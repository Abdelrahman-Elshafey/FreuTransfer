import type { CurrencyCode } from "./currency.ts";
import { Decimal, type DecimalInput, ROUNDING, type RoundingMode, toDecimal } from "./decimal.ts";
import { CurrencyMismatchError, MoneyError } from "./errors.ts";
import { Money, maxMoney, minMoney } from "./money.ts";

/**
 * How a provider computes its fee: `fixed + percent × base`, then kept between `min` and `max`.
 * `percent` is a fraction: "0.005" means 0.5%. All amounts are in the sender's currency.
 */
export type FeeRule = {
  readonly fixed: Money;
  readonly percent: Decimal;
  readonly min?: Money;
  readonly max?: Money;
};

/** The three ways providers charge (Strategy pattern as data: one `kind` per strategy). */
export type SimpleFeeModel =
  /** The fee is taken out of what you pay: converted = total − fee. */
  | { readonly kind: "deducted"; readonly rule: FeeRule }
  /** The fee is added on top of what's converted: total = converted + fee(converted). */
  | { readonly kind: "on_top"; readonly rule: FeeRule };

/** Different fee models by amount. A tier applies while total paid ≤ `upTo` (null = no limit). */
export type FeeTier = { readonly upTo: Money | null; readonly model: SimpleFeeModel };
export type FeeModel =
  | SimpleFeeModel
  | { readonly kind: "tiered"; readonly tiers: readonly FeeTier[] };

/** What happens to the money you pay: part is the fee, the rest gets converted. */
export type PaymentSplit = {
  readonly totalPaid: Money;
  readonly fee: Money;
  readonly converted: Money;
};

type FeeRuleInput = {
  readonly fixed?: DecimalInput;
  readonly percent?: DecimalInput;
  readonly min?: DecimalInput;
  readonly max?: DecimalInput;
};

/** Convenience builder: feeRule("CHF", { fixed: "5", percent: "0.005", min: "10" }). */
export function feeRule(currency: CurrencyCode, input: FeeRuleInput): FeeRule {
  const percent = toDecimal(input.percent ?? "0", "percent");
  if (percent.isNegative()) throw new MoneyError("Fee percent cannot be negative");
  const rule: FeeRule = {
    fixed: Money.of(input.fixed ?? "0", currency),
    percent,
    ...(input.min === undefined ? {} : { min: Money.of(input.min, currency) }),
    ...(input.max === undefined ? {} : { max: Money.of(input.max, currency) }),
  };
  if (rule.fixed.isNegative()) throw new MoneyError("Fixed fee cannot be negative");
  if (rule.min && rule.max && rule.min.compareTo(rule.max) > 0) {
    throw new MoneyError("Minimum fee is larger than maximum fee");
  }
  return rule;
}

/**
 * Splits the total you pay into fee + converted amount.
 *
 * The fee is rounded to the currency's minor unit because it is real money actually
 * charged (you can't be charged 4.9831 CHF). `converted` is then exactly total − fee,
 * so fee + converted always equals what you paid.
 */
export function splitPayment(
  totalPaid: Money,
  model: FeeModel,
  rounding: RoundingMode = ROUNDING.halfEven,
): PaymentSplit {
  if (!totalPaid.amount.gt(0)) throw new MoneyError("Total paid must be positive");
  const simple = model.kind === "tiered" ? pickTier(totalPaid, model.tiers) : model;
  assertRuleCurrency(simple.rule, totalPaid);

  const rawFee =
    simple.kind === "deducted"
      ? deductedFee(totalPaid, simple.rule)
      : onTopFee(totalPaid, simple.rule);
  const fee = clamp(rawFee, simple.rule).round(rounding);

  if (fee.compareTo(totalPaid) >= 0) {
    throw new MoneyError(
      `Fee ${fee.toString()} is not less than the amount ${totalPaid.toString()}`,
    );
  }
  return { totalPaid, fee, converted: totalPaid.minus(fee) };
}

/** Deducted: the fee is computed on the total you pay. */
function deductedFee(totalPaid: Money, rule: FeeRule): Money {
  return rule.fixed.plus(totalPaid.times(rule.percent));
}

/**
 * On top: the fee is computed on the converted amount c, and total = c + fixed + percent × c.
 * Solving for c: c = (total − fixed) / (1 + percent); the fee is what's left.
 * If that fee is below min (or above max), the clamped fee applies instead; this is consistent
 * because the fee grows with c.
 */
function onTopFee(totalPaid: Money, rule: FeeRule): Money {
  const converted = totalPaid.minus(rule.fixed).dividedBy(new Decimal(1).plus(rule.percent));
  return totalPaid.minus(converted);
}

function clamp(fee: Money, rule: FeeRule): Money {
  let result = fee;
  if (rule.min) result = maxMoney(result, rule.min);
  if (rule.max) result = minMoney(result, rule.max);
  return result;
}

function pickTier(totalPaid: Money, tiers: readonly FeeTier[]): SimpleFeeModel {
  for (const tier of tiers) {
    if (tier.upTo === null || totalPaid.compareTo(tier.upTo) <= 0) return tier.model;
  }
  throw new MoneyError(`No fee tier covers ${totalPaid.toString()}`);
}

function assertRuleCurrency(rule: FeeRule, totalPaid: Money): void {
  if (rule.fixed.currency !== totalPaid.currency) {
    throw new CurrencyMismatchError(
      `Fee rule is in ${rule.fixed.currency}, payment is in ${totalPaid.currency}`,
    );
  }
}
