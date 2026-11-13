import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadManualData, parseManualData } from "./manual-data.ts";

const repoDataDir = fileURLToPath(new URL("../../../data/manual/", import.meta.url));

const valid = () => ({
  providers: [{ id: "yuh", name: "Yuh", kind: "fintech", website: "https://www.yuh.com" }],
  corridors: [{ id: "CHF-EUR", sourceCurrency: "CHF", targetCurrency: "EUR" }],
  midRates: [] as Record<string, unknown>[],
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

  it("rejects a currency the core engine doesn't support", () => {
    const data = valid();
    data.corridors[0] = { id: "CHF-USD", sourceCurrency: "CHF", targetCurrency: "USD" };
    expect(() => parseManualData(data)).toThrow(/unsupported currency/);
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

  // The database stores NUMERIC(20,10). Postgres would silently round an 11th decimal, and the
  // next seed would then report a changed history row (file "…05341" ≠ stored "…0534").
  it("rejects more decimals or digits than the database stores", () => {
    const entry = (field: string, value: string) => {
      const data = valid();
      (data.feeSchedules[0] as Record<string, unknown>)[field] = value;
      return data;
    };
    expect(() => parseManualData(entry("fxMarkup", "0.0123456789"))).not.toThrow(); // 10 decimals
    expect(() => parseManualData(entry("fxMarkup", "0.01234567891"))).toThrow(/10 decimals/);
    expect(() => parseManualData(entry("fixedFee", "12345678901"))).toThrow(/10 decimals/);
  });

  // These links become <a href> on the page: only https, never javascript: or http:.
  it.each([["javascript:alert(1)"], ["http://www.yuh.com/en/pricing/"], ["www.yuh.com"]])(
    "rejects the link %s",
    (link) => {
      const source = valid();
      (source.feeSchedules[0] as Record<string, unknown>).sourceUrl = link;
      expect(() => parseManualData(source)).toThrow(/https/);
      const website = valid();
      (website.providers[0] as Record<string, unknown>).website = link;
      expect(() => parseManualData(website)).toThrow(/https/);
    },
  );

  describe("limits (stage 5a)", () => {
    const withLimits = (extra: Record<string, unknown>) => {
      const data = valid();
      Object.assign(data.feeSchedules[0] as Record<string, unknown>, extra);
      return data;
    };

    it("accepts a maximum amount and a tier limit in its own currency", () => {
      const data = withLimits({
        maxAmount: "4700",
        markupTier: { upTo: "1250", markupAbove: "0.01", currency: "EUR" },
      });
      expect(parseManualData(data).feeSchedules[0]).toMatchObject({
        maxAmount: "4700",
        markupTier: { currency: "EUR" },
      });
    });

    it.each([["0"], ["0.00"]])("rejects a maximum amount of %s", (maxAmount) => {
      expect(() => parseManualData(withLimits({ maxAmount }))).toThrow(/more than 0/);
    });

    it("rejects a tier limit in a currency the core engine doesn't support", () => {
      const data = withLimits({
        markupTier: { upTo: "1250", markupAbove: "0.01", currency: "GBP" },
      });
      expect(() => parseManualData(data)).toThrow(/unsupported currency/);
    });
  });

  describe("withdrawals (stage 5b)", () => {
    const withdrawal = {
      providerId: "yuh",
      corridorId: "CHF-EUR",
      status: "verified",
      withdrawn: true,
      sourceUrl: "https://www.yuh.com/en/pricing/",
      checkedAt: "2026-11-06T09:00:00Z",
      note: "Transfers to euro accounts stopped",
    };
    const withEntry = (entry: Record<string, unknown>) => {
      const data = valid();
      data.feeSchedules.push(entry);
      return data;
    };

    it("accepts a withdrawal after a price, with a reason", () => {
      const fs = parseManualData(withEntry(withdrawal)).feeSchedules[1];
      expect(fs).toEqual(withdrawal);
    });

    it.each([[undefined], [""], ["   "]])("rejects a withdrawal without a reason (%j)", (note) => {
      expect(() => parseManualData(withEntry({ ...withdrawal, note }))).toThrow();
    });

    it("rejects a withdrawal that also carries a price", () => {
      expect(() =>
        parseManualData(withEntry({ ...withdrawal, sourceKind: "rule_based", fxMarkup: "0.01" })),
      ).toThrow(/Unrecognized key/);
    });

    // Otherwise "withdrawn" would be dropped as an unknown field and the provider stay listed.
    it.each([[true], [false]])("rejects withdrawn: %s on a priced entry", (withdrawn) => {
      const data = valid();
      (data.feeSchedules[0] as Record<string, unknown>).withdrawn = withdrawn;
      expect(() => parseManualData(data)).toThrow(/a withdrawal has no prices/);
    });

    it("rejects needs_input: a withdrawal has nothing left to read", () => {
      expect(() => parseManualData(withEntry({ ...withdrawal, status: "needs_input" }))).toThrow();
    });

    it("rejects a withdrawal dated in the future", () => {
      const now = new Date("2026-11-06T08:59:59Z"); // one second before the withdrawal
      expect(() => parseManualData(withEntry(withdrawal), now)).toThrow(/in the future/);
    });
  });

  // A typo like 2027 would make an entry the newest forever, and never stale.
  describe("dates in the future", () => {
    const now = new Date("2026-11-05T18:00:00Z");
    const midRate = {
      base: "CHF",
      quote: "EUR",
      rate: "1.0893",
      source: "ecb",
      asOf: "2026-11-05",
      fetchedAt: "2026-11-05T17:29:37Z",
      sourceUrl: "https://api.frankfurter.dev/v2/rates",
    };

    it("accepts dates up to now (the same day, an earlier time)", () => {
      const data = { ...valid(), midRates: [midRate] };
      expect(() => parseManualData(data, now)).not.toThrow();
    });

    it("rejects a check time after now", () => {
      const data = valid();
      (data.feeSchedules[0] as Record<string, unknown>).checkedAt = "2026-11-05T18:00:01Z";
      expect(() => parseManualData(data, now)).toThrow(/in the future/);
    });

    it("rejects a manual rate read after now", () => {
      const data = valid();
      data.feeSchedules[0] = {
        ...data.feeSchedules[0],
        sourceKind: "manual",
        fxMarkup: undefined,
        providerRate: "1.08",
        rateCapturedAt: "2027-11-05T17:00:00Z",
      };
      expect(() => parseManualData(data, now)).toThrow(/in the future/);
    });

    it("rejects a reference rate dated or fetched after now", () => {
      const tomorrow = { ...valid(), midRates: [{ ...midRate, asOf: "2026-11-06" }] };
      expect(() => parseManualData(tomorrow, now)).toThrow(/in the future/);
      const fetchedLater = {
        ...valid(),
        midRates: [{ ...midRate, fetchedAt: "2026-11-05T18:30:00Z" }],
      };
      expect(() => parseManualData(fetchedLater, now)).toThrow(/in the future/);
    });
  });
});
