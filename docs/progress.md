# Progress

Roadmap from `Project Plan.md` §7. Updated at the end of every stage.

**Now:** stages 0–5 done: v0.1 is live at https://freutransfer.aelshafey.com (four languages, automatic deploys after the owner's approval, backups with off-site copies in Cloudflare R2, the reference rate collected from Frankfurter every hour with a warning when it is older than 5 days; ADR 0006, ADR 0007, `docs/deploy.md`). Open check: 4d, every working day of 16–20 Nov collected by itself (verify on 20 Nov). **Stage 5 done (2026-11-14):** both directions CHF⇄EUR with Wise, Yuh, Revolut, PostFinance and Western Union (CHF→EUR), chosen on the page (ADR 0008–0010). **Stage 6 in progress:** 6a design foundation (ADR 0011) built. **Next: 6b**, the breakdown with bracket labels and the "best" badge.

| # | Stage | Status | What it delivers | Done when |
|---|---|---|---|---|
| 0 | Feasibility | ✅ Done (2026-11-10) | Research doc ✅ · Wise removed as a source (ADR 0003) ✅ · app checks ✅ · providers without exact public values dropped ✅ · `docs/feasibility.md` ✅ | Every v1 provider has a confirmed data source **before stage 5** ✅ |
| 1 | Setup | ✅ Done (`d555741`) | Monorepo, Biome, TypeScript, Docker Postgres, CI, `CLAUDE.md`, ADR 0001; renamed to FreuTransfer + OVH hosting (ADR 0002) | CI green on GitHub ✅ |
| 2 | Core engine | ✅ Done (2026-11-10) | `Money`/`Rate` value objects, fee strategies, `computeCost`, rounding, golden + property tests | 2 real calculator results reproduced to the cent ✅ (third skipped by the owner) |
| 3 | v0.1 end-to-end | ✅ Done (2026-11-12): 3a DB ✅ · 3b data ✅ (4 of 4 verified) · 3c API ✅ · 3d page ✅ · 3f languages ✅ · 3e deploy ✅ (3e-1 images · 3e-2 CI · 3e-3 first deploy · 3e-4 backups) | Prisma schema + migrations, first manual provider data (Claude researches → you verify at the banks), `/v1/compare`, results table, page in EN/DE/FR/IT (ADR 0005), **first deploy to the OVH VPS** | Comparison with manual data live on your domain, in four languages |
| 4 | Mid-market + pipeline | ✅ Done (2026-11-13): 4a database ✅ · 4b collector ✅ · 4c hourly `collect` service ✅ · 4e old-rate warning ✅ · 4d one week ⏳ (verify 20 Nov) | Frankfurter adapter, raw → parse pipeline, `collector_runs`, hourly `collect` service on the VPS (ADR 0007) | A week of daily snapshots stored (8 working days 3–12 Nov stored; 16–20 Nov to be collected live) |
| 5 | Provider data | ✅ Done (2026-11-14): 5-0 scope ✅ · 5a guard + limits ✅ · 5b withdrawing a provider ✅ · 5c EUR→CHF data ✅ · 5d manual rates at today's reference rate ✅ · 5e corridor choice ✅ | Full provider list: Claude researches fees/rates → you verify → entered as rule-based or manual data; sanity guards | All v1 providers collected; no negative hidden costs |
| 6 | Frontend | 🟡 **In progress**: 6a design foundation ✅ · 6b breakdown · 6c caveat codes · 6d my bank vs best · 6e charts | Breakdown table, cost %, freshness labels, charts, "my bank vs best", translated caveat codes | Usable on mobile; every number shows its source; every text in four languages |
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
- **2026-11-10:** PRs #1–#3 merged into `dev`. Owner decision: **Alpian removed**; v1 has 4
  providers, all verified (Wise, Yuh, Revolut, PostFinance).
