import { ROUNDING, type RoundingMode } from "./decimal.ts";
import { type FeeModel, splitPayment } from "./fees.ts";
import type { Money } from "./money.ts";
import type { Rate } from "./rate.ts";

/**
 * The three amounts every comparison needs. The full stored quote (capture time, source,
 * countries, mid rate used) is added with the database in stage 3 and wraps these amounts.
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
 * `received` is rounded to the recipient currency's minor unit, because that's what is
 * actually paid out. Some providers round differently; pass `rounding` to match them.
 */
export function quoteFromRule(params: {
  readonly totalPaid: Money;
  readonly fees: FeeModel;
  readonly providerRate: Rate | ((converted: Money) => Rate);
  readonly rounding?: RoundingMode;
}): QuoteAmounts {
  const rounding = params.rounding ?? ROUNDING.halfEven;
  const split = splitPayment(params.totalPaid, params.fees, rounding);
  const rate =
    typeof params.providerRate === "function"
      ? params.providerRate(split.converted)
      : params.providerRate;
  return {
    totalPaid: params.totalPaid,
    visibleFee: split.fee,
    received: rate.convert(split.converted).round(rounding),
  };
}
