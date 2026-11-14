import { describe, expect, it } from "vitest";
import { compareProviders, MID_RATE_MAX_AGE_DAYS, NoMidRateError, rankOffers } from "./compare.ts";
import { Decimal } from "./decimal.ts";
import { CurrencyMismatchError } from "./errors.ts";
import { feeRule } from "./fees.ts";
import { Money } from "./money.ts";
import type { MidRateObservation, ProviderOffer } from "./offer.ts";
import { Rate } from "./rate.ts";

const now = new Date("2026-11-05T18:00:00Z");
const mid: MidRateObservation = {
  rate: Rate.of("CHF", "EUR", "1.0893"),
  source: "ecb",
  asOf: "2026-11-05",
  fetchedAt: now,
};

function offer(
  id: string,
  pricing: ProviderOffer["pricing"],
  fixed = "0",
  checkedAt = now,
): ProviderOffer {
  return {
    providerId: id,
    providerName: id.toUpperCase(),
    providerKind: "fintech",
    sourceKind: pricing.kind === "markup" ? "rule_based" : "manual",
    sourceCurrency: "CHF",
    targetCurrency: "EUR",
    fees: { kind: "deducted", rule: feeRule("CHF", { fixed }) },
    pricing,
    sourceUrl: `https://example.test/${id}`,
    checkedAt,
  };
}

const markup = (m: string) => ({ kind: "markup", markup: new Decimal(m) }) as const;

describe("rankOffers", () => {
  it("ranks providers from cheapest to most expensive total cost", () => {
    const result = rankOffers(
      [offer("bank", markup("0.017")), offer("cheap", markup("0")), offer("mid", markup("0.0095"))],
      mid,
      Money.of("1000", "CHF"),
      now,
    );
    expect(result.ranked.map((r) => r.offer.providerId)).toEqual(["cheap", "mid", "bank"]);
    expect(result.ranked[0]?.cost.totalCost.toString()).toBe("0.00 CHF");
    expect(result.ranked[2]?.cost.fxMarkup.toString()).toBe("17.00 CHF");
  });

  // Equal costs need a fixed order that doesn't depend on the server's language settings
  // (localeCompare) or on display names: the provider id, compared as plain text.
  it("orders equal costs by provider id", () => {
    const zeta = { ...offer("a", markup("0.01")), providerName: "Zeta" };
    const alpha = { ...offer("b", markup("0.01")), providerName: "Alpha" };
    const result = rankOffers([alpha, zeta], mid, Money.of("1000", "CHF"), now);
    expect(result.ranked.map((r) => r.offer.providerId)).toEqual(["a", "b"]);
  });

  it("marks manual rates as approximate", () => {
    const manual = offer("pf", {
      kind: "rate",
      rate: Rate.of("CHF", "EUR", "1.0700"),
      capturedAt: new Date("2026-11-05T09:30:00Z"),
    });
    const [row] = rankOffers([manual], mid, Money.of("1000", "CHF"), now).ranked;
    expect(row?.approximate).toBe(true);
    expect(row?.quote.received.toString()).toBe("1070.00 EUR");
  });

  it("lists data older than 30 days separately instead of ranking it", () => {
    const old = offer("old", markup("0"), "0", new Date("2026-09-01T00:00:00Z"));
    const result = rankOffers(
      [old, offer("new", markup("0.01"))],
      mid,
      Money.of("1000", "CHF"),
      now,
    );
    expect(result.ranked.map((r) => r.offer.providerId)).toEqual(["new"]);
    expect(result.stale.map((r) => r.offer.providerId)).toEqual(["old"]);
  });

  it("puts providers that can't serve the amount in `unavailable`", () => {
    const result = rankOffers(
      [offer("pricey", markup("0"), "15")],
      mid,
      Money.of("10", "CHF"),
      now,
    );
    expect(result.ranked).toEqual([]);
    expect(result.unavailable).toEqual([
      { offer: expect.objectContaining({ providerId: "pricey" }), reason: "amount_not_supported" },
    ]);
  });

  it("fails on broken data instead of hiding it as 'unavailable'", () => {
    // A fee rule in EUR for a CHF payment is a data bug, not an amount the provider can't serve.
    const broken = {
      ...offer("broken", markup("0")),
      fees: { kind: "deducted", rule: feeRule("EUR", { fixed: "1" }) },
    } as const;
    expect(() => rankOffers([broken], mid, Money.of("1000", "CHF"), now)).toThrow(
      CurrencyMismatchError,
    );
  });
});

