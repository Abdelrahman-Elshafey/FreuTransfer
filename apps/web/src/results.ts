import type { ResultRowDto } from "@freu-transfer/api/contract";

/**
 * The providers that get the "cheapest" badge: every ranked row whose total cost equals the
 * lowest one, so a tie gives the badge to both, not only to whichever the ranking lists first.
 * The rows come ranked (cheapest first) and their costs are strings in one currency, rounded to
 * the cent by the API: equal strings are equal costs, with no number conversion.
 */
export function cheapestIds(ranked: readonly ResultRowDto[]): ReadonlySet<string> {
  const lowest = ranked[0]?.totalCost.amount;
  return new Set(ranked.filter((r) => r.totalCost.amount === lowest).map((r) => r.providerId));
}
