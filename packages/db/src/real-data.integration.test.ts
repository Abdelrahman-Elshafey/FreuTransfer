// The real files in data/manual/, seeded into a fresh database the way a deploy does it. The
// loader's checks are looser than the database's (a markup of "1.5" passes the loader; the CHECK
// constraint refuses it), so without this test a bad value would pass CI and stop the seed in
// production, after the migrations have already run.
import { fileURLToPath } from "node:url";
import { type CurrencyCode, compareProviders, Decimal, Money } from "@freu-transfer/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.ts";
import { type FeeScheduleEntry, loadManualData, type ManualData } from "./manual-data.ts";
import { PrismaMidRateRepository, PrismaOfferRepository } from "./repositories.ts";
import { seedManualData } from "./seed.ts";
import { startTestDatabase } from "./test-database.ts";

const repoDataDir = fileURLToPath(new URL("../../../data/manual/", import.meta.url));

let db: PrismaClient;
let stop: () => Promise<void>;
let data: ManualData;

beforeAll(async () => {
  ({ db, stop } = await startTestDatabase());
  data = await loadManualData(repoDataDir);
  await seedManualData(db, data);
}, 180_000);

afterAll(async () => {
  await stop?.();
});

/** Per provider, its newest verified entry for a corridor: what the site shows (or withdraws). */
function newestVerified(corridorId: string): FeeScheduleEntry[] {
  const newest = new Map<string, FeeScheduleEntry>();
  const entries = data.feeSchedules
    .filter((fs) => fs.corridorId === corridorId && fs.status === "verified")
    .sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt));
  for (const fs of entries) newest.set(fs.providerId, fs); // later entries overwrite earlier ones
  return [...newest.values()];
}

const pair = (corridorId: string) => {
  const corridor = data.corridors.find((c) => c.id === corridorId);
  if (!corridor) throw new Error(`No corridor ${corridorId} in corridors.json`);
  return [
    corridor.sourceCurrency as CurrencyCode,
    corridor.targetCurrency as CurrencyCode,
  ] as const;
};

