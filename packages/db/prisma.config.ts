import { defineConfig } from "prisma/config";
import { LOCAL_DEV_DATABASE_URL } from "./src/local-dev.ts";

// Prisma 7 reads the connection string from here, not from schema.prisma.
// Without DATABASE_URL it uses the local dev database, so `prisma generate` also works in CI.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? LOCAL_DEV_DATABASE_URL },
});
