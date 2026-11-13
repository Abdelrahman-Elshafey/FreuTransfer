// `pnpm collect`: one Frankfurter run (stage 4). In production the `collect` service runs this
// every hour (ADR 0007). Exit code 1 when the run failed, so the failure shows in the logs.
import {
  createPrismaClient,
  databaseUrlFromEnv,
  PrismaCollectorStore,
  PrismaCorridorRepository,
} from "@freu-transfer/db";
import { collectFrankfurter } from "./frankfurter.ts";

const url = databaseUrlFromEnv();
if (!url) throw new Error("DATABASE_URL is required in production");

const db = createPrismaClient(url);
try {
  const result = await collectFrankfurter({
    store: new PrismaCollectorStore(db),
    corridors: new PrismaCorridorRepository(db),
    fetch: globalThis.fetch,
    now: () => new Date(),
  });
  for (const o of result.outcomes) {
    console.log(
      `collect: ${o.pair.source}→${o.pair.target} (${o.source}): ${o.stored} new, ${o.unchanged} already stored`,
    );
  }
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`collect: FAILED ${error}`);
    process.exitCode = 1;
  }
  console.log(`collect: run ${result.run} ${result.errors.length > 0 ? "failed" : "succeeded"}`);
} finally {
  await db.$disconnect();
}
