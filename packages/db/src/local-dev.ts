/**
 * The local development database from docker-compose.yml (not a secret). One place for it:
 * Prisma's config, the seed script and the API (outside production) all fall back to it.
 * 127.0.0.1, not "localhost": on Windows "localhost" may resolve to ::1, where Docker isn't listening.
 */
export const LOCAL_DEV_DATABASE_URL =
  "postgresql://freu:freu_dev_only@127.0.0.1:5434/freu_transfer";

/** DATABASE_URL if set; otherwise the local dev database, except in production (null). */
export function databaseUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  return env.NODE_ENV === "production" ? null : LOCAL_DEV_DATABASE_URL;
}
