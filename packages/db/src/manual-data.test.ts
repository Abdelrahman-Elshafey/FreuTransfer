import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadManualData, parseManualData } from "./manual-data.ts";

const repoDataDir = fileURLToPath(new URL("../../../data/manual/", import.meta.url));

const valid = () => ({
  providers: [{ id: "yuh", name: "Yuh", kind: "fintech", website: "https://www.yuh.com" }],
  corridors: [{ id: "CHF-EUR", sourceCurrency: "CHF", targetCurrency: "EUR" }],
  midRates: [],
  feeSchedules: [
    {
      providerId: "yuh",
      corridorId: "CHF-EUR",
      status: "verified",
      sourceKind: "rule_based",
      feeMode: "deducted",
      fixedFee: "0",
      percentFee: "0",
      fxMarkup: "0.0095",
      sourceUrl: "https://www.yuh.com/en/pricing/",
      checkedAt: "2026-11-05T17:30:00Z",
    } as Record<string, unknown>,
  ],
});

describe("manual data files", () => {
  it("the files in data/manual/ are valid", async () => {
    const data = await loadManualData(repoDataDir);
    expect(data.providers.length).toBeGreaterThan(0);
    expect(data.midRates[0]?.rate).toBe("1.0893");
  });

  it("accepts a valid entry", () => {
    expect(() => parseManualData(valid())).not.toThrow();
  });

  it("rejects money written as a JSON number", () => {
    const data = valid();
    (data.feeSchedules[0] as Record<string, unknown>).fxMarkup = 0.0095;
    expect(() => parseManualData(data)).toThrow();
  });

  it("rejects a fee schedule for an unknown provider", () => {
    const data = valid();
    (data.feeSchedules[0] as Record<string, unknown>).providerId = "nobody";
    expect(() => parseManualData(data)).toThrow(/Unknown provider/);
  });

  it("requires needs_input for a manual entry without a rate", () => {
    const data = valid();
    data.feeSchedules[0] = {
      ...data.feeSchedules[0],
      sourceKind: "manual",
      fxMarkup: undefined,
      providerRate: null,
      rateCapturedAt: null,
    };
    expect(() => parseManualData(data)).toThrow(/needs_input/);
    (data.feeSchedules[0] as Record<string, unknown>).status = "needs_input";
    expect(() => parseManualData(data)).not.toThrow();
  });
});
