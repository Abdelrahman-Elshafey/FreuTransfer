# How to review FreuTransfer


The method for a full review of the code and the docs. Written 2026-11-11 by Claude after the third
full review (the owner's file was empty, so this is Claude's method; add your own steps anywhere).
The rules being checked are the 16 points of "Definition of done" in `CLAUDE.md`; this file is the
**procedure** for checking them, plus the checks those rules don't cover.

A review reports three kinds of result, kept apart: **fixed** (clear defects, each with a test that
failed first), **for the owner** (needs a decision), **checked and fine** (so the next review knows
what was looked at).

## Before starting
- `git status` and the current branch: review what is really there, including uncommitted work.
- Docker Desktop running (database tests and the production stack need it).
- Read `docs/progress.md` (what was built since the last review) and the last entry of the log below.

## Step 1: Read everything, in dependency order
All of it, not a sample: the code is small (about 5,000 lines).
`packages/core` → `packages/db` (schema, migrations, loader, seed, repositories) → `apps/api` →
`apps/web` → tests → `data/manual` → Docker, Compose, CI → docs.
While reading, write down every doubt. Decide only after the whole picture is known.

## Step 2: Run the machines
| Command | Finds |
|---|---|
| `pnpm check` | lint, unused files/exports/dependencies (knip), types, all tests |
| `pnpm outdated -r` | newer versions. Check `npm view <pkg> dist-tags` and the release date: skip RCs and releases younger than the supply-chain gate |
| `pnpm audit` | known vulnerabilities. For each: is the package in a production image, or only in tests? |
| `git grep -nE "TODO\|FIXME\|it\.(skip\|only\|todo)\|as any\|@ts-\|biome-ignore"` | leftovers and silenced checks |
| `docker image ls` after a build | image sizes; `du -sh node_modules/.pnpm/* \| sort -h` inside an image shows what is heavy |

## Step 3: What the machines can't see
1. **Code without a caller that knip misses:** class methods, fields of returned objects, kinds of a
   union type, `package.json` scripts. For each, search for a reader outside the tests.
2. **The six edge-case questions** (CLAUDE.md rule 2) asked of every input: the API query, the
   amount box, every field of the data files, environment variables. *Repeated, changed, missing,
   old, Windows, another language.* Add: **from the future** (a mistyped year) and **too precise
   for where it is stored**.
3. **Follow one value through every layer.** Take one number from a data file and follow it:
   file → loader (what does the check allow?) → database column (what does the type keep?) →
   repository → core → API string → formatter → screen. Bugs live where two layers disagree about
   what is allowed (found this way: 11 decimals pass the loader, the column keeps 10).
4. **Everything shown to the reader that comes from data:** links (`href`), names, notes. Can a
   wrong or hostile value do harm? Is the text written for the reader, not for a developer?
5. **One source for every value** (rule 5): search for each version, port, URL, name and limit.
   Count the copies. Each extra copy needs a test that keeps it equal, or a written reason.
6. **Decisions against the repo** (rule 6): for every ADR and every owner decision in the log, search
   for the old assumption in code *comments* and docs, not only in code.
7. **Facts from outside** (rule 7): every provider value has a source link and a date; anything
   quoted from a tool's behaviour (an image tag, an env variable, a flag) was checked by running it.
8. **Order- and place-dependence:** sorting (ties, `localeCompare`), time zones (which day is
   "today"?), the server's language settings, line endings.
9. **What happens over time:** data never deleted (can a wrong or withdrawn entry be corrected?),
   values that grow stale without a guard, a second run of every job (seed, migrate, deploy).
10. **Failure, not only success:** stop one container, send a broken request, start twice.
11. **Tests that can't fail:** for every new test, break the code on purpose once and see it fail.
    Expected values are worked out in a comment (rule 3).
12. **Docs against reality:** run the commands in `README.md` and `docs/deploy.md` as written;
    compare numbers in docs (sizes, counts, dates) with a fresh measurement.
