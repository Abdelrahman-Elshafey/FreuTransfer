/** Any invalid money operation: bad input, impossible amount, wrong currency. */
export class MoneyError extends Error {
  override name = "MoneyError";
}

/** Raised when two amounts or a rate and an amount don't share the expected currency. */
export class CurrencyMismatchError extends MoneyError {
  override name = "CurrencyMismatchError";
}

/**
 * The provider can't serve this amount (its fee would eat it all, or no fee tier covers it).
 * Not a bug: the comparison lists the provider as unavailable. Every other MoneyError is a bug.
 */
export class AmountNotSupportedError extends MoneyError {
  override name = "AmountNotSupportedError";
}