- **2026-11-11:** Server rebooted by the owner (kernel 7.0.0-43; all UrConnections containers came back).
  Owner decisions (ADR 0006): `freutransfer.aelshafey.com`; own folder on the server; images from CI,
  first deploy by hand, then automatic deploys after approval; nightly backups to Cloudflare R2.
  **3e-1:** `apps/api/Dockerfile` (targets `api` and `migrate`: the Prisma CLI stays out of the API
  image), `apps/web/Dockerfile` + `nginx.conf` (page + routing), `compose.prod.yml` (db, migrate, seed,
  api, web, tunnel; no ports), `.env.prod.example`, `compose.local.yml`, `docs/deploy.md`, a test that
  keeps Node/Postgres versions equal across files. Whole stack run locally: migrations + seed, `/health`,
  `/v1/compare`, page in four languages, cache headers, 404s, repeat start, API restart and API down.
- **2026-11-11:** Full review with the method now written in `review.md` (log of findings there).
  Fixed: data links https only (a `javascript:` link was accepted), values with more decimals than
  the database stores, dates in the future, ranking ties independent of the server's language,
  reader-friendly error texts in four languages, third copy of the Postgres version under test.
  For the owner: reference rate has no age limit until stage 4; a provider can't be withdrawn from
  production (stage 5). 141 tests pass; production stack re-run locally.
- **2026-11-11:** Owner decision: deploy from `dev` until v1.0; `main` gets its first release at the
  end (ADR 0006, CLAUDE.md, README updated). **3e-2:** CI builds the three images on every PR and
  pushes them to GHCR after a merge into `dev` (tagged with the commit); a `deploy` job waits for the
  owner's approval (environment `production`) and runs `scripts/deploy.sh <commit>` on the server over
  SSH with a key limited to that script, then checks `/health` from outside. The job is skipped until
  the repository variable `DEPLOY_HOST` exists. Script checked with shellcheck, workflow with
  actionlint; commit-id check tested with 5 bad inputs (incl. `<sha>; rm -rf /`).
- **2026-11-11:** **3e-3: FreuTransfer is live** at https://freutransfer.aelshafey.com. The owner
  cloned the repository to `~/apps/freutransfer`, wrote `.env.prod` (password and tunnel token stay on
  the server) and started the stack for `bf37523`. Checked: migrate and seed exit 0 (5 fee
  schedules), api/web/db healthy, tunnel with 4 connections, `/health`, `/v1/compare` and the page from
  outside; all 7 UrConnections containers healthy. Automatic deploys: deploy key added by the owner as a
  forced command (refuses `ls`, `cat .env.prod`, a short id, `; id` and a shell; tested from outside),
  GitHub environment `production` (owner as reviewer) and host key in `DEPLOY_KNOWN_HOSTS` set up by the owner
  (fingerprint compared with the one already trusted). The reference rate is still the seeded one
  (2026-11-06) until stage 4.
- **2026-11-12:** First automatic deploy (`cb02be7`, PR #7) after the owner's approval: images pulled,
  `migrate`/`seed` exit 0, `api`/`web` replaced and healthy, `db` and `tunnel` not restarted, the
  previous commit's images removed. (The first try was skipped: `DEPLOY_HOST` wasn't a repository
  variable yet.) **3e-4 backups built:** `backup` service (`pg_dump` at start, every 24 h and before
  every deploy in `deploy.sh`; 14 days), `offsite` service (rclone 1.75.2 to Cloudflare R2 every 6 h;
  30 days); old dumps deleted by the time in their name, the newest always kept. 7 tests run the
  scripts in the production images (`deploy/backup.test.ts`, incl. a real restore); two deliberate
  bugs (newest copy deleted, partial file left) were each caught by a test. Run locally: service dump,
  `deploy.sh`'s backup command, restore drill with equal row counts in all 5 tables, `offsite`
  without settings names the missing lines. `deploy.sh` now refuses to run without
  `COMPOSE_PROFILES=tunnel,offsite`. Open: nothing alerts when a backup fails (no stage covers
  monitoring yet; for the owner).
