import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { createPrismaClient, type PrismaClient } from "./client.ts";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
// Prisma's CLI, run with this Node directly: no shell, so no argument-escaping issues on Windows.
const prismaCli = join(
  dirname(createRequire(import.meta.url).resolve("prisma/package.json")),
  "build/index.js",
);

/**
 * Test helper: a throwaway Postgres 18.6 in Docker, migrated with the real migration files.
 * Docker must be running. Call `stop()` in afterAll.
 */
export async function startTestDatabase(): Promise<{
  db: PrismaClient;
  stop: () => Promise<void>;
}> {
  const container = await new PostgreSqlContainer("postgres:18.6").start();
  const url = container.getConnectionUri();
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: packageDir,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  const db = createPrismaClient(url);
  return {
    db,
    stop: async () => {
      await db.$disconnect();
      await container.stop();
    },
  };
}
