import express, { type Express } from "express";
import { type CompareDeps, compareRouter } from "./compare-route.ts";
import { problemHandler, sendProblem } from "./problem.ts";

export type AppDeps = CompareDeps;

/**
 * Builds the Express app without starting a server, so tests can call it directly
 * (supertest) and main.ts stays the only place that opens a port (composition root).
 * Dependencies come in from outside: Postgres repositories in main.ts, fakes in tests.
 */
export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(compareRouter(deps));

  app.use((_req, res) => {
    sendProblem(res, { type: "about:blank", title: "Not Found", status: 404 });
  });
  app.use(problemHandler);

  return app;
}
