/**
 * @freu-transfer/core — the pure domain package.
 *
 * Rules (see CLAUDE.md): no I/O, no imports from other workspace packages,
 * money only through the Money/Rate value objects.
 *
 * Only what other packages use is exported (knip checks this with `includeEntryExports`).
 */
export {
  type ComparisonRow,
  compareProviders,
  NoMidRateError,
  RECHECK_DAYS,
  type UnavailableReason,
} from "./compare.ts";
export { assertCurrencyCode, type CurrencyCode, isCurrencyCode } from "./currency.ts";
export { Decimal, toFixedString } from "./decimal.ts";
export { type FeeModel, feeRule } from "./fees.ts";
export { Money } from "./money.ts";
export type {
  MidRateObservation,
  Pricing,
  ProviderKind,
  ProviderOffer,
  SourceKind,
} from "./offer.ts";
export type {
  CollectorRunId,
  CollectorStore,
  CorridorPair,
  CorridorRepository,
  MidRateConflict,
  MidRateRepository,
  OfferRepository,
  RawObservationId,
  SaveMidRatesResult,
} from "./ports.ts";
export { Rate } from "./rate.ts";
