import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isCurrencyCode } from "@freu-transfer/core";
import { z } from "zod";

/**
 * The reviewed data files in `data/manual/` (ADR 0003). Every entry is validated before anything
 * touches the database, and money values stay strings (never JSON numbers).
 */

// The database columns are NUMERIC(20,10): at most 10 digits before and 10 after the point.
// More decimals would be rounded silently by Postgres, and the next seed would then see a
// "changed" history row and stop.
const decimal = z
  .string()
  .regex(
    /^\d{1,10}(\.\d{1,10})?$/,
    "must be a non-negative decimal string with at most 10 digits and 10 decimals",
  );
// Links are shown on the page as <a href>: https only (z.url() alone also accepts javascript:).
const link = z.url({ protocol: /^https$/, error: "must be an https:// link" });
// Only currencies the core engine knows (with their minor units); anything else would be stored
// and then fail when compared.
const currency = z.string().refine(isCurrencyCode, "unsupported currency");
const id = z.string().regex(/^[a-z0-9-]+$/i, "must be a slug");

const providerSchema = z.object({
  id,
  name: z.string().min(1),
  kind: z.enum(["bank", "fintech", "money_transfer_operator"]),
  website: link,
});

const corridorSchema = z.object({ id, sourceCurrency: currency, targetCurrency: currency });

const midRateSchema = z.object({
  base: currency,
  quote: currency,
  rate: decimal,
  source: z.enum(["ecb"]),
  asOf: z.iso.date(),
  fetchedAt: z.iso.datetime(),
  sourceUrl: link,
  note: z.string().optional(),
});

/** draft = researched by Claude; needs_input = a value only the owner can read; verified = checked by the owner. */
const statusSchema = z.enum(["draft", "needs_input", "verified"]);

const feeBase = {
  providerId: id,
  corridorId: id,
  status: statusSchema,
  feeMode: z.enum(["deducted", "on_top"]),
  fixedFee: decimal,
  percentFee: decimal,
  minFee: decimal.optional(),
  maxFee: decimal.optional(),
  sourceUrl: link,
  checkedAt: z.iso.datetime(),
  note: z.string().optional(),
};

const feeScheduleSchema = z
  .discriminatedUnion("sourceKind", [
    z.object({
      ...feeBase,
      sourceKind: z.literal("rule_based"),
      fxMarkup: decimal,
      /** Optional: fxMarkup applies up to `upTo` (source currency), `markupAbove` beyond it. */
      markupTier: z.object({ upTo: decimal, markupAbove: decimal }).optional(),
    }),
    z.object({
      ...feeBase,
      sourceKind: z.literal("manual"),
      providerRate: decimal.nullable(),
      rateCapturedAt: z.iso.datetime().nullable(),
    }),
  ])
  .superRefine((entry, ctx) => {
    if (entry.sourceKind !== "manual") return;
    const complete = entry.providerRate !== null && entry.rateCapturedAt !== null;
    if (!complete && entry.status !== "needs_input") {
      ctx.addIssue({
        code: "custom",
        message: "A manual entry without a rate and capture time must have status needs_input",
      });
    }
  });

export type FeeScheduleEntry = z.infer<typeof feeScheduleSchema>;

const filesSchema = z.object({
  providers: z.array(providerSchema),
  corridors: z.array(corridorSchema),
  midRates: z.array(midRateSchema),
  feeSchedules: z.array(feeScheduleSchema),
});

export type ManualData = z.infer<typeof filesSchema>;

/** The rules that look across entries, or need the current time. */
const manualDataSchema = (now: Date) =>
  filesSchema.superRefine((data, ctx) => {
    const providers = new Set(data.providers.map((p) => p.id));
    const corridors = new Set(data.corridors.map((c) => c.id));
    data.feeSchedules.forEach((fs, i) => {
      if (!providers.has(fs.providerId)) {
        ctx.addIssue({
          code: "custom",
          path: ["feeSchedules", i, "providerId"],
          message: `Unknown provider "${fs.providerId}"`,
        });
      }
      if (!corridors.has(fs.corridorId)) {
        ctx.addIssue({
          code: "custom",
          path: ["feeSchedules", i, "corridorId"],
          message: `Unknown corridor "${fs.corridorId}"`,
        });
      }
      // The newest entry per provider wins and counts as fresh for RECHECK_DAYS: a date typed in
      // the future (2027 for 2026) would win forever and never go stale.
      const times = {
        checkedAt: fs.checkedAt,
        rateCapturedAt: fs.sourceKind === "manual" ? fs.rateCapturedAt : null,
      };
      for (const [field, value] of Object.entries(times)) {
        if (value !== null && new Date(value) > now) {
          ctx.addIssue({
            code: "custom",
            path: ["feeSchedules", i, field],
            message: `${field} ${value} is in the future`,
          });
        }
      }
    });
    // Publication days are compared as UTC days: reference rates appear in the afternoon (CET),
    // long after the UTC day has started.
    const today = now.toISOString().slice(0, 10);
    data.midRates.forEach((rate, i) => {
      if (rate.asOf > today || new Date(rate.fetchedAt) > now) {
        ctx.addIssue({
          code: "custom",
          path: ["midRates", i],
          message: `asOf ${rate.asOf} or fetchedAt ${rate.fetchedAt} is in the future`,
        });
      }
    });
  });

/**
 * Validates already-parsed data (used by tests and by `loadManualData`). `now` is the time the
 * dates are checked against (tests pass a fixed one).
 */
export function parseManualData(raw: unknown, now: Date = new Date()): ManualData {
  return manualDataSchema(now).parse(raw);
}

/** Reads and validates the four files in a `data/manual/` directory. */
export async function loadManualData(dir: string): Promise<ManualData> {
  const read = async (file: string): Promise<unknown> =>
    JSON.parse(await readFile(join(dir, file), "utf8"));
  return parseManualData({
    providers: await read("providers.json"),
    corridors: await read("corridors.json"),
    midRates: await read("mid-rates.json"),
    feeSchedules: await read("fee-schedules.json"),
  });
}