describe("reference rate age (MID_RATE_MAX_AGE_DAYS = 5)", () => {
  /** Whether a rate published on `asOf` counts as too old at `at`. */
  const tooOld = (asOf: string, at: string) =>
    rankOffers([], { ...mid, asOf }, Money.of("1000", "CHF"), new Date(at)).midTooOld;

  it("is 5", () => {
    expect(MID_RATE_MAX_AGE_DAYS).toBe(5);
  });

  it("allows the Easter gap: Thursday's rate is still fine on Tuesday", () => {
    // Easter 2027: Thursday 25 March is the last rate before Good Friday and Easter Monday.
    // Tuesday 30 March 14:00 Zurich (12:00 UTC, CEST), before the new rate: 30 − 25 = 5 days, not > 5.
    expect(tooOld("2027-03-25", "2027-03-30T12:00:00Z")).toBe(false);
    // Wednesday 31 March without a newer rate: 31 − 25 = 6 days > 5, the collector has stopped.
    expect(tooOld("2027-03-25", "2027-03-31T12:00:00Z")).toBe(true);
  });

  it("counts days in Zurich, not in UTC", () => {
    // Rate of Thursday 12 Nov. 2026-11-17T23:30Z is already Wednesday 18 Nov 00:30 in Zurich (CET,
    // UTC+1): 18 − 12 = 6 days > 5. Counted in UTC it would be 17 − 12 = 5 days, not too old.
    expect(tooOld("2026-11-12", "2026-11-17T23:30:00Z")).toBe(true);
    // One hour earlier, 2026-11-17T22:30Z = Tuesday 17 Nov 23:30 in Zurich: 17 − 12 = 5 days.
    expect(tooOld("2026-11-12", "2026-11-17T22:30:00Z")).toBe(false);
  });

  it("is fine on the day of publication", () => {
    expect(tooOld("2026-11-12", "2026-11-12T16:00:00Z")).toBe(false);
  });
});

describe("sanity guard: total cost above 10% or below 0% is listed as implausible", () => {
  // mid 1 CHF = 1.0893 EUR, 1,000 CHF paid, no fee.
  const check = (o: ProviderOffer, at = now) => rankOffers([o], mid, Money.of("1000", "CHF"), at);

  it("ranks a cost of exactly 10%", () => {
    // markup 10%: received = 1000 × 1.0893 × 0.9 = 980.37 EUR (exact)
    // worth 980.37 / 1.0893 = 900.00 CHF → cost 100.00 CHF = exactly 10%
    const result = check(offer("ten", markup("0.10")));
    expect(result.ranked[0]?.cost.totalCostPct.toString()).toBe("0.1");
    expect(result.unavailable).toEqual([]);
  });

  it("lists a cost just above 10% instead of ranking it", () => {
    // markup 10.01%: received = 1000 × 1.0893 × 0.8999 = 980.26107 → 980.26 EUR
    // worth 980.26 / 1.0893 = 899.899017… CHF → cost 100.100982… CHF = 10.01% > 10%
    const o = offer("over", markup("0.1001"));
    const result = check(o);
    expect(result.ranked).toEqual([]);
    expect(result.unavailable).toEqual([{ offer: o, reason: "implausible_cost" }]);
  });

  it("lists a negative cost (a rate better than the reference rate)", () => {
    // A manual rate of 1.10 EUR per CHF, better than mid 1.0893: received 1,100.00 EUR,
    // worth 1100 / 1.0893 = 1009.8228… CHF → cost −9.82 CHF < 0
    const o = offer("typo", { kind: "rate", rate: Rate.of("CHF", "EUR", "1.10"), capturedAt: now });
    expect(check(o).unavailable).toEqual([{ offer: o, reason: "implausible_cost" }]);
  });

  it("ranks a free provider whose payout rounding leaves a fraction of a cent below 0", () => {
    // Found by the API test (2026-11-09 case): mid 1.0937, no fee, no markup, pay 1,000.50 CHF:
    //   received = 1000.50 × 1.0937 = 1094.24685 → 1094.25 EUR (rounded up)
    //   worth 1094.25 / 1.0937 = 1000.50288… CHF → exact cost −0.00288… CHF, rounded 0.00
    const free = offer("free", markup("0"));
    const at1_0937 = { ...mid, rate: Rate.of("CHF", "EUR", "1.0937") };
    const result = rankOffers([free], at1_0937, Money.of("1000.50", "CHF"), now);
    expect(result.unavailable).toEqual([]);
    expect(result.ranked[0]?.quote.received.toString()).toBe("1094.25 EUR");
  });

  it("ranks a cost of exactly 0% (Revolut within its allowance)", () => {
    // markup 0: received = 1000 × 1.0893 = 1089.30 EUR, worth exactly 1,000 CHF → cost 0
    expect(check(offer("zero", markup("0"))).ranked).toHaveLength(1);
  });

  it("also guards offers that are no longer re-checked", () => {
    const old = offer("old", markup("0.1001"), "0", new Date("2026-09-01T00:00:00Z"));
    const result = check(old);
    expect(result.stale).toEqual([]);
    expect(result.unavailable[0]?.reason).toBe("implausible_cost");
  });
});

