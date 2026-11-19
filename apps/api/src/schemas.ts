/**
 * The API's response shapes as Zod schemas: the one source for the TypeScript types the handlers
 * and the page use (contract.ts derives them) and for the OpenAPI document (openapi.ts). Responses
 * are built by the handlers, not parsed: app.test.ts checks every kind of answer against these.
 *
 * Descriptions are for developers, in English, like a problem's `title`; the page never shows
 * them (docs/adr/0005).
 */
import { CURRENCY_CODES, type UnavailableReason } from "@freu-transfer/core";
import { z } from "zod";

/** The schemas that get a name in the OpenAPI document (`#/components/schemas/<id>`). */
export const components = z.registry<{ id: string; description?: string }>();

const named = <T extends z.ZodType>(schema: T, id: string, description: string): T => {
  components.add(schema, { id, description });
  return schema;
};

const currency = z.enum(CURRENCY_CODES);

export const moneySchema = named(
  z.object({
    amount: z
      .string()
      .regex(/^-?\d+\.\d{2}$/)
      .meta({ examples: ["1044.75"] }),
    currency,
  }),
  "Money",
  "An amount as a string, already rounded to the currency's minor unit; never a JSON number.",
);

export const midRateSchema = named(
  z.object({
    rate: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .meta({
        description: "1 source currency = `rate` target currency, exact.",
        examples: ["1.0893"],
      }),
    source: z.string().meta({ description: '"ecb", the only reference rate source in v1.' }),
    asOf: z.iso.date().meta({ description: "Publication day." }),
  }),
  "MidRate",
  "An official reference rate (mid-market): the rate, who published it and on which day.",
);

export const caveatSchema = named(
  z.discriminatedUnion("code", [
    z.object({ code: z.literal("monthly_allowance"), allowance: moneySchema }).meta({
      description:
        "No markup on the first `allowance` exchanged per month; earlier exchanges that month use it up (the price assumes none was used).",
    }),
    z.object({ code: z.literal("amount_limit"), max: moneySchema }).meta({
      description: "The provider accepts at most `max` per transfer.",
    }),
  ]),
  "Caveat",
  "What a row's numbers can't show, as a code with its amounts; clients write the sentence.",
);

const UNAVAILABLE_REASONS = [
  "no_reference_rate",
  "amount_not_supported",
  "implausible_cost",
] as const satisfies readonly UnavailableReason[];
// Both ways: a reason added to core fails the typecheck here until it is listed.
const allReasons: Exclude<UnavailableReason, (typeof UNAVAILABLE_REASONS)[number]> extends never
  ? true
  : never = true;
void allReasons;

export const resultRowSchema = named(
  z.object({
    providerId: z.string(),
    providerName: z.string(),
    providerKind: z.enum(["bank", "fintech", "money_transfer_operator"]),
    sourceKind: z.enum(["rule_based", "manual"]).meta({
      description:
        "rule_based: the provider's published fee and markup applied to the reference rate; manual: a rate read by hand.",
    }),
    received: moneySchema.meta({ description: "What arrives, in the target currency." }),
    visibleFee: moneySchema,
    fxMarkup: moneySchema.meta({ description: "The cost hidden in the exchange rate." }),
    totalCost: moneySchema.meta({ description: "visibleFee + fxMarkup, in the source currency." }),
    totalCostPercent: z
      .string()
      .regex(/^-?\d+\.\d{2}$/)
      .meta({ description: 'Percent, rounded once from the exact value: "0.95" means 0.95%.' }),
    approximate: z.boolean().meta({
      description: "True for manual rates: an estimate from a rate read on another day or time.",
    }),
    midRate: midRateSchema.meta({ description: "The reference rate this row was compared with." }),
    rateCapturedAt: z.iso
      .datetime()
      .nullable()
      .meta({ description: "Manual rates only: when the provider's rate was read (UTC)." }),
    measuredAgainst: midRateSchema.nullable().meta({
      description:
        "Manual rates only: the reference rate of the day the rate was read; its distance from it is applied to `midRate`.",
    }),
    caveats: z.array(caveatSchema),
    vsCheapest: z
      .object({ extraCost: moneySchema, lessReceived: moneySchema, extraCostPerYear: moneySchema })
      .nullable()
      .meta({
        description:
          "Ranked rows only (null in `stale`): the difference from the cheapest ranked row, zero for the cheapest; extraCostPerYear = 12 × extraCost.",
      }),
    checkedAt: z.iso.datetime().meta({ description: "When this price was last checked (UTC)." }),
    sourceUrl: z.url().meta({ description: "Where the price comes from." }),
  }),
  "ResultRow",
  "One provider's result for the amount asked.",
);

const rankedRowSchema = named(
  resultRowSchema.extend({
    rank: z
      .int()
      .min(1)
      .meta({ description: "1 = cheapest; equal costs are ordered by providerId." }),
  }),
  "RankedRow",
  "A ResultRow in the ranking, with its place.",
);

export const comparisonSchema = named(
  z.object({
    from: currency,
    to: currency,
    amount: moneySchema,
    midRate: midRateSchema.meta({ description: "The newest reference rate." }),
    midRateTooOld: z.boolean().meta({
      description: "True when `midRate` was published more than `midRateMaxAgeDays` days ago.",
    }),
    midRateMaxAgeDays: z.int(),
    recheckDays: z.int().meta({ description: "Data older than this many days is in `stale`." }),
    results: z
      .array(rankedRowSchema)
      .meta({ description: "Ranked, cheapest (lowest total cost) first." }),
    stale: z.array(resultRowSchema).meta({ description: "Shown, but not ranked." }),
    unavailable: z
      .array(
        z.object({
          providerId: z.string(),
          providerName: z.string(),
          reason: z.enum(UNAVAILABLE_REASONS),
        }),
      )
      .meta({
        description: "Providers that can't be compared for this amount, with a reason code.",
      }),
  }),
  "Comparison",
  "Every provider for one amount and direction.",
);

export const historySchema = named(
  z.object({
    from: currency,
    to: currency,
    days: z.int(),
    fromDay: z.iso.date(),
    toDay: z.iso.date(),
    rates: z
      .array(midRateSchema)
      .meta({ description: "Oldest first, one per publication day; weekends have none." }),
  }),
  "History",
  "The reference rates of the last `days` calendar days in Zurich, today included.",
);

export const problemSchema = named(
  z.object({
    type: z.string().meta({ description: "A tag URI defined by this API, or about:blank." }),
    title: z.string().meta({ description: "For developers, in English." }),
    status: z.int(),
    detail: z.string().optional(),
    errors: z
      .array(z.object({ field: z.string(), message: z.string() }))
      .optional()
      .meta({ description: "Invalid query only: every field that failed." }),
  }),
  "Problem",
  "RFC 9457 Problem Details: the body of every error.",
);

export const healthSchema = z.object({ status: z.literal("ok") });
