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
  note: null,
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

  it("gives every row the reference rate it was compared with, and a manual rate's capture time", async () => {
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
    expect(byId.postfinance.midRate).toEqual({ rate: "1.0712", source: "ecb", asOf: "2026-11-04" });
    expect(byId.postfinance.rateCapturedAt).toBe("2026-11-04T09:30:00.000Z");
    expect(res.body.recheckDays).toBe(30);
  });

  it.each([
    ["missing amount", "/v1/compare?from=CHF&to=EUR"],
    ["zero amount", "/v1/compare?from=CHF&to=EUR&amount=0"],
    ["three decimals", "/v1/compare?from=CHF&to=EUR&amount=10.123"],
    ["negative", "/v1/compare?from=CHF&to=EUR&amount=-5"],
    ["unknown currency", "/v1/compare?from=CHF&to=XYZ&amount=100"],
    ["same currency", "/v1/compare?from=CHF&to=CHF&amount=100"],
  ])("rejects %s with an RFC 9457 problem", async (_name, url) => {
    const res = await request(createApp(deps())).get(url);
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(res.body.title).toBe("Invalid query");
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it("returns 404 when the corridor has no reference rate", async () => {
    const res = await request(createApp(deps())).get("/v1/compare?from=CHF&to=GBP&amount=100");
    expect(res.status).toBe(404);
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
  });
});