describe("markup tier with its limit in the target currency (Revolut EUR→CHF, CHF 1'250)", () => {
  // mid 1 EUR = 0.92 CHF; you pay in EUR, the allowance is stated in CHF.
  const eurMid: MidRateObservation = { ...mid, rate: Rate.of("EUR", "CHF", "0.92") };
  const revolutEur: ProviderOffer = {
    ...offer("revolut", markup("0")),
    sourceCurrency: "EUR",
    targetCurrency: "CHF",
    fees: { kind: "deducted", rule: feeRule("EUR", {}) },
    pricing: {
      kind: "markup",
      markup: new Decimal("0"),
      tier: { upTo: Money.of("1250", "CHF"), markupAbove: new Decimal("0.01") },
    },
  };
  const rowFor = (amount: string) =>
    rankOffers([revolutEur], eurMid, Money.of(amount, "EUR"), now).ranked[0];

  it("is free while the francs stay within the allowance", () => {
    // 1,000 EUR = 920 CHF at mid ≤ 1,250 CHF → markup 0 → received 920.00 CHF, cost 0
    expect(rowFor("1000")?.quote.received.toString()).toBe("920.00 CHF");
    expect(rowFor("1000")?.cost.totalCost.toString()).toBe("0.00 EUR");
  });

  it("charges 1% only on the francs above the allowance", () => {
    // 2,000 EUR = 1,840 CHF at mid; above the allowance: 1,840 − 1,250 = 590 CHF
    // 1% of 590 = 5.90 CHF less → received 1840 − 5.90 = 1,834.10 CHF
    // (in source terms: limit 1250 / 0.92 = 1358.6956… EUR, blended markup 0.01 × 641.3043… / 2000)
    // worth 1834.10 / 0.92 = 1993.5869565… EUR → cost 6.4130434… → 6.41 EUR
    const row = rowFor("2000");
    expect(row?.quote.received.toString()).toBe("1834.10 CHF");
    expect(row?.cost.totalCost.toString()).toBe("6.41 EUR");
  });
});

describe("markup tier (Revolut-style allowance: 0% up to 1,250 CHF, 1% above)", () => {
  const revolut = offer("revolut", {
    kind: "markup",
    markup: new Decimal("0"),
    tier: { upTo: Money.of("1250", "CHF"), markupAbove: new Decimal("0.01") },
  });
  const costFor = (amount: string, o = revolut) =>
    rankOffers([o], mid, Money.of(amount, "CHF"), now).ranked[0]?.cost;

  it("rule 1: no markup below or exactly at the allowance", () => {
    expect(costFor("1000")?.totalCost.toString()).toBe("0.00 CHF");
    expect(costFor("1250")?.totalCost.toString()).toBe("0.00 CHF");
  });

  it("rule 2: only the part above the allowance pays the markup", () => {
    // 2,500 CHF: 1,250 at 0% + 1,250 at 1% = 12.50 CHF → blended 0.5%.
    // received = 2500 × 1.0893 × (1 − 0.005) = 2709.63375 → 2709.63 EUR
    // worth 2709.63 / 1.0893 = 2487.4965574… CHF → total cost 12.5034425… → 12.50 CHF
    // exact fraction 12.5034425… / 2500 = 0.0050013770… (0.50%)
    const cost = costFor("2500");
    expect(cost?.received.toString()).toBe("2709.63 EUR");
    expect(cost?.totalCost.toString()).toBe("12.50 CHF");
    expect(cost?.totalCostPct.toFixed(10)).toBe("0.0050013770");
  });

  it("rule 3: the allowance counts the converted amount, after the fee", () => {
    // Pay 1,260 CHF with a 10 CHF fee deducted: 1,250 is converted, all within the allowance.
    const withFee = {
      ...revolut,
      fees: { kind: "deducted", rule: feeRule("CHF", { fixed: "10" }) },
    } as const;
    expect(costFor("1260", withFee)?.fxMarkup.toString()).toBe("0.00 CHF");
  });

  it("rule 4: a tier with the same markup on both sides equals a single markup", () => {
    const single = offer("a", { kind: "markup", markup: new Decimal("0.0095") });
    const tiered = offer("a", {
      kind: "markup",
      markup: new Decimal("0.0095"),
      tier: { upTo: Money.of("1250", "CHF"), markupAbove: new Decimal("0.0095") },
    });
    for (const amount of ["100", "1250", "5000"]) {
      expect(
        costFor(amount, tiered)?.received.equals(costFor(amount, single)?.received as Money),
      ).toBe(true);
    }
  });
});

