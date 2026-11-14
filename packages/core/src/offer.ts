import type { CurrencyCode } from "./currency.ts";
import type { Decimal } from "./decimal.ts";
import type { FeeModel } from "./fees.ts";
import type { Money } from "./money.ts";
import type { Rate } from "./rate.ts";

export type ProviderKind = "bank" | "fintech" | "money_transfer_operator";

/** Where a price comes from (ADR 0003). */
export type SourceKind = "rule_based" | "manual";

/**
 * How the provider's exchange rate is known:
 * - `markup`: a published markup over mid-market (rule-based); the rate follows the mid exactly.
 *   With `tier`, `markup` applies to the converted amount up to `tier.upTo` and `tier.markupAbove`
 *   to the part above it (e.g. Revolut: 0% within the monthly allowance, 1% beyond).
 * - `rate`: a rate read by hand at a known time (manual); its distance from that day's mid is
 *   applied to today's mid (ADR 0010).
 */
export type Pricing =
  | {
      readonly kind: "markup";
      readonly markup: Decimal;
      readonly tier?: { readonly upTo: Money; readonly markupAbove: Decimal };
    }
  | { readonly kind: "rate"; readonly rate: Rate; readonly capturedAt: Date };

/**
 * A provider's current pricing for one corridor, with where it came from and when it was checked.
 * The data files' research `note` is not part of it: it is English evidence for the owner and
 * reviewers (kept in git and the database), not text for the page (docs/adr/0005).
 */
export type ProviderOffer = {
  readonly providerId: string;
  readonly providerName: string;
  readonly providerKind: ProviderKind;
  readonly sourceKind: SourceKind;
  readonly sourceCurrency: CurrencyCode;
  readonly targetCurrency: CurrencyCode;
  readonly fees: FeeModel;
  readonly pricing: Pricing;
  readonly sourceUrl: string;
  readonly checkedAt: Date;
};

/** A dated official reference rate (e.g. the ECB rate of 2026-11-05). */
export type MidRateObservation = {
  readonly rate: Rate;
  /** "ecb" (the only reference rate source in v1, ADR 0008) */
  readonly source: string;
  /** Publication date, "YYYY-MM-DD". */
  readonly asOf: string;
  readonly fetchedAt: Date;
};
