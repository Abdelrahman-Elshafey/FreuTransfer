import { assertCurrencyCode, type CurrencyCode } from "./currency.ts";
import { Decimal, type DecimalInput, toDecimal } from "./decimal.ts";
import { CurrencyMismatchError, MoneyError } from "./errors.ts";
import { Money } from "./money.ts";

/**
 * An exchange rate with one fixed direction: 1 `base` = `value` × `quote`.
 * Example: Rate.of("CHF", "EUR", "1.07") means 1 CHF = 1.07 EUR.
 */
export class Rate {
  readonly base: CurrencyCode;
  readonly quote: CurrencyCode;
  readonly value: Decimal;

  private constructor(base: CurrencyCode, quote: CurrencyCode, value: Decimal) {
    this.base = base;
    this.quote = quote;
    this.value = value;
    Object.freeze(this);
  }

  static of(base: CurrencyCode, quote: CurrencyCode, value: DecimalInput): Rate {
    assertCurrencyCode(base);
    assertCurrencyCode(quote);
    if (base === quote) throw new MoneyError(`A rate needs two different currencies (${base})`);
    const v = toDecimal(value, "Rate value");
    if (v.lte(0)) throw new MoneyError(`Rate must be positive, got ${v.toString()}`);
    return new Rate(base, quote, v);
  }

  /** Convert an amount in `base` into `quote`. Full precision; round afterwards if needed. */
  convert(money: Money): Money {
    if (money.currency !== this.base) {
      throw new CurrencyMismatchError(
        `Rate ${this.base}→${this.quote} cannot convert ${money.currency}`,
      );
    }
    return Money.of(money.amount.times(this.value), this.quote);
  }

  /** The same rate the other way round: 1 EUR = 1 / 1.07 CHF. */
  invert(): Rate {
    return new Rate(this.quote, this.base, new Decimal(1).dividedBy(this.value));
  }

  /**
   * A provider's rate built from the mid-market rate and a published markup, given as a
   * fraction: withMarkup("0.0095") is 0.95% worse than mid. Used for rule-based providers.
   */
  withMarkup(markup: DecimalInput): Rate {
    const m = toDecimal(markup, "markup");
    if (m.isNegative() || m.gte(1)) {
      throw new MoneyError(`Markup must be between 0 and 1, got ${m.toString()}`);
    }
    return new Rate(this.base, this.quote, this.value.times(new Decimal(1).minus(m)));
  }

  toString(): string {
    return `1 ${this.base} = ${this.value.toString()} ${this.quote}`;
  }
}
