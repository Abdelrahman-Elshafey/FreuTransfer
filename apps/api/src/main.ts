// Composition root: the only place that knows about Postgres, env vars and ports.
import {
  createPrismaClient,
  databaseUrlFromEnv,
  PrismaMidRateRepository,
  PrismaOfferRepository,
} from "@freu-transfer/db";
import { createApp } from "./app.ts";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
// Outside production this falls back to the local Docker database (docker-compose.yml).
const databaseUrl = databaseUrlFromEnv();
if (!databaseUrl) {
  console.error("DATABASE_URL is required in production (see .env.example)");
  process.exit(1);
}

const db = createPrismaClient(databaseUrl);
const app = createApp({
  offers: new PrismaOfferRepository(db),
  midRates: new PrismaMidRateRepository(db),
  now: () => new Date(),
});

// Express 5 also calls this callback when listening fails (e.g. the port is taken), with the error.
const server = app.listen(port, (error) => {
  if (error) throw error;
  console.log(`API listening on http://localhost:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => void db.$disconnect().then(() => process.exit(0)));
  });
}
