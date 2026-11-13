import { type MidRateObservation, Rate } from "@freu-transfer/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.ts";
import { PrismaCollectorStore, PrismaCorridorRepository } from "./collector-store.ts";
import { startTestDatabase } from "./test-database.ts";

let db: PrismaClient;
let stop: () => Promise<void>;
let store: PrismaCollectorStore;

beforeAll(async () => {
  ({ db, stop } = await startTestDatabase());
  store = new PrismaCollectorStore(db);
  await db.corridor.createMany({
    data: [
      { id: "CHF-EUR", sourceCurrency: "CHF", targetCurrency: "EUR" },
      { id: "EUR-CHF", sourceCurrency: "EUR", targetCurrency: "CHF" },
    ],
  });
}, 180_000);

afterAll(async () => {
  await stop?.();
});

const fetchedAt = new Date("2026-11-12T16:30:01Z");
const ecb = (asOf: string, rate: string): MidRateObservation => ({
  rate: Rate.of("CHF", "EUR", rate),
  source: "ecb",
  asOf,
  fetchedAt,
});

/** A run with one raw response, as the collector creates them. */
async function runWithRaw() {
  const run = await store.startRun("frankfurter", new Date("2026-11-12T16:30:00Z"));
  const raw = await store.saveRaw(run, {
    url: "https://api.frankfurter.dev/v2/rates?base=CHF&quotes=EUR&providers=ECB",
    httpStatus: 200,
    body: "[]",
    fetchedAt,
  });
  return { run, raw };
}

describe("PrismaCollectorStore", () => {
  it("records a run from start to finish, succeeded or failed with its reason", async () => {
    const ok = await store.startRun("frankfurter", new Date("2026-11-12T16:30:00Z"));
    await store.finishRun(ok, new Date("2026-11-12T16:30:02Z"));
    const failed = await store.startRun("frankfurter", new Date("2026-11-12T17:30:00Z"));
    await store.finishRun(failed, new Date("2026-11-12T17:30:02Z"), "CHF→EUR: HTTP 503");

    const rows = await db.collectorRun.findMany({
      where: { id: { in: [ok, failed] } },
      orderBy: { id: "asc" },
    });
    expect(rows.map((r) => [r.status, r.error, r.finishedAt?.toISOString()])).toEqual([
      ["succeeded", null, "2026-11-12T16:30:02.000Z"],
      ["failed", "CHF→EUR: HTTP 503", "2026-11-12T17:30:02.000Z"],
    ]);
  });

  it("stores new days exactly, linked to their raw response", async () => {
    const { raw } = await runWithRaw();
    const result = await store.saveMidRates(raw, [
      ecb("2026-11-11", "1.083"),
      ecb("2026-11-12", "1.0832"),
    ]);

    expect(result).toEqual({ stored: 2, unchanged: 0, conflicts: [] });
    const rows = await db.midMarketRate.findMany({
      where: { rawObservationId: raw },
      orderBy: { asOf: "asc" },
    });
    expect(rows.map((r) => [r.asOf.toISOString().slice(0, 10), r.rate.toString()])).toEqual([
      ["2026-11-11", "1.083"],
      ["2026-11-12", "1.0832"],
    ]);
  });

  it("skips days already stored with the same value (a repeated run)", async () => {
    const { raw } = await runWithRaw();
    // 1.0832 and 1.08320 are the same number: stored as NUMERIC(20,10) either way.
    const result = await store.saveMidRates(raw, [ecb("2026-11-12", "1.08320")]);
    expect(result).toEqual({ stored: 0, unchanged: 1, conflicts: [] });
    expect(await db.midMarketRate.count({ where: { asOf: new Date("2026-11-12") } })).toBe(1);
  });

  it("never overwrites a stored day with a different value, and reports it", async () => {
    const { raw } = await runWithRaw();
    const result = await store.saveMidRates(raw, [
      ecb("2026-11-10", "1.0866"), // new
      ecb("2026-11-12", "1.0899"), // stored as 1.0832
    ]);

    expect(result.stored).toBe(1);
    expect(result.conflicts).toEqual([
      {
        base: "CHF",
        quote: "EUR",
        source: "ecb",
        asOf: "2026-11-12",
        stored: "1.0832",
        received: "1.0899",
      },
    ]);
    const kept = await db.midMarketRate.findFirst({ where: { asOf: new Date("2026-11-12") } });
    expect(kept?.rate.toString()).toBe("1.0832");
  });

  it("keeps the same day from different sources apart", async () => {
    const { raw } = await runWithRaw();
    const result = await store.saveMidRates(raw, [
      { ...ecb("2026-11-12", "1.0833"), source: "snb" },
    ]);
    expect(result).toEqual({ stored: 1, unchanged: 0, conflicts: [] });
  });
});

describe("PrismaCorridorRepository", () => {
  it("lists every corridor as a currency pair", async () => {
    expect(await new PrismaCorridorRepository(db).all()).toEqual([
      { source: "CHF", target: "EUR" },
      { source: "EUR", target: "CHF" },
    ]);
  });
});
