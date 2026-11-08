import { type Decimal, ROUND_HALF_EVEN } from "./decimal.ts";
import { CurrencyMismatchError, MoneyError } from "./errors.ts";
import type { Money } from "./money.ts";
import type { QuoteAmounts } from "./quote.ts";
import type { Rate } from "./rate.ts";

/** Digits kept for cost percentages as fractions: 0.023598 = 2.3598%. */
const PCT_DECIMALS = 6;

/** The result shown to users. All money is in the sender's currency except `received`/`idealReceived`. */
export type CostBreakdown = {
  readonly totalPaid: Money;
  readonly received: Money;
  /** What would arrive at the mid-market rate with no fee at all. */
  readonly idealReceived: Money;
  /** What arrived, valued back in the sender's currency at mid-market. */
  readonly receivedValueAtMid: Money;
  /** Everything you lost compared with the fair rate: fee + hidden markup. */
  readonly totalCost: Money;
  readonly visibleFee: Money;
  /** The hidden cost inside the exchange rate. */
  readonly fxMarkup: Money;
  /** totalCost / totalPaid as a fraction (0.0236 = 2.36%). */
  readonly totalCostPct: Decimal;
};

/**
 * The universal cost formula (Project Plan §3), the same for every provider:
 *
 *   total_cost   = total_paid − received / mid_rate
 *   fx_markup    = total_cost − visible_fee
 *   total_cost_% = total_cost / total_paid
 *
 * Everything is computed at full precision and rounded only here, at the end. The markup is
 * derived from the *rounded* total and fee, so fee + markup = total holds to the cent in what
 * users see. A negative total cost means the quote beats the reference rate (e.g. stale data);
 * it is returned as is, and the sanity guards in the collectors decide what to do with it.
 */
export function computeCost(quote: QuoteAmounts, mid: Rate): CostBreakdown {
  const { totalPaid, visibleFee, received } = quote;
  if (mid.base !== totalPaid.currency || mid.quote !== received.currency) {
    throw new CurrencyMismatchError(
      `Mid rate ${mid.base}→${mid.quote} doesn't match quote ${totalPaid.currency}→${received.currency}`,
    );
  }
  if (visibleFee.currency !== totalPaid.currency) {
    throw new CurrencyMismatchError("The visible fee must be in the sender's currency");
  }
  if (!totalPaid.amount.gt(0)) throw new MoneyError("Total paid must be positive");

  const receivedValueAtMid = mid.invert().convert(received);
  const exactTotalCost = totalPaid.minus(receivedValueAtMid);

  const totalCost = exactTotalCost.round();
  const roundedFee = visibleFee.round();

  return {
    totalPaid,
    received,
    idealReceived: mid.convert(totalPaid).round(),
    receivedValueAtMid: receivedValueAtMid.round(),
    totalCost,
    visibleFee: roundedFee,
    fxMarkup: totalCost.minus(roundedFee),
    totalCostPct: exactTotalCost.amount
      .dividedBy(totalPaid.amount)
      .toDecimalPlaces(PCT_DECIMALS, ROUND_HALF_EVEN),
  };
}