- **2026-11-12:** Focused security review (Cloudflare `security-audit` skill, guidance mode; source
  only, nothing run against the live site). **Fixed:** `deploy.sh` accepted a commit from any branch
  and then ran that commit's own copy of itself, so the deploy key plus a pushed branch could run
  anything on the server without the owner's approval; it now accepts only commits on `dev`
  (4 tests in `deploy/deploy-script.test.ts` on a throwaway repository; removing the check fails 2).
  Checked by reading the tunnel's log: one route, `freutransfer.aelshafey.com` → `web:8080`,
  private-network routing off. **For the owner:** pin the GitHub Actions to commit ids (before
  v1.0); a ruleset protecting `dev` (instructions given). Fine: API input checks, no raw SQL in
  app code, no HTML injection, containers as non-root users, no secrets in the git history.
- **2026-11-12:** **3e-4 done, stage 3 done.** The owner created the R2 bucket and a key limited to it
  and added the values to `.env.prod`; a one-off rclone test on the server uploaded, read and deleted
  a file, and listing all buckets was refused (403). PR #8 (backups + deploy guard) deployed after
  approval (`2bd1d4e`): `deploy.sh` took a backup before the deploy, `backup` and `offsite` run, the
  first copy is in R2 (same size as on the server). **Restore drill from R2 passed** on the server:
  the newest copy restored into a scratch database with the same row counts in all 5 tables
  (scratch database removed). Owner set up a ruleset protecting `dev`.
- **2026-11-12:** Stage 4 planned; owner decision: the collector runs as an hourly Compose service
  instead of a systemd timer (ADR 0007, ADR 0002 updated). Frankfurter checked at the source: free,
  no quotas, `robots.txt` allows all; CHF→EUR (ECB), CHF→EGP (CBE) and CHF→RSD (NBS) work; the two
  hand-entered rates match it. Rates arrive as JSON numbers: the adapter must read their source text
  (a normal parse turned `123456789.1234567891` into `123456789.12345679`). **4a:** migration
  `collector_pipeline`: `collector_runs` (finished exactly once, never deleted), `raw_observations`
  (append-only, belongs to a run), `mid_market_rates.raw_observation_id` (empty for hand-entered
  rates). 7 new database tests; removing two of the rules on purpose made their tests fail. Applied
  locally to a production database with data: existing rates kept, seed, API and backup work.
- **2026-11-13:** 4a deployed (`6dcb4f4`): migration applied on the server, the 2 rates kept, backup
  taken before it. **4b:** `packages/collectors` with the Frankfurter adapter: per corridor the last
  10 days with the source pinned (`SOURCE_FOR_QUOTE`, typed over every currency), raw response
  stored before parsing, rates read from the JSON source text (never JS numbers), wrong pair /
  dates outside the window / impossible or repeated dates / zero, negative, exponent or too many
  decimals refused; a changed stored day is kept and fails the run. `PrismaCollectorStore`,
  `PrismaCorridorRepository`, `pnpm collect`. 24 collector + 6 database tests; reading plain numbers
  and parsing before saving the raw response each fail 2 tests on purpose. Self-review found a
  broken connection while reading the body counted as "unexpected" (stopping other corridors):
  fixed and tested. Real run against Frankfurter (local DB): 7 new days, the 2 hand-entered days
  matched exactly; second run stored nothing.
- **2026-11-13:** Review fixes still open on `dev` (the other findings of the 2026-11-12 review were
  already fixed there). Migration `unique_schedule_no_truncate`: one fee schedule per corridor ×
  provider × check time (unique key, replaces the index), and `TRUNCATE` refused on all four
  append-only tables (it fires no row trigger; without this, `TRUNCATE collector_runs CASCADE`
  emptied runs, raw responses and rates). `pnpm db:seed --include-drafts` refused in production and
  unknown arguments refused. `Money.of` accepts plain decimals only (no "0x10", "1e3", "1_000");
  negative minimum/maximum fees refused. Checked on a database with data: upgrade, seed, API, and
  `pg_restore` with and without `--clean` (counts equal). Open for the owner: a maximum age for the
  reference rate now that it is collected hourly.
