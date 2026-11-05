/** The response of `GET /v1/compare` (apps/api). Money and percentages arrive as strings. */
export type MoneyDto = { amount: string; currency: string };

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
  checkedAt: string;
  sourceUrl: string;
  note: string | null;
};

type Comparison = {
  amount: MoneyDto;
  midRate: { rate: string; source: string; asOf: string };
  results: (ResultRow & { rank: number })[];
  stale: ResultRow[];
  unavailable: { providerId: string; providerName: string; reason: string }[];
};

type Problem = { title: string; detail?: string; errors?: { field: string; message: string }[] };

export type CompareOutcome = { ok: true; data: Comparison } | { ok: false; message: string };

/**
 * Calls the API. Never throws: every failure becomes a message the page can show.
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
  } catch {
    return { ok: false, message: "The API can't be reached. Is it running?" };
  }
  if (res.ok) return { ok: true, data: (await res.json()) as Comparison };

  const problem = (await res.json().catch(() => null)) as Problem | null;
  if (!problem) return { ok: false, message: `The API answered with HTTP ${res.status}.` };
  const details = problem.errors?.map((e) => `${e.field}: ${e.message}`).join("; ");
  return {
    ok: false,
    message: [problem.title, problem.detail, details].filter(Boolean).join(". "),
  };
}
