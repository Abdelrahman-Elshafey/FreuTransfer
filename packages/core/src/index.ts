/**
 * @freu-transfer/core — the pure domain package.
 *
 * Rules (see CLAUDE.md): no I/O, no imports from other workspace packages,
 * money only through the Money/Rate value objects.
 */
export const CORE_VERSION = "0.1.0";

export { type CostBreakdown, computeCost } from "./cost.ts";
export {
  assertCurrencyCode,
  type CurrencyCode,
  isCurrencyCode,
  minorUnits,
} from "./currency.ts";
export { Decimal, type DecimalInput, ROUNDING, type RoundingMode } from "./decimal.ts";
export { CurrencyMismatchError, MoneyError } from "./errors.ts";
export {
  type FeeModel,
  type FeeRule,
  type FeeTier,
  feeRule,
  type PaymentSplit,
  type SimpleFeeModel,
  splitPayment,
} from "./fees.ts";
export { Money } from "./money.ts";
export { type QuoteAmounts, quoteFromRule } from "./quote.ts";
export { Rate } from "./rate.ts";