- **2026-11-13:** Reviewed `dev` after the phone session (PR #12: no TRUNCATE on append-only tables,
  unique fee schedules, no drafts in production, plain decimals): nothing to change in the plan
  except three corrections found by reading the code, all fixed in 4c. Owner decision: option A,
  a warning when the reference rate is older than 5 days (sub-step 4e). **4c:** the collector is in
  the API image (it was in none); `collect` service in `compose.prod.yml` (hourly loop, waits for
  `seed`); its health check switched off: without it the container turned unhealthy after 30 s and
  `up --wait` failed (tried on purpose), which would have failed every deploy; `deploy/compose.test.ts`
  now checks this on the configuration as Docker Compose reads it (fails without the switch-off). Local production
  stack: `up --wait` exit 0, first run stored 6 new days, the site's rate went from 1.0937
  (6 Nov) to 1.0832 (12 Nov), repeated runs stored nothing. Runbook section "Collector".
- **2026-11-13:** **4e (option A):** `MID_RATE_MAX_AGE_DAYS = 5` in core (Easter is the longest normal
  gap: Thursday's rate is the newest until Tuesday afternoon); `Comparison.midTooOld` counts calendar
  days in Zurich; the API sends `midRateTooOld` and `midRateMaxAgeDays`; the page shows a warning
  (role "alert") in EN/DE/FR/IT and still shows the results. Tests: the Easter 2027 gap (computed:
  Easter Sunday 28 March), a Zurich/UTC day boundary, the API flag both ways, the four sentences.
  Real run in headless Edge: with only the seeded rate (6 Nov, 7 days old) the warning shows in all
  four languages with the right date format; with the collected rate (12 Nov) none. Branch built on
  4c (both touch this file): merge 4c first.
- **2026-11-13:** 4c deployed (`b7d6382`): `collect` runs on the server (`up --wait` passed, so the
  health-check fix works there too); first run stored 6 new days and matched the 2 hand-entered
  ones; the live rate became 1.0832 (12 Nov) instead of 1.0937 (6 Nov); backup before the deploy;
  UrConnections untouched. 4e deployed (`b0fde5d`): the live API sends `midRateTooOld: false` and
  `midRateMaxAgeDays: 5`. **Stage 4 closed by the owner.** Honest state of its "done when": the
  server holds rates for 8 working days (3–12 Nov), but all were fetched in one go by the 10-day
  window; that the hourly runs keep working day after day is the open check 4d (every working day
  16–20 Nov collected by itself, all runs succeeded; verify on 20 Nov). It doesn't block stage 5.
- **2026-11-13:** Stage 5 planned. Owner decisions (ADR 0008): v1 = **CHF→EUR and EUR→CHF** only
  (CHF→GBP/EGP/RSD dropped); **Western Union added for CHF→EUR** (manual, its own calculator; not
  EUR→CHF, its price depends on the sending country); PayPal and Migros Bank not added; Wise's
  comparison page only as a cross-check (ADR 0003: Wise's terms). Research EUR→CHF: Yuh 0.95% both
  ways; Revolut's allowance is CHF 1ʼ250 whichever direction; PostFinance buy column; Wise 1.69 EUR
  + 0.4301% on top, derived from three calculator readings; Wise CHF→EUR re-confirmed at 100 and
  5,000 CHF; Western Union's shown 1.0540 is rounded, 1.054014 reproduces 100/1,000/4,700 CHF.
  **5-0:** currencies CHF and EUR only, the collector's sources only the ECB, data files `ecb` only,
  the Egyptian/Serbian bank names removed from the four catalogs; tests that used GBP/EGP/RSD as
  stand-ins now use EUR→CHF (the opposite direction of the same pair, a sharper leak test); the
  API refuses GBP (400). Plan, CLAUDE.md, README, ADR 0003, feasibility study updated.
- **2026-11-13:** Full review (method in `review.md`, log there), on the owner's request "anything
  from the old rules, change it to the way we work now". Rewritten: CLAUDE.md's quote rule (no
  stored quotes, no countries: results are computed per request, countries follow from the corridor,
  ADR 0008); Plan §4 (route), §5 (no "parsed quotes → latest_quotes", collectors = Frankfurter
  only), §7 and §9 (hourly collector, backups every 24 h + before deploys); README status and
  layout; `package.json` description; ADR 0002/0003 pointers; schema comment; the reference-rate
  notes; a note on the research file. Production address once in CI (`SITE_URL`), its copy in the
  collector kept equal by a test. Web image: an always-ignored `ERR_PNPM_UNEXPECTED_STORE` (pnpm's
  re-check against the wrong store) switched off with a reason; it also lacked the collectors
  manifest; a test now checks both Dockerfiles copy every workspace manifest. **5a:** sanity guard
  (total cost > 10% or < 0% → "implausible_cost", listed, never ranked; text in four languages);
  `max_amount` per fee schedule (a single fee tier: above it "not available for this amount"); the
  tier limit in its own currency (`fx_markup_tier_currency`, converted at the reference rate).
  "Below 0%" uses the cost rounded to the cent: the first version used the exact cost and an
  existing API test caught it hiding a free provider whose payout rounds up by a fraction of a cent
  (Revolut within its allowance would have dropped out for many amounts); now a core test too.
  Migration `amount_limit_tier_currency`; loader and seed (both fields are history) updated. Tests:
  13 new; breaking the 10% boundary, the negative check, the limit conversion, the seed comparison
  and the repository mapping each fails a test. Local production stack: migration on existing
  data, comparison and GBP → 400 as expected.
- **2026-11-13:** **5b: withdrawing a provider** (owner chose withdrawal entries, ADR 0009). An entry
  `"withdrawn": true` in `fee-schedules.json` (provider × corridor, date, link, required reason, no
  prices) is stored as a `fee_schedules` row; while it is the newest row the provider isn't shown in
  that direction, and a newer price brings it back. The seed now refuses a stored entry deleted from
  the files (before, that was silently ignored and the provider stayed live). Migration
  `withdrawn_fee_schedule` (`source_kind`/`fee_mode` empty only on withdrawals; the CHECK spells out
  `IS NOT NULL`, since a CHECK passes on NULL). Found by the tests: priced rows lacked
  `withdrawn: false`, so every stored row (the 5 in production too) would have stopped the seed.
  Tests: 22 new; each rule broken on purpose (filter before "newest", no missing-row check, CHECK
  without the reason / max amount / source kind, loader not strict / no reason / needs_input /
  `withdrawn` on a priced entry) fails a test. Run for real on a throwaway Postgres 18.6 with the API:
  Yuh withdrawn → gone from CHF→EUR, second seed inserts nothing, Wise deleted from the file →
  seed stops with the message. Real files on the local database: seed clean.
- **2026-11-13:** Full review after 5a/5b (method and log in `review.md`). Found by running a
  failed deploy in a throwaway stack: **a failed seed took the API down** (`up` stops the old
  container first). `scripts/deploy.sh` now runs migrations and seed before replacing anything and
  records the tag afterwards; two new tests for the script's second phase. Also: a rollback past a
  data change stops at the seed (written into the runbook and ADR 0009); a new test seeds the real
  data files into a fresh database (the loader is looser than the database); the heading "Not
  available for this amount" → "Not in this comparison" in four languages; runbook: how to take a
  provider off the site. 253 tests. For the owner: "arrives" of a manual rate isn't comparable
  with the others (PostFinance shows more EUR than Wise but ranks last), and six smaller points.
- **2026-11-13:** Owner's answers to the review. **Supply-chain gate on:** `minimumReleaseAge:
  10080` (7 days) in `pnpm-workspace.yaml`; set explicitly it is also strict (pnpm's built-in
  default is 1 day and falls back to too-new versions). Checked with pnpm 12.16.1: a 2-day-old
  `vite@8.3.8` is refused, and so is the current lockfile until its newest entry (knip 6.44.2,
  7 Nov 09:28 UTC) is 7 days old, so CI is red until 14 Nov ~10:30 Zurich. **Server address**
  replaced by a placeholder in `docs/deploy.md` (older commits keep it). **20 merged branches
  deleted** on GitHub and locally. Decided: a manual rate's "arrives" will use today's reference
  rate minus its measured markup, labelled as an estimate (5d, after 5c).
- **2026-11-13:** **5c: the EUR→CHF direction and Western Union**, from the owner's screenshots
  (times read from the Windows clock, Zurich time). Corridor `EUR-CHF` (the collector fetched 7 new
  EUR→CHF days on its first local run); the EUR→CHF reference rate of 5 Nov (0.918) read from
  Frankfurter for PostFinance's reading of that day (the collector looks back only 10 days).
  Entries: Wise 1.69 EUR + 0.4301% on top; Yuh 0.95%; Revolut CHF 1ʼ250 free then 1% (limit in
  CHF); PostFinance buy 0.9068; Western Union CHF→EUR 1.054014, no fee, up to 4,700 CHF (new
  provider `western-union`); a re-check entry for Wise CHF→EUR (13 Nov, unchanged). Tests: every
  calculator reading reproduced to the cent **from the data files** (the golden tests only checked
  the formulas: a mistyped value in a file passed them); Western Union's 4,700 limit; no offer
  below 0% or above 10% at 100–5,000 in both directions. Each check fails with a wrong value on
  purpose (rounded rate, 0.43%, missing limit, rate above mid, ~12% rate). Local API: both
  directions ranked, Western Union "not available" above 4,700 CHF. For the owner: Revolut's UK page
  shows a EUR 1.20 fee for EUR→CHF transfers; the Swiss terms say local payments are free (used).
- **2026-11-14:** **5d: a manual rate at today's reference rate** (ADR 0010, the owner's decision of
  13 Nov). A manual rate keeps its distance from the reference rate of the day it was read, applied
  to today's (`rate read × today's / that day's`), so what arrives and the ranking agree; every row
  is compared with today's rate, and a manual one also carries `measuredAgainst` (shown under
  "Manual · approximate"). Tests per rule (same distance, arrives agrees with rank, both rates
  carried, a rate better than its day's mid still fails the guard). Local API at 2,500 CHF:
  PostFinance 2,665.14 EUR in 4th place (before: 2,700.95, more than Wise, yet last). Merged (PR #21).
- **2026-11-14:** **5e: choosing the direction on the page.** A "Direction" choice (CHF → EUR, the
  default, or EUR → CHF) from one list in `apps/web/src/api.ts`; the amount is labelled in the
  currency paid; switching clears the results of the other direction; the intro no longer assumes
  francs (four languages). Headless Chrome: both directions ranked from the local API (EUR→CHF
  without Western Union), results cleared on switching, French texts. Stage 5 done.
- **2026-11-14:** **Stage 6 started; 6a: design foundation** (ADR 0011, the owner's choices):
  Tailwind CSS 4.3.5, Inter self-hosted (no font CDN), dark mode following the system, a lime
  "best" badge (added with it in 6b, like JetBrains Mono for the bracket labels). Header, headline
  ("What really arrives?", four languages), form card with pill button; results as one card per
  provider on phones, a table from 768px. `tokens.test.ts` checks every text/background pair
  against WCAG AA (4.5:1) in both themes, from `styles.css` itself (fails on purpose with a lighter
  grey: 2.57:1). Biome parses Tailwind's directives. Headless Chrome at 390px and 1280px, light and
  dark: no horizontal scrolling, every row with its source.
