import {
  type ComparisonDto,
  type HistoryDto,
  PROBLEM_TYPES,
  type ProblemDto,
} from "@freu-transfer/api/contract";
import type { OpenApiDocument } from "./api-docs.ts";

/** What went wrong, as a code: the page turns it into a sentence in the reader's language. */
export type ApiError =
  | { readonly kind: "unreachable" }
  | { readonly kind: "notJson"; readonly status: number }
  | { readonly kind: "http"; readonly status: number }
  | { readonly kind: "invalidQuery" }
  | { readonly kind: "corridorNotAvailable" };

/** The directions the page offers: the v1 corridors (ADR 0008). The first is the default. */
export const DIRECTIONS = [
  { from: "CHF", to: "EUR" },
  { from: "EUR", to: "CHF" },
] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** An API answer: the data, or what went wrong as a code. */
export type Outcome<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ApiError };

/**
 * GET from our API. Network and server failures become an `ApiError`; only unexpected errors
 * (bugs) are thrown. /v1/* goes to the API: through Vite's proxy in development
 * (vite.config.ts), through nginx in production (apps/web/nginx.conf, docs/adr/0004).
 */
async function getJson<T>(path: string, fetchFn: typeof fetch): Promise<Outcome<T>> {
  let res: Response;
  let body: unknown;
  try {
    res = await fetchFn(path);
    // Inside the try: the connection can also break while the body arrives.
    body = await readJson(res);
  } catch (error) {
    // fetch, and reading its body, reject with a TypeError when the network or the server fails.
    if (!(error instanceof TypeError)) throw error;
    return failed({ kind: "unreachable" });
  }
  if (body === NOT_JSON) {
    return failed(
      res.ok ? { kind: "notJson", status: res.status } : { kind: "http", status: res.status },
    );
  }
  if (res.ok) return { ok: true, data: body as T };

  const type = (body as Partial<ProblemDto> | null)?.type;
  if (type === PROBLEM_TYPES.invalidQuery) return failed({ kind: "invalidQuery" });
  if (type === PROBLEM_TYPES.corridorNotAvailable) return failed({ kind: "corridorNotAvailable" });
  return failed({ kind: "http", status: res.status });
}

/**
 * `GET /v1/compare` for "I pay `amount` in `direction.from`, the recipient gets `direction.to`".
 * `amount` is already in the API's form ("1000.50", see parseAmount).
 */
export function fetchComparison(
  direction: Direction,
  amount: string,
  fetchFn: typeof fetch = fetch,
): Promise<Outcome<ComparisonDto>> {
  const query = new URLSearchParams({ from: direction.from, to: direction.to, amount });
  return getJson(`/v1/compare?${query}`, fetchFn);
}

/** `GET /v1/history`: the reference rates of the API's default period (HistoryDto.days). */
export function fetchHistory(
  direction: Direction,
  fetchFn: typeof fetch = fetch,
): Promise<Outcome<HistoryDto>> {
  const query = new URLSearchParams({ from: direction.from, to: direction.to });
  return getJson(`/v1/history?${query}`, fetchFn);
}

/** `GET /v1/openapi.json`: the API's own description, for the API page. */
export function fetchApiDescription(
  fetchFn: typeof fetch = fetch,
): Promise<Outcome<OpenApiDocument>> {
  return getJson("/v1/openapi.json", fetchFn);
}

/**
 * One comparison per amount (the "cost by amount" chart), asked in parallel. All or nothing: the
 * first failure is returned, so a chart is never drawn from a partial set.
 */
export async function fetchComparisons(
  direction: Direction,
  amounts: readonly string[],
  fetchFn: typeof fetch = fetch,
): Promise<Outcome<readonly ComparisonDto[]>> {
  const outcomes = await Promise.all(amounts.map((a) => fetchComparison(direction, a, fetchFn)));
  const data: ComparisonDto[] = [];
  for (const outcome of outcomes) {
    if (!outcome.ok) return outcome;
    data.push(outcome.data);
  }
  return { ok: true, data };
}

const failed = (error: ApiError) => ({ ok: false, error }) as const;

const NOT_JSON = Symbol("not JSON");

/** The parsed body, or NOT_JSON when it isn't JSON (res.json() rejects with a SyntaxError). */
async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return NOT_JSON;
  }
}
