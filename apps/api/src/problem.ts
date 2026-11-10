import type { ErrorRequestHandler, Response } from "express";

/**
 * The problem types this API defines. RFC 9457 §4.2.1: with "about:blank" the title SHOULD be the
 * plain HTTP status phrase, so errors with their own meaning get their own type. These are
 * non-resolvable tag URIs (allowed by §3.1.1): stable identifiers that clients (e.g. the page's
 * translations) can rely on, unlike the English title.
 */
export const PROBLEM_TYPES = {
  invalidQuery: "tag:aelshafey.com,2026:freu-transfer/problems/invalid-query",
  corridorNotAvailable: "tag:aelshafey.com,2026:freu-transfer/problems/corridor-not-available",
} as const;

/** RFC 9457 "Problem Details": one standard JSON shape for every API error. */
export type Problem = {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly errors?: readonly { readonly field: string; readonly message: string }[];
};

export function sendProblem(res: Response, problem: Problem): void {
  res.status(problem.status).type("application/problem+json").json(problem);
}

/** Last middleware: anything unexpected becomes a 500 problem without leaking internals. */
export const problemHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  sendProblem(res, {
    type: "about:blank",
    title: "Internal Server Error",
    status: 500,
  });
};
