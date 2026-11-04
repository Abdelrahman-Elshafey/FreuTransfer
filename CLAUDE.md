# CLAUDE.md — project rules for Swiss Transfer

Portfolio project: a money-transfer cost comparer for **Switzerland ⇄ Europe** (plus CHF→EGP/RSD).
Source of truth for scope and roadmap: `Project Plan.md`. Market and data-source research:
`Research - Swiss & European Transfer Landscape.md`.

## Working agreement
- Build **one roadmap step at a time**, in order (Project Plan §11). Before a step: explain the plan
  and why. After it: walk the user through the code until they can explain it.
- Write tests together with the code. After every change run `pnpm check` (lint + typecheck + test).
- One commit per roadmap step (ask before committing or pushing).
- Before adding or upgrading any dependency, check the **latest stable** version in the npm
  registry (`npm view <pkg> dist-tags`). Skip RC/alpha releases, and check engines and peer dependencies.
  pnpm's `minimumReleaseAge` supply-chain gate refuses very fresh releases. **Don't add
  `minimumReleaseAgeExclude` entries**; pick the newest version old enough to pass the gate.
- Record significant decisions as ADRs in `docs/adr/` (`NNNN-short-title.md`).

## Money rules (non-negotiable)
- **Never** represent money or rates as JS `number`. Use the `Money`/`Rate` value objects in
  `packages/core` (backed by decimal.js). Values cross the API as **strings**.
- Round only at the end, to the currency's ISO 4217 minor unit, with the documented rounding mode.
- Universal cost formula (Project Plan §2):
  `total_cost = total_paid − received / mid_rate`, `fx_markup = total_cost − visible_fee`,
  `total_cost_% = total_cost / total_paid`.
- Every quote carries `capturedAt`, `source`, sender/recipient country, and the mid rate it was
  compared with.

## Architecture rules
- Modular monolith, hexagonal boundaries:
  - `packages/core`: pure domain. **No I/O, no imports from other workspace packages.**
  - `packages/db` (step 3): Prisma lives only here; repositories return core types, never Prisma models.
  - `packages/collectors` (step 4): one adapter per source, implementing core ports; raw responses are stored before parsing.
  - `apps/api`: Express 5. Handlers validate (Zod) and call core use cases, with no business logic. `app.ts` builds the app; `main.ts` is the composition root.
  - `apps/web`: React + Vite.
- Append-only data: never update or delete observations, rates or quotes.
- SQL: Prisma TypedSQL or tagged `$queryRaw` only, **never `$queryRawUnsafe`**.
- Data sourcing: respect ToS and robots.txt. No automated access to sources that disallow it
  (e.g. Revolut `/api/`); use rule-based or manual adapters instead. Wise comparison data only
  as permitted by Wise (see Project Plan §7).

## Tooling
- Node **26.13.0 LTS** (`.node-version`), pnpm **12.16.1** (`packageManager`), TypeScript 7.
- TypeScript runs natively in Node (type stripping): use only erasable syntax (no `enum`,
  `namespace` or parameter properties) and import local files **with the `.ts` extension**.
- Commands: `pnpm install` · `pnpm check` · `pnpm lint:fix` · `pnpm db:up` / `pnpm db:down`
  · `pnpm dev:api` (http://localhost:3000) · `pnpm dev:web` (http://localhost:5173).
- Windows host: the repo forces LF line endings (`.gitattributes`).
- Local DB = Docker container on **127.0.0.1:5434**. Port 5432 is the owner's native PostgreSQL
  service (`postgresql-x64-18`) and 5433 is another project's container (`urconnections`).
  Never use either for this project.
