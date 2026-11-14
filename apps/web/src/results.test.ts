import type { ResultRowDto } from "@freu-transfer/api/contract";
import { describe, expect, it } from "vitest";
import { cheapestIds } from "./results.ts";

const row = (providerId: string, cost: string) =>
  ({ providerId, totalCost: { amount: cost, currency: "CHF" } }) as ResultRowDto;

describe("cheapestIds", () => {
  it("marks only the cheapest row", () => {
    expect(cheapestIds([row("wise", "3.50"), row("yuh", "9.50")])).toEqual(new Set(["wise"]));
  });

  it("marks every row that ties for the lowest cost, not only the first listed", () => {
    // Revolut and Wise both cost 0.00; the ranking lists Revolut first by name.
    const ranked = [row("revolut", "0.00"), row("wise", "0.00"), row("yuh", "0.01")];
    expect(cheapestIds(ranked)).toEqual(new Set(["revolut", "wise"]));
  });

  it("marks nothing when no provider is ranked", () => {
    expect(cheapestIds([])).toEqual(new Set());
  });
});
