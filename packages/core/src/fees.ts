import type { CurrencyCode } from "./currency.ts";
import { Decimal, type DecimalInput, toDecimal } from "./decimal.ts";
import { AmountNotSupportedError, CurrencyMismatchError, MoneyError } from "./errors.ts";
import { Money } from "./money.ts";

/**
 * How a provider computes its fee: `fixed + percent × base`. `percent` is a fraction: "0.005"
 * means 0.5%. Amounts are in the sender's currency.
 */
export type FeeRule = {
  readonly fixed: Money;
  readonly percent: Decimal;
};

/**
 * The two ways providers charge (Strategy pattern as data: one `kind` per strategy):
 * - `deducted`: the fee is taken out of what you pay: converted = total − fee.
 * - `on_top`: the fee is added on top of what's converted: total = converted + fee(converted).
 * `maxAmount`: the most the provider accepts per transfer (total paid); above it the offer can't
 * serve the amount (Western Union online: 4,700 CHF). No minimum or maximum fee and no fee tiers:
 * no provider has them (ADR 0015).
 */
export type FeeModel = {
  readonly kind: "deducted" | "on_top";
  readonly rule: FeeRule;
  readonly maxAmount?: Money;
};

/** What happens to the money you pay: part is the fee, the rest gets converted. */
type PaymentSplit = {
  readonly fee: Money;
  readonly converted: Money;
};

/** Convenience builder: feeRule("CHF", { fixed: "5", percent: "0.005" }). */
export function feeRule(
  currency: CurrencyCode,
  input: { readonly fixed?: DecimalInput; readonly percent?: DecimalInput },
): FeeRule {
  const percent = toDecimal(input.percent ?? "0", "percent");
  if (percent.isNegative()) throw new MoneyError("Fee percent cannot be negative");
  const fixed = Money.of(input.fixed ?? "0", currency);
  if (fixed.isNegative()) throw new MoneyError("Fixed fee cannot be negative");
  return { fixed, percent };
}

/**
 * Splits the total you pay into fee + converted amount.
 *
 * The fee is rounded to the currency's minor unit because it is real money actually
 * charged (you can't be charged 4.9831 CHF). `converted` is then exactly total − fee,
 * so fee + converted always equals what you paid.
 */
export function splitPayment(totalPaid: Money, model: FeeModel): PaymentSplit {
  if (!totalPaid.amount.gt(0)) throw new MoneyError("Total paid must be positive");
  assertRuleCurrency(model.rule, totalPaid);
  if (model.maxAmount && totalPaid.compareTo(model.maxAmount) > 0) {
    throw new AmountNotSupportedError(
      `${totalPaid.toString()} is more than the most accepted, ${model.maxAmount.toString()}`,
    );
  }

  const fee = (
    model.kind === "deducted" ? deductedFee(totalPaid, model.rule) : onTopFee(totalPaid, model.rule)
  ).round();

  if (fee.compareTo(totalPaid) >= 0) {
    throw new AmountNotSupportedError(
      `Fee ${fee.toString()} is not less than the amount ${totalPaid.toString()}`,
    );
  }
  return { fee, converted: totalPaid.minus(fee) };
}

/** Deducted: the fee is computed on the total you pay. */
function deductedFee(totalPaid: Money, rule: FeeRule): Money {
  return rule.fixed.plus(totalPaid.times(rule.percent));
}

/**
 * On top: the fee is computed on the converted amount c, and total = c + fixed + percent × c.
 * Solving for c: c = (total − fixed) / (1 + percent); the fee is what's left.
 */
function onTopFee(totalPaid: Money, rule: FeeRule): Money {
  const converted = totalPaid.minus(rule.fixed).dividedBy(new Decimal(1).plus(rule.percent));
  return totalPaid.minus(converted);
}

function assertRuleCurrency(rule: FeeRule, totalPaid: Money): void {
  if (rule.fixed.currency !== totalPaid.currency) {
    throw new CurrencyMismatchError(
      `Fee rule is in ${rule.fixed.currency}, payment is in ${totalPaid.currency}`,
    );
  }
}