13. **A deploy that fails half-way, and a rollback** (added 2026-11-13): for each step of
    `scripts/deploy.sh`, what is running after that step fails? Then roll back after each kind of
    change (code, schema, data). Try it in a throwaway copy of the stack
    (`docker compose -p <name> -f compose.prod.yml …`, then `down -v`), not only by reading.

## Step 4: Fix
- A clear defect: write the failing test, fix it, run `pnpm check`.
- Anything that changes scope, data, the schema or a decision: don't fix; list it for the owner.
- Run the real thing once at the end: the production stack locally (`docs/deploy.md`) and one
  real request.

## Step 5: Report
Findings first, most serious first, each with: what, where (`file:line`), what could go wrong, what
was done. Then "tests pass" and "self-reviewed" as two separate facts, and what was not done.
Add an entry to the log below and to `docs/progress.md`.

---

## Review log

### 2026-11-13, second review (branch `step-5/review`, after 5a and 5b)
Asked by the owner: a full review of the code, the docs and everything related. Machines:
`pnpm check` green (253 tests); `pnpm audit` the same 2 moderate findings (Testcontainers, tests
only); Biome 2.6.7, Vite 8.3.8, plugin-react 6.3.0 and knip 6.45.1 are 2–4 days old (skipped);
no leftovers. No error found in the money calculations.

**Fixed**
1. **A failed seed during a deploy took the API down** (found by running it: `up` stops the old
   API container first and never starts the new one when the seed fails; `api: Created`). Any seed
   failure did this: an edited history row, a value the database refuses, and since 5b a row
   deleted from the files. `scripts/deploy.sh` now runs the new version's migrations and seed
   *before* anything is replaced and records the tag only afterwards; a failure stops the deploy
   and the old version keeps serving. Two tests for phase 2 of the script (a stand-in `docker`
   records the calls; both failed first), and the real thing in a throwaway stack: seed exit 1,
   API still healthy.
