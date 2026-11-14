import { type ComparisonDto, PROBLEM_TYPES, type ProblemDto } from "@freu-transfer/api/contract";

/** What went wrong, as a code: the page turns it into a sentence in the reader's language. */
export type CompareError =
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

export type CompareOutcome =
  | { readonly ok: true; readonly data: ComparisonDto }
  | { readonly ok: false; readonly error: CompareError };

/**
 * Calls `GET /v1/compare` for "I pay `amount` in `direction.from`, the recipient gets `direction.to`". Network and server failures become a `CompareError`; only unexpected
 * errors (bugs) are thrown. `amount` is already in the API's form ("1000.50", see parseAmount).
 * /v1/* goes to the API: through Vite's proxy in development (vite.config.ts), through nginx
 * in production (apps/web/nginx.conf, docs/adr/0004).
 */
export async function fetchComparison(
  direction: Direction,
  amount: string,
  fetchFn: typeof fetch = fetch,
): Promise<CompareOutcome> {
  const query = new URLSearchParams({ from: direction.from, to: direction.to, amount });
  let res: Response;
  try {
    res = await fetchFn(`/v1/compare?${query}`);
  } catch (error) {
    // fetch rejects with a TypeError when the network or the server can't be reached.
    if (!(error instanceof TypeError)) throw error;
    return failed({ kind: "unreachable" });
  }
  const body = await readJson(res);
  if (body === NOT_JSON) {
    return failed(
      res.ok ? { kind: "notJson", status: res.status } : { kind: "http", status: res.status },
    );
  }
  if (res.ok) return { ok: true, data: body as ComparisonDto };

  const type = (body as Partial<ProblemDto> | null)?.type;
  if (type === PROBLEM_TYPES.invalidQuery) return failed({ kind: "invalidQuery" });
  if (type === PROBLEM_TYPES.corridorNotAvailable) return failed({ kind: "corridorNotAvailable" });
  return failed({ kind: "http", status: res.status });
}

const failed = (error: CompareError): CompareOutcome => ({ ok: false, error });

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
