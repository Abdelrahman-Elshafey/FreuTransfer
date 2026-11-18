import type { ComparisonDto } from "@freu-transfer/api/contract";

/** The amounts the "cost by amount" chart samples (Project Plan §4), in the paying currency. */
export const CHART_AMOUNTS = ["100", "500", "1000", "2500", "5000"] as const;

/**
 * A fixed colour slot per provider (`--series-N` in styles.css): colour follows the provider,
 * never its rank, so a provider keeps its colour in both directions and at every amount.
 * chart-data.test.ts checks that every provider in data/manual/providers.json has one.
 */
const SERIES_SLOTS: Readonly<Record<string, number>> = {
  wise: 1,
  revolut: 2,
  yuh: 3,
  postfinance: 4,
  "western-union": 5,
};

export function seriesSlot(providerId: string): number | null {
  return Object.hasOwn(SERIES_SLOTS, providerId) ? (SERIES_SLOTS[providerId] ?? null) : null;
}

/** One provider's line: its cost % at each of CHART_AMOUNTS, null where it isn't ranked. */
export type Series = {
  readonly providerId: string;
  readonly providerName: string;
  /** The API's percent string ("0.95" = 0.95%) per amount; null = not available there (a gap). */
  readonly points: readonly (string | null)[];
};

/**
 * The chart's lines from one comparison per amount (same order as CHART_AMOUNTS). Only ranked
 * rows count, like the ranking: a stale or unavailable provider leaves a gap, never a zero.
 * Ordered by colour slot (then id), so the legend reads the same at every amount.
 */
export function costSeries(comparisons: readonly ComparisonDto[]): Series[] {
  const names = new Map<string, string>();
  for (const c of comparisons) for (const r of c.results) names.set(r.providerId, r.providerName);
  const order = (id: string) => seriesSlot(id) ?? Number.POSITIVE_INFINITY;
  return [...names]
    .sort(([a], [b]) => order(a) - order(b) || (a < b ? -1 : 1))
    .map(([providerId, providerName]) => ({
      providerId,
      providerName,
      points: comparisons.map(
        (c) => c.results.find((r) => r.providerId === providerId)?.totalCostPercent ?? null,
      ),
    }));
}

/**
 * Y-axis ticks for percentages up to `max`: 0 and at most 5 clean steps above it, the top one at
 * or above `max`. Numbers only place the axis on screen (the plotted values' labels stay the API's
 * strings, formatted by Intl); each tick's label is its own fixed-decimal string.
 */
export function percentTicks(max: number): string[] {
  const steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10];
  const step = steps.find((s) => Math.ceil(max / s) <= 5) ?? 10;
  const count = Math.max(1, Math.ceil(max / step));
  const decimals = step < 1 ? (step === 0.25 ? 2 : 1) : 0;
  return Array.from({ length: count + 1 }, (_, i) => (i * step).toFixed(decimals));
}

/**
 * Y-axis ticks for rates between `min` and `max` (a rate chart doesn't start at 0: it shows how a
 * rate moves). The smallest clean step that covers the range in at most 5 steps, from the step at
 * or below `min` to the one at or above `max`; one step on each side when every rate is equal.
 * Numbers only place the axis; each label is its own fixed-decimal string.
 */
export function rateTicks(min: number, max: number): string[] {
  // [step, decimals its labels need]
  const steps = [
    [0.0005, 4],
    [0.001, 3],
    [0.002, 3],
    [0.0025, 4],
    [0.005, 3],
    [0.01, 2],
    [0.02, 2],
    [0.025, 3],
    [0.05, 2],
    [0.1, 1],
  ] as const;
  // The small epsilon keeps a value sitting exactly on a step (1.08 / 0.005) from floating past it.
  const lowOf = (step: number) => Math.floor(min / step + 1e-9);
  const highOf = (step: number) => Math.ceil(max / step - 1e-9);
  const [step, decimals] = steps.find(([s]) => highOf(s) - lowOf(s) <= 5) ?? [0.1, 1];
  let low = lowOf(step);
  let high = highOf(step);
  if (low === high) {
    low -= 1;
    high += 1;
  }
  return Array.from({ length: high - low + 1 }, (_, i) => ((low + i) * step).toFixed(decimals));
}
