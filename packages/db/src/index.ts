/**
 * @freu-transfer/db — persistence. Prisma lives only in this package; everything it exports
 * speaks core types (CLAUDE.md, architecture rules). Seeding runs inside the package (`pnpm db:seed`).
 */
export { createPrismaClient } from "./client.ts";
export { databaseUrlFromEnv } from "./local-dev.ts";
export { PrismaMidRateRepository, PrismaOfferRepository } from "./repositories.ts";
