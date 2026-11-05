import type { ErrorRequestHandler, Response } from "express";

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
