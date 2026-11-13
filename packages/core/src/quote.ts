import { type FeeModel, splitPayment } from "./fees.ts";
import type { Money } from "./money.ts";
import type { Rate } from "./rate.ts";

/**
 * The three amounts every comparison needs. Computed on every request, never stored; the result
 * row around them (`ComparisonRow`) adds the offer's source and dates and the reference rate used.
 */
export type QuoteAmounts = {
  /** Everything that leaves the sender's account (sender currency). */
  readonly totalPaid: Money;
  /** The fees the provider states explicitly (sender currency). */
  readonly visibleFee: Money;
  /** What arrives in the recipient's account (recipient currency). */
  readonly received: Money;
};

/**
 * Builds a quote for a provider that publishes its pricing: apply its fee model to the
 * amount paid, then convert the rest at its rate. For rule-based providers the rate is
 * usually `mid.withMarkup(publishedMarkup)`.
 *
 * `providerRate` can also be a function of the converted amount, for rates that depend on it
 * (a markup tier); it receives the amount after the fee.
 *
 * `received` is rounded (half-even) to the recipient currency's minor unit, because that's
 * what is actually paid out.
 */
export function quoteFromRule(params: {
  readonly totalPaid: Money;
  readonly fees: FeeModel;
  readonly providerRate: Rate | ((converted: Money) => Rate);
}): QuoteAmounts {
  const split = splitPayment(params.totalPaid, params.fees);
  const rate =
    typeof params.providerRate === "function"
      ? params.providerRate(split.converted)
      : params.providerRate;
  return {
    totalPaid: params.totalPaid,
    visibleFee: split.fee,
    received: rate.convert(split.converted).round(),
  };
}
