# Swiss Transfer — Cost Comparer

What **actually arrives** when you send money between **Switzerland and Europe** (CHF ⇄ EUR, plus a
few remittance corridors), and how much of the cost is hidden in the exchange rate.

> 🚧 Early development: roadmap step 1 (project skeleton). The full README (diagrams, maths,
> decisions, screenshots) comes in step 7. Plan: [`Project Plan.md`](Project%20Plan.md).

## Quick start

Requirements: Node.js 26.13 LTS, pnpm 12, Docker Desktop.

```sh
pnpm install
pnpm check        # lint + typecheck + tests
pnpm db:up        # Postgres 18.6 on localhost:5434
pnpm dev:api      # http://localhost:3000/health
pnpm dev:web      # http://localhost:5173
```

## Repository layout

| Path | Purpose |
|---|---|
| `packages/core` | Pure domain: money, rates, cost engine (no I/O) |
| `apps/api` | Express 5 HTTP API |
| `apps/web` | React + Vite frontend |
| `docs/adr` | Architecture Decision Records |