// Owner, 2026-11-13 (stage 5d, ADR 0010): a manual rate is an estimate at today's reference rate,
// keeping the distance from the reference rate measured on the day it was read. Otherwise a rate
// read when the franc was stronger shows more arriving than a cheaper provider ranked above it.
describe("manual rate at today's reference rate", () => {
  // Read on 20 Oct: 1.089 EUR per CHF while that day's reference rate was 1.10, i.e. 1% below it.
  // Today's reference rate is 1.0893 (mid).
  const oct20: MidRateObservation = {
    ...mid,
    rate: Rate.of("CHF", "EUR", "1.10"),
    asOf: "2026-10-20",
  };
  const manual = offer("bank", {
    kind: "rate",
    rate: Rate.of("CHF", "EUR", "1.089"),
    capturedAt: new Date("2026-10-20T09:00:00Z"),
  });
  const rank = (offers: ProviderOffer[]) =>
    rankOffers(offers, mid, Money.of("1000", "CHF"), now, (day) =>
      day === "2026-10-20" ? oct20 : null,
    );

  it("rule 1: applies the same distance from the reference rate to today's", () => {
    // today's estimate = 1.089 × 1.0893 / 1.10 = 1.078407 (1% below 1.0893)
    //   received = 1000 × 1.078407 = 1078.407 → 1078.41 EUR (1,089.00 with the rate as read)
    //   worth 1078.41 / 1.0893 = 990.002754… CHF → cost 9.997246… → 10.00 CHF
    const [row] = rank([manual]).ranked;
    expect(row?.quote.received.toString()).toBe("1078.41 EUR");
    expect(row?.cost.totalCost.toString()).toBe("10.00 CHF");
    expect(row?.approximate).toBe(true);
  });

  it("rule 2: what arrives agrees with the ranking", () => {
    // A rule-based provider 0.5% below mid: 1000 × 1.0893 × 0.995 = 1083.8535 → 1083.85 EUR.
    // It ranks first (0.5% < 1%), and more arrives with it than with the manual one (1078.41).
    // With the rate as read the manual one would show 1,089.00 EUR, more than the cheaper one.
    const ranked = rank([manual, offer("fintech", markup("0.005"))]).ranked;
    expect(ranked.map((r) => [r.offer.providerId, r.quote.received.toString()])).toEqual([
      ["fintech", "1083.85 EUR"],
      ["bank", "1078.41 EUR"],
    ]);
  });

  it("rule 3: carries both reference rates: today's (compared) and the reading day's (measured)", () => {
    const [row] = rank([manual]).ranked;
    expect(row?.mid).toBe(mid);
    expect(row?.measuredAgainst).toBe(oct20);
    const [ruleBased] = rank([offer("fintech", markup("0.005"))]).ranked;
    expect(ruleBased?.measuredAgainst).toBeNull();
  });

  it("rule 4: a rate better than its day's reference rate is still a data error", () => {
    // 1.111 against 1.10 that day = 1% better than mid: estimate 1.111 × 1.0893 / 1.10 = 1.100193
    // → 1,100.19 EUR, worth 1100.19 / 1.0893 = 1009.997246… CHF → cost −9.997246… → −10.00 CHF < 0
    // → implausible, not an exception.
    const better = offer("typo", {
      kind: "rate",
      rate: Rate.of("CHF", "EUR", "1.111"),
      capturedAt: new Date("2026-10-20T09:00:00Z"),
    });
    expect(rank([better]).unavailable).toEqual([{ offer: better, reason: "implausible_cost" }]);
  });
});

