import type { CurrencyCode } from "./currency.ts";
import type { MidRateObservation, ProviderOffer } from "./offer.ts";

/**
 * Ports: what the domain needs from the outside world, described as interfaces.
 * `packages/db` implements them with Postgres; tests implement them with in-memory fakes.
 * Core never knows which one it gets (hexagonal architecture).
 */
export interface OfferRepository {
  /** The newest offer per provider for a corridor. */
  latestOffers(source: CurrencyCode, target: CurrencyCode): Promise<ProviderOffer[]>;
}

export interface MidRateRepository {
  /**
   * The newest reference rate for base → quote, or null if none is stored.
   * With `onOrBefore` ("YYYY-MM-DD"), the newest one published on or before that day.
   */
  latest(
    base: CurrencyCode,
    quote: CurrencyCode,
    onOrBefore?: string,
  ): Promise<MidRateObservation | null>;
}
