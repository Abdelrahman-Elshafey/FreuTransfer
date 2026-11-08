# Progress

Roadmap from `Project Plan.md` §7. Updated at the end of every stage.

**Now:** stage 3 in progress: 3a database ✅, 3b manual data ✅ (Revolut + UBS still drafts, waiting for owner verification), 3c API ✅, 3d page ✅, review 2026-11-08 ✅, 3e deploy next (needs VPS details). Stage 2 waits only for 3 real calculator results. Stage 0 continues alongside.

| # | Stage | Status | What it delivers | Done when |
|---|---|---|---|---|
| 0 | Feasibility | 🟡 In progress (in parallel) | Research doc ✅ · Wise removed as a source (ADR 0003) ✅ · app checks ✅ (Remitly, WorldRemit, TransferGo, XE, ZKB dropped; OFX ⬜) · `docs/feasibility.md` ⬜ | Every v1 provider has a confirmed data source **before stage 5** |
| 1 | Setup | ✅ Done (`d555741`) | Monorepo, Biome, TypeScript, Docker Postgres, CI, `CLAUDE.md`, ADR 0001; renamed to FreuTransfer + OVH hosting (ADR 0002) | CI green on GitHub ✅ |
| 2 | Core engine | 🟡 **In progress**: code + tests ✅, golden tests 2 of 3 ✅ | `Money`/`Rate` value objects, fee strategies, `computeCost`, rounding, golden + property tests | 3 real calculator results reproduced to the cent |
| 3 | v0.1 end-to-end | 🟡 **In progress**: 3a DB ✅ · 3b data ✅ (3 of 5 verified) · 3c API ✅ · 3d page ✅ · 3e deploy ⬜ | Prisma schema + migrations, first manual provider data (Claude researches → you verify at the banks), `/v1/compare`, results table, **first deploy to the OVH VPS** | Comparison with manual data live on your domain |
| 4 | Mid-market + pipeline | ⬜ Not started | Frankfurter adapter, raw → parse pipeline, `collector_runs`, daily timer on the VPS | A week of daily snapshots stored |
| 5 | Provider data | ⬜ Not started | Full provider list: Claude researches fees/rates → you verify → entered as rule-based or manual data; sanity guards | All v1 providers collected; no negative hidden costs |
| 6 | Frontend | ⬜ Not started | Breakdown table, cost %, freshness labels, charts, "my bank vs best" | Usable on mobile; every number shows its source |
| 7 | Polish | ⬜ Not started | README, `methodology.md`, World Bank comparison, ADRs | A reviewer understands the project in 5 minutes |
| 8 | Later | ⬜ Backlog | Intraday rates, receive mode, more corridors, alerts, DE/FR | — |

Legend: ✅ done · 🟡 in progress · ⏭️ next · ⬜ not started

## Log
- **2026-11-04:** Plan v2 → v2.2 and market research. Stage 1 built, committed (`d555741`), pushed; CI green.
  Project renamed to FreuTransfer, fresh local DB, hosting moved to the OVH VPS (ADR 0002). Wise email sent.
- **2026-11-05:** Wise removed as a data source (ADR 0003, plan v2.3). Frankfurter is the only automated
  source; provider prices are rule-based or manual, verified by the owner. Nothing committed yet (owner asked to wait).
- **2026-11-05:** Plan shortened to ~100 lines (v3). Stage 2 built: Money, Rate, fee models (deducted / on top /
  min-max / tiers), quoteFromRule, computeCost; 35 tests incl. property tests. Golden tests wait for real data.
- **2026-11-05:** `docs/design-inspiration.md` (bejamas.com) verified against the live site and completed with
  real colours, fonts and shapes. Used in stage 6.
- **2026-11-05:** Rename + docs committed (`c916e99`) and stage 2 committed (`291479f`), pushed. Stage 3 started:
  `packages/db` (Prisma 7.10.1, migration with CHECK constraints and append-only triggers, repositories,
  Testcontainers tests), `data/manual/` + Zod loader + idempotent `pnpm db:seed` (verified entries only),
  core `compareProviders` use case, `GET /v1/compare` with RFC 9457 errors.
- **2026-11-05:** Code review of everything. Fixed: manual rates now compared with the reference rate of
  the day they were read (not today's); seeding refuses edited history instead of silently skipping it;
  `pnpm dev:api` works without `.env`; `127.0.0.1` instead of `localhost`. Removed unused code
  (`CORE_VERSION`, `Money.zero`, `ROUNDING.down`, extra db exports), shared test-DB helper, CI = `pnpm check`.
  70 tests pass; `/v1/compare` verified end to end against the local DB (draft data).
- **2026-11-05:** Root causes analysed; 16-rule "Definition of done" added to `CLAUDE.md`. knip 6.44.1 added
  to `pnpm check`; it found an unused dependency (`testcontainers`) and an unused export, both removed.
- **2026-11-05:** Markup tier (option A) for allowances like Revolut's (0% up to CHF 1,250, 1% above):
  core `markupFor`, migration `markup_tier` with an all-or-nothing CHECK (a test caught a NULL hole in
  the first version), repository, Zod format, seed. Verified via the API: 1,000 → 0%, 2,500 → 0.50%,
  10,000 → 0.88%. 75 tests. Local dev DB needs a `prisma migrate reset` by the owner (Prisma blocks
  destructive commands from Claude Code).
- **2026-11-05:** 3d results page: form (CHF → EUR) + ranked table, stale/unavailable lists, readable
  errors; `api.ts` with tests; API now sends `totalCostPercent` ("0.95") so the browser does no maths.
  Verified: Vite build, page renders (headless Edge), page → proxy → API → DB returns the ranking. 79 tests.
- **2026-11-05:** Owner screenshots checked against the engine (research doc addendum). Wise and PostFinance
  verified (Wise's fee is *on top*, not deducted: the draft was wrong by 1 cent). Golden test 1 (Wise) passes;
  Revolut's and Wise's EUR→CHF screens show rounded rates, so they can't be golden tests. 80 tests.
- **2026-11-06:** Yuh verified (0.95% from its pricing page) and a second PostFinance reading (0.9256, 06.11)
  with the 06.11 ECB rate; golden test 2 (PostFinance converter: the two shown rates are exact inverses).
  Owner dropped ZKB, Remitly, WorldRemit, TransferGo and XE. UBS key4 FX calculator shows no rates.
- **2026-11-08:** Owner created a `dev` branch: step branches now merge into `dev`, and `dev` into `main`
  only for a release (CLAUDE.md, README; CI also runs on pushes to `dev`). Code review of stage 3. Fixed:
  `pnpm db:seed` now runs in one transaction (a seed that stopped on a conflict left the rows inserted
  before it, and append-only tables can never remove them; a test caught it); every `/v1/compare` row
  now carries the reference rate it was compared with and a manual rate's capture time (CLAUDE.md money
  rule; the page showed only the newest rate); the page no longer hangs on "Comparing…" when the API
  answers 200 with non-JSON; the 30-day re-check limit comes from the API (`recheckDays`) instead of a
  second copy in the page; the Vite proxy and README use `127.0.0.1`. Removed unused code: knip now also
  checks package entry exports (`includeEntryExports`) and found 23 unused core exports; the unused
  rounding-mode option, `Money.isZero` and `USD`. 84 tests pass; API and page verified against a real
  Postgres (curl + headless Chromium).
