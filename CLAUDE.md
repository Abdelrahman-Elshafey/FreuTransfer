# CLAUDE.md — project rules for FreuTransfer

Portfolio project: a money-transfer cost comparer for **Switzerland ⇄ euro area** (CHF→EUR and
EUR→CHF only, ADR 0008).
Source of truth for scope and roadmap: `Project Plan.md`. Market and data-source research:
`Research - Swiss & European Transfer Landscape.md`.

## Working agreement
- Build **one roadmap step at a time**, in order (Project Plan §7). Before a step: explain the plan
  and why. After it: walk the user through the code until they can explain it.
- Write tests together with the code. After every change run `pnpm check`
  (Prisma generate + lint + knip + typecheck + test).
- **Git workflow (from 2026-11-08):** two long-lived branches. `dev` collects finished work and is
  what production runs until v1.0: a merge into `dev` builds the images and, after the owner's
  approval, deploys them (ADR 0006). `main` stays untouched until the end of the project, when
  `dev` is merged into it as v1.0 (owner, 2026-11-11).
  Never commit to `main` or `dev` directly. Each roadmap step or sub-step gets a short-lived branch
  from `dev` (`step-<n>/<short-name>`, e.g. `step-3/deploy`), pushed and merged **into `dev`**
  through a pull request once CI passes; then the branch is deleted. **Tell the owner before
  creating a commit and before pushing** (branch name + commit message), and wait for the OK.
  Commits are authored as A.Elshafey only, with no AI attribution lines.
- Before adding or upgrading any dependency, check the **latest stable** version in the npm
  registry (`npm view <pkg> dist-tags`). Skip RC/alpha releases, and check engines and peer dependencies.
  pnpm's `minimumReleaseAge` supply-chain gate refuses very fresh releases. **Don't add
  `minimumReleaseAgeExclude` entries**; pick the newest version old enough to pass the gate.
- Record significant decisions as ADRs in `docs/adr/` (`NNNN-short-title.md`).

## Definition of done (every change, before saying "done")
Written after the 2026-11-05 code review, which found 5 bugs and 5 pieces of unneeded code.
Each rule names the mistake it prevents.

**Against bugs**
1. **Rules first, then code.** Before a use case, list the Project Plan rules and edge cases it must
   satisfy, and write one test per rule, with data that can catch a violation (e.g. two different rate
   dates, not one). *Prevents: building for the simple case and testing what was built, not what's required.*
2. **Ask the six edge-case questions** of every function: what if the input is *repeated*, *changed*,
   *missing*, *old*, runs on *Windows*, or is read or typed in *another language* (German "1'000,50",
   a French reader)? *Prevents: e.g. a seed that silently skipped edited data.*
3. **Expected test values are worked out step by step in a comment**, never from memory, and include
   every rounding step. *Prevents: wrong expectations that hide or invent bugs.*
4. **Errors are never swallowed.** Catch only specific error types; every error the code throws has a test.
5. **One source for every value or setting** (URLs, ports, limits). When changing how one entry point
   behaves, search for the others. *Prevents: three copies of the DB URL drifting apart.*
6. **When a decision changes** (new ADR, a choice by the owner), search the whole repo for the old
   assumption and update it in the same change. *Prevents: `localhost` surviving the 127.0.0.1 decision.*
7. **Facts from outside** (versions, fees, rates, API shapes) are checked at the source with link and
   date, never taken from memory.
8. **Run the real thing** once per sub-step (the CLI, the API with curl), not only the tests.

**Against unneeded code**
9. **No code without a caller.** A function, option, export or dependency is added only when something
   uses it in the same change. No "a money class usually has this". knip enforces part of this.
10. **Remove scaffolding** as soon as real code replaces it (e.g. step-1 placeholders).
11. **Extract at the second copy.** The second time the same setup code is written, make it a helper.
12. **Prefer deleting over adding:** if a simpler version passes the same tests, use it.
13. **Every exception to a tool or rule has a written reason** (e.g. knip ignores `@prisma/client`
    because only the git-ignored generated client imports it).

**Process**
14. **Read before changing:** read the existing code and its callers first; keep changes inside the
    current step and say so when fixing something outside it.
15. **Self-review before reporting.** Re-read the diff against rules 1–14, then report "tests pass" and
    "self-reviewed" as two separate facts, plus anything not done.