describe("compareProviders", () => {
  it("reads through the ports and ranks", async () => {
    const result = await compareProviders(
      {
        offers: { latestOffers: async () => [offer("a", markup("0.01"))] },
        midRates: { latest: async () => mid },
      },
      { amount: Money.of("500", "CHF"), target: "EUR", now },
    );
    expect(result.ranked).toHaveLength(1);
    expect(result.mid.asOf).toBe("2026-11-05");
  });

  it("measures a manual rate against the reference rate of the day it was read", async () => {
    const oldMid: MidRateObservation = {
      ...mid,
      rate: Rate.of("CHF", "EUR", "1.0700"),
      asOf: "2026-10-20",
    };
    const manual = offer("pf", {
      kind: "rate",
      rate: Rate.of("CHF", "EUR", "1.0700"),
      // 23:30 UTC on 19 Oct is already 20 Oct in Zurich
      capturedAt: new Date("2026-10-19T23:30:00Z"),
    });
    const asked: (string | undefined)[] = [];
    const result = await compareProviders(
      {
        offers: { latestOffers: async () => [manual] },
        midRates: {
          latest: async (_b, _q, day) => {
            asked.push(day);
            return day === undefined ? mid : oldMid;
          },
        },
      },
      { amount: Money.of("1000", "CHF"), target: "EUR", now },
    );
    expect(asked).toEqual([undefined, "2026-10-20"]);
    // Same rate as that day's mid → no markup. Against today's 1.0893 it would look like 1.8%.
    // Today's estimate: 1000 × 1.0893 × (1.0700 / 1.0700) = 1089.30 EUR, cost 0.
    const [row] = result.ranked;
    expect(row?.measuredAgainst?.asOf).toBe("2026-10-20");
    expect(row?.mid.asOf).toBe("2026-11-05");
    expect(row?.quote.received.toString()).toBe("1089.30 EUR");
    expect(row?.cost.totalCost.toString()).toBe("0.00 CHF");
  });

  it("marks a manual rate unavailable when no reference rate exists for its day", () => {
    const manual = offer("pf", {
      kind: "rate",
      rate: Rate.of("CHF", "EUR", "1.07"),
      capturedAt: new Date("2026-01-02T10:00:00Z"),
    });
    const result = rankOffers([manual], mid, Money.of("1000", "CHF"), now, () => null);
    expect(result.unavailable[0]?.reason).toBe("no_reference_rate");
  });

  it("fails clearly when no reference rate is stored", async () => {
    await expect(
      compareProviders(
        { offers: { latestOffers: async () => [] }, midRates: { latest: async () => null } },
        { amount: Money.of("500", "EUR"), target: "CHF", now },
      ),
    ).rejects.toThrow(NoMidRateError);
  });
});

// Stage 6c (owner, 2026-11-14): caveats that follow from an offer's own data, as codes with values.
describe("caveats", () => {
  const rowFor = (o: ProviderOffer, amount = "1000") =>
    rankOffers([o], mid, Money.of(amount, "CHF"), now).ranked[0];

  it("rule 1: an allowance tier is a monthly allowance, with its amount", () => {
    const revolut = offer("revolut", {
      kind: "markup",
      markup: new Decimal("0"),
      tier: { upTo: Money.of("1250", "CHF"), markupAbove: new Decimal("0.01") },
    });
    expect(rowFor(revolut)?.caveats).toEqual([
      { code: "monthly_allowance", allowance: Money.of("1250", "CHF") },
    ]);
  });

  it("rule 2: a maximum amount is a limit per transfer, with its amount", () => {
    // Western Union-style: no fee up to 4,700 CHF, nothing above (a single fee tier).
    const limited: ProviderOffer = {
      ...offer("wu", markup("0.02")),
      fees: {
        kind: "tiered",
        tiers: [
          {
            upTo: Money.of("4700", "CHF"),
            model: { kind: "deducted", rule: feeRule("CHF", {}) },
          },
        ],
      },
    };
    expect(rowFor(limited)?.caveats).toEqual([
      { code: "amount_limit", max: Money.of("4700", "CHF") },
    ]);
    // Above the limit it stays "not available", not a ranked row with a caveat.
    const above = rankOffers([limited], mid, Money.of("4700.01", "CHF"), now);
    expect(above.unavailable).toEqual([{ offer: limited, reason: "amount_not_supported" }]);
  });

  it("rule 2: fee tiers whose last one has no limit are not a limit", () => {
    const open: ProviderOffer = {
      ...offer("bank", markup("0.01")),
      fees: {
        kind: "tiered",
        tiers: [
          { upTo: Money.of("1000", "CHF"), model: { kind: "deducted", rule: feeRule("CHF", {}) } },
          { upTo: null, model: { kind: "deducted", rule: feeRule("CHF", { fixed: "5" }) } },
        ],
      },
    };
    expect(rowFor(open, "2000")?.caveats).toEqual([]);
  });

  it("an offer without tier or limit has no caveats; stale rows keep theirs", () => {
    expect(rowFor(offer("plain", markup("0.01")))?.caveats).toEqual([]);
    const old = new Date("2026-09-01T00:00:00Z");
    const staleTier = offer(
      "old",
      {
        kind: "markup",
        markup: new Decimal("0"),
        tier: { upTo: Money.of("1250", "CHF"), markupAbove: new Decimal("0.01") },
      },
      "0",
      old,
    );
    const [row] = rankOffers([staleTier], mid, Money.of("1000", "CHF"), now).stale;
    expect(row?.caveats.map((c) => c.code)).toEqual(["monthly_allowance"]);
  });
});

