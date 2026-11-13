import { type CostBreakdown, computeCost } from "./cost.ts";
import type { CurrencyCode } from "./currency.ts";
import type { Decimal } from "./decimal.ts";
import { AmountNotSupportedError } from "./errors.ts";
import type { Money } from "./money.ts";
import type { MidRateObservation, ProviderOffer } from "./offer.ts";
import type { MidRateRepository, OfferRepository } from "./ports.ts";
import { type QuoteAmounts, quoteFromRule } from "./quote.ts";

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

export type ComparisonRow = {
  readonly offer: ProviderOffer;
  readonly quote: QuoteAmounts;
  readonly cost: CostBreakdown;
  /** The reference rate this row was compared with. */
  readonly mid: MidRateObservation;
  /** True for manual rates: read at another time than the reference rate (~14:10 CET). */
  readonly approximate: boolean;
};

/**
 * Why an offer can't be compared for this amount. A code, not a sentence: the page shows it in
 * the reader's language (docs/adr/0005).
 */
export type UnavailableReason = "no_reference_rate" | "amount_not_supported";

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
  /** Offers that can't serve this amount, or have no reference rate for their day. */
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
 * The markup for a converted amount. Without a tier it's the single published markup. With a tier,
 * the part up to `tier.upTo` gets `markup` and the part above gets `tier.markupAbove`; the result is
 * the blended fraction over the whole amount:
 *   (markup × min(c, upTo) + markupAbove × max(0, c − upTo)) / c
 */
function markupFor(
  pricing: Extract<ProviderOffer["pricing"], { kind: "markup" }>,
  converted: Money,
): Decimal {
  const { tier } = pricing;
  if (!tier || converted.compareTo(tier.upTo) <= 0) return pricing.markup;
  const above = converted.minus(tier.upTo);
  return tier.upTo
    .times(pricing.markup)
    .plus(above.times(tier.markupAbove))
    .dividedBy(converted.amount).amount;
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

  // A manual rate is compared with the reference rate of the day it was read, not today's.
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

  for (const offer of offers) {
    const { pricing } = offer;
    let rowMid = mid;
    if (pricing.kind === "rate") {
      const day = zurichDay(pricing.capturedAt);
      const found = midOn(day);
      if (!found) {
        unavailable.push({ offer, reason: "no_reference_rate" });
        continue;
      }
      rowMid = found;
    }
    const midRate = rowMid.rate;
    const providerRate =
      pricing.kind === "markup"
        ? (converted: Money) => midRate.withMarkup(markupFor(pricing, converted))
        : pricing.rate;

    let quote: QuoteAmounts;
    try {
      quote = quoteFromRule({ totalPaid: amount, fees: offer.fees, providerRate });
    } catch (error) {
      // Only "this amount can't be served"; any other error is a bug or broken data and must surface.
      if (!(error instanceof AmountNotSupportedError)) throw error;
      unavailable.push({ offer, reason: "amount_not_supported" });
      continue;
    }
    const row: ComparisonRow = {
      offer,
      quote,
      cost: computeCost(quote, rowMid.rate),
      mid: rowMid,
      approximate: pricing.kind === "rate",
    };
    const ageDays = (now.getTime() - offer.checkedAt.getTime()) / DAY_MS;
    (ageDays > RECHECK_DAYS ? stale : fresh).push(row);
  }

  // Equal costs: by provider id as plain text, the same on every server (not localeCompare).
  const byCost = (a: ComparisonRow, b: ComparisonRow) =>
    a.cost.totalCost.compareTo(b.cost.totalCost) ||
    (a.offer.providerId < b.offer.providerId ? -1 : 1);

  // Calendar days from the publication day to today, both in Zurich (the rate's own time zone).
  const midAgeDays = (Date.parse(zurichDay(now)) - Date.parse(mid.asOf)) / DAY_MS;
  return {
    amount,
    mid,
    midTooOld: midAgeDays > MID_RATE_MAX_AGE_DAYS,
    ranked: fresh.sort(byCost),
    stale: stale.sort(byCost),
    unavailable,
  };
}
