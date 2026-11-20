import { describe, expect, it } from "vitest";
import { AmountNotSupportedError, CurrencyMismatchError } from "./errors.ts";
import { type FeeModel, feeRule, splitPayment } from "./fees.ts";
import { Money } from "./money.ts";

const chf = (amount: string) => Money.of(amount, "CHF");

function split(total: string, model: FeeModel) {
  const s = splitPayment(chf(total), model);
  return { fee: s.fee.toFixed(), converted: s.converted.toFixed() };
}

describe("splitPayment", () => {
  it("deducted fixed fee: converted = total − fee", () => {
    const model: FeeModel = { kind: "deducted", rule: feeRule("CHF", { fixed: "5" }) };
    expect(split("1000", model)).toEqual({ fee: "5.00", converted: "995.00" });
  });

  it("deducted percentage: the fee is computed on the total paid", () => {
    const model: FeeModel = { kind: "deducted", rule: feeRule("CHF", { percent: "0.0125" }) };
    // 1000 × 0.0125 = 12.50; converted = 1000 − 12.50 = 987.50
    expect(split("1000", model)).toEqual({ fee: "12.50", converted: "987.50" });
  });

  it("fee on top: total = converted + fixed + percent × converted", () => {
    const model: FeeModel = {
      kind: "on_top",
      rule: feeRule("CHF", { fixed: "2", percent: "0.005" }),
    };
    // converted = (1000 − 2) / 1.005 = 993.0348…, fee = 6.9651… → 6.97 (rounded, real money)
    expect(split("1000", model)).toEqual({ fee: "6.97", converted: "993.03" });
  });

  it("maximum amount: served up to and including it, not a cent above", () => {
    const model: FeeModel = {
      kind: "deducted",
      rule: feeRule("CHF", { fixed: "3" }),
      maxAmount: chf("500"),
    };
    expect(split("500", model)).toEqual({ fee: "3.00", converted: "497.00" });
    expect(() => splitPayment(chf("500.01"), model)).toThrow(AmountNotSupportedError);
  });

  it("maximum amount: one in another currency is a data error, not 'not available'", () => {
    const model: FeeModel = {
      kind: "deducted",
      rule: feeRule("CHF", {}),
      maxAmount: Money.of("500", "EUR"),
    };
    expect(() => splitPayment(chf("100"), model)).toThrow(CurrencyMismatchError);
  });

  it("rejects a fee that eats the whole amount, and non-positive amounts", () => {
    const model: FeeModel = { kind: "deducted", rule: feeRule("CHF", { fixed: "5" }) };
    expect(() => splitPayment(chf("4"), model)).toThrow(AmountNotSupportedError);
    expect(() => splitPayment(chf("0"), model)).toThrow(/positive/);
  });

  it("rejects a fee rule in another currency", () => {
    const model: FeeModel = { kind: "deducted", rule: feeRule("EUR", { fixed: "5" }) };
    expect(() => splitPayment(chf("100"), model)).toThrow(CurrencyMismatchError);
  });

  it("validates fee rules", () => {
    expect(() => feeRule("CHF", { fixed: "-1" })).toThrow(/negative/);
    expect(() => feeRule("CHF", { percent: "-0.1" })).toThrow(/negative/);
  });
});
