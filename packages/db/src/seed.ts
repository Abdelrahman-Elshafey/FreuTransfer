import { Decimal } from "@freu-transfer/core";
import type { Prisma, PrismaClient } from "./generated/prisma/client.ts";
import type { FeeScheduleEntry, ManualData } from "./manual-data.ts";

export type SeedResult = {
  readonly providers: number;
  readonly corridors: number;
  readonly midRates: number;
  readonly feeSchedules: number;
  readonly skippedNotVerified: number;
};

/** A history row in the files no longer matches the database row with the same key. */
class SeedConflictError extends Error {
  override name = "SeedConflictError";
}

/**
 * Loads reviewed manual data into the database. Safe to run repeatedly: rows already stored
 * are left alone, only missing ones are inserted.
 *
 * Rates and fee schedules are append-only history, and corridors are referenced by them. If a file
 * entry has the same key as a stored row but different values, seeding stops with SeedConflictError
 * instead of silently ignoring the change: a correction must be a new entry with a new `checkedAt`
 * (or `asOf`).
 *
 * Only `verified` fee schedules are loaded, unless `includeDrafts` is set for a local preview
 * (never in production). `needs_input` entries are never loaded.
 *
 * All or nothing: everything runs in one transaction, so a conflict or a rejected row leaves the
 * database unchanged. Without it, rows inserted before the error would stay forever (the tables
 * are append-only, so they can't be deleted).
 */
export function seedManualData(
  db: PrismaClient,
  data: ManualData,
  options: { readonly includeDrafts?: boolean } = {},
): Promise<SeedResult> {
  return db.$transaction((tx) => seedInTransaction(tx, data, options));
}

async function seedInTransaction(
  db: Prisma.TransactionClient,
  data: ManualData,
  options: { readonly includeDrafts?: boolean },
): Promise<SeedResult> {
  // Reference data (not history): insert new ones, update names and websites of existing ones.
  const knownProviders = new Set(
    (await db.provider.findMany({ select: { id: true } })).map((p) => p.id),
  );
  for (const p of data.providers) {
    await db.provider.upsert({ where: { id: p.id }, create: p, update: p });
  }
  // Corridors are referenced by fee schedules, so a stored corridor can't change its currencies.
  let corridors = 0;
  for (const c of data.corridors) {
    const existing = await db.corridor.findUnique({ where: { id: c.id } });
    if (existing) {
      if (
        existing.sourceCurrency !== c.sourceCurrency ||
        existing.targetCurrency !== c.targetCurrency
      ) {
        throw new SeedConflictError(
          `Corridor ${c.id} is ${existing.sourceCurrency}→${existing.targetCurrency} in the ` +
            `database but ${c.sourceCurrency}→${c.targetCurrency} in corridors.json. Fee ` +
            "schedules refer to it, so it can't change: add a new corridor instead.",
        );
      }
      continue;
    }
    await db.corridor.create({ data: c });
    corridors++;
  }

  let midRates = 0;
  for (const r of data.midRates) {
    const asOf = new Date(`${r.asOf}T00:00:00Z`);
    const key = { base: r.base, quote: r.quote, source: r.source, asOf };
    const existing = await db.midMarketRate.findUnique({
      where: { base_quote_source_asOf: key },
      select: { rate: true },
    });
    if (existing) {
      if (!same(existing.rate, r.rate)) {
        throw new SeedConflictError(
          `${r.base}→${r.quote} ${r.source} rate of ${r.asOf} is ${existing.rate.toString()} in the ` +
            `database but ${r.rate} in mid-rates.json. Stored rates can't be changed.`,
        );
      }
      continue;
    }
    await db.midMarketRate.create({
      data: { ...key, rate: r.rate, fetchedAt: new Date(r.fetchedAt) },
    });
    midRates++;
  }

  const loadable = data.feeSchedules.filter(
    (fs) => fs.status === "verified" || (options.includeDrafts === true && fs.status === "draft"),
  );
  let feeSchedules = 0;
  for (const entry of loadable) {
    const row = toRow(entry);
    const existing = await db.feeSchedule.findFirst({
      where: { providerId: row.providerId, corridorId: row.corridorId, checkedAt: row.checkedAt },
    });
    if (existing) {
      const changed = differences(existing, row);
      if (changed.length > 0) {
        throw new SeedConflictError(
          `${entry.providerId} ${entry.corridorId} checked at ${entry.checkedAt} is already stored with ` +
            `different ${changed.join(", ")}. Fee schedules are history: add a new entry with a new ` +
            "checkedAt instead of editing this one.",
        );
      }
      continue;
    }
    await db.feeSchedule.create({ data: row });
    feeSchedules++;
  }

  return {
    providers: data.providers.filter((p) => !knownProviders.has(p.id)).length,
    corridors,
    midRates,
    feeSchedules,
    skippedNotVerified: data.feeSchedules.length - loadable.length,
  };
}

type DbValue = { toString(): string } | Date | string | null;

/** Decimal-aware equality: "1.07" equals the stored 1.0700000000. */
function same(stored: DbValue, wanted: DbValue): boolean {
  if (stored === null || wanted === null) return stored === wanted;
  if (stored instanceof Date || wanted instanceof Date) {
    return new Date(stored as Date).getTime() === new Date(wanted as Date).getTime();
  }
  const a = stored.toString();
  const b = wanted.toString();
  const isNumber = /^-?\d+(\.\d+)?$/;
  return isNumber.test(a) && isNumber.test(b) ? new Decimal(a).equals(b) : a === b;
}

const COMPARED_FIELDS = [
  "sourceKind",
  "feeMode",
  "fixedFee",
  "percentFee",
  "minFee",
  "maxFee",
  "fxMarkup",
  "fxMarkupTierUpTo",
  "fxMarkupAbove",
  "providerRate",
  "rateCapturedAt",
  "sourceUrl",
  "note",
] as const;

function differences(stored: Record<string, unknown>, wanted: Record<string, unknown>): string[] {
  return COMPARED_FIELDS.filter(
    (f) => !same((stored[f] ?? null) as DbValue, (wanted[f] ?? null) as DbValue),
  );
}

function toRow(entry: FeeScheduleEntry) {
  const common = {
    providerId: entry.providerId,
    corridorId: entry.corridorId,
    sourceKind: entry.sourceKind,
    feeMode: entry.feeMode,
    fixedFee: entry.fixedFee,
    percentFee: entry.percentFee,
    minFee: entry.minFee ?? null,
    maxFee: entry.maxFee ?? null,
    sourceUrl: entry.sourceUrl,
    checkedAt: new Date(entry.checkedAt),
    note: entry.note ?? null,
  };
  if (entry.sourceKind === "rule_based") {
    return {
      ...common,
      fxMarkup: entry.fxMarkup,
      fxMarkupTierUpTo: entry.markupTier?.upTo ?? null,
      fxMarkupAbove: entry.markupTier?.markupAbove ?? null,
      providerRate: null,
      rateCapturedAt: null,
    };
  }
  if (entry.providerRate === null || entry.rateCapturedAt === null) {
    throw new Error(`Manual entry for ${entry.providerId} is incomplete`);
  }
  return {
    ...common,
    fxMarkup: null,
    fxMarkupTierUpTo: null,
    fxMarkupAbove: null,
    providerRate: entry.providerRate,
    rateCapturedAt: new Date(entry.rateCapturedAt),
  };
}
