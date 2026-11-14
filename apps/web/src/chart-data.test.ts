import { readFileSync } from "node:fs";
import type { ComparisonDto, ResultRowDto } from "@freu-transfer/api/contract";
import { describe, expect, it } from "vitest";
import { CHART_AMOUNTS, costSeries, percentTicks, seriesSlot } from "./chart-data.ts";

const row = (providerId: string, percent: string) =>
  ({
    providerId,
    providerName: providerId.toUpperCase(),
    totalCostPercent: percent,
  }) as ResultRowDto;
const comparison = (results: ResultRowDto[], stale: ResultRowDto[] = []) =>
  ({ results, stale }) as unknown as ComparisonDto;

describe("costSeries", () => {
  it("gives each provider its cost % per amount, a gap where it isn't ranked", () => {
    // Western Union-style: available up to 2,500, not at 5,000 (above its limit).
    const comparisons = [
      comparison([row("wise", "0.60"), row("western-union", "2.40")]),
      comparison([row("wise", "0.35"), row("western-union", "2.33")]),
      comparison([row("wise", "0.30")]),
    ];
    expect(costSeries(comparisons)).toEqual([
      { providerId: "wise", providerName: "WISE", points: ["0.60", "0.35", "0.30"] },
      {
        providerId: "western-union",
        providerName: "WESTERN-UNION",
        points: ["2.40", "2.33", null],
      },
    ]);
  });

  it("leaves stale rows out, like the ranking: a gap, not a point", () => {
    const series = costSeries([comparison([row("wise", "0.35")], [row("yuh", "0.95")])]);
    expect(series.map((s) => s.providerId)).toEqual(["wise"]);
  });

  it("orders lines by colour slot, not by cost, so the legend never reshuffles", () => {
    // Revolut is cheaper here, but Wise has slot 1.
    const series = costSeries([comparison([row("revolut", "0.00"), row("wise", "0.35")])]);
    expect(series.map((s) => s.providerId)).toEqual(["wise", "revolut"]);
  });

  it("puts a provider without a slot last instead of failing", () => {
    const series = costSeries([comparison([row("newbank", "1.00"), row("yuh", "0.95")])]);
    expect(series.map((s) => s.providerId)).toEqual(["yuh", "newbank"]);
  });
});

describe("seriesSlot", () => {
  it("has a distinct colour slot for every provider in the data files", () => {
    const providers = JSON.parse(
      readFileSync(new URL("../../../data/manual/providers.json", import.meta.url), "utf8"),
    ) as { id: string }[];
    const slots = providers.map((p) => seriesSlot(p.id));
    expect(slots).not.toContain(null);
    expect(new Set(slots).size).toBe(providers.length);
    // styles.css defines --series-1 … --series-5 (tokens.test.ts checks them in both themes).
    expect(Math.max(...(slots as number[]))).toBeLessThanOrEqual(5);
  });
});

describe("percentTicks", () => {
  it.each([
    // [highest value, ticks]: the smallest clean step that needs at most 5 steps
    [2.33, ["0.0", "0.5", "1.0", "1.5", "2.0", "2.5"]], // 2.33 / 0.5 = 4.66 → 5 steps
    [0.95, ["0.0", "0.2", "0.4", "0.6", "0.8", "1.0"]], // 0.95 / 0.2 = 4.75 → 5 steps
    [1.22, ["0.00", "0.25", "0.50", "0.75", "1.00", "1.25"]], // 1.22 / 0.25 = 4.88 → 5
    [9.6, ["0", "2", "4", "6", "8", "10"]], // 9.6 / 2 = 4.8 → 5 steps
    [0, ["0.0", "0.1"]], // all free: still one step, so the axis isn't flat
  ])("up to %s → %j", (max, ticks) => {
    expect(percentTicks(max)).toEqual(ticks);
  });

  it("covers the five sample amounts of Project Plan §4", () => {
    expect(CHART_AMOUNTS).toEqual(["100", "500", "1000", "2500", "5000"]);
  });
});
