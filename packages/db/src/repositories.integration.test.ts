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

  it("refuses TRUNCATE on every append-only table (it fires no row trigger)", async () => {
    const before = await db.feeSchedule.count();
    await expect(db.$executeRaw`TRUNCATE mid_market_rates`).rejects.toThrow(
      /mid_market_rates is append-only: TRUNCATE/,
    );
    await expect(db.$executeRaw`TRUNCATE fee_schedules`).rejects.toThrow(
      /fee_schedules is append-only: TRUNCATE/,
    );
    // These two are referenced by foreign keys, so a plain TRUNCATE is already refused; CASCADE
    // would empty the tables that point at them too. The triggers must stop that as well.
    await expect(db.$executeRaw`TRUNCATE raw_observations CASCADE`).rejects.toThrow(
      /is append-only: TRUNCATE/,
    );
    await expect(db.$executeRaw`TRUNCATE collector_runs CASCADE`).rejects.toThrow(
      /is append-only: TRUNCATE/,
    );
    expect(await db.feeSchedule.count()).toBe(before);
  });

  it("refuses a second fee schedule for the same corridor, provider and check time", async () => {
    // Same key as the newer Yuh row of beforeAll (CHF-EUR, yuh, 2026-11-03 10:00Z), other markup.
    await expect(
      db.feeSchedule.create({
        data: {
          providerId: "yuh",
          corridorId: "CHF-EUR",
          sourceKind: "rule_based",
          feeMode: "deducted",
          fxMarkup: "0.02",
          sourceUrl: "https://example.test/yuh-again",
          checkedAt: new Date("2026-11-03T10:00:00Z"),
        },
      }),
    ).rejects.toThrow(/Unique constraint/);
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

/**
 * The database's own reason for refusing a write. For a single-row update or delete, Prisma
 * reports a trigger's error code (restrict_violation) as "Foreign key constraint violated" and
 * keeps the trigger's message only in `meta.driverAdapterError.cause`.
 */
async function refusal(write: Promise<unknown>): Promise<string> {
  try {
    await write;
  } catch (error) {
    const meta = (
      error as { meta?: { driverAdapterError?: { cause?: { originalMessage?: string } } } }
    ).meta;
    return meta?.driverAdapterError?.cause?.originalMessage ?? String(error);
  }
  throw new Error("expected the database to refuse this write");
}

describe("collector pipeline rules (stage 4)", () => {
  const startedAt = new Date("2026-11-12T15:30:00Z");
  const finishedAt = new Date("2026-11-12T15:30:05Z");
  const startRun = () => db.collectorRun.create({ data: { collector: "frankfurter", startedAt } });

  it("finishes a run exactly once, and never deletes one", async () => {
    const run = await startRun();
    expect(run.status).toBe("running");

    const finished = await db.collectorRun.update({
      where: { id: run.id },
      data: { status: "succeeded", finishedAt },
    });
    expect(finished.status).toBe("succeeded");

    expect(
      await refusal(
        db.collectorRun.update({
          where: { id: run.id },
          data: { status: "failed", error: "rewritten later" },
        }),
      ),
    ).toBe(`Collector run ${run.id} is already finished`);
    expect(await refusal(db.collectorRun.delete({ where: { id: run.id } }))).toBe(
      "Table collector_runs is append-only: DELETE is not allowed",
    );
  });

  it("keeps who and when of a running run fixed", async () => {
    const run = await startRun();
    expect(
      await refusal(
        db.collectorRun.update({ where: { id: run.id }, data: { collector: "other" } }),
      ),
    ).toBe("Only status, finished_at and error of a running collector run may change");
  });

  it.each([
    ["succeeded without a finish time", { status: "succeeded" as const }],
    ["failed without a reason", { status: "failed" as const, finishedAt }],
    ["failed with an empty reason", { status: "failed" as const, finishedAt, error: "" }],
    ["succeeded with an error", { status: "succeeded" as const, finishedAt, error: "x" }],
  ])("refuses a run %s", async (_name, data) => {
    const run = await startRun();
    await expect(db.collectorRun.update({ where: { id: run.id }, data })).rejects.toThrow(
      /collector_runs_state_check/,
    );
  });

  it("refuses a run that finishes before it started", async () => {
    const run = await startRun();
    await expect(
      db.collectorRun.update({
        where: { id: run.id },
        data: { status: "succeeded", finishedAt: new Date("2026-11-12T15:29:59Z") },
      }),
    ).rejects.toThrow(/collector_runs_times_check/);
  });

  it("stores a raw response only for an existing run, and never changes or deletes it", async () => {
    await expect(
      db.rawObservation.create({
        data: {
          runId: 999_999n,
          url: "https://x.test",
          httpStatus: 200,
          body: "[]",
          fetchedAt: finishedAt,
        },
      }),
    ).rejects.toThrow(/raw_observations_run_id_fkey/);

    const run = await startRun();
    const raw = await db.rawObservation.create({
      data: {
        runId: run.id,
        url: "https://x.test",
        httpStatus: 200,
        body: "[]",
        fetchedAt: finishedAt,
      },
    });
    expect(
      await refusal(db.rawObservation.update({ where: { id: raw.id }, data: { body: "[1]" } })),
    ).toBe("Table raw_observations is append-only: UPDATE is not allowed");
    expect(await refusal(db.rawObservation.delete({ where: { id: raw.id } }))).toBe(
      "Table raw_observations is append-only: DELETE is not allowed",
    );
  });

  it("links a parsed rate to the exact response it came from", async () => {
    const run = await startRun();
    // The body as Frankfurter sends it: the rate is a JSON number, stored here as text.
    const body = '[{"date":"2026-11-12","base":"CHF","quote":"EUR","rate":1.0832}]';
    const raw = await db.rawObservation.create({
      data: { runId: run.id, url: "https://x.test", httpStatus: 200, body, fetchedAt: finishedAt },
    });
    const rate = await db.midMarketRate.create({
      data: {
        base: "CHF",
        quote: "EUR",
        rate: "1.0832",
        source: "ecb",
        asOf: new Date("2026-11-12"),
        fetchedAt: finishedAt,
        rawObservationId: raw.id,
      },
      include: { rawObservation: true },
    });
    expect(rate.rawObservation?.body).toBe(body);
    expect(rate.rawObservation?.runId).toBe(run.id);
  });
});
