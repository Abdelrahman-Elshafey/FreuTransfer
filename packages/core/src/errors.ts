/** Any invalid money operation: bad input, impossible amount, wrong currency. */
export class MoneyError extends Error {
  override name = "MoneyError";
}

/** Raised when two amounts or a rate and an amount don't share the expected currency. */
export class CurrencyMismatchError extends MoneyError {
  override name = "CurrencyMismatchError";
}
