import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.ts";
import { parseManualData } from "./manual-data.ts";
import { PrismaOfferRepository } from "./repositories.ts";
import { seedManualData } from "./seed.ts";
import { startTestDatabase } from "./test-database.ts";

let db: PrismaClient;
let stop: () => Promise<void>;

beforeAll(async () => {
  ({ db, stop } = await startTestDatabase());
}, 180_000);

afterAll(async () => {
  await stop?.();
});

const entry = (providerId: string, status: string, fxMarkup: string) => ({
  providerId,
  corridorId: "CHF-EUR",
  status,
  sourceKind: "rule_based",
  feeMode: "deducted",
  fixedFee: "0",
  percentFee: "0",
  fxMarkup,
  sourceUrl: "https://example.test",
  checkedAt: "2026-11-05T17:30:00Z",
});

const data = parseManualData({
  providers: [
    { id: "yuh", name: "Yuh", kind: "fintech", website: "https://www.yuh.com" },
    { id: "wise", name: "Wise", kind: "fintech", website: "https://wise.com" },
    { id: "postfinance", name: "PostFinance", kind: "bank", website: "https://www.postfinance.ch" },
  ],
  corridors: [{ id: "CHF-EUR", sourceCurrency: "CHF", targetCurrency: "EUR" }],
  midRates: [
    {
      base: "CHF",
      quote: "EUR",
      rate: "1.0893",
      source: "ecb",
      asOf: "2026-11-05",
      fetchedAt: "2026-11-05T17:29:37Z",
      sourceUrl: "https://api.frankfurter.dev/v2/rates",
    },
  ],
  feeSchedules: [
    entry("yuh", "verified", "0.0095"),
    entry("wise", "draft", "0"),
    {
      ...entry("postfinance", "needs_input", "0"),
      sourceKind: "manual",
      providerRate: null,
      rateCapturedAt: null,
    },
  ],
});

