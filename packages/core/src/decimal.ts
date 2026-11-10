// Named import: decimal.js's type file is read as CommonJS, so its default import would be
// typed as the whole module rather than the class.
import { Decimal as DecimalJs } from "decimal.js";
import { MoneyError } from "./errors.ts";

/**
 * Our own configured copy of decimal.js, so no other code can change our settings.
 * - 40 significant digits: far more than any amount or rate needs, so intermediate
 *   results are exact for our purposes.
 * - Banker's rounding (half-even) is the default; see `ROUND_HALF_EVEN` below.
 */
export const Decimal = DecimalJs.clone({
  precision: 40,
  rounding: DecimalJs.ROUND_HALF_EVEN,
  toExpNeg: -40,
  toExpPos: 40,
});
export type Decimal = DecimalJs;

/** Our one rounding mode: half-even (banker's rounding), as documented in Project Plan §3. */
export const ROUND_HALF_EVEN = DecimalJs.ROUND_HALF_EVEN;

/**
 * Rounds half-even to `places` decimals and prints them: "0.95". Never "-0.00": decimal.js's own
 * toFixed keeps the minus sign of a small negative value that rounds to zero (-0.0029 → "-0.00").
 */
export function toFixedString(value: Decimal, places: number): string {
  return value.toDecimalPlaces(places, ROUND_HALF_EVEN).toFixed(places);
}

/** Values we accept for money and rates. JS `number` is deliberately not allowed. */
export type DecimalInput = string | Decimal;

/**
 * Turns a string or Decimal into our Decimal. Rejects numbers at runtime too, because
 * plain JavaScript callers (or `as any`) could slip one past the type checker.
 */
export function toDecimal(value: DecimalInput, what: string): Decimal {
  if (typeof value !== "string" && !Decimal.isDecimal(value)) {
    throw new MoneyError(`${what} must be a string or Decimal, not ${typeof value}`);
  }
  let result: Decimal;
  try {
    result = new Decimal(value);
  } catch {
    throw new MoneyError(`${what} is not a valid number: "${String(value)}"`);
  }
  if (!result.isFinite()) {
    throw new MoneyError(`${what} must be finite: "${String(value)}"`);
  }
  return result;
}
