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
    // Exact, not rounded: 23.5981308411… / 1000 = 0.0235981308… (2.36%)
    expect(cost.totalCostPct.toFixed(10)).toBe("0.0235981308");
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
});

/**
 * Golden tests: real provider calculator results, reproduced to the cent.
 * Each one cites the screenshot the owner took (date, time, page).
 */
describe("golden tests (real calculator results)", () => {
  it("Wise, 1,000 CHF → EUR, wise.com calculator, 2026-11-05 21:18: fee 3.50, receives 1,087.88", () => {
    // Fee 1.21 CHF + 0.23% of the converted amount (on top):
    //   converted = (1000 − 1.21) / 1.0023 = 996.4980…; fee = 1000 − 996.4980… = 3.5019… → 3.50
    //   converted = 1000 − 3.50 = 996.50
    // The screenshot doesn't show Wise's rate; 1,087.88 / 996.50 puts it between 1.091696 and
    // 1.091706, so 1.0917 (4 decimals, inside that range) is used:
    //   996.50 × 1.0917 = 1087.87905 → 1087.88 EUR
    const quote = quoteFromRule({
      totalPaid: Money.of("1000", "CHF"),
      fees: { kind: "on_top", rule: feeRule("CHF", { fixed: "1.21", percent: "0.0023" }) },
      providerRate: Rate.of("CHF", "EUR", "1.0917"),
    });
    expect(quote.visibleFee.toString()).toBe("3.50 CHF");
    expect(quote.received.toString()).toBe("1087.88 EUR");
  });

  it("PostFinance currency converter, 2026-11-06 18:58: CHF 1 = EUR 1.08038 / EUR 1 = CHF 0.9256", () => {
    // The converter shows both directions; they are each other's inverse, which is how we store
    // PostFinance's CHF→EUR rate (1 / sell rate):
    //   1 / 0.9256 = 1.0803802939… → shown with 5 decimals: 1.08038
    //   1.00 CHF × 1.0803802939 = 1.08038… → 1.08 EUR (the converter's result for 1.00)
    const chfEur = Rate.of("EUR", "CHF", "0.9256").invert();
    expect(chfEur.value.toFixed(5)).toBe("1.08038");
    const quote = quoteFromRule({
      totalPaid: Money.of("1.00", "CHF"),
      fees: { kind: "deducted", rule: feeRule("CHF", {}) },
      providerRate: chfEur,
    });
    expect(quote.received.toString()).toBe("1.08 EUR");
  });
});
