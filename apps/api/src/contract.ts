/**
 * The API's HTTP contract, one source for both sides: the handlers are typed against it, and the
 * page imports it (`@freu-transfer/api/contract`). The response types come from the Zod schemas in
 * schemas.ts (which also make the OpenAPI document), through type-only imports: at runtime this
 * file imports nothing, so the page's bundle gets no Zod and nothing else from the API
 * (contract.test.ts checks it).
 *
 * Language-neutral (docs/adr/0005): codes, money and dates only; the page writes the sentences.
 */
import type { z } from "zod";
import type {
  caveatSchema,
  comparisonSchema,
  historySchema,
  midRateSchema,
  moneySchema,
  problemSchema,
  resultRowSchema,
} from "./schemas.ts";

/** An amount as the API takes it: at most 7 digits and 2 decimals ("1000", "1000.50"). */
export const AMOUNT_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;

/** A positive amount in AMOUNT_PATTERN; never a float. */
export function isAmount(value: string): boolean {
  return AMOUNT_PATTERN.test(value) && /[1-9]/.test(value);
}

/**
 * The problem types this API defines (RFC 9457 §3.1.1): non-resolvable tag URIs. Errors without
 * their own meaning use "about:blank" with the plain HTTP status phrase as title (§4.2.1).
 */
export const PROBLEM_TYPES = {
  invalidQuery: "tag:aelshafey.com,2026:freu-transfer/problems/invalid-query",
  corridorNotAvailable: "tag:aelshafey.com,2026:freu-transfer/problems/corridor-not-available",
} as const;

export type ProblemDto = z.infer<typeof problemSchema>;
export type MoneyDto = z.infer<typeof moneySchema>;
export type MidRateDto = z.infer<typeof midRateSchema>;
export type CaveatDto = z.infer<typeof caveatSchema>;
export type ResultRowDto = z.infer<typeof resultRowSchema>;
/** `GET /v1/compare?from=CHF&to=EUR&amount=1000` */
export type ComparisonDto = z.infer<typeof comparisonSchema>;
/** `GET /v1/history?from=CHF&to=EUR&days=90` */
export type HistoryDto = z.infer<typeof historySchema>;
