/**
 * The API's HTTP contract, one source for both sides: the handlers are typed against it, and the
 * page imports it (`@freu-transfer/api/contract`). Plain types and constants only: no Express or
 * Node imports, so the page's bundle gets nothing else from the API.
 *
 * Language-neutral (docs/adr/0005): codes, money and dates only; the page writes the sentences.
 */
import type { UnavailableReason } from "@freu-transfer/core";

/** A positive amount with at most 7 digits and 2 decimals ("1000", "1000.50"); never a float. */
export function isAmount(value: string): boolean {
  return /^\d{1,7}(\.\d{1,2})?$/.test(value) && /[1-9]/.test(value);
}

/**
 * The problem types this API defines (RFC 9457 §3.1.1): non-resolvable tag URIs. Errors without
 * their own meaning use "about:blank" with the plain HTTP status phrase as title (§4.2.1).
 */
export const PROBLEM_TYPES = {
  invalidQuery: "tag:aelshafey.com,2026:freu-transfer/problems/invalid-query",
  corridorNotAvailable: "tag:aelshafey.com,2026:freu-transfer/problems/corridor-not-available",
} as const;

/** RFC 9457 "Problem Details": the body of every API error. The title is for developers. */
export type ProblemDto = {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly errors?: readonly { readonly field: string; readonly message: string }[];
};

/** Amounts are strings, already rounded to the currency's minor unit ("1044.75"). */
export type MoneyDto = { readonly amount: string; readonly currency: string };

type MidRateDto = {
  /** 1 source currency = `rate` target currency, exact ("1.0893"). */
  readonly rate: string;
  /** "ecb" (the only reference rate source in v1, ADR 0008) */
  readonly source: string;
  /** Publication day, "YYYY-MM-DD". */
  readonly asOf: string;
};

/**
 * What the reader should know that a row's numbers can't show (core's `Caveat`): a code with its
 * amounts; the page writes the sentence.
 * - `monthly_allowance`: no markup on the first `allowance` exchanged per month; earlier exchanges
 *   that month use it up (the price assumes none was used).
 * - `amount_limit`: the provider accepts at most `max` per transfer.
 */
export type CaveatDto =
  | { readonly code: "monthly_allowance"; readonly allowance: MoneyDto }
  | { readonly code: "amount_limit"; readonly max: MoneyDto };

export type ResultRowDto = {
  readonly providerId: string;
  readonly providerName: string;
  readonly providerKind: string;
  readonly sourceKind: "rule_based" | "manual";
  readonly received: MoneyDto;
  readonly visibleFee: MoneyDto;
  readonly fxMarkup: MoneyDto;
  readonly totalCost: MoneyDto;
  /** Percent with 2 decimals, rounded once from the exact value: "0.95" means 0.95%. */
  readonly totalCostPercent: string;
  /** True for manual rates: an estimate from a rate read on another day or at another time. */
  readonly approximate: boolean;
  /** The reference rate this row was compared with: the newest one, the same for every row. */
  readonly midRate: MidRateDto;
  /** Manual rates only: when the provider's rate was read (ISO 8601, UTC). */
  readonly rateCapturedAt: string | null;
  /**
   * Manual rates only: the reference rate of the day the provider's rate was read. Its distance
   * from it is applied to `midRate`, so `received` is an estimate at today's rate (ADR 0010).
   */
  readonly measuredAgainst: MidRateDto | null;
  readonly caveats: readonly CaveatDto[];
  /**
   * Ranked rows only (null in `stale`): the difference from the cheapest ranked row, from the
   * rounded amounts shown, zero for the cheapest. `extraCostPerYear` = 12 × `extraCost`, for
   * sending this amount every month.
   */
  readonly vsCheapest: {
    readonly extraCost: MoneyDto;
    readonly lessReceived: MoneyDto;
    readonly extraCostPerYear: MoneyDto;
  } | null;
  /** ISO 8601, UTC. */
  readonly checkedAt: string;
  readonly sourceUrl: string;
};

/** `GET /v1/compare?from=CHF&to=EUR&amount=1000` */
export type ComparisonDto = {
  readonly from: string;
  readonly to: string;
  readonly amount: MoneyDto;
  /** The newest reference rate (used for rule-based providers). */
  readonly midRate: MidRateDto;
  /** True when `midRate` was published more than `midRateMaxAgeDays` days ago: new rates aren't
   * arriving, so the page warns that the results may be out of date. */
  readonly midRateTooOld: boolean;
  readonly midRateMaxAgeDays: number;
  /** Data older than this many days is in `stale`, not ranked. */
  readonly recheckDays: number;
  /** Cheapest first. */
  readonly results: readonly (ResultRowDto & { readonly rank: number })[];
  readonly stale: readonly ResultRowDto[];
  readonly unavailable: readonly {
    readonly providerId: string;
    readonly providerName: string;
    readonly reason: UnavailableReason;
  }[];
};
