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

  it("deducted percentage with min and max", () => {
    const withMin: FeeModel = {
      kind: "deducted",
      rule: feeRule("CHF", { percent: "0.001", min: "3" }),
    };
    expect(split("1000", withMin)).toEqual({ fee: "3.00", converted: "997.00" });

    const withMax: FeeModel = {
      kind: "deducted",
      rule: feeRule("CHF", { percent: "0.02", max: "15" }),
    };
    expect(split("1000", withMax)).toEqual({ fee: "15.00", converted: "985.00" });
  });

  it("fee on top: total = converted + fixed + percent × converted", () => {
    const model: FeeModel = {
      kind: "on_top",
      rule: feeRule("CHF", { fixed: "2", percent: "0.005" }),
    };
    // converted = (1000 − 2) / 1.005 = 993.0348…, fee = 6.9651… → 6.97 (rounded, real money)
    expect(split("1000", model)).toEqual({ fee: "6.97", converted: "993.03" });
  });

  it("fee on top with a minimum fee", () => {
    const model: FeeModel = {
      kind: "on_top",
      rule: feeRule("CHF", { percent: "0.001", min: "5" }),
    };
    expect(split("1000", model)).toEqual({ fee: "5.00", converted: "995.00" });
  });

  it("tiered: picks the first tier that covers the amount", () => {
    const model: FeeModel = {
      kind: "tiered",
      tiers: [
        { upTo: chf("500"), model: { kind: "deducted", rule: feeRule("CHF", { fixed: "3" }) } },
        { upTo: null, model: { kind: "deducted", rule: feeRule("CHF", { percent: "0.01" }) } },
      ],
    };
    expect(split("500", model).fee).toBe("3.00");
    expect(split("1000", model).fee).toBe("10.00");
  });

  it("tiered: an amount above the last tier can't be served", () => {
    const model: FeeModel = {
      kind: "tiered",
      tiers: [
        { upTo: chf("500"), model: { kind: "deducted", rule: feeRule("CHF", { fixed: "3" }) } },
      ],
    };
    expect(() => splitPayment(chf("500.01"), model)).toThrow(AmountNotSupportedError);
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
    expect(() => feeRule("CHF", { min: "10", max: "5" })).toThrow(/Minimum/);
    expect(() => feeRule("CHF", { min: "-5" })).toThrow(/Minimum fee cannot be negative/);
    expect(() => feeRule("CHF", { max: "-5" })).toThrow(/Maximum fee cannot be negative/);
  });
});
