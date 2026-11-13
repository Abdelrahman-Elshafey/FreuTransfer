// The real files in data/manual/, seeded into a fresh database the way a deploy does it. The
// loader's checks are looser than the database's (a markup of "1.5" passes the loader; the CHECK
// constraint refuses it), so without this test a bad value would pass CI and stop the seed in
// production, after the migrations have already run.
import { fileURLToPath } from "node:url";
import type { CurrencyCode } from "@freu-transfer/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.ts";
import { loadManualData, type ManualData } from "./manual-data.ts";
import { PrismaOfferRepository } from "./repositories.ts";
import { seedManualData } from "./seed.ts";
import { startTestDatabase } from "./test-database.ts";

const repoDataDir = fileURLToPath(new URL("../../../data/manual/", import.meta.url));

let db: PrismaClient;
let stop: () => Promise<void>;
let data: ManualData;

beforeAll(async () => {
  ({ db, stop } = await startTestDatabase());
  data = await loadManualData(repoDataDir);
}, 180_000);

afterAll(async () => {
  await stop?.();
});

describe("data/manual on a fresh database", () => {
  it("stores every verified entry; a second run stores nothing", async () => {
    const verified = data.feeSchedules.filter((fs) => fs.status === "verified");
    expect(verified.length).toBeGreaterThan(0);
    const first = await seedManualData(db, data);
    expect(first.feeSchedules).toBe(verified.length);
    expect(first.midRates).toBe(data.midRates.length);
    const second = await seedManualData(db, data);
    expect(second.feeSchedules + second.midRates + second.corridors + second.providers).toBe(0);
  });

  it("offers, per corridor, exactly the providers whose newest verified entry is a price", async () => {
    for (const corridor of data.corridors) {
      // The newest verified entry per provider: later entries overwrite earlier ones.
      const newest = new Map<string, (typeof data.feeSchedules)[number]>();
      const entries = data.feeSchedules
        .filter((fs) => fs.corridorId === corridor.id && fs.status === "verified")
        .sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt));
      for (const fs of entries) newest.set(fs.providerId, fs);
      const expected = [...newest.values()]
        .filter((fs) => fs.withdrawn !== true)
        .map((fs) => fs.providerId)
        .sort();

      const offers = await new PrismaOfferRepository(db).latestOffers(
        corridor.sourceCurrency as CurrencyCode,
        corridor.targetCurrency as CurrencyCode,
      );
      expect(offers.map((o) => o.providerId).sort()).toEqual(expected);
    }
  });
});
