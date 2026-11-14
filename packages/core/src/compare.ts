import { type CostBreakdown, computeCost } from "./cost.ts";
import type { CurrencyCode } from "./currency.ts";
import { Decimal } from "./decimal.ts";
import { AmountNotSupportedError } from "./errors.ts";
import { maxAmount } from "./fees.ts";
import type { Money } from "./money.ts";
import type { MidRateObservation, ProviderOffer } from "./offer.ts";
import type { MidRateRepository, OfferRepository } from "./ports.ts";
import { type QuoteAmounts, quoteFromRule } from "./quote.ts";
import { Rate } from "./rate.ts";

/** Manual and rule-based data older than this is shown separately, not ranked (Project Plan §4). */
export const RECHECK_DAYS = 30;
/**
 * A reference rate published more than this many days ago is "too old" (owner, 2026-11-13): the
 * ECB publishes on working days only, and the longest normal gap is Easter (Thursday's rate is the
 * newest until Tuesday afternoon, 5 days). Older means the collector has stopped. The comparison
 * is still shown, with a warning (Project Plan §4: every number shows its source and date).
 */
export const MID_RATE_MAX_AGE_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Sanity guard (Project Plan §9): a total cost above 10% or below 0% (at least a cent below) is
 * almost certainly a data error (a mistyped rate or fee), not a real price. Such an offer is never
 * ranked; it is listed as "being checked", so a typo can't top the ranking.
 */
const MAX_PLAUSIBLE_COST = new Decimal("0.10");

export type ComparisonRow = {
  readonly offer: ProviderOffer;
  readonly quote: QuoteAmounts;
  readonly cost: CostBreakdown;
  /** The reference rate this row was compared with: the newest one, for every row. */
  readonly mid: MidRateObservation;
  /**
   * Manual rates only: the reference rate of the day the provider's rate was read. The rate's
   * distance from it is applied to `mid` to estimate today's amount (ADR 0010).
   */
  readonly measuredAgainst: MidRateObservation | null;
  /** True for manual rates: an estimate from a rate read on another day or at another time. */
  readonly approximate: boolean;
  /** What the reader should know that the numbers can't show (caveatsFor). */
  readonly caveats: readonly Caveat[];
  /** Ranked rows only: what this provider costs more than the cheapest one; null for stale rows. */
  readonly vsCheapest: VsCheapest | null;
};

/**
 * "My bank vs best" (Project Plan §1): the difference from the cheapest ranked row, from the
 * rounded amounts the reader sees, so the numbers on the page add up. Zero for the cheapest row
 * and for rows tied with it.
 */
type VsCheapest = {
  /** Total cost minus the cheapest's, in the sender's currency. */
  readonly extraCost: Money;
  /** How much less arrives than with the cheapest, in the recipient's currency. */
  readonly lessReceived: Money;
  /**
   * `extraCost` × 12: sending this amount every month for a year (the commuter's view). Holds for
   * a monthly allowance too, which starts again every month.
   */
  readonly extraCostPerYear: Money;
};

const MONTHS_PER_YEAR = "12";

function vsCheapest(row: ComparisonRow, cheapest: ComparisonRow): VsCheapest {
  const extraCost = row.cost.totalCost.minus(cheapest.cost.totalCost);
  return {
    extraCost,
    lessReceived: cheapest.quote.received.minus(row.quote.received),
    extraCostPerYear: extraCost.times(MONTHS_PER_YEAR),
  };
}

/**
 * Something about a row that its numbers can't show (Project Plan §4). A code with its values, not
 * a sentence: the page writes it in the reader's language (docs/adr/0005).
 * - `monthly_allowance`: the markup-free part is a monthly allowance; exchanges earlier in the
 *   month use it up, and the price shown assumes none of it was used.
 * - `amount_limit`: the provider accepts at most `max` per transfer.
 */
export type Caveat =
  | { readonly code: "monthly_allowance"; readonly allowance: Money }
  | { readonly code: "amount_limit"; readonly max: Money };

