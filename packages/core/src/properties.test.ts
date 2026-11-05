import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeCost } from "./cost.ts";
import { Decimal } from "./decimal.ts";
import { type FeeModel, feeRule, splitPayment } from "./fees.ts";
import { Money } from "./money.ts";
import { quoteFromRule } from "./quote.ts";
import { Rate } from "./rate.ts";

// Random inputs are generated as BigInts and turned into decimal strings, so no JS
// floating-point number ever touches a money value, even in tests.
const fraction = (value: bigint, scale: string) => new Decimal(value.toString()).dividedBy(scale);

/** 1.00 to 100,000.00 CHF */
const amountArb = fc
  .bigInt({ min: 100n, max: 10_000_000n })
  .map((cents) => Money.of(fraction(cents, "100"), "CHF"));
/** 0% to 3% as a fraction */
const percentArb = fc.bigInt({ min: 0n, max: 300n }).map((bp) => fraction(bp, "10000"));
/** fixed fee 0.00 to 0.99 CHF, so it never exceeds the smallest amount */
const fixedArb = fc.bigInt({ min: 0n, max: 99n }).map((cents) => fraction(cents, "100"));
/** mid rate 0.5000 to 2.0000 */
const midArb = fc
  .bigInt({ min: 5_000n, max: 20_000n })
  .map((v) => Rate.of("CHF", "EUR", fraction(v, "10000")));
/** markup 0% to 5% */
const markupArb = fc.bigInt({ min: 0n, max: 500n }).map((bp) => fraction(bp, "10000"));

const feeModelArb: fc.Arbitrary<FeeModel> = fc
  .record({ kind: fc.constantFrom("deducted", "on_top"), fixed: fixedArb, percent: percentArb })
  .map(({ kind, fixed, percent }) => ({ kind, rule: feeRule("CHF", { fixed, percent }) }));

const ONE_CENT = Money.of("0.01", "CHF");

describe("properties (fast-check)", () => {
  it("fee + converted always equals what you paid", () => {
    fc.assert(
      fc.property(amountArb, feeModelArb, (total, model) => {
        const s = splitPayment(total, model);
        expect(s.fee.plus(s.converted).equals(total)).toBe(true);
        expect(s.fee.isNegative()).toBe(false);
      }),
    );
  });

  it("fee + hidden markup always equals the total cost (to the cent)", () => {
    fc.assert(
      fc.property(amountArb, feeModelArb, midArb, markupArb, (total, fees, mid, markup) => {
        const quote = quoteFromRule({
          totalPaid: total,
          fees,
          providerRate: mid.withMarkup(markup),
        });
        const cost = computeCost(quote, mid);
        expect(cost.visibleFee.plus(cost.fxMarkup).equals(cost.totalCost)).toBe(true);
      }),
    );
  });

  it("a markup never gives you more than the fair amount (up to one cent of rounding)", () => {
    fc.assert(
      fc.property(amountArb, feeModelArb, midArb, markupArb, (total, fees, mid, markup) => {
        const quote = quoteFromRule({
          totalPaid: total,
          fees,
          providerRate: mid.withMarkup(markup),
        });
        const cost = computeCost(quote, mid);
        expect(cost.fxMarkup.compareTo(ONE_CENT.times("-1"))).toBeGreaterThanOrEqual(0);
        expect(cost.totalCost.compareTo(cost.visibleFee.minus(ONE_CENT))).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("paying more never means receiving less", () => {
    fc.assert(
      fc.property(amountArb, amountArb, feeModelArb, midArb, (a, b, fees, rate) => {
        const [low, high] = a.compareTo(b) <= 0 ? [a, b] : [b, a];
        const receivedLow = quoteFromRule({ totalPaid: low, fees, providerRate: rate }).received;
        const receivedHigh = quoteFromRule({ totalPaid: high, fees, providerRate: rate }).received;
        expect(receivedHigh.compareTo(receivedLow)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("no fee and no markup costs at most one cent of rounding", () => {
    fc.assert(
      fc.property(amountArb, midArb, (total, mid) => {
        const quote = quoteFromRule({
          totalPaid: total,
          fees: { kind: "deducted", rule: feeRule("CHF", {}) },
          providerRate: mid,
        });
        const cost = computeCost(quote, mid);
        expect(cost.totalCost.amount.abs().lte("0.01")).toBe(true);
      }),
    );
  });
});