// Stage 6d (Project Plan §1, "Am I overpaying with my bank?"): each ranked row against the cheapest.
describe("vsCheapest", () => {
  const amount = Money.of("1000", "CHF");

  it("rule 1: the extra cost per transfer and per year, and how much less arrives", () => {
    // mid 1.0893. cheap: 0.5% markup → 1000 × 1.0893 × 0.995 = 1083.8535 → 1083.85 EUR,
    //   worth 1083.85 / 1.0893 = 995 − 0.0035 / 1.0893 = 994.996787… CHF
    //   cost 1000 − 994.996787… = 5.003213… → 5.00 CHF
    // bank: 1.7% markup → 1000 × 1.0893 × 0.983 = 1070.7819 → 1070.78 EUR,
    //   worth 1070.78 / 1.0893 = 983 − 0.0019 / 1.0893 = 982.998256… CHF
    //   cost 1000 − 982.998256… = 17.001744… → 17.00 CHF
    // extra cost 17.00 − 5.00 = 12.00 CHF; less arrives 1083.85 − 1070.78 = 13.07 EUR;
    // per year 12.00 × 12 = 144.00 CHF
    const { ranked } = rankOffers(
      [offer("bank", markup("0.017")), offer("cheap", markup("0.005"))],
      mid,
      amount,
      now,
    );
    const [best, bank] = ranked;
    expect(bank?.vsCheapest?.extraCost.toString()).toBe("12.00 CHF");
    expect(bank?.vsCheapest?.lessReceived.toString()).toBe("13.07 EUR");
    expect(bank?.vsCheapest?.extraCostPerYear.toString()).toBe("144.00 CHF");
    // The cheapest compares with itself: zero.
    expect(best?.vsCheapest?.extraCost.toString()).toBe("0.00 CHF");
    expect(best?.vsCheapest?.lessReceived.toString()).toBe("0.00 EUR");
  });

  it("rule 1: the differences of the shown (rounded) amounts, so the page adds up", () => {
    const { ranked } = rankOffers(
      [offer("bank", markup("0.017")), offer("cheap", markup("0.005"))],
      mid,
      amount,
      now,
    );
    const [best, bank] = ranked;
    if (!best || !bank?.vsCheapest) throw new Error("expected two ranked rows");
    expect(best.cost.totalCost.plus(bank.vsCheapest.extraCost).equals(bank.cost.totalCost)).toBe(
      true,
    );
    expect(bank.quote.received.plus(bank.vsCheapest.lessReceived).equals(best.quote.received)).toBe(
      true,
    );
  });

  it("rule 1: rows tied with the cheapest show zero", () => {
    const { ranked } = rankOffers(
      [offer("a", markup("0.01")), offer("b", markup("0.01"))],
      mid,
      amount,
      now,
    );
    expect(ranked.map((r) => r.vsCheapest?.extraCost.toString())).toEqual(["0.00 CHF", "0.00 CHF"]);
  });

  it("rule 2: stale rows are not compared", () => {
    const old = new Date("2026-09-01T00:00:00Z");
    const result = rankOffers(
      [offer("fresh", markup("0.005")), offer("old", markup("0.001"), "0", old)],
      mid,
      amount,
      now,
    );
    expect(result.stale[0]?.vsCheapest).toBeNull();
    // The cheaper stale offer isn't "the cheapest": only ranked rows count.
    expect(result.ranked[0]?.vsCheapest?.extraCost.toString()).toBe("0.00 CHF");
  });
});