16. **Small deliveries:** stop after each sub-step (e.g. 3a, 3b) with a short summary, so mistakes are
    caught early.

## Money rules (non-negotiable)
- **Never** represent money or rates as JS `number`. Use the `Money`/`Rate` value objects in
  `packages/core` (backed by decimal.js). Values cross the API as **strings**.
- Round only at the end, to the currency's ISO 4217 minor unit, with the documented rounding mode.
- Universal cost formula (Project Plan §3):
  `total_cost = total_paid − received / mid_rate`, `fx_markup = total_cost − visible_fee`,
  `total_cost_% = total_cost / total_paid`.
- Every result carries its source link and check date, the capture time of a manual rate, and the
  reference rate it was compared with (source and day). Quotes are computed on every request, not
  stored. Sender and recipient countries follow from the corridor in v1 (ADR 0008).

## Architecture rules
- Modular monolith, hexagonal boundaries:
  - `packages/core`: pure domain. **No I/O, no imports from other workspace packages.**
  - `packages/db` (step 3): Prisma lives only here; repositories return core types, never Prisma models.
  - `packages/collectors` (step 4): one adapter per source, implementing core ports; raw responses are stored before parsing.
  - `apps/api`: Express 5. Handlers validate (Zod) and call core use cases, with no business logic. `app.ts` builds the app; `main.ts` is the composition root.
  - `apps/web`: React + Vite.
- Languages (ADR 0005, Project Plan §5a): **EN, DE, FR, IT**. Language lives only in `apps/web`:
  core, db and API send codes, money and dates, never reader-facing sentences. Every visible text
  comes from `apps/web/src/i18n/` and is added in all four languages in the same change (Swiss
  German: `ss`, never `ß`). Numbers and dates only through the `Intl` formatter, from the API's
  strings. The API's response shape lives in `apps/api/src/contract.ts`, shared with the page.
- Production: the owner's OVH VPS + domain, Docker Compose with Postgres not exposed publicly,
  collectors as an hourly Compose service (ADR 0007), public access through a Cloudflare Tunnel with no open
  ports (ADR 0004; UrConnections' Caddy owns 80/443 on that server). No Vercel/Neon.
  Stack: `compose.prod.yml` (images from `apps/*/Dockerfile`), runbook `docs/deploy.md`, releases
  and backups ADR 0006. Versions copied into Docker files are kept equal by `deploy/versions.test.ts`.
- Append-only data: never update or delete observations, rates or quotes (database triggers enforce
  it). The one exception: a `collector_runs` row is finished exactly once (status, finish time,
  error), so a run that crashes stays visible as `running`. A provider is taken off the site with a
  withdrawal entry in `fee-schedules.json` (ADR 0009); the seed refuses entries deleted from the files.
- SQL: Prisma TypedSQL or tagged `$queryRaw` only, **never `$queryRawUnsafe`**.
- Data sourcing: respect ToS and robots.txt. No automated access to sources that disallow it
  (e.g. Revolut `/api/`); use rule-based or manual adapters instead.
- v1 data sources (ADR 0003): **Frankfurter** is the only automated source (mid-market). Provider
  prices are rule-based or manual (Claude researches, the owner verifies). **No Wise API or
  comparison data** (`api.wise.com`).

## Tooling
- Node **26.13.0 LTS** (`.node-version`), pnpm **12.16.1** (`packageManager`), TypeScript 7.
- TypeScript runs natively in Node (type stripping): use only erasable syntax (no `enum`,
  `namespace` or parameter properties) and import local files **with the `.ts` extension**.
- Commands: `pnpm install` · `pnpm check` (generates the Prisma client first; DB tests need Docker running) · `pnpm knip` (unused files, exports, dependencies) · `pnpm lint:fix` · `pnpm db:up` / `pnpm db:down` · `pnpm db:migrate` · `pnpm db:seed` (loads `data/manual`) · `pnpm db:generate` · `pnpm collect` (one Frankfurter run)
  · `pnpm dev:api` (http://localhost:3000) · `pnpm dev:web` (http://localhost:5173).
- Windows host: the repo forces LF line endings (`.gitattributes`).
- Local DB = Docker container on **127.0.0.1:5434**. Port 5432 is the owner's native PostgreSQL
  service (`postgresql-x64-18`) and 5433 is another project's container (`urconnections`).
  Never use either for this project.