/** The caveats that follow from an offer's own data. */
function caveatsFor(offer: ProviderOffer): Caveat[] {
  const caveats: Caveat[] = [];
  if (offer.pricing.kind === "markup" && offer.pricing.tier) {
    caveats.push({ code: "monthly_allowance", allowance: offer.pricing.tier.upTo });
  }
  const max = maxAmount(offer.fees);
  if (max) caveats.push({ code: "amount_limit", max });
  return caveats;
}

/**
 * Why an offer can't be compared for this amount. A code, not a sentence: the page shows it in
 * the reader's language (docs/adr/0005).
 */
export type UnavailableReason = "no_reference_rate" | "amount_not_supported" | "implausible_cost";

type Unavailable = { readonly offer: ProviderOffer; readonly reason: UnavailableReason };

export type Comparison = {
  readonly amount: Money;
  /** The newest reference rate (used for rule-based providers). */
  readonly mid: MidRateObservation;
  /** True when `mid` was published more than MID_RATE_MAX_AGE_DAYS days ago (in Zurich). */
  readonly midTooOld: boolean;
  /** Fresh offers, cheapest (lowest total cost) first. */
  readonly ranked: readonly ComparisonRow[];
  /** Offers whose data is older than RECHECK_DAYS: shown, but not ranked. */
  readonly stale: readonly ComparisonRow[];
  /** Offers that can't serve this amount, have no reference rate for their day, or fail the
   * sanity guard. */
  readonly unavailable: readonly Unavailable[];
};

/** No reference rate is stored for the corridor, so no fair comparison is possible. */
export class NoMidRateError extends Error {
  override name = "NoMidRateError";
}

/** The calendar day in Zurich ("YYYY-MM-DD"): ECB rates are dated in Central European time. */
function zurichDay(instant: Date): string {
  return instant.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
}

/**
 * The markup for a converted amount c. Without a tier it's the single published markup. With a
 * tier, the part up to the limit gets `markup` and the part above gets `tier.markupAbove`; the
 * result is the blended fraction over the whole amount:
 *   (markup × min(c, limit) + markupAbove × max(0, c − limit)) / c
 * The limit may be stated in the target currency (Revolut: CHF 1'250 also when you pay in EUR); it
 * is then converted into the source currency at the reference rate, the rate the exchange uses.
 */
function markupFor(
  pricing: Extract<ProviderOffer["pricing"], { kind: "markup" }>,
  converted: Money,
  mid: Rate,
): Decimal {
  const { tier } = pricing;
  if (!tier) return pricing.markup;
  const limit =
    tier.upTo.currency === converted.currency ? tier.upTo : mid.invert().convert(tier.upTo);
  if (converted.compareTo(limit) <= 0) return pricing.markup;
  const above = converted.minus(limit);
  return limit.times(pricing.markup).plus(above.times(tier.markupAbove)).dividedBy(converted.amount)
    .amount;
}

/**
 * A manual rate moved to today's reference rate (ADR 0010): the same distance from the reference
 * rate as on the day it was read, so it is comparable with the rule-based offers:
 *   estimate = rate read × today's reference / that day's reference
 * A rate read today stays as it is. Not via `withMarkup`: a rate better than its day's reference
 * (a typo) gives a negative markup, which the sanity guard must see, not an exception.
 */
function atTodaysReference(read: Rate, thatDay: Rate, today: Rate): Rate {
  return Rate.of(read.base, read.quote, read.value.times(today.value).dividedBy(thatDay.value));
}

