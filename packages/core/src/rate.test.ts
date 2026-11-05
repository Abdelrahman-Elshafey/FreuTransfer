import { describe, expect, it } from "vitest";
import { CurrencyMismatchError, MoneyError } from "./errors.ts";
import { Money } from "./money.ts";
import { Rate } from "./rate.ts";

describe("Rate", () => {
  const chfEur = Rate.of("CHF", "EUR", "1.07");

  it("converts from base to quote currency", () => {
    expect(chfEur.convert(Money.of("1000", "CHF")).toString()).toBe("1070.00 EUR");
  });

  it("refuses to convert the wrong currency", () => {
    expect(() => chfEur.convert(Money.of("1", "EUR"))).toThrow(CurrencyMismatchError);
  });

  it("inverts", () => {
    const eurChf = chfEur.invert();
    expect(eurChf.base).toBe("EUR");
    expect(eurChf.quote).toBe("CHF");
    expect(eurChf.convert(Money.of("1070", "EUR")).toFixed()).toBe("1000.00");
  });

  it("applies a published markup as a fraction", () => {
    expect(chfEur.withMarkup("0.01").value.toString()).toBe("1.0593");
    expect(() => chfEur.withMarkup("-0.01")).toThrow(MoneyError);
    expect(() => chfEur.withMarkup("1")).toThrow(MoneyError);
  });

  it("rejects zero, negative and same-currency rates", () => {
    expect(() => Rate.of("CHF", "EUR", "0")).toThrow(/positive/);
    expect(() => Rate.of("CHF", "EUR", "-1")).toThrow(/positive/);
    expect(() => Rate.of("CHF", "CHF", "1")).toThrow(/different/);
  });
});
