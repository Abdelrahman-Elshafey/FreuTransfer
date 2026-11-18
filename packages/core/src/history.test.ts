import { describe, expect, it } from "vitest";
import { rateHistory } from "./history.ts";
import type { MidRateObservation } from "./offer.ts";
import { Rate } from "./rate.ts";

const observation = (asOf: string, rate: string): MidRateObservation => ({
  rate: Rate.of("CHF", "EUR", rate),
  source: "ecb",
  asOf,
  fetchedAt: new Date(`${asOf}T15:00:00Z`),
});

describe("rateHistory", () => {
  it("asks for the last N Zurich calendar days, today included", async () => {
    const asked: unknown[] = [];
    const rates = [observation("2026-11-12", "1.0812"), observation("2026-11-13", "1.0792")];
    const result = await rateHistory(
      {
        history: {
          between: async (...args) => {
            asked.push(args);
            return rates;
          },
        },
      },
      // 23:30 UTC on 18 Nov = 00:30 on 19 Nov in Zurich: "today" is the 19th.
      // 7 days, today included: 19 − 6 = 13 Nov … 19 Nov.
      { base: "CHF", quote: "EUR", days: 7, now: new Date("2026-11-18T23:30:00Z") },
    );
    expect(asked).toEqual([["CHF", "EUR", "2026-11-13", "2026-11-19"]]);
    expect(result).toEqual({ fromDay: "2026-11-13", toDay: "2026-11-19", rates });
  });

  it("one day is today only", async () => {
    const result = await rateHistory(
      { history: { between: async () => [] } },
      { base: "EUR", quote: "CHF", days: 1, now: new Date("2026-11-18T10:00:00Z") },
    );
    expect([result.fromDay, result.toDay]).toEqual(["2026-11-18", "2026-11-18"]);
  });
});