/** Use case: compare every provider for "I pay `amount`, the recipient gets `target`". */
export async function compareProviders(
  ports: { readonly offers: OfferRepository; readonly midRates: MidRateRepository },
  request: { readonly amount: Money; readonly target: CurrencyCode; readonly now: Date },
): Promise<Comparison> {
  const source = request.amount.currency;
  const mid = await ports.midRates.latest(source, request.target);
  if (!mid) throw new NoMidRateError(`No reference rate stored for ${source}→${request.target}`);
  const offers = await ports.offers.latestOffers(source, request.target);

  // A manual rate is measured against the reference rate of the day it was read (ADR 0010).
  const midByDay = new Map<string, MidRateObservation | null>();
  for (const offer of offers) {
    if (offer.pricing.kind !== "rate") continue;
    const day = zurichDay(offer.pricing.capturedAt);
    if (!midByDay.has(day)) {
      midByDay.set(day, await ports.midRates.latest(source, request.target, day));
    }
  }
  return rankOffers(offers, mid, request.amount, request.now, (day) => midByDay.get(day) ?? null);
}

/**
 * The pure part of the use case: no I/O, so it's tested directly with plain data.
 * `midOn(day)` gives the reference rate for a manual rate's day (defaults to `mid`).
 */
export function rankOffers(
  offers: readonly ProviderOffer[],
  mid: MidRateObservation,
  amount: Money,
  now: Date,
  midOn: (day: string) => MidRateObservation | null = () => mid,
): Comparison {
  const fresh: ComparisonRow[] = [];
  const stale: ComparisonRow[] = [];
  const unavailable: Unavailable[] = [];

  const midRate = mid.rate;
  for (const offer of offers) {
    const { pricing } = offer;
    let measuredAgainst: MidRateObservation | null = null;
    let providerRate: Rate | ((converted: Money) => Rate);
    if (pricing.kind === "rate") {
      measuredAgainst = midOn(zurichDay(pricing.capturedAt));
      if (!measuredAgainst) {
        unavailable.push({ offer, reason: "no_reference_rate" });
        continue;
      }
      providerRate = atTodaysReference(pricing.rate, measuredAgainst.rate, midRate);
    } else {
      providerRate = (converted: Money) =>
        midRate.withMarkup(markupFor(pricing, converted, midRate));
    }

    let quote: QuoteAmounts;
    try {
      quote = quoteFromRule({ totalPaid: amount, fees: offer.fees, providerRate });
    } catch (error) {
      // Only "this amount can't be served"; any other error is a bug or broken data and must surface.
      if (!(error instanceof AmountNotSupportedError)) throw error;
      unavailable.push({ offer, reason: "amount_not_supported" });
      continue;
    }
    const cost = computeCost(quote, midRate);
    // "Below 0%" uses the cost rounded to the cent: rounding the payout up can leave a free
    // provider (no fee, no markup) a fraction of a cent "below 0", which is not a data error.
    if (cost.totalCostPct.gt(MAX_PLAUSIBLE_COST) || cost.totalCost.amount.lt(0)) {
      unavailable.push({ offer, reason: "implausible_cost" });
      continue;
    }
    const row: ComparisonRow = {
      offer,
      quote,
      cost,
      mid,
      measuredAgainst,
      approximate: pricing.kind === "rate",
      caveats: caveatsFor(offer),
      vsCheapest: null,
    };
    const ageDays = (now.getTime() - offer.checkedAt.getTime()) / DAY_MS;
    (ageDays > RECHECK_DAYS ? stale : fresh).push(row);
  }

  // Equal costs: by provider id as plain text, the same on every server (not localeCompare).
  const byCost = (a: ComparisonRow, b: ComparisonRow) =>
    a.cost.totalCost.compareTo(b.cost.totalCost) ||
    (a.offer.providerId < b.offer.providerId ? -1 : 1);

  fresh.sort(byCost);
  const [cheapest] = fresh;
  const ranked = cheapest
    ? fresh.map((row) => ({ ...row, vsCheapest: vsCheapest(row, cheapest) }))
    : [];

  // Calendar days from the publication day to today, both in Zurich (the rate's own time zone).
  const midAgeDays = (Date.parse(zurichDay(now)) - Date.parse(mid.asOf)) / DAY_MS;
  return {
    amount,
    mid,
    midTooOld: midAgeDays > MID_RATE_MAX_AGE_DAYS,
    ranked,
    stale: stale.sort(byCost),
    unavailable,
  };
}
