import { HISTORY_MAX_DAYS, type MidRateHistory, rateHistory } from "@freu-transfer/core";
import { type RequestHandler, Router } from "express";
import { z } from "zod";
import type { HistoryDto } from "./contract.ts";
import { toMidDto } from "./mid-dto.ts";
import { differentCurrencies, pair, parseQuery } from "./query.ts";

/** The days `/v1/history` covers when the query names none: about three months. */
const DEFAULT_HISTORY_DAYS = 90;

/** `GET /v1/history?from=CHF&to=EUR&days=90`; `days` is optional. */
const querySchema = z
  .object({
    ...pair,
    days: z
      .string()
      .regex(/^\d{1,3}$/, `whole days, 1 to ${HISTORY_MAX_DAYS}`)
      .transform(Number)
      .refine((d) => d >= 1 && d <= HISTORY_MAX_DAYS, `whole days, 1 to ${HISTORY_MAX_DAYS}`)
      .optional(),
  })
  .refine(...differentCurrencies);

export type HistoryDeps = {
  readonly history: MidRateHistory;
  readonly now: () => Date;
};

/** Thin handler: validate, call the core use case, shape the response. */
export function historyRouter(deps: HistoryDeps): Router {
  const router = Router();
  const handler: RequestHandler = async (req, res) => {
    const query = parseQuery(querySchema, req, res);
    if (!query) return;
    const days = query.days ?? DEFAULT_HISTORY_DAYS;
    const result = await rateHistory(deps, {
      base: query.from,
      quote: query.to,
      days,
      now: deps.now(),
    });
    const body: HistoryDto = {
      from: query.from,
      to: query.to,
      days,
      fromDay: result.fromDay,
      toDay: result.toDay,
      rates: result.rates.map(toMidDto),
    };
    res.json(body);
  };
  router.get("/v1/history", handler);
  return router;
}
