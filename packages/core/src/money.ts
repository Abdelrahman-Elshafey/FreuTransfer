import { assertCurrencyCode, type CurrencyCode, minorUnits } from "./currency.ts";
import {
  type Decimal,
  type DecimalInput,
  ROUNDING,
  type RoundingMode,
  toDecimal,
} from "./decimal.ts";
import { CurrencyMismatchError, MoneyError } from "./errors.ts";

/**
 * An exact amount in one currency. Immutable: every operation returns a new Money.
 *
 * Amounts are kept at full precision. Call `round()` only at the end of a calculation
 * (or where real money is settled, e.g. a fee actually charged).
 */
export class Money {
  readonly amount: Decimal;
  readonly currency: CurrencyCode;

  private constructor(amount: Decimal, currency: CurrencyCode) {
    this.amount = amount;
    this.currency = currency;
    Object.freeze(this);
  }

  /** `Money.of("1000.00", "CHF")`. Accepts a string or Decimal, never a JS number. */
  static of(amount: DecimalInput, currency: CurrencyCode): Money {
    assertCurrencyCode(currency);
    return new Money(toDecimal(amount, "Money amount"), currency);
  }

  plus(other: Money): Money {
    assertSameCurrency(this, other, "plus");
    return new Money(this.amount.plus(other.amount), this.currency);
  }

  minus(other: Money): Money {
    assertSameCurrency(this, other, "minus");
    return new Money(this.amount.minus(other.amount), this.currency);
  }

  /** Multiply by a plain factor (e.g. a percentage as a fraction). Not by another Money. */
  times(factor: DecimalInput): Money {
    return new Money(this.amount.times(toDecimal(factor, "factor")), this.currency);
  }

  dividedBy(divisor: DecimalInput): Money {
    const d = toDecimal(divisor, "divisor");
    if (d.isZero()) throw new MoneyError("Division by zero");
    return new Money(this.amount.dividedBy(d), this.currency);
  }

  /** -1, 0 or 1. Only amounts in the same currency can be compared. */
  compareTo(other: Money): -1 | 0 | 1 {
    assertSameCurrency(this, other, "compareTo");
    return this.amount.comparedTo(other.amount) as -1 | 0 | 1;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount.equals(other.amount);
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  isNegative(): boolean {
    return this.amount.isNegative() && !this.amount.isZero();
  }

  /** Round to the currency's minor unit (CHF → 2 decimals, JPY → 0). Half-even by default. */
  round(mode: RoundingMode = ROUNDING.halfEven): Money {
    return new Money(this.amount.toDecimalPlaces(minorUnits(this.currency), mode), this.currency);
  }

  /** The amount rounded to the minor unit, as a fixed string: "1044.75". */
  toFixed(mode: RoundingMode = ROUNDING.halfEven): string {
    return this.amount.toFixed(minorUnits(this.currency), mode);
  }

  /** "1044.75 EUR" (rounded, for logs and messages). */
  toString(): string {
    return `${this.toFixed()} ${this.currency}`;
  }

  /** How Money crosses the API: amounts as strings, never JSON numbers. */
  toJSON(): { amount: string; currency: CurrencyCode } {
    return { amount: this.toFixed(), currency: this.currency };
  }
}

function assertSameCurrency(a: Money, b: Money, operation: string): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(`${operation}: ${a.currency} vs ${b.currency}`);
  }
}

export function maxMoney(a: Money, b: Money): Money {
  return a.compareTo(b) >= 0 ? a : b;
}

export function minMoney(a: Money, b: Money): Money {
  return a.compareTo(b) <= 0 ? a : b;
}
