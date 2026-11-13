import { MoneyError } from "./errors.ts";

/**
 * Currencies we support (the v1 corridors CHF→EUR and EUR→CHF, Project Plan §2 and ADR 0008), with
 * their ISO 4217 minor units (digits after the decimal point). Only real corridor currencies: the
 * API and the data files accept exactly this list.
 */
const MINOR_UNITS = {
  CHF: 2,
  EUR: 2,
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
