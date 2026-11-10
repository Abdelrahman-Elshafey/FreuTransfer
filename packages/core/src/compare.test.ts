import { describe, expect, it } from "vitest";
import { compareProviders, NoMidRateError, rankOffers } from "./compare.ts";
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

  it("compares a manual rate with the reference rate of the day it was read", async () => {
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
    // Same rate as that day's mid → no hidden cost. Against today's 1.0893 it would look like 1.8%.
    expect(result.ranked[0]?.mid.asOf).toBe("2026-10-20");
    expect(result.ranked[0]?.cost.totalCost.toString()).toBe("0.00 CHF");
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
        { amount: Money.of("500", "CHF"), target: "EGP", now },
      ),
    ).rejects.toThrow(NoMidRateError);
  });
});