2. **A rollback past a data change stops at the seed** (a consequence of 5b that 5b didn't
   mention: the older commit's files lack the newer entries). With fix 1 the site stays up; the
   limit is now written in `docs/deploy.md` ("Roll back") and ADR 0009.
3. **Nothing in CI seeded the real data files into a database.** The loader is looser than the
   database (a markup of "1.5" passes the loader and its tests; the CHECK constraint refuses it),
   so a typo would have passed CI and failed in production. New test
   `real-data.integration.test.ts` (fails with that typo).
4. **A heading promised the wrong thing:** "Not available for this amount" also listed providers
   whose data is being checked (5a) or that lack a reference rate. Now "Not in this comparison",
   in four languages (for the owner to review).
5. Docs behind the code: `docs/progress.md` still said "Next: stage 5"; the runbook and
   `compose.prod.yml` named only the edited row as a reason the seed stops, and nothing said how
   to take a provider off the site; `pnpm db:seed` missing from CLAUDE.md's commands; an
   overlong comment in `compare.ts`.

**For the owner (not changed)**
1. *(Resolved 2026-11-14: today's reference rate, ADR 0010, 5d.)* **"Arrives" isn't comparable between a manual rate and the others.** Seen on the local
   production stack (2,500 CHF, reference rate 1.0832 of 12 Nov): PostFinance shows 2,700.95 EUR,
   more than Wise's 2,700.48, yet ranks last with 1.22%. Its rate was read on 6 Nov (reference
   rate 1.0937 that day) and "arrives" is computed with that old rate; the cost % is right (it is
   compared with its own day), the amount is what would have arrived on 6 Nov. Options: show a
   manual provider's amount as today's reference rate minus its measured markup (comparable, and
   labelled as an estimate); or keep it and say so next to the amount (stage 6).
2. *(Resolved 2026-11-13: 7 days, strict, `pnpm-workspace.yaml`.)* The `minimumReleaseAge` gate is still not configured (same as the last review).
3. *(Resolved 2026-11-13: 20 deleted; `ccr-…` kept as a local tag only.)* Merged branches are never deleted (20 on GitHub, plus `ccr-3fbd7ef4-jafk20`, which belongs to
   no step), although CLAUDE.md says "then the branch is deleted". Delete them, or change the rule?
4. *(Resolved 2026-11-13: placeholder; older commits still contain it.)* `docs/deploy.md` shows the server's IP address in a public repository. SSH is key-only, and
   scanners find the address anyway, but it could be a placeholder.
5. The local `.env` and `.env.prod` hold the off-site backup keys (only the names were looked
   at). `pnpm dev:api` loads `.env` into the API's environment, where nothing uses them: better
   kept only on the server and in a password manager.
6. Fee tiers by amount: since 5a a maximum amount reaches `kind: "tiered"` with one tier; several
   tiers and a tier without a limit (`upTo: null`) are still reached only by tests.
7. Still open from earlier: pin GitHub Actions to commit ids before v1.0; no alert when the
   collector or a backup fails; security headers and a request limit (stage 7).

**Checked and fine**
5a and 5b followed through every layer (file → loader → column → repository → core → API →
page); every ADR (0001–0009) searched for its old assumption; the new migration on existing rows
(local production stack: applied, 5 rows kept, comparison, GBP and a Swiss-typed amount → 400,
EUR→CHF → 404 until 5c); seed twice; the Prisma skills under `packages/db/.claude` are there on
purpose (progress log, 2026-11-09) and stay out of the images; one source for versions, ports,
the site address and the limits; all four catalogs complete.

### 2026-11-13 (branch `step-5/guard`, after stage 4 and the scope change, ADR 0008)
Asked by the owner: find everything still written for an old rule and bring it to how the project
works now. Machines: `pnpm check` green; `pnpm audit` the same 2 moderate findings (Testcontainers,
tests only); updates for Biome, Vite, plugin-react and knip are 2–4 days old (skipped, next review);
no leftovers. No error found in the money calculations.

**Fixed**
1. **CLAUDE.md promised what the code doesn't do:** "every quote carries … sender/recipient
   country". Quotes are computed per request and never stored, and in v1 the countries follow from
   the corridor. Rule rewritten to what every result really carries (source link, check date,
   capture time, reference rate with source and day); `quote.ts` and Plan §5 no longer announce
   "stored quotes → `latest_quotes`" (an assumption from before ADR 0003).
2. **"Daily" and "nightly" after ADR 0006/0007:** README, Plan §7/§9, ADR 0003, a schema comment and
   the reference-rate notes now say hourly / every 24 h and before deploys.
3. **README status two stages behind** ("step 3, deploy next"); `package.json` still said
   "Switzerland ⇄ Europe".
4. **The production address in three places** (CI twice, the collector's User-Agent): now once in CI
   (`SITE_URL`); a test keeps the collector's copy equal (fails when changed).
5. **A build error printed and ignored on every web build** (`ERR_PNPM_UNEXPECTED_STORE`: pnpm's
   re-check before `build` looks in another store than the cache-mounted install). Switched off with
   a written reason; the web Dockerfile also lacked the collectors manifest. A test checks that both
   Dockerfiles copy every workspace manifest (fails when one is missing).

**For the owner (not changed)**
1. The `minimumReleaseAge` gate that CLAUDE.md mentions isn't configured in this repo (no
   `pnpm-workspace.yaml` or `.npmrc` entry; `pnpm config get minimum-release-age` → undefined).
   Whether pnpm 12 applies a built-in default wasn't confirmed; fresh releases are skipped by hand.
   Set it explicitly (e.g. 7 days) so the rule is enforced, not remembered?
2. Still open from earlier: pin GitHub Actions to commit ids before v1.0; no alert when the
   collector or a backup fails (the page warns after 5 days); security headers and a request limit
   (stage 7).

**Checked and fine**
Every ADR (0001–0008) and owner decision searched for its old assumption in code, comments and docs
(only dated logs and the original research keep old wording, as history); one source for the site
address, versions and limits; the API refuses dropped currencies; unknown rate sources fall back to
their code on the page; seed still accepts the data files after the note changes.

### 2026-11-11 (branch `step-3/deploy-images`, before the first deploy)
Earlier reviews: 2026-11-05 (5 bugs, 5 pieces of unneeded code → the 16 rules), 2026-11-09 (twice).
No error found in the money calculations.

**Fixed (each with a test that failed first)**
1. **Links from data files could be anything**, including `javascript:`: `z.url()` accepts every
   scheme, and `sourceUrl` becomes an `<a href>` on the page. Now https only
   (`packages/db/src/manual-data.ts`).
2. **A value with more than 10 decimals passed the loader**, but the column is `NUMERIC(20,10)`:
   Postgres rounds silently, and the *next* seed would report a changed history row and stop. In
   production the API waits for the seed, so every later deploy would fail. Now refused when loading.
3. **Dates in the future were accepted** (`checkedAt`, `rateCapturedAt`, `asOf`, `fetchedAt`): a
   mistyped year would make an entry the newest forever and never stale. Now refused.
4. **Equal costs were ordered with `localeCompare` on the display name**, which depends on the
   server's language settings. Now by provider id as plain text (`packages/core/src/compare.ts`).
5. **A third copy of the Postgres version** (`packages/db/src/test-database.ts`) was not covered by
   the versions test. Now it is.
6. **Error texts spoke to a developer** ("The API can't be reached. Is it running?"). Rewritten for
   readers in all four languages, before the site goes live.
7. Small: a comment in `apps/web/src/api.ts` still said the tunnel routes `/v1` (nginx does);
   the unused `start` script of the API removed; API tests for a repeated query parameter and an
   amount typed the Swiss way added; README layout table lists the production files.

**For the owner (not changed)**
1. *(Resolved 2026-11-13: hourly collector, stage 4; warning above 5 days, 4e.)* **The reference rate has no age limit.** The newest stored rate is from 2026-11-06, read by hand.
   The cost in % stays right (markups are relative), but "what arrives" in EUR is computed from an
   old rate until stage 4 fetches it daily. Options: do stage 4 right after the deploy; or show a
   warning when the rate is older than a few days.
2. *(Resolved 2026-11-13: withdrawal entries, ADR 0009, 5b.)* **A provider can't be withdrawn once it is in production.** Fee schedules are never deleted, so
   removing a provider from the files (as with UBS and Alpian this week) would leave it on the live
   site; after 30 days it only moves to "not re-checked". Production is still empty, so nothing is
   wrong today. Suggestion for stage 5: a `retired` date on providers (they are reference data, not
   history).
3. **Fee tiers by amount** (`kind: "tiered"` in `packages/core/src/fees.ts`) can't be stored in the
   database yet, so only tests reach them. The plan (§6) names them; keep for stage 5, or remove
   until a provider needs them.
4. **No security headers and no request limit** on the public site (Cloudflare gives basic
   protection). Suggested for stage 7.
5. `pnpm audit`: 2 moderate findings in `glob`/`minimatch`, reached only through Testcontainers
   (tests). No fixed Testcontainers release exists yet. They are also inside the `migrate` image but
   never run there (reason written in `apps/api/Dockerfile`).
6. `vite` 8.3.7 and `@vitejs/plugin-react` 6.3.0 came out on 2026-11-09: too new to take; next review.
   `prisma`'s `latest` tag points to 8.0.0-rc.33, a release candidate: 7.10.1 stays.

**Checked and fine**
Money never becomes a JS number (API, loader, formatter); rounding happens once; errors are caught
by type only; SQL is tagged `$queryRaw`; append-only triggers; seed is all-or-nothing and safe to
repeat; images contain no `.env`, tests or docs; nothing publishes a port in production; all four
catalogs have every text; no leftovers (`TODO`, skipped tests, `as any`).
