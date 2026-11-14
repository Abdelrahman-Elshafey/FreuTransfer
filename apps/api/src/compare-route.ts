import {
  type Caveat,
  type ComparisonRow,
  type CurrencyCode,
  compareProviders,
  isCurrencyCode,
  MID_RATE_MAX_AGE_DAYS,
  type MidRateObservation,
  type MidRateRepository,
  Money,
  NoMidRateError,
  type OfferRepository,
  RECHECK_DAYS,
  toFixedString,
} from "@freu-transfer/core";
import { type RequestHandler, Router } from "express";
import { z } from "zod";
import {
  type CaveatDto,
  type ComparisonDto,
  isAmount,
  PROBLEM_TYPES,
  type ResultRowDto,
} from "./contract.ts";
import { sendProblem } from "./problem.ts";

const currency = z.string().transform((s, ctx): CurrencyCode => {
  const code = s.toUpperCase();
  if (isCurrencyCode(code)) return code;
  ctx.addIssue({ code: "custom", message: "unsupported currency" });
  return z.NEVER;
});

/** `GET /v1/compare?from=CHF&to=EUR&amount=1000`. The amount stays a string (never a float). */
const querySchema = z
  .object({
    from: currency,
    to: currency,
    // Checked on the digits, not with parseFloat: money never becomes a JS number.
    amount: z
      .string()
      .refine(isAmount, "a positive amount with at most 2 decimals, e.g. 1000 or 1000.50"),
  })
  .refine((q) => q.from !== q.to, { message: "from and to must differ", path: ["to"] });

export type CompareDeps = {
  readonly offers: OfferRepository;
  readonly midRates: MidRateRepository;
  readonly now: () => Date;
};

/** Thin handler: validate, call the core use case, shape the response. No business logic here. */
export function compareRouter(deps: CompareDeps): Router {
  const router = Router();
  const handler: RequestHandler = async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      sendProblem(res, {
        type: PROBLEM_TYPES.invalidQuery,
        title: "Invalid query",
        status: 400,
        errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
      return;
    }
    const { from, to, amount } = parsed.data;
    try {
      const result = await compareProviders(deps, {
        amount: Money.of(amount, from),
        target: to,
        now: deps.now(),
      });
      const body: ComparisonDto = {
        from,
        to,
        amount: result.amount.toJSON(),
        midRate: toMidDto(result.mid),
        midRateTooOld: result.midTooOld,
        midRateMaxAgeDays: MID_RATE_MAX_AGE_DAYS,
        recheckDays: RECHECK_DAYS,
        results: result.ranked.map((row, i) => ({ rank: i + 1, ...toDto(row) })),
        stale: result.stale.map(toDto),
        unavailable: result.unavailable.map(({ offer, reason }) => ({
          providerId: offer.providerId,
          providerName: offer.providerName,
          reason,
        })),
      };
      res.json(body);
    } catch (error) {
      if (!(error instanceof NoMidRateError)) throw error;
      sendProblem(res, {
        type: PROBLEM_TYPES.corridorNotAvailable,
        title: "Corridor not available",
        status: 404,
        detail: error.message,
      });
    }
  };
  router.get("/v1/compare", handler);
  return router;
}

function toMidDto(mid: MidRateObservation): ResultRowDto["midRate"] {
  return { rate: mid.rate.value.toString(), source: mid.source, asOf: mid.asOf };
}

function toCaveatDto(caveat: Caveat): CaveatDto {
  switch (caveat.code) {
    case "monthly_allowance":
      return { code: caveat.code, allowance: caveat.allowance.toJSON() };
    case "amount_limit":
      return { code: caveat.code, max: caveat.max.toJSON() };
  }
}

/** Money and percentages as strings, never JSON numbers. */
function toDto(row: ComparisonRow): ResultRowDto {
  const { offer, quote, cost } = row;
  const { pricing } = offer;
  return {
    providerId: offer.providerId,
    providerName: offer.providerName,
    providerKind: offer.providerKind,
    sourceKind: offer.sourceKind,
    received: quote.received.toJSON(),
    visibleFee: cost.visibleFee.toJSON(),
    fxMarkup: cost.fxMarkup.toJSON(),
    totalCost: cost.totalCost.toJSON(),
    // Percent with 2 decimals ("0.95" = 0.95%), rounded once, so clients do no maths.
    totalCostPercent: toFixedString(cost.totalCostPct.times(100), 2),
    approximate: row.approximate,
    midRate: toMidDto(row.mid),
    rateCapturedAt: pricing.kind === "rate" ? pricing.capturedAt.toISOString() : null,
    measuredAgainst: row.measuredAgainst === null ? null : toMidDto(row.measuredAgainst),
    caveats: row.caveats.map(toCaveatDto),
    vsCheapest:
      row.vsCheapest === null
        ? null
        : {
            extraCost: row.vsCheapest.extraCost.toJSON(),
            lessReceived: row.vsCheapest.lessReceived.toJSON(),
            extraCostPerYear: row.vsCheapest.extraCostPerYear.toJSON(),
          },
    checkedAt: offer.checkedAt.toISOString(),
    sourceUrl: offer.sourceUrl,
  };
}