describe("seedManualData", () => {
  it("loads only verified fee schedules by default", async () => {
    const result = await seedManualData(db, data);
    expect(result).toEqual({
      providers: 3,
      corridors: 1,
      midRates: 1,
      feeSchedules: 1,
      skippedNotVerified: 2,
    });
    const offers = await new PrismaOfferRepository(db).latestOffers("CHF", "EUR");
    expect(offers.map((o) => o.providerId)).toEqual(["yuh"]);
  });

  it("is idempotent: a second run inserts nothing", async () => {
    const result = await seedManualData(db, data);
    expect(result.providers + result.corridors + result.midRates + result.feeSchedules).toBe(0);
  });

  it("refuses a changed entry that kept the same checkedAt, instead of silently skipping it", async () => {
    const edited = parseManualData({
      ...data,
      feeSchedules: [entry("yuh", "verified", "0.0090")],
    });
    await expect(seedManualData(db, edited)).rejects.toThrow(/different fxMarkup/);
  });

  it("refuses a changed mid rate for an already stored day", async () => {
    const edited = parseManualData({
      ...data,
      midRates: [{ ...data.midRates[0], rate: "1.0900" }],
      feeSchedules: [],
    });
    await expect(seedManualData(db, edited)).rejects.toThrow(/Stored rates can't be changed/);
  });

  it("refuses a stored corridor whose currencies changed, instead of silently skipping it", async () => {
    const edited = parseManualData({
      ...data,
      corridors: [{ id: "CHF-EUR", sourceCurrency: "EUR", targetCurrency: "CHF" }],
      feeSchedules: [],
    });
    await expect(seedManualData(db, edited)).rejects.toThrow(/Corridor CHF-EUR is CHF→EUR/);
  });

  it("stores nothing when it stops on a conflict (the tables are append-only, so no clean-up is possible)", async () => {
    // A new day's rate (would be inserted) comes before a conflicting fee schedule (stops the seed).
    const newRate = { ...data.midRates[0], asOf: "2026-11-06", rate: "1.0937" };
    const edited = parseManualData({
      ...data,
      midRates: [...data.midRates, newRate],
      feeSchedules: [entry("yuh", "verified", "0.0090")],
    });
    await expect(seedManualData(db, edited)).rejects.toThrow(/different fxMarkup/);
    expect(await db.midMarketRate.count({ where: { asOf: new Date("2026-11-06") } })).toBe(0);
  });

  it("adds drafts only when asked (local preview), never needs_input", async () => {
    const result = await seedManualData(db, data, { includeDrafts: true });
    expect(result.feeSchedules).toBe(1);
    const offers = await new PrismaOfferRepository(db).latestOffers("CHF", "EUR");
    expect(offers.map((o) => o.providerId).sort()).toEqual(["wise", "yuh"]);
  });
});

// The files keep every stored entry (the seed refuses a missing one, stage 5b), plus `extra`.
const seedWith = (...extra: Record<string, unknown>[]) =>
  seedManualData(db, parseManualData({ ...data, feeSchedules: [...data.feeSchedules, ...extra] }));

// A stored row with both limits (EUR is the target of CHF-EUR), then the same row edited.
const withLimits = {
  ...entry("yuh", "verified", "0"),
  checkedAt: "2026-11-05T18:00:00Z",
  maxAmount: "4700",
  markupTier: { upTo: "1250", markupAbove: "0.01", currency: "EUR" },
};

describe("limits are history too (stage 5a)", () => {
  it("refuses a changed maximum amount or tier currency on a stored row", async () => {
    expect((await seedWith(withLimits)).feeSchedules).toBe(1);
    await expect(seedWith({ ...withLimits, maxAmount: "5000" })).rejects.toThrow(
      /different maxAmount/,
    );
    await expect(
      seedWith({ ...withLimits, markupTier: { ...withLimits.markupTier, currency: "CHF" } }),
    ).rejects.toThrow(/different fxMarkupTierCurrency/);
    // Unchanged: nothing to do.
    expect((await seedWith(withLimits)).feeSchedules).toBe(0);
  });
});

describe("withdrawals (stage 5b)", () => {
  // After yuh's newest price (withLimits, 2026-11-05 18:00).
  const withdrawal = {
    providerId: "yuh",
    corridorId: "CHF-EUR",
    status: "verified",
    withdrawn: true,
    sourceUrl: "https://example.test/yuh-news",
    checkedAt: "2026-11-06T09:00:00Z",
    note: "Transfers to euro accounts stopped",
  };
  const offerIds = async () =>
    (await new PrismaOfferRepository(db).latestOffers("CHF", "EUR")).map((o) => o.providerId);

  it("stores a withdrawal, and the provider leaves the comparison", async () => {
    expect(await offerIds()).toContain("yuh");
    expect((await seedWith(withLimits, withdrawal)).feeSchedules).toBe(1);
    expect(await offerIds()).not.toContain("yuh");
    // Repeated: nothing new.
    expect((await seedWith(withLimits, withdrawal)).feeSchedules).toBe(0);
  });

  it("refuses an edited withdrawal (its reason is history too)", async () => {
    await expect(seedWith(withLimits, { ...withdrawal, note: "Other reason" })).rejects.toThrow(
      /different note/,
    );
  });

  it("refuses a stored entry deleted from the files, and stores nothing", async () => {
    // withLimits is left out; a new reference rate in the same run must not be stored.
    const newRate = { ...data.midRates[0], asOf: "2026-11-07", rate: "1.0950" };
    const edited = parseManualData({
      ...data,
      midRates: [...data.midRates, newRate],
      feeSchedules: [...data.feeSchedules, withdrawal],
    });
    await expect(seedManualData(db, edited)).rejects.toThrow(
      /yuh CHF-EUR checked at 2026-11-05T18:00:00.000Z is stored but no longer in fee-schedules.json/,
    );
    expect(await db.midMarketRate.count({ where: { asOf: new Date("2026-11-07") } })).toBe(0);
  });
});
