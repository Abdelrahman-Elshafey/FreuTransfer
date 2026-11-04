import { CORE_VERSION } from "@swiss-transfer/core";
import express, { type Express } from "express";

/**
 * Builds the Express app without starting a server, so tests can call it directly
 * (supertest) and main.ts stays the only place that opens a port (composition root).
 */
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", core: CORE_VERSION });
  });

  return app;
}
