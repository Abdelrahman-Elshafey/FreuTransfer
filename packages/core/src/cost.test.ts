import { describe, expect, it } from "vitest";
import { computeCost } from "./cost.ts";
import { CurrencyMismatchError } from "./errors.ts";
import { feeRule } from "./fees.ts";
import { Money } from "./money.ts";
import { quoteFromRule } from "./quote.ts";
import { Rate } from "./rate.ts";

const mid = Rate.of("CHF", "EUR", "1.07");

describe("computeCost", () => {
  it("reproduces the worked example from the Project Plan (§3)", () => {
    // Pay 1,000 CHF, 5 CHF fee deducted, provider rate 1.05, mid 1.07.
    const quote = quoteFromRule({
      totalPaid: Money.of("1000", "CHF"),
      fees: { kind: "deducted", rule: feeRule("CHF", { fixed: "5" }) },
      providerRate: Rate.of("CHF", "EUR", "1.05"),
    });
    expect(quote.received.toString()).toBe("1044.75 EUR");

    const cost = computeCost(quote, mid);
    expect(cost.idealReceived.toString()).toBe("1070.00 EUR");
    expect(cost.receivedValueAtMid.toString()).toBe("976.40 CHF");
    expect(cost.totalCost.toString()).toBe("23.60 CHF");
    expect(cost.visibleFee.toString()).toBe("5.00 CHF");
    expect(cost.fxMarkup.toString()).toBe("18.60 CHF");
    expect(cost.totalCostPct.toString()).toBe("0.023598"); // 2.36%
  });

  it("handles a fee on top plus a published markup (rule-based provider)", () => {
    // 1,000 CHF, fee 2 CHF + 0.5% on top, rate = mid − 1%.
    const quote = quoteFromRule({
      totalPaid: Money.of("1000", "CHF"),
      fees: { kind: "on_top", rule: feeRule("CHF", { fixed: "2", percent: "0.005" }) },
      providerRate: mid.withMarkup("0.01"),
    });
    // converted 993.03 × 1.0593 = 1051.916679 → 1051.92 EUR
    expect(quote.received.toString()).toBe("1051.92 EUR");

    const cost = computeCost(quote, mid);
    expect(cost.visibleFee.toString()).toBe("6.97 CHF");
    expect(cost.totalCost.toString()).toBe("16.90 CHF");
    expect(cost.fxMarkup.toString()).toBe("9.93 CHF");
  });

  it("works for EUR→CHF with a manually entered quote", () => {
    // Someone reads an EU bank's offer by hand: pay 1,000 EUR, fee 15 EUR, 917.50 CHF arrive.
    const quote = {
      totalPaid: Money.of("1000", "EUR"),
      visibleFee: Money.of("15", "EUR"),
      received: Money.of("917.50", "CHF"),
    };
    const cost = computeCost(quote, Rate.of("EUR", "CHF", "0.9346"));
    // 917.50 / 0.9346 = 981.703… EUR → cost 18.30 EUR, of which 3.30 hidden
    expect(cost.totalCost.toString()).toBe("18.30 EUR");
    expect(cost.fxMarkup.toString()).toBe("3.30 EUR");
  });

  it("costs nothing with no fee at the mid-market rate", () => {
    const quote = quoteFromRule({
      totalPaid: Money.of("1000", "CHF"),
      fees: { kind: "deducted", rule: feeRule("CHF", {}) },
      providerRate: mid,
    });
    const cost = computeCost(quote, mid);
    expect(cost.totalCost.toString()).toBe("0.00 CHF");
    expect(cost.fxMarkup.toString()).toBe("0.00 CHF");
  });

  it("keeps fee + markup = total to the cent after rounding", () => {
    const quote = {
      totalPaid: Money.of("1000", "CHF"),
      visibleFee: Money.of("4.995", "CHF"),
      received: Money.of("1044.756", "EUR"),
    };
    const cost = computeCost(quote, mid);
    expect(cost.visibleFee.plus(cost.fxMarkup).equals(cost.totalCost)).toBe(true);
  });

  it("refuses a mid rate in the wrong currencies", () => {
    const quote = {
      totalPaid: Money.of("1000", "CHF"),
      visibleFee: Money.of("5", "CHF"),
      received: Money.of("1044.75", "EUR"),
    };
    expect(() => computeCost(quote, Rate.of("CHF", "GBP", "0.9"))).toThrow(CurrencyMismatchError);
    expect(() => computeCost(quote, mid.invert())).toThrow(CurrencyMismatchError);
    expect(() => computeCost({ ...quote, visibleFee: Money.of("5", "EUR") }, mid)).toThrow(
      CurrencyMismatchError,
    );
  });

  it.todo("golden test 1: a real provider calculator result, reproduced to the cent");
  it.todo("golden test 2: a real provider calculator result, reproduced to the cent");
  it.todo("golden test 3: a real provider calculator result, reproduced to the cent");
});
