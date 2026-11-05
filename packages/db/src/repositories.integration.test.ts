import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.ts";
import { PrismaMidRateRepository, PrismaOfferRepository } from "./repositories.ts";
import { startTestDatabase } from "./test-database.ts";

let db: PrismaClient;
let stop: () => Promise<void>;

beforeAll(async () => {
  ({ db, stop } = await startTestDatabase());

  await db.provider.createMany({
    data: [
      {
        id: "postfinance",
        name: "PostFinance",
        kind: "bank",
        website: "https://www.postfinance.ch",
      },
      { id: "yuh", name: "Yuh", kind: "fintech", website: "https://www.yuh.com" },
      { id: "revolut", name: "Revolut", kind: "fintech", website: "https://www.revolut.com" },
    ],
  });
  await db.corridor.createMany({
    data: [
      { id: "CHF-EUR", sourceCurrency: "CHF", targetCurrency: "EUR" },
      { id: "CHF-GBP", sourceCurrency: "CHF", targetCurrency: "GBP" },
    ],
  });
  await db.feeSchedule.createMany({
    data: [
      {
        providerId: "revolut",
        corridorId: "CHF-EUR",
        sourceKind: "rule_based",
        feeMode: "deducted",
        fxMarkup: "0",
        fxMarkupTierUpTo: "1250",
        fxMarkupAbove: "0.01",
        sourceUrl: "https://example.test/revolut",
        checkedAt: new Date("2026-11-03T10:00:00Z"),
      },
      // Yuh: an older row, then a correction. Only the newer one may be returned.
      {
        providerId: "yuh",
        corridorId: "CHF-EUR",
        sourceKind: "rule_based",
        feeMode: "deducted",
        fxMarkup: "0.0100",
        sourceUrl: "https://example.test/yuh-old",
        checkedAt: new Date("2026-10-01T10:00:00Z"),
      },
      {
        providerId: "yuh",
        corridorId: "CHF-EUR",
        sourceKind: "rule_based",
        feeMode: "deducted",
        fxMarkup: "0.0095",
        sourceUrl: "https://example.test/yuh",
        checkedAt: new Date("2026-11-03T10:00:00Z"),
      },
      {
        providerId: "postfinance",
        corridorId: "CHF-EUR",
        sourceKind: "manual",
        feeMode: "deducted",
        fixedFee: "0",
        providerRate: "1.0512",
        rateCapturedAt: new Date("2026-11-04T09:30:00Z"),
        sourceUrl: "https://example.test/postfinance",
        checkedAt: new Date("2026-11-04T09:30:00Z"),
        note: "Devisen rate, amount tier up to 10,000",
      },
      // Another corridor: must not leak into CHF→EUR results.
      {
        providerId: "yuh",
        corridorId: "CHF-GBP",
        sourceKind: "rule_based",
        feeMode: "deducted",
        fxMarkup: "0.0095",
        sourceUrl: "https://example.test/yuh-gbp",
        checkedAt: new Date("2026-11-03T10:00:00Z"),
      },
    ],
  });
  await db.midMarketRate.createMany({
    data: [
      {
        base: "CHF",
        quote: "EUR",
        rate: "1.0700",
        source: "ecb",
        asOf: new Date("2026-11-03"),
        fetchedAt: new Date("2026-11-03T15:30:00Z"),
      },
      {
        base: "CHF",
        quote: "EUR",
        rate: "1.0712",
        source: "ecb",
        asOf: new Date("2026-11-04"),
        fetchedAt: new Date("2026-11-04T15:30:00Z"),
      },
    ],
  });
}, 180_000);

afterAll(async () => {
  await stop?.();
});

