// A test only: the page itself never imports core (it would ship the cost engine to visitors).
import {
  MAX_PLAUSIBLE_COST,
  MID_RATE_MAX_AGE_DAYS,
  Money,
  Rate,
  RECHECK_DAYS,
} from "@freu-transfer/core";
import { describe, expect, it } from "vitest";
import { METHODOLOGY } from "./methodology-values.ts";

describe("the values the methodology quotes", () => {
  it("are core's limits", () => {
    expect(METHODOLOGY.recheckDays).toBe(RECHECK_DAYS);
    expect(METHODOLOGY.maxAgeDays).toBe(MID_RATE_MAX_AGE_DAYS);
    // 0.10 as a fraction = "10" as the API's percent string
    expect(MAX_PLAUSIBLE_COST.times(100).toString()).toBe(METHODOLOGY.maxCostPercent);
  });

  it("work out the example with core's money (Project Plan §3; golden test in core cost.test.ts)", () => {
    const e = METHODOLOGY.example;
    const paid = Money.of(e.paid, e.from);
    const fee = Money.of(e.fee, e.from);
    // 1000.00 − 5.00 = 995.00 CHF exchanged
    const converted = paid.minus(fee);
    expect(converted.toFixed()).toBe(e.converted);
    // 995.00 × 1.05 = 1044.75 EUR arrive
    const received = Rate.of(e.from, e.to, e.rate).convert(converted);
    expect(received.toFixed()).toBe(e.received);
    // 1044.75 ÷ 1.07 = 976.4018691… → 976.40 CHF at the reference rate
    const worth = Rate.of(e.from, e.to, e.mid).invert().convert(received);
    expect(worth.toFixed()).toBe(e.worth);
    // 1000 − 976.4018691… = 23.5981308… → 23.60 CHF total cost
    const totalCost = paid.minus(worth);
    expect(totalCost.toFixed()).toBe(e.totalCost);
    // 23.60 − 5.00 = 18.60 CHF hidden (from the rounded amounts, as core does)
    expect(totalCost.round().minus(fee).toFixed()).toBe(e.hidden);
    // 23.5981308… ÷ 1000 = 2.3598…% → 2.36%
    expect(totalCost.amount.div(paid.amount).times(100).toFixed(2)).toBe(e.percent);
  });
});
