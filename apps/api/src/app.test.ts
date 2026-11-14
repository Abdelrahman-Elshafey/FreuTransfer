import {
  Decimal,
  feeRule,
  type MidRateObservation,
  type ProviderOffer,
  Rate,
} from "@freu-transfer/core";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { type AppDeps, createApp } from "./app.ts";
import { PROBLEM_TYPES } from "./contract.ts";

const now = new Date("2026-11-05T18:00:00Z");
const mid: MidRateObservation = {
  rate: Rate.of("CHF", "EUR", "1.0893"),
  source: "ecb",
  asOf: "2026-11-05",
  fetchedAt: now,
};

const yuh: ProviderOffer = {
  providerId: "yuh",
  providerName: "Yuh",
  providerKind: "fintech",
  sourceKind: "rule_based",
  sourceCurrency: "CHF",
  targetCurrency: "EUR",
  fees: { kind: "deducted", rule: feeRule("CHF", {}) },
  pricing: { kind: "markup", markup: new Decimal("0.0095") },
  sourceUrl: "https://www.yuh.com/en/pricing/",
  checkedAt: now,
};

/** In-memory fakes for the core ports: the API is tested without a database. */
const deps = (overrides: Partial<AppDeps> = {}): AppDeps => ({
  offers: { latestOffers: async (s, t) => (s === "CHF" && t === "EUR" ? [yuh] : []) },
  midRates: { latest: async (b, q) => (b === "CHF" && q === "EUR" ? mid : null) },
  now: () => now,
  ...overrides,
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(createApp(deps())).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("does not advertise the framework", async () => {
    const res = await request(createApp(deps())).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("GET /v1/compare", () => {
  it("says whether the reference rate is too old, with the limit, and still compares", async () => {
    // The rate is from 2026-11-05 (Thursday). Wednesday 11 Nov 12:00 Zurich (11:00 UTC):
    // 11 − 5 = 6 days > 5 → too old. Tuesday 10 Nov: 10 − 5 = 5 days → not too old.
    const at = (iso: string) => createApp(deps({ now: () => new Date(iso) }));
    const old = await request(at("2026-11-11T11:00:00Z")).get(
      "/v1/compare?from=CHF&to=EUR&amount=1000",
    );
    expect(old.body).toMatchObject({ midRateTooOld: true, midRateMaxAgeDays: 5 });
    expect(old.body.results).toHaveLength(1);

    const fine = await request(at("2026-11-10T11:00:00Z")).get(
      "/v1/compare?from=CHF&to=EUR&amount=1000",
    );
    expect(fine.body).toMatchObject({ midRateTooOld: false, midRateMaxAgeDays: 5 });
  });

  it("returns ranked results with money as strings", async () => {
    const res = await request(createApp(deps())).get("/v1/compare?from=chf&to=EUR&amount=1000");
    expect(res.status).toBe(200);
    expect(res.body.midRate).toEqual({ rate: "1.0893", source: "ecb", asOf: "2026-11-05" });
    expect(res.body.results).toHaveLength(1);
    const [row] = res.body.results;
    // 1000 × 1.0893 × (1 − 0.0095) = 1078.95165 → 1078.95 EUR
    expect(row).toMatchObject({
      rank: 1,
      providerId: "yuh",
      received: { amount: "1078.95", currency: "EUR" },
      visibleFee: { amount: "0.00", currency: "CHF" },
      totalCost: { amount: "9.50", currency: "CHF" },
      fxMarkup: { amount: "9.50", currency: "CHF" },
      // 1078.95 EUR is worth 990.4985 CHF at mid: cost 9.5015 CHF (the payout rounding costs a little)
      totalCostPercent: "0.95",
      approximate: false,
      sourceUrl: "https://www.yuh.com/en/pricing/",
    });
    expect(typeof row.received.amount).toBe("string");
  });

  it("gives every row today's reference rate, and a manual rate its capture time and its own day's rate", async () => {
    // A manual rate read on 4 Nov is compared with the 4 Nov reference rate, not the newest (5 Nov).
    const nov4: MidRateObservation = {
      ...mid,
      rate: Rate.of("CHF", "EUR", "1.0712"),
      asOf: "2026-11-04",
    };
    const manual: ProviderOffer = {
      ...yuh,
      providerId: "postfinance",
      providerName: "PostFinance",
      sourceKind: "manual",
      pricing: {
        kind: "rate",
        rate: Rate.of("CHF", "EUR", "1.0512"),
        capturedAt: new Date("2026-11-04T09:30:00Z"),
      },
    };
    const app = createApp(
      deps({
        offers: { latestOffers: async () => [yuh, manual] },
        midRates: { latest: async (_b, _q, day) => (day === "2026-11-04" ? nov4 : mid) },
      }),
    );
    const res = await request(app).get("/v1/compare?from=CHF&to=EUR&amount=1000");
    const byId = Object.fromEntries(
      res.body.results.map((r: { providerId: string }) => [r.providerId, r]),
    );
    expect(byId.yuh.midRate).toEqual({ rate: "1.0893", source: "ecb", asOf: "2026-11-05" });
    expect(byId.yuh.rateCapturedAt).toBeNull();
    expect(byId.yuh.measuredAgainst).toBeNull();
    // Compared with today's rate like every row; measured against its own day's (ADR 0010):
    //   estimate = 1.0512 × 1.0893 / 1.0712 = 1.068962…; 1000 × 1.068962… = 1068.962… → 1068.96 EUR
    expect(byId.postfinance.midRate).toEqual({ rate: "1.0893", source: "ecb", asOf: "2026-11-05" });
    expect(byId.postfinance.measuredAgainst).toEqual({
      rate: "1.0712",
      source: "ecb",
      asOf: "2026-11-04",
    });
    expect(byId.postfinance.received).toEqual({ amount: "1068.96", currency: "EUR" });
    expect(byId.postfinance.rateCapturedAt).toBe("2026-11-04T09:30:00.000Z");
    expect(res.body.recheckDays).toBe(30);
  });

  it("rounds the cost percentage once, from the exact value (no double rounding)", async () => {
    // Manual rate 1.0, mid 1.009642, pay 1,000 CHF, no fee:
    //   received = 1000.00 EUR, worth 1000 / 1.009642 = 990.45008032… CHF at mid
    //   exact cost = 9.54991967… CHF = 0.954991967…% → "0.95"
    // Rounding the fraction to 6 decimals first (0.009550) and then to 2 would give "0.96".
    const manual: ProviderOffer = {
      ...yuh,
      sourceKind: "manual",
      pricing: { kind: "rate", rate: Rate.of("CHF", "EUR", "1"), capturedAt: now },
    };
    const app = createApp(
      deps({
        offers: { latestOffers: async () => [manual] },
        midRates: { latest: async () => ({ ...mid, rate: Rate.of("CHF", "EUR", "1.009642") }) },
      }),
    );
    const res = await request(app).get("/v1/compare?from=CHF&to=EUR&amount=1000");
    expect(res.body.results[0]).toMatchObject({
      received: { amount: "1000.00", currency: "EUR" },
      totalCost: { amount: "9.55", currency: "CHF" },
      totalCostPercent: "0.95",
    });
  });

  it('sends a cost that rounds to zero as "0.00", never "-0.00"', async () => {
    // Found on the real page (2026-11-09): mid 1.0937, no fee, no markup, pay 1,000.50 CHF:
    //   received = 1000.50 × 1.0937 = 1094.24685 → 1094.25 EUR (payout rounding)
    //   worth 1094.25 / 1.0937 = 1000.50288… CHF → exact cost −0.00288… CHF = −0.000288…%
    //   rounded to 2 decimals that is zero, and must not keep the minus sign.
    const zeroMarkup: ProviderOffer = {
      ...yuh,
      pricing: { kind: "markup", markup: new Decimal("0") },
    };
    const app = createApp(
      deps({
        offers: { latestOffers: async () => [zeroMarkup] },
        midRates: { latest: async () => ({ ...mid, rate: Rate.of("CHF", "EUR", "1.0937") }) },
      }),
    );
    const res = await request(app).get("/v1/compare?from=CHF&to=EUR&amount=1000.50");
    expect(res.body.results[0]).toMatchObject({
      received: { amount: "1094.25", currency: "EUR" },
      totalCost: { amount: "0.00", currency: "CHF" },
      totalCostPercent: "0.00",
    });
  });

  it("lists providers that can't serve the amount with a reason code, not English text", async () => {
    const pricey: ProviderOffer = {
      ...yuh,
      providerId: "pricey",
      providerName: "Pricey",
      fees: { kind: "deducted", rule: feeRule("CHF", { fixed: "15" }) },
    };
    const app = createApp(deps({ offers: { latestOffers: async () => [pricey] } }));
    const res = await request(app).get("/v1/compare?from=CHF&to=EUR&amount=10");
    expect(res.body.unavailable).toEqual([
      { providerId: "pricey", providerName: "Pricey", reason: "amount_not_supported" },
    ]);
  });

  it.each([
    ["missing amount", "/v1/compare?from=CHF&to=EUR"],
    ["zero amount", "/v1/compare?from=CHF&to=EUR&amount=0"],
    ["three decimals", "/v1/compare?from=CHF&to=EUR&amount=10.123"],
    ["negative", "/v1/compare?from=CHF&to=EUR&amount=-5"],
    ["unknown currency", "/v1/compare?from=CHF&to=XYZ&amount=100"],
    // A real currency, but not one of ours: it has no cents, so "100.50" would be impossible.
    ["currency outside the v1 corridors", "/v1/compare?from=JPY&to=EUR&amount=100.50"],
    // Supported until ADR 0008 (v1 = CHF⇄EUR only).
    ["a dropped corridor currency", "/v1/compare?from=CHF&to=GBP&amount=100"],
    ["same currency", "/v1/compare?from=CHF&to=CHF&amount=100"],
    ["a repeated parameter", "/v1/compare?from=CHF&to=EUR&amount=100&amount=200"],
    // The page turns "1'000,50" into "1000.50" before calling; the API takes only that form.
    ["an amount as people type it", "/v1/compare?from=CHF&to=EUR&amount=1'000,50"],
  ])("rejects %s with an RFC 9457 problem", async (_name, url) => {
    const res = await request(createApp(deps())).get(url);
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(res.body.type).toBe(PROBLEM_TYPES.invalidQuery);
    expect(res.body.title).toBe("Invalid query");
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it("returns 404 when the corridor has no reference rate", async () => {
    const res = await request(createApp(deps())).get("/v1/compare?from=EUR&to=CHF&amount=100");
    expect(res.status).toBe(404);
    expect(res.body.type).toBe(PROBLEM_TYPES.corridorNotAvailable);
    expect(res.body.title).toBe("Corridor not available");
  });

  it("hides internal errors behind a generic 500", async () => {
    const broken = deps({
      midRates: {
        latest: async () => {
          throw new Error("database password is wrong");
        },
      },
    });
    const res = await request(createApp(broken)).get("/v1/compare?from=CHF&to=EUR&amount=100");
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  it("answers unknown routes with a problem, not HTML", async () => {
    const res = await request(createApp(deps())).get("/nope");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/problem\+json/);
    // "about:blank" means "just the HTTP status", so the title is the status phrase (RFC 9457 §4.2.1).
    expect(res.body).toMatchObject({ type: "about:blank", title: "Not Found" });
  });
});
