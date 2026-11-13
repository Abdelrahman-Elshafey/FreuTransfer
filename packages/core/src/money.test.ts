import { describe, expect, it } from "vitest";
import { Decimal } from "./decimal.ts";
import { CurrencyMismatchError, MoneyError } from "./errors.ts";
import { Money } from "./money.ts";

describe("Money", () => {
  it("adds decimals exactly (no float error)", () => {
    const sum = Money.of("0.1", "CHF").plus(Money.of("0.2", "CHF"));
    expect(sum.amount.toString()).toBe("0.3");
  });

  it("refuses to mix currencies", () => {
    expect(() => Money.of("1", "CHF").plus(Money.of("1", "EUR"))).toThrow(CurrencyMismatchError);
    expect(() => Money.of("1", "CHF").compareTo(Money.of("1", "EUR"))).toThrow(
      CurrencyMismatchError,
    );
  });

  it("rejects JS numbers, invalid strings, infinity and unknown currencies", () => {
    expect(() => Money.of(0.1 as unknown as string, "CHF")).toThrow(/string or Decimal/);
    expect(() => Money.of("abc", "CHF")).toThrow(MoneyError);
    // Notations decimal.js would read (as 16, 3, 1000, 1000, …) but that are not plain decimals.
    for (const odd of ["0x10", "0b11", "1_000", "1e3", " 12", "+5", ".5", "5.", "Infinity"]) {
      expect(() => Money.of(odd, "CHF"), odd).toThrow(/not a valid number/);
    }
    expect(() => Money.of(new Decimal("Infinity"), "CHF")).toThrow(/finite/);
    expect(() => Money.of("1", "XYZ" as "CHF")).toThrow(/Unsupported currency/);
  });

  it("rounds half-even to the currency's minor unit by default", () => {
    expect(Money.of("0.125", "CHF").round().toFixed()).toBe("0.12");
    expect(Money.of("0.135", "CHF").round().toFixed()).toBe("0.14");
  });

  it("never prints a negative zero", () => {
    // -0.0029 rounds to 0.00; decimal.js's own toFixed(2) would print "-0.00".
    expect(Money.of("-0.0029", "CHF").toFixed()).toBe("0.00");
    expect(Money.of("-0.005", "CHF").toFixed()).toBe("0.00"); // half-even: -0.005 → -0.00 → 0.00
    expect(Money.of("-0.0051", "CHF").toFixed()).toBe("-0.01");
  });

  it("serialises amounts as strings for the API", () => {
    expect(JSON.stringify(Money.of("1044.7", "EUR"))).toBe('{"amount":"1044.70","currency":"EUR"}');
  });

  it("is immutable", () => {
    const m = Money.of("10", "CHF");
    m.plus(Money.of("5", "CHF"));
    expect(m.toFixed()).toBe("10.00");
    expect(Object.isFrozen(m)).toBe(true);
  });

  it("multiplies and divides by plain factors, never by zero", () => {
    expect(Money.of("200", "CHF").times("0.005").toFixed()).toBe("1.00");
    expect(Money.of("10", "CHF").dividedBy("4").toFixed()).toBe("2.50");
    expect(() => Money.of("10", "CHF").dividedBy(new Decimal(0))).toThrow(/zero/);
  });
});
