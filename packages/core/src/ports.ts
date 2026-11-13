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

/** A currency pair the site compares: what the sender pays in, what the recipient gets. */
export type CorridorPair = { readonly source: CurrencyCode; readonly target: CurrencyCode };

export interface CorridorRepository {
  /** Every corridor, so collectors fetch exactly what the comparisons need. */
  all(): Promise<readonly CorridorPair[]>;
}

/** Ids the store hands out; opaque to the collectors. */
export type CollectorRunId = bigint;
export type RawObservationId = bigint;

/** A stored reference rate that differs from a newly received one for the same day and source. */
export type MidRateConflict = {
  readonly base: CurrencyCode;
  readonly quote: CurrencyCode;
  readonly source: string;
  readonly asOf: string;
  readonly stored: string;
  readonly received: string;
};

export type SaveMidRatesResult = {
  /** New days stored. */
  readonly stored: number;
  /** Days already stored with exactly the same rate (a repeated run). */
  readonly unchanged: number;
  /** Days already stored with a different rate: never overwritten (append-only), reported. */
  readonly conflicts: readonly MidRateConflict[];
};

/**
 * Where collectors record their work (stage 4, ADR 0007): runs, raw responses (saved BEFORE they
 * are parsed) and the reference rates parsed from them.
 */
export interface CollectorStore {
  startRun(collector: string, startedAt: Date): Promise<CollectorRunId>;
  saveRaw(
    run: CollectorRunId,
    raw: {
      readonly url: string;
      readonly httpStatus: number;
      readonly body: string;
      readonly fetchedAt: Date;
    },
  ): Promise<RawObservationId>;
  saveMidRates(
    raw: RawObservationId,
    rates: readonly MidRateObservation[],
  ): Promise<SaveMidRatesResult>;
  /** Finishes the run: succeeded without `error`, failed with it. */
  finishRun(run: CollectorRunId, finishedAt: Date, error?: string): Promise<void>;
}
