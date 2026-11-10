import { isAmount, type MoneyDto } from "@freu-transfer/api/contract";

/**
 * Formatting for people, in one locale (docs/adr/0005). Values stay strings: Intl.NumberFormat
 * formats a decimal string exactly, without turning it into a float, and showing exactly as many
 * decimals as the API sent means the page never rounds money a second time.
 */
export function formatterFor(locale: string) {
  const exact = (value: string, options: Intl.NumberFormatOptions = {}) => {
    const digits = decimals(value);
    return new Intl.NumberFormat(locale, {
      ...options,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value as Intl.StringNumericLiteral);
  };
  return {
    /** "1044.75 EUR" → "EUR 1’044.75" (de-CH) or "1 044,75 EUR" (fr-CH). */
    money: (m: MoneyDto) => exact(m.amount, { style: "currency", currency: m.currency }),
    /** A rate or a plain amount, all its decimals: "1.0893" → "1,0893" (fr-CH). */
    decimal: (value: string) => exact(value),
    /** The API's percent ("0.95" means 0.95%) with the locale's sign: "0,95 %" (fr-CH). */
    percent: (percent: string) =>
      // "0.95E-2" is the exact fraction 0.0095; the percent style multiplies it back by 100.
      new Intl.NumberFormat(locale, {
        style: "percent",
        minimumFractionDigits: decimals(percent),
        maximumFractionDigits: decimals(percent),
      }).format(`${percent}E-2` as Intl.StringNumericLiteral),
    /** An instant (ISO 8601) as the calendar day in Zurich, where the data is about. */
    instant: (iso: string) =>
      new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Zurich" }).format(
        new Date(iso),
      ),
    /** A calendar day ("2026-11-05", e.g. a reference rate's date) without any time-zone shift. */
    day: (day: string) =>
      new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date(`${day}T00:00:00Z`),
      ),
  };
}

export type Formatter = ReturnType<typeof formatterFor>;

/** Digits after the decimal point: "1044.75" → 2, "1000" → 0. */
function decimals(value: string): number {
  const point = value.indexOf(".");
  return point === -1 ? 0 : value.length - point - 1;
}

/**
 * Reads an amount the way people type it in Switzerland and next door: "1000", "1'000.50",
 * "1’000,50", "1 000,5". Spaces and apostrophes are thousands separators, "." or "," is the
 * decimal mark. Returns the API's form ("1000.50"), or null if it isn't a valid amount. "1.000" is
 * refused rather than guessed (1 or 1,000?). Never goes through a JS number.
 */
export function parseAmount(input: string): string | null {
  const canonical = input.replace(/[\s'’]/g, "").replace(",", ".");
  return isAmount(canonical) ? canonical : null;
}
