/** The response of `GET /v1/compare` (apps/api). Money and percentages arrive as strings. */
export type MoneyDto = { amount: string; currency: string };
type MidRateDto = { rate: string; source: string; asOf: string };

export type ResultRow = {
  providerId: string;
  providerName: string;
  providerKind: string;
  sourceKind: "rule_based" | "manual";
  received: MoneyDto;
  visibleFee: MoneyDto;
  fxMarkup: MoneyDto;
  totalCost: MoneyDto;
  /** "0.95" means 0.95% */
  totalCostPercent: string;
  approximate: boolean;
  /** The reference rate this row was compared with. */
  midRate: MidRateDto;
  checkedAt: string;
  sourceUrl: string;
  note: string | null;
};

type Comparison = {
  amount: MoneyDto;
  midRate: MidRateDto;
  /** Data older than this many days is in `stale`, not ranked. */
  recheckDays: number;
  results: (ResultRow & { rank: number })[];
  stale: ResultRow[];
  unavailable: { providerId: string; providerName: string; reason: string }[];
};

type Problem = { title: string; detail?: string; errors?: { field: string; message: string }[] };

export type CompareOutcome = { ok: true; data: Comparison } | { ok: false; message: string };

/**
 * Calls the API. Network and server failures become a message the page can show; only
 * unexpected errors (bugs) are thrown.
 * In development Vite forwards /api/* to the API (vite.config.ts); production does the same.
 */
export async function fetchComparison(
  amount: string,
  fetchFn: typeof fetch = fetch,
): Promise<CompareOutcome> {
  const query = new URLSearchParams({ from: "CHF", to: "EUR", amount });
  let res: Response;
  try {
    res = await fetchFn(`/api/v1/compare?${query}`);
  } catch (error) {
    // fetch rejects with a TypeError when the network or the server can't be reached.
    if (!(error instanceof TypeError)) throw error;
    return { ok: false, message: "The API can't be reached. Is it running?" };
  }
  const body = await readJson(res);
  if (body === NOT_JSON) {
    return {
      ok: false,
      message: res.ok
        ? `The API answered with something that isn't JSON (HTTP ${res.status}).`
        : `The API answered with HTTP ${res.status}.`,
    };
  }
  if (res.ok) return { ok: true, data: body as Comparison };

  const problem = body as Problem | null;
  if (!problem) return { ok: false, message: `The API answered with HTTP ${res.status}.` };
  const details = problem.errors?.map((e) => `${e.field}: ${e.message}`).join("; ");
  return {
    ok: false,
    message: [problem.title, problem.detail, details].filter(Boolean).join(". "),
  };
}

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
