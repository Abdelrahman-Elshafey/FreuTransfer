import { CURRENCY_CODES, type CurrencyCode, isCurrencyCode } from "@freu-transfer/core";
import type { Request, Response } from "express";
import { z } from "zod";
import { PROBLEM_TYPES } from "./contract.ts";
import { sendProblem } from "./problem.ts";

/** A currency the site supports, case-insensitive in the query ("chf" = "CHF"). */
const currency = z
  .string()
  .transform((s, ctx): CurrencyCode => {
    const code = s.toUpperCase();
    if (isCurrencyCode(code)) return code;
    ctx.addIssue({ code: "custom", message: "unsupported currency" });
    return z.NEVER;
  })
  .meta({
    enum: CURRENCY_CODES,
    description: "A supported currency (ISO 4217), case-insensitive.",
  });

/** `from` and `to`: every endpoint asks about one direction of a currency pair. */
export const pair = { from: currency, to: currency };

/** Use as `.refine(...differentCurrencies)`: `from` and `to` must differ. */
export const differentCurrencies: [
  (q: { from: CurrencyCode; to: CurrencyCode }) => boolean,
  { message: string; path: PropertyKey[] },
] = [(q) => q.from !== q.to, { message: "from and to must differ", path: ["to"] }];

/**
 * The query parsed with `schema`, or undefined after answering 400 with the invalid-query
 * problem (RFC 9457) listing every field that failed.
 */
export function parseQuery<T>(schema: z.ZodType<T>, req: Request, res: Response): T | undefined {
  const parsed = schema.safeParse(req.query);
  if (parsed.success) return parsed.data;
  sendProblem(res, {
    type: PROBLEM_TYPES.invalidQuery,
    title: "Invalid query",
    status: 400,
    errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
  });
  return undefined;
}
