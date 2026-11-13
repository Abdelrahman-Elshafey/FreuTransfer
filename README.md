# FreuTransfer — Cost Comparer

What **actually arrives** when you send money between **Switzerland and the euro area** (CHF → EUR
and EUR → CHF), and how much of the cost is hidden in the exchange rate. In English,
German, French and Italian.

> 🚧 Early development: roadmap step 3 (first end-to-end version: database, `/v1/compare`, results
> page; deploy to the VPS next). The full README (diagrams, maths, decisions, screenshots) comes in
> step 7. Plan: [`Project Plan.md`](Project%20Plan.md).

## Quick start

Requirements: Node.js 26.13 LTS, pnpm 12, Docker Desktop.

```sh
pnpm install
pnpm check        # Prisma generate + lint + knip + typecheck + tests (Docker must run: DB tests use Testcontainers)
pnpm db:up        # Postgres 18.6 on 127.0.0.1:5434
pnpm db:migrate   # apply migrations to it
pnpm db:seed      # load the verified entries from data/manual/
pnpm dev:api      # http://localhost:3000/health
pnpm dev:web      # http://localhost:5173
```

## Branches

Work happens on short-lived `step-<n>/<name>` branches, merged into `dev` by pull request (CI must
pass). Until v1.0, `dev` is what runs in production: a merge builds the images and, after the
owner's approval, deploys them ([`docs/deploy.md`](docs/deploy.md)). `main` receives `dev` once, as
v1.0, at the end of the project.

## Progress

Roadmap status, updated after every stage: [`docs/progress.md`](docs/progress.md).

## Repository layout

| Path | Purpose |
|---|---|
| `packages/core` | Pure domain: money, rates, cost engine, ports (no I/O) |
| `packages/db` | Prisma schema, migrations, repositories (return core types) |
| `packages/collectors` | Data collectors: the daily reference rate from Frankfurter (`pnpm collect`) |
| `apps/api` | Express 5 HTTP API; `src/contract.ts` is the response shape the page imports |
| `apps/web` | React + Vite frontend; `src/i18n` holds the four languages (ADR 0005) |
| `compose.prod.yml`, `apps/*/Dockerfile` | The production stack; runbook in [`docs/deploy.md`](docs/deploy.md) |
| `scripts/deploy.sh`, `deploy/backup` | Deploying one commit on the server; database backups and their off-site copies |
| `data/manual` | Reviewed provider prices and reference rates, each with source link and date (ADR 0003) |
| `docs/adr` | Architecture Decision Records |
