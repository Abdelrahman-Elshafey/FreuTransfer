import {
  assertCurrencyCode,
  type CurrencyCode,
  Decimal,
  type FeeModel,
  feeRule,
  type MidRateObservation,
  type MidRateRepository,
  Money,
  type OfferRepository,
  type Pricing,
  type ProviderKind,
  type ProviderOffer,
  Rate,
  type SourceKind,
} from "@freu-transfer/core";
import type { PrismaClient } from "./generated/prisma/client.ts";

/** Prisma returns NUMERIC as its own Decimal type; we convert through the exact string. */
type DbDecimal = { toString(): string };
const dec = (value: DbDecimal) => new Decimal(value.toString());

type OfferRow = {
  provider_id: string;
  provider_name: string;
  provider_kind: string;
  source_currency: string;
  target_currency: string;
  source_kind: string;
  fee_mode: string;
  fixed_fee: DbDecimal;
  percent_fee: DbDecimal;
  min_fee: DbDecimal | null;
  max_fee: DbDecimal | null;
  fx_markup: DbDecimal | null;
  fx_markup_tier_up_to: DbDecimal | null;
  fx_markup_above: DbDecimal | null;
  provider_rate: DbDecimal | null;
  rate_captured_at: Date | null;
  source_url: string;
  checked_at: Date;
};

export class PrismaOfferRepository implements OfferRepository {
  readonly #db: PrismaClient;

  constructor(db: PrismaClient) {
    this.#db = db;
  }

  async latestOffers(source: CurrencyCode, target: CurrencyCode): Promise<ProviderOffer[]> {
    // DISTINCT ON keeps the newest row per provider (rows are append-only; the newest wins).
    // Tagged $queryRaw: values are sent as parameters, never pasted into the SQL text.
    const rows = await this.#db.$queryRaw<OfferRow[]>`
      SELECT DISTINCT ON (fs.provider_id)
        fs.provider_id, p.name AS provider_name, p.kind::text AS provider_kind,
        c.source_currency, c.target_currency,
        fs.source_kind::text AS source_kind, fs.fee_mode::text AS fee_mode,
        fs.fixed_fee, fs.percent_fee, fs.min_fee, fs.max_fee,
        fs.fx_markup, fs.fx_markup_tier_up_to, fs.fx_markup_above,
        fs.provider_rate, fs.rate_captured_at,
        fs.source_url, fs.checked_at
      FROM fee_schedules fs
      JOIN providers p ON p.id = fs.provider_id
      JOIN corridors c ON c.id = fs.corridor_id
      WHERE c.source_currency = ${source} AND c.target_currency = ${target}
      ORDER BY fs.provider_id, fs.checked_at DESC, fs.id DESC`;
    return rows.map(toOffer);
  }
}

export class PrismaMidRateRepository implements MidRateRepository {
  readonly #db: PrismaClient;

  constructor(db: PrismaClient) {
    this.#db = db;
  }

  async latest(
    base: CurrencyCode,
    quote: CurrencyCode,
    onOrBefore?: string,
  ): Promise<MidRateObservation | null> {
    const row = await this.#db.midMarketRate.findFirst({
      where: {
        base,
        quote,
        ...(onOrBefore === undefined ? {} : { asOf: { lte: new Date(`${onOrBefore}T00:00:00Z`) } }),
      },
      orderBy: [{ asOf: "desc" }, { fetchedAt: "desc" }],
    });
    if (!row) return null;
    return {
      rate: Rate.of(base, quote, dec(row.rate)),
      source: row.source,
      asOf: row.asOf.toISOString().slice(0, 10),
      fetchedAt: row.fetchedAt,
    };
  }
}

function toOffer(row: OfferRow): ProviderOffer {
  const sourceCurrency = currency(row.source_currency);
  const targetCurrency = currency(row.target_currency);
  return {
    providerId: row.provider_id,
    providerName: row.provider_name,
    providerKind: row.provider_kind as ProviderKind,
    sourceKind: row.source_kind as SourceKind,
    sourceCurrency,
    targetCurrency,
    fees: toFeeModel(row, sourceCurrency),
    pricing: toPricing(row, sourceCurrency, targetCurrency),
    sourceUrl: row.source_url,
    checkedAt: row.checked_at,
  };
}

function toFeeModel(row: OfferRow, currency: CurrencyCode): FeeModel {
  const rule = feeRule(currency, {
    fixed: dec(row.fixed_fee),
    percent: dec(row.percent_fee),
    ...(row.min_fee === null ? {} : { min: dec(row.min_fee) }),
    ...(row.max_fee === null ? {} : { max: dec(row.max_fee) }),
  });
  if (row.fee_mode !== "deducted" && row.fee_mode !== "on_top") {
    throw new Error(`Unknown fee mode "${row.fee_mode}"`);
  }
  return { kind: row.fee_mode, rule };
}

function toPricing(row: OfferRow, source: CurrencyCode, target: CurrencyCode): Pricing {
  // The database CHECK constraint guarantees exactly one of these shapes.
  if (row.fx_markup !== null) {
    // The CHECK constraint guarantees both tier columns are set together, or neither.
    const tier =
      row.fx_markup_tier_up_to !== null && row.fx_markup_above !== null
        ? {
            tier: {
              upTo: Money.of(dec(row.fx_markup_tier_up_to), source),
              markupAbove: dec(row.fx_markup_above),
            },
          }
        : {};
    return { kind: "markup", markup: dec(row.fx_markup), ...tier };
  }
  if (row.provider_rate !== null && row.rate_captured_at !== null) {
    return {
      kind: "rate",
      rate: Rate.of(source, target, dec(row.provider_rate)),
      capturedAt: row.rate_captured_at,
    };
  }
  throw new Error(`Fee schedule for ${row.provider_id} has neither a markup nor a rate`);
}

function currency(code: string): CurrencyCode {
  const trimmed = code.trim(); // CHAR(3) columns may be space-padded
  assertCurrencyCode(trimmed);
  return trimmed;
}
