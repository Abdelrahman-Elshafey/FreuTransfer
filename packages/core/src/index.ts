/**
 * @freu-transfer/core — the pure domain package.
 *
 * Rules (see CLAUDE.md): no I/O, no imports from other workspace packages,
 * money only through the Money/Rate value objects.
 */
export {
  type Comparison,
  type ComparisonRow,
  compareProviders,
  NoMidRateError,
  RECHECK_DAYS,
  rankOffers,
  zurichDay,
} from "./compare.ts";
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
export type {
  MidRateObservation,
  Pricing,
  ProviderKind,
  ProviderOffer,
  SourceKind,
} from "./offer.ts";
export type { MidRateRepository, OfferRepository } from "./ports.ts";
export { type QuoteAmounts, quoteFromRule } from "./quote.ts";
export { Rate } from "./rate.ts";