describe("data/manual on a fresh database", () => {
  it("stored every verified entry; a second run stores nothing", async () => {
    const verified = data.feeSchedules.filter((fs) => fs.status === "verified");
    expect(verified.length).toBeGreaterThan(0);
    expect(await db.feeSchedule.count()).toBe(verified.length);
    expect(await db.midMarketRate.count()).toBe(data.midRates.length);
    const second = await seedManualData(db, data);
    expect(second.feeSchedules + second.midRates + second.corridors + second.providers).toBe(0);
  });

  it("offers, per corridor, exactly the providers whose newest verified entry is a price", async () => {
    for (const corridor of data.corridors) {
      const expected = newestVerified(corridor.id)
        .filter((fs) => fs.withdrawn !== true)
        .map((fs) => fs.providerId)
        .sort();
      const offers = await new PrismaOfferRepository(db).latestOffers(...pair(corridor.id));
      expect(offers.map((o) => o.providerId).sort()).toEqual(expected);
    }
  });

  // Stage 5's "done when": no negative hidden costs. Every real offer, at the sample amounts of
  // Project Plan §4, in both directions, costs between 0% and 10% (the sanity guard's range). The
  // only offers left out are those above a provider's own limit (Western Union online: 4,700 CHF).
  it.each(
    ["CHF-EUR", "EUR-CHF"].flatMap((corridor) =>
      ["100", "500", "1000", "2500", "5000"].map((amount) => [corridor, amount] as const),
    ),
  )("%s, %s: every offer is plausible (0% to 10%)", async (corridor, amount) => {
    const [source, target] = pair(corridor);
    const result = await compareProviders(
      { offers: new PrismaOfferRepository(db), midRates: new PrismaMidRateRepository(db) },
      { amount: Money.of(amount, source), target, now: new Date() },
    );
    const rows = [...result.ranked, ...result.stale];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.cost.totalCost.isNegative(), row.offer.providerId).toBe(false);
      expect(row.cost.totalCostPct.lte("0.10"), row.offer.providerId).toBe(true);
    }
    const overLimit = newestVerified(corridor).flatMap((fs) =>
      "maxAmount" in fs && fs.maxAmount !== undefined && new Decimal(amount).gt(fs.maxAmount)
        ? [`${fs.providerId}: amount_not_supported`]
        : [],
    );
    expect(result.unavailable.map((u) => `${u.offer.providerId}: ${u.reason}`).sort()).toEqual(
      overLimit.sort(),
    );
  });

  /** The comparison of one amount, through the real repositories (as the API does it). */
  const compare = (corridor: string, amount: string) => {
    const [source, target] = pair(corridor);
    return compareProviders(
      { offers: new PrismaOfferRepository(db), midRates: new PrismaMidRateRepository(db) },
      { amount: Money.of(amount, source), target, now: new Date() },
    );
  };

  // The values in the files, not only the formulas (the golden tests in core): each reading the
  // owner took from a provider's own calculator comes out to the cent from the stored entry. Wise's
  // amount received depends on the day's rate, so only its fee is compared; Western Union's rate
  // is stored, so the amount received is.
  it.each([
    // Wise calculator, 2026-11-05 21:18 and 2026-11-13 08:56–09:22. 1.21 CHF + 0.23% on top:
    //   converted = (total − 1.21) / 1.0023, fee = total − converted
    //     100: 98.79 / 1.0023 = 98.563304…     → fee 1.436696…  → 1.44
    //   1,000: 998.79 / 1.0023 = 996.498054…   → fee 3.501945…  → 3.50
    //   5,000: 4998.79 / 1.0023 = 4987.319166… → fee 12.680834… → 12.68
    ["wise", "CHF-EUR", "100", "fee", "1.44 CHF"],
    ["wise", "CHF-EUR", "1000", "fee", "3.50 CHF"],
    ["wise", "CHF-EUR", "5000", "fee", "12.68 CHF"],
    // Wise calculator, 2026-11-13 08:44–08:55. 1.69 EUR + 0.4301% on top (derived from these
    // three readings; 0.43% would give 23.09 at 5,000):
    //     100: 98.31 / 1.004301 = 97.888979…     → fee 2.111021…  → 2.11
    //   1,000: 998.31 / 1.004301 = 994.034657…   → fee 5.965343…  → 5.97
    //   5,000: 4998.31 / 1.004301 = 4976.904334… → fee 23.095666… → 23.10
    ["wise", "EUR-CHF", "100", "fee", "2.11 EUR"],
    ["wise", "EUR-CHF", "1000", "fee", "5.97 EUR"],
    ["wise", "EUR-CHF", "5000", "fee", "23.10 EUR"],
    // Western Union calculator, 2026-11-13 09:25. No fee; the shown rate 1.0540 is rounded:
    //     100 × 1.054014 = 105.4014  → 105.40
    //   1,000 × 1.054014 = 1054.014  → 1054.01   (1.0540 would give 1054.00)
    //   4,700 × 1.054014 = 4953.8658 → 4953.87   (1.0540 would give 4953.80)
    ["western-union", "CHF-EUR", "100", "received", "105.40 EUR"],
    ["western-union", "CHF-EUR", "1000", "received", "1054.01 EUR"],
    ["western-union", "CHF-EUR", "4700", "received", "4953.87 EUR"],
  ])(
    "%s %s %s: %s %s, as on the provider's calculator",
    async (id, corridor, amount, what, expected) => {
      const row = [...(await compare(corridor, amount)).ranked].find(
        (r) => r.offer.providerId === id,
      );
      const value = what === "fee" ? row?.quote.visibleFee : row?.quote.received;
      expect(value?.toString()).toBe(expected);
    },
  );

  it('Western Union: up to 4,700 CHF online (its calculator: "Send up to 4,700.00 CHF")', async () => {
    const reasons = async (amount: string) =>
      (await compare("CHF-EUR", amount)).unavailable
        .filter((u) => u.offer.providerId === "western-union")
        .map((u) => u.reason);
    expect(await reasons("4700")).toEqual([]);
    expect(await reasons("4700.01")).toEqual(["amount_not_supported"]);
  });
});
