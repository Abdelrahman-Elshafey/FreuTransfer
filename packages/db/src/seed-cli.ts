// `pnpm db:seed [--include-drafts]`: validates data/manual/*.json and loads it.
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./client.ts";
import { databaseUrlFromEnv } from "./local-dev.ts";
import { loadManualData } from "./manual-data.ts";
import { seedManualData } from "./seed.ts";
import { parseSeedArgs } from "./seed-args.ts";

const dataDir = fileURLToPath(new URL("../../../data/manual/", import.meta.url));
const { includeDrafts } = parseSeedArgs(process.argv.slice(2), process.env);
const url = databaseUrlFromEnv();
if (!url) throw new Error("DATABASE_URL is required in production");

const data = await loadManualData(dataDir);
const db = createPrismaClient(url);
try {
  const result = await seedManualData(db, data, { includeDrafts });
  console.log(`Seeded from ${dataDir}${includeDrafts ? " (including drafts)" : ""}:`, result);
} finally {
  await db.$disconnect();
}
