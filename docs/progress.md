# Progress

Roadmap from `Project Plan.md` §7. Updated at the end of every stage.

**Now:** stages 0 and 2 done. Stage 3: 3a database ✅, 3b manual data ✅ (4 of 5 providers verified; Alpian waits for a one-minute owner check), 3c API ✅, 3d page ✅, reviews ✅, 3f languages ✅, **3e deploy next** (Cloudflare Tunnel, ADR 0004; needs the subdomain).

| # | Stage | Status | What it delivers | Done when |
|---|---|---|---|---|
| 0 | Feasibility | ✅ Done (2026-11-10) | Research doc ✅ · Wise removed as a source (ADR 0003) ✅ · app checks ✅ · providers without exact public values dropped ✅ · `docs/feasibility.md` ✅ | Every v1 provider has a confirmed data source **before stage 5** ✅ |
| 1 | Setup | ✅ Done (`d555741`) | Monorepo, Biome, TypeScript, Docker Postgres, CI, `CLAUDE.md`, ADR 0001; renamed to FreuTransfer + OVH hosting (ADR 0002) | CI green on GitHub ✅ |
| 2 | Core engine | ✅ Done (2026-11-10) | `Money`/`Rate` value objects, fee strategies, `computeCost`, rounding, golden + property tests | 2 real calculator results reproduced to the cent ✅ (third skipped by the owner) |
| 3 | v0.1 end-to-end | 🟡 **In progress**: 3a DB ✅ · 3b data ✅ (4 of 5 verified) · 3c API ✅ · 3d page ✅ · 3f languages ✅ · 3e deploy ⬜ | Prisma schema + migrations, first manual provider data (Claude researches → you verify at the banks), `/v1/compare`, results table, page in EN/DE/FR/IT (ADR 0005), **first deploy to the OVH VPS** | Comparison with manual data live on your domain, in four languages |
| 4 | Mid-market + pipeline | ⬜ Not started | Frankfurter adapter, raw → parse pipeline, `collector_runs`, daily timer on the VPS | A week of daily snapshots stored |
| 5 | Provider data | ⬜ Not started | Full provider list: Claude researches fees/rates → you verify → entered as rule-based or manual data; sanity guards | All v1 providers collected; no negative hidden costs |
| 6 | Frontend | ⬜ Not started | Breakdown table, cost %, freshness labels, charts, "my bank vs best", translated caveat codes | Usable on mobile; every number shows its source; every text in four languages |
| 7 | Polish | ⬜ Not started | README, `methodology.md` and legal texts in four languages, World Bank comparison, OpenAPI, ADRs, language URLs decision | A reviewer understands the project in 5 minutes |
| 8 | Later | ⬜ Backlog | Intraday rates, receive mode, more corridors, alerts | — |

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
- **2026-11-09:** Owner decided the sanity guard (Project Plan §9: total cost above 10% or below 0% is a
  data error, listed for checking, not ranked; built in stage 5). Full review of code and docs. Fixed:
  the API printed "listening" and exited with code 0 when its port was taken (Express 5 passes the
  error to the `listen` callback); the cost percentage was rounded twice (6 decimals, then 2), so an
  exact 0.95499% showed as 0.96%: core now keeps it exact and the API rounds once; the page called
  `/api/v1/...` while production forwards `/v1/*`: it now uses `/v1/...` in both (Vite proxy without a
  rewrite); `pnpm db:seed` silently skipped a corridor whose currencies changed: it now stops with a
  conflict; data files accepted any 3-letter currency: now only the ones core supports. The
  2026-11-08 hosting decision is recorded as ADR 0004 (Cloudflare Tunnel; UrConnections' Caddy owns
  80/443), and ADR 0002, CLAUDE.md and the plan point to it. `.env.example` no longer repeats the local
  DB URL. 87 tests pass; API and Vite proxy verified against the local Postgres.
  Prisma agent skills trimmed (owner's choice): only `prisma-cli` and `prisma-client-api` stay, in
  `packages/db/.claude/skills`; the `.agents` and `.windsurf` copies and the 8 skills for other setups
  (Prisma 8, Prisma Compute, Prisma Postgres, MongoDB, v7 upgrade, adapter writing) were removed.
- **2026-11-09 (2):** Second full review of code, docs and packages, and the language groundwork
  (owner: English, German, French, Italian). Fixed: a provider whose data was broken (e.g. a fee
  rule in the wrong currency) was listed as "not available for this amount" instead of failing:
  only the new `AmountNotSupportedError` is caught now; the API and data files accepted `JPY`, a
  currency kept only for a rounding test; the API sent `"-0.00"` as the cost percentage when payout
  rounding put a quote a fraction of a cent above mid (found on the real page; new
  `toFixedString`); the two custom errors used `about:blank` with their own titles, which RFC 9457
  §4.2.1 reserves for the plain status phrase: they now have problem types; the page showed a
  rate's check date in UTC, not Zurich; the research doc still recommended Wise data in §8/§9.
  Patch updates (Biome 2.6.6, knip 6.44.2, supertest 7.3.2, Vite 8.3.6); the duplicate `format`
  script removed. Languages (ADR 0005, plan §5a, CLAUDE.md): no library; typed catalogs in
  `apps/web/src/i18n/` (a missing text fails typecheck), `Intl` formatting from the API's strings,
  Swiss formats, amount input `1'000,50`; the API sends codes instead of English (reason codes,
  problem types) and no longer sends the English research `note`; the response shape is shared in
  `apps/api/src/contract.ts`. 127 tests pass; API checked with curl; production build checked in
  headless Edge in all four languages.
  Committed as `f7af2dd` (review) and `5a2a2e0` (languages) on `step-3/review-3`, pushed.
- **2026-11-10:** Owner decisions: OFX dropped; no cantonal banks; keep only providers with exact public
  values; golden test 3 skipped (stage 2 done with 2 real results); translations accepted, formal
  register. Revolut **verified** from its fee document for Swiss clients (Revolut Bank UAB, valid from
  21 Nov 2025): CHF 1'250 exchange limit a month, 1% fair-usage fee above, weekends 1% (not modelled),
  SEPA in EUR free; the owner's links were the Lithuanian versions of the same terms. **UBS removed**
  ("up to 1.70%" only). Raiffeisen, Western Union and EU banks dropped (no exact public source).
  **Alpian added** as a draft (pricing page: 0.2% FX markup on weekdays, SEPA to the Eurozone free).
  `docs/feasibility.md` written: stage 0 done.
