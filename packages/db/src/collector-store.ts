import {
  assertCurrencyCode,
  type CollectorRunId,
  type CollectorStore,
  type CorridorPair,
  type CorridorRepository,
  Decimal,
  type MidRateConflict,
  type MidRateObservation,
  type RawObservationId,
  type SaveMidRatesResult,
} from "@freu-transfer/core";
import type { PrismaClient } from "./generated/prisma/client.ts";

/** The collector pipeline's tables (stage 4a): runs, raw responses, parsed reference rates. */
export class PrismaCollectorStore implements CollectorStore {
  readonly #db: PrismaClient;

  constructor(db: PrismaClient) {
    this.#db = db;
  }

  async startRun(collector: string, startedAt: Date): Promise<CollectorRunId> {
    const run = await this.#db.collectorRun.create({ data: { collector, startedAt } });
    return run.id;
  }

  async saveRaw(
    run: CollectorRunId,
    raw: { url: string; httpStatus: number; body: string; fetchedAt: Date },
  ): Promise<RawObservationId> {
    const row = await this.#db.rawObservation.create({ data: { runId: run, ...raw } });
    return row.id;
  }

  async saveMidRates(
    raw: RawObservationId,
    rates: readonly MidRateObservation[],
  ): Promise<SaveMidRatesResult> {
    let stored = 0;
    let unchanged = 0;
    const conflicts: MidRateConflict[] = [];
    // One transaction: either all new days of this response are stored, or none.
    await this.#db.$transaction(async (tx) => {
      for (const r of rates) {
        const key = {
          base: r.rate.base,
          quote: r.rate.quote,
          source: r.source,
          asOf: new Date(`${r.asOf}T00:00:00Z`),
        };
        const existing = await tx.midMarketRate.findUnique({
          where: { base_quote_source_asOf: key },
        });
        if (!existing) {
          await tx.midMarketRate.create({
            data: {
              ...key,
              rate: r.rate.value.toString(),
              fetchedAt: r.fetchedAt,
              rawObservationId: raw,
            },
          });
          stored++;
        } else if (new Decimal(existing.rate.toString()).equals(r.rate.value)) {
          unchanged++; // the same value again (e.g. the next hourly run): nothing to store
        } else {
          // Append-only: the stored day is evidence and stays; the difference is reported.
          conflicts.push({
            base: r.rate.base,
            quote: r.rate.quote,
            source: r.source,
            asOf: r.asOf,
            stored: new Decimal(existing.rate.toString()).toString(),
            received: r.rate.value.toString(),
          });
        }
      }
    });
    return { stored, unchanged, conflicts };
  }

  async finishRun(run: CollectorRunId, finishedAt: Date, error?: string): Promise<void> {
    await this.#db.collectorRun.update({
      where: { id: run },
      data:
        error === undefined
          ? { status: "succeeded", finishedAt }
          : { status: "failed", finishedAt, error },
    });
  }
}

export class PrismaCorridorRepository implements CorridorRepository {
  readonly #db: PrismaClient;

  constructor(db: PrismaClient) {
    this.#db = db;
  }

  async all(): Promise<readonly CorridorPair[]> {
    const rows = await this.#db.corridor.findMany({ orderBy: { id: "asc" } });
    return rows.map((row) => {
      // CHAR(3) columns may be space-padded.
      const source = row.sourceCurrency.trim();
      const target = row.targetCurrency.trim();
      assertCurrencyCode(source);
      assertCurrencyCode(target);
      return { source, target };
    });
  }
}
