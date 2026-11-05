# ADR 0001: Stack and architecture

- **Status:** accepted (hosting parts superseded by ADR 0002)
- **Date:** 2026-11-04

## Context
A solo portfolio project (15+ h/week, free tools only) that must show correct money handling, clean
boundaries, auditability and good tests. Most of the difficulty is in data correctness (FX timing,
amount- and route-dependent quotes), not in web traffic.

## Decision
- **Runtime:** Node.js 26 LTS, with TypeScript run natively through type stripping (no build step).
  TypeScript 7 for type checking only (`tsc --noEmit`).
- **Repository:** pnpm workspaces monorepo: `packages/core`, `packages/db`, `packages/collectors`,
  `apps/api`, `apps/web`.
- **Architecture:** a modular monolith with hexagonal (ports & adapters) boundaries. `core` is pure and
  has no workspace dependencies; adapters implement core ports.
- **API:** Express 5 (native async error handling), Zod validation, OpenAPI generated from the Zod schemas.
- **Database:** PostgreSQL 18 (Docker locally; production hosting in ADR 0002) with Prisma 7 pinned to an exact version.
- **Frontend:** React 19 + Vite 8.
- **Quality:** Biome (lint + format), Vitest (+ fast-check, Testcontainers later), and GitHub Actions CI.

## Alternatives considered
- **Hono + Drizzle:** recommended initially for serverless hosting and SQL-first queries. The owner chose
  **Express + Prisma** because they're familiar and widely known. Prisma's weaker advanced-SQL support
  is handled with TypedSQL or tagged `$queryRaw`.
- **NestJS:** its DI and modules would duplicate what the package boundaries already give us.
- **Microservices:** no benefit for a solo project, and much more operational cost.

## Consequences
- Package boundaries make illegal dependencies visible in review (and later, lint rules).
- Native TS execution limits us to erasable syntax and `.ts` import extensions.
- Prisma and the Node version are pinned exactly; other dependencies use caret ranges plus the lockfile.
