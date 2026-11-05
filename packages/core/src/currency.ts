import { MoneyError } from "./errors.ts";

/**
 * Currencies we support, with their ISO 4217 minor units (digits after the decimal point).
 * JPY is included only to prove rounding works for a currency with no cents.
 */
const MINOR_UNITS = {
  CHF: 2,
  EUR: 2,
  GBP: 2,
  USD: 2,
  EGP: 2,
  RSD: 2,
  JPY: 0,
} as const;

export type CurrencyCode = keyof typeof MINOR_UNITS;

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(MINOR_UNITS, value);
}

export function assertCurrencyCode(value: string): asserts value is CurrencyCode {
  if (!isCurrencyCode(value)) {
    throw new MoneyError(`Unsupported currency: "${value}"`);
  }
}

/** Number of decimal places for a currency (a digit count, not an amount). */
export function minorUnits(currency: CurrencyCode): number {
  return MINOR_UNITS[currency];
}