describe("PrismaOfferRepository", () => {
  it("returns the newest offer per provider for the corridor, as core types", async () => {
    const offers = await new PrismaOfferRepository(db).latestOffers("CHF", "EUR");
    expect(offers.map((o) => o.providerId).sort()).toEqual(["postfinance", "revolut", "yuh"]);

    const revolut = offers.find((o) => o.providerId === "revolut");
    const tier = revolut?.pricing.kind === "markup" ? revolut.pricing.tier : undefined;
    expect(tier?.upTo.toString()).toBe("1250.00 CHF");
    expect(tier?.markupAbove.toString()).toBe("0.01");

    const yuh = offers.find((o) => o.providerId === "yuh");
    expect(yuh?.pricing).toMatchObject({ kind: "markup" });
    expect(yuh?.pricing.kind === "markup" && yuh.pricing.markup.toString()).toBe("0.0095");
    expect(yuh?.sourceUrl).toBe("https://example.test/yuh");

    const pf = offers.find((o) => o.providerId === "postfinance");
    expect(pf?.sourceKind).toBe("manual");
    expect(pf?.sourceCurrency).toBe("CHF");
    expect(pf?.pricing.kind === "rate" && pf.pricing.rate.toString()).toBe("1 CHF = 1.0512 EUR");
    expect(pf?.fees.kind).toBe("deducted");
  });

  it("returns nothing for a corridor without data", async () => {
    expect(await new PrismaOfferRepository(db).latestOffers("CHF", "EGP")).toEqual([]);
  });
});

describe("PrismaMidRateRepository", () => {
  it("returns the newest reference rate with its date", async () => {
    const mid = await new PrismaMidRateRepository(db).latest("CHF", "EUR");
    expect(mid?.rate.value.toString()).toBe("1.0712");
    expect(mid?.asOf).toBe("2026-11-04");
    expect(mid?.source).toBe("ecb");
  });

  it("returns the newest rate on or before a given day", async () => {
    const repo = new PrismaMidRateRepository(db);
    expect((await repo.latest("CHF", "EUR", "2026-11-03"))?.rate.value.toString()).toBe("1.07");
    expect((await repo.latest("CHF", "EUR", "2026-11-10"))?.asOf).toBe("2026-11-04");
    expect(await repo.latest("CHF", "EUR", "2026-01-01")).toBeNull();
  });

  it("returns null when no rate is stored", async () => {
    expect(await new PrismaMidRateRepository(db).latest("CHF", "RSD")).toBeNull();
  });
});

describe("database rules", () => {
  it("refuses UPDATE and DELETE on append-only tables", async () => {
    await expect(
      db.midMarketRate.updateMany({ where: { base: "CHF" }, data: { rate: "2" } }),
    ).rejects.toThrow(/append-only/);
    await expect(db.feeSchedule.deleteMany({})).rejects.toThrow(/append-only/);
  });

  it("refuses a rule-based fee schedule without a markup", async () => {
    await expect(
      db.feeSchedule.create({
        data: {
          providerId: "yuh",
          corridorId: "CHF-EUR",
          sourceKind: "rule_based",
          feeMode: "deducted",
          sourceUrl: "https://example.test",
          checkedAt: new Date(),
        },
      }),
    ).rejects.toThrow(/fee_schedules_pricing_check/);
  });

  it("refuses a half-filled markup tier", async () => {
    await expect(
      db.feeSchedule.create({
        data: {
          providerId: "revolut",
          corridorId: "CHF-EUR",
          sourceKind: "rule_based",
          feeMode: "deducted",
          fxMarkup: "0",
          fxMarkupTierUpTo: "1250",
          sourceUrl: "https://example.test",
          checkedAt: new Date(),
        },
      }),
    ).rejects.toThrow(/fee_schedules_markup_tier_check/);
  });

  it("refuses negative fees", async () => {
    await expect(
      db.feeSchedule.create({
        data: {
          providerId: "yuh",
          corridorId: "CHF-EUR",
          sourceKind: "rule_based",
          feeMode: "deducted",
          fixedFee: "-1",
          fxMarkup: "0.01",
          sourceUrl: "https://example.test",
          checkedAt: new Date(),
        },
      }),
    ).rejects.toThrow(/fee_schedules_amounts_check/);
  });
});
