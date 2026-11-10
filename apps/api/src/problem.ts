import type { ErrorRequestHandler, Response } from "express";
import type { ProblemDto } from "./contract.ts";

/** Sends an RFC 9457 problem with its media type. */
export function sendProblem(res: Response, problem: ProblemDto): void {
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
