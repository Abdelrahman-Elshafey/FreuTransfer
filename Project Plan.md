# Money Transfer Cost Comparer — Project Plan (v2)

> v2.1, 2026-11-04. Replaces v1 (kept as `Project Plan (v1).md`).
> v2: a universal cost formula, quotes instead of "rate + fee", mid-market timing, a reframed edge, the researched stack with verified versions, the architecture, and a reordered roadmap.
> **v2.1:** adds the results of `Research - Swiss & European Transfer Landscape.md`: transfers in **both directions (CH⇄EU)**, cross-border commuters as the main user group, concrete data sources (Wise public comparison and quote data, Frankfurter per-source rates, bank rate pages), route-dependent pricing, and updated competitors.

---

## 1. What it is

A website where someone enters what they want to **pay in total** (e.g. 1,000 CHF, or 1,000 EUR) and the other currency, for transfers **from Switzerland to Europe or from Europe to Switzerland** (plus a few remittance corridors such as CHF→EGP). It shows how much **actually arrives** with each provider (Wise, Revolut, Western Union, PostFinance, a big Swiss bank…), sorted from best to worst. It also splits the cost into the **visible fee** and the **hidden cost inside the exchange rate**.

**The problem it solves:** providers advertise "zero fees" but quietly use a worse exchange rate, and Swiss banks rarely show their FX spread at all.

**Goal of the project: portfolio / job.** Correctness, tests, clean architecture and a strong README come first. Broad provider coverage and monetisation are not goals.

**Constraints:** free tools and hosting only, 15+ hours/week, v1 in about 6–8 weeks.

### Main users (from the research)
- **Cross-border commuters:** 414,262 people (Q2 2026; 58% from France, 22% Italy, 16% Germany) earn CHF and convert to EUR every month. Most Swiss "remittance outflows" are actually these wages.
- Residents sending EUR to family or property in the EU, and EU residents sending EUR→CHF (students, new arrivals, Swiss bills).
- Diaspora remittances (CHF→RSD/EGP…) as the "hard corridor" showcase.

### Competition and the edge (researched; full table in the research doc §3)
- **Monito** (Lausanne, global, 400+ providers); the **Wise comparison** pages (run by Wise, estimates); **ibani.com** (Swiss FX platform with CHF-EUR guides for cross-border commuters, not neutral); **moneyland.ch** (its account comparison excludes FX spreads); **getrates.ch** and **neo-banques.ch** (static fee tables).
- Wise's own comparison data covers only **5 providers for CHF→EUR**: no UBS, PostFinance, Raiffeisen, cantonal banks other than ZKB, Revolut, Yuh, neon or FX platforms.

**Our edge:** *"Live, dated, source-cited costs of Swiss banks (from their own published rate sheets) next to fintechs, **in both directions**, with an open methodology and public history."*
- An **"Am I overpaying with my own bank?"** view (UBS / PostFinance / Raiffeisen / my cantonal bank vs the best option).
- A **cross-border commuter view:** "best way to convert my monthly CHF salary", including the yearly cost difference.
- A **"cheapest provider by amount"** chart: Swiss banks charge no fee but a 1–2% markup; EU banks often a small markup but €15–50 fees for EUR→CHF.
- **EUR→CHF in two ways:** convert at the EU bank, or send EUR by SEPA and convert at the Swiss bank.
- A public methodology, raw evidence for every number, history, and an **"ECB markup" column** (the standard used by the EU's CBPR2 rules).

### Scope for v1 (proposed, confirm in step 0)
- Directions: **CH→EU and EU→CH**. Sender countries: CH, DE, FR, IT. Language: English only.
- **Corridors (5):** **CHF→EUR**, **EUR→CHF** (main ones), CHF→GBP (a major currency covered by the ECB), CHF→EGP (personal corridor and the hard case: Central Bank of Egypt official rate vs market), CHF→RSD (diaspora corridor with World Bank data to validate against).
- **Providers (v1 target ~8, built in layers):**
  - from Wise's comparison data (if Wise permits): Wise, ZKB, Migros Bank, Western Union, PayPal, plus the EU banks for EUR→CHF
  - from **bank rate pages**: 2 cantonal banks (e.g. SZKB, BCN)
  - **rule-based** from published terms: Revolut, PostFinance, Yuh, Alpian
  - the v1 set must include **at least one of each data-source type**: API / published rate sheet / rule-based / manual.

---

## 2. The money maths (the heart of the project)

### Ingredients
- **Mid-market rate:** the fair reference rate (halfway between buy and sell). It must be **captured at the same time as the provider quote** (see §3).
- **Provider quote:** what the provider actually offers for a given amount: fee, exchange rate, amount received.
- **Total paid:** everything that leaves the sender's account.

### One universal formula (works for every provider, whatever its fee structure)
```
total_cost_CHF  = total_paid_CHF − (amount_received / mid_rate)
visible_fee_CHF = fees the provider states explicitly
fx_markup_CHF   = total_cost_CHF − visible_fee_CHF        (the hidden cost)
total_cost_%    = total_cost_CHF / total_paid_CHF          (industry standard, used by the World Bank)
```

### Always compare the same thing: what the sender pays in total
`amount=1000` means **1,000 CHF leaves your account**, for every provider:
- **Fee deducted:** converted = total − fee.
- **Fee on top:** converted = (total − fixed_fee) / (1 + percent_fee).
- Later, **receive mode** ("the recipient must get 20,000 EGP") works the other way round. Wise's own API supports both modes (`sendAmount` / `recipientGetsAmount`), so this is the industry norm.

### Example (made-up numbers): pay 1,000 CHF in total, to EUR
- Mid-market rate: 1 CHF = 1.07 EUR. Provider: fixed fee 5 CHF (deducted), rate 1.05.

1. Converted = 1,000 − 5 = 995 CHF → received = 995 × 1.05 = **1,044.75 EUR**
2. Value of what arrived, in CHF at mid-market = 1,044.75 / 1.07 = 976.40 CHF
3. **Total cost** = 1,000 − 976.40 = **23.60 CHF (2.36%)**
4. Visible fee = 5.00 CHF → **hidden FX markup = 18.60 CHF**, almost 4× the visible fee.

### Money-handling rules (reviewers check these first)
- **Never use JS floats for money.** Use `decimal.js`, wrapped in our own `Money` and `Rate` value objects.
- Amounts carry their currency. Use **ISO 4217 minor units** per currency (CHF/EUR 2 decimals, JPY 0).
- Rates are stored as Postgres `NUMERIC(20,10)`, never as integers or floats. One fixed direction: `1 base = rate × quote`.
- **Round only at the end**, to the currency's minor unit, with one documented rounding mode (half-even for calculations; match the provider's rounding when reproducing their quote).
- The API sends money **as strings** (`"1044.75"`), never as JSON numbers.
- All timestamps are `timestamptz`, stored in UTC and shown in Europe/Zurich time.

---

## 3. Data correctness (the hard problems, and the README story)

### 3.1 The mid-market rate's timing must match the quote's
CHF/EUR can move 0.3–0.5% in a day, which is as large as Wise's whole margin. Comparing an hourly quote with a once-a-day rate makes the hidden cost meaningless, or even **negative**.

**v1 primary (free, tested): the Wise mid-market rate captured in the same request.** Every Wise quote and comparison response contains Wise's mid-market rate at that moment (e.g. CHF/EUR 1.08992 at 17:38 UTC on 2026-11-04). Store it as `source = wise_mid`, and **cross-check it daily against the ECB rate**; flag the day if they differ by more than 0.5%. This needs Wise's permission (see §7).

**Fallback (if Wise data isn't allowed), and the daily cross-check: align with the ECB fix.**
- The ECB reference rate is a snapshot taken at about **14:10 CET** on working days.
- The collectors take **one provider snapshot per working day at about 14:15 Europe/Zurich time** and compare it only with that day's reference rate.
- GitHub cron runs in UTC and has no DST support. Schedule it at both 12:10 and 13:10 UTC, and have the job exit unless Zurich time is around 14:10.
- Store the **actual** capture time and the gap between quote time and rate time (`mid_alignment_minutes`). Exclude quotes from the hidden-cost figure if the gap is too large.
- No snapshot on weekends or TARGET holidays. The site shows "as of the last working-day reference rate".

**v1.1 improvement:** hourly snapshots using a free intraday source (e.g. Open Exchange Rates' free tier, reportedly hourly, USD-based, about 1,000 requests a month; **verify before use**). Keep the ECB rate as a cross-check.

### 3.2 EGP (and other non-ECB currencies)
- The ECB doesn't publish EGP. **Always pin the Frankfurter source:** `?providers=CBE` (Central Bank of Egypt, official rate) for EGP, `?providers=NBS` (National Bank of Serbia) for RSD, `?providers=ECB` for the rest. Without a filter, Frankfurter blends sources and dates.
- Measured on 2026-11-04: CHF/EGP was Wise 67.014, CBE 66.942, Frankfurter blended 67.377, a **0.65% spread** between "mid-market" sources.
- Egypt has had big gaps between its official and market rates (devaluation in March 2024). **Document in the README** which source counts as "mid-market" for EGP and why, and show a note on EGP results.

### 3.3 Prices depend on the amount and the method
- Prices vary with the amount (tiers, minimum/maximum fees), the account plan (e.g. Revolut tiers and monthly fair-usage limits), the **pay-in** method (bank transfer / card) and the **payout** method (bank account / cash pickup / mobile wallet).
- So we **collect quotes**, sampled at fixed amounts (**100 / 500 / 1,000 / 2,500 / 5,000 CHF**), and interpolate between them.
- v1 compares **bank transfer → bank account** only (the same scope as Wise's comparison data). Other methods come later. Wise's quote data already shows card pay-in costs (1,000 CHF→EUR: +10.84 CHF by debit card, +34.54 CHF by credit card), so card pay-in is an easy v1.1 addition.
- **Prices depend on the route:** Western Union's CHF→EUR price for 1,000 CHF ranged from 1,011.67 to 1,062.42 EUR depending on the **destination country** (~5%). Quotes must store sender and recipient country.
- **EUR→CHF has two paths:** (a) convert at the EU bank (often €15–50 fee), or (b) send EUR by SEPA and let the Swiss bank convert (its 1–2% markup). Model both as separate "routes".

### 3.4 Costs we can't measure: disclose them
- **SWIFT intermediary/receiving fees** (SHA/OUR/BEN) on non-SEPA bank transfers (e.g. CHF→EGP) are often the largest hidden cost. Show a clear note on bank results for those corridors.
- Weekend markups (some providers, e.g. Revolut historically) are outside the v1 snapshot time. Note this.

### 3.5 Validation against the outside world
- **Golden tests:** at least 3 real provider calculator results (saved with screenshot + date) reproduced **to the cent**.
- **World Bank Remittance Prices Worldwide:** this dataset has Swiss corridors (e.g. CH→Serbia, Albania, Sri Lanka). Compare our cost % with theirs in the README.

---

## 4. Architecture

### Shape: modular monolith with hexagonal (ports & adapters) boundaries
No microservices: they would add complexity with no benefit for a solo project.

```
                 ┌─────────── packages/core (pure, no I/O) ───────────┐
                 │  Money, Rate, CurrencyPair  (value objects)        │
                 │  computeCost(quote, midRate) → CostBreakdown        │
                 │  FeeModel strategies: Deducted | OnTop | Tiered     │
                 │  Ports: QuoteSource, MidRateSource, QuoteRepository │
                 └───────────────▲──────────────────────▲──────────────┘
                                 │ implements            │ uses
   packages/collectors           │            apps/api (Express 5)
   ├─ adapters/frankfurter.ts ───┤            GET /v1/compare?from&to&amount
   ├─ adapters/wise.ts  ─────────┤            GET /v1/history?pair&provider
   ├─ adapters/postfinance.ts ───┤            GET /v1/providers
   ├─ adapters/manual.ts  ───────┘                    │ reads
   │ writes                                           ▼
   └──► raw_observations ──parse──► quotes ──► latest_quotes (view)   packages/db (Prisma)
                                                      ▲
                                        apps/web (React + Vite) ── calls /v1/*
```

### Repository layout (pnpm workspaces)
```
swiss-transfer/
├─ apps/
│  ├─ api/            Express 5: routes, Zod validation, OpenAPI, composition root
│  └─ web/            React + Vite SPA
├─ packages/
│  ├─ core/           pure domain: Money, Rate, cost engine, fee strategies, ports
│  ├─ db/             Prisma schema, migrations, TypedSQL queries, repositories
│  └─ collectors/     provider adapters, parsers, run orchestration, sanity guards
├─ docs/
│  ├─ feasibility.md  provider × corridor data-source table (step 0)
│  ├─ methodology.md  the maths and data rules, public-facing
│  └─ adr/            Architecture Decision Records (0001-express-prisma.md, …)
├─ .github/workflows/ ci.yml, collect.yml
├─ docker-compose.yml Postgres 18.6
├─ CLAUDE.md
└─ README.md
```
**Dependency rule:** `core` imports nothing from the other packages. `db`, `collectors` and `api` depend on `core`, never on each other's internals.

### Design patterns (each one solves a specific problem)
1. **Functional core, imperative shell:** the cost engine is pure functions. All I/O lives at the edges.
2. **Value objects** (`Money`, `Rate`, `CurrencyPair`): immutable and currency-aware; adding CHF to EUR throws an error.
3. **Strategy pattern** for fee models (`DeductedFee`, `OnTopFee`, `TieredFee`), so the engine has no `if (provider === …)`.
4. **Adapter + Registry** for providers: `QuoteSource.fetchQuotes(corridor, amounts) → Quote[]`. A new provider means one file plus one registry line.
5. **Anti-corruption layer:** each adapter parses the provider's format with Zod into our `Quote` type.
6. **Two-stage ingestion (raw → parsed):** the untouched response goes into `raw_observations` first, then a versioned parser produces `quotes`. Parser bugs can be fixed by **re-parsing history**.
7. **Append-only data + read model (CQRS-lite):** collectors only insert. The API reads the `latest_quotes` view.
8. **Collector resilience:**
   - retry with exponential backoff and a per-provider timeout
   - a circuit breaker after N failures
   - idempotent runs (unique key per provider/corridor/amount/snapshot)
   - **sanity guards** that reject a quote more than X% away from mid-market
9. **Composition root:** one `main.ts` per app wires adapters into use cases (manual dependency injection). Tests inject fakes.
10. **Repositories return domain types:** Prisma models never leave `packages/db`.

---

## 5. Stack and versions (verified 2026-11-04)

| Concern | Choice | Version | Notes |
|---|---|---|---|
| Runtime | Node.js LTS "Lithium" | **26.13.0** | Type stripping is stable, so `.ts` runs without a build step. `erasableSyntaxOnly: true`. Skip v27, which is only an alpha. |
| Language | TypeScript (native Go compiler) | **7.0.2** | Used for `tsc --noEmit` type checking in CI. Fallback: 6.0.3 if a tool breaks. |
| Package manager | pnpm workspaces | **12.16.1** | Pin it via `packageManager`. |
| API | Express | **5.3.0** | Async errors go to the error middleware natively. Not 4.x. |
| | @types/express / @types/node | 5.0.6 / 26.x | |
| Validation | Zod | **4.6.7** | API input, provider responses, env config. |
| OpenAPI | @asteasolutions/zod-to-openapi | 9.1.0 | Generated from the same Zod schemas (peer dependency zod ^4). |
| API docs UI | @scalar/express-api-reference | 0.10.34 | Replaces `swagger-ui-express`, which has had no release since 2024. |
| ORM | Prisma + @prisma/client | **7.10.1 (exact, both)** | ⚠ npm `latest` for `prisma` is **8.0.0-rc.30 (a release candidate)**: install `prisma@7.10.1` explicitly. |
| DB driver adapters | @prisma/adapter-pg / @prisma/adapter-neon | 7.10.1 | pg locally, Neon in prod. Match the Prisma version. |
| Database | PostgreSQL | **18.6** | Docker `postgres:18.6` locally, Neon free tier (PG 18) in prod. Skip PG 19, which is only an RC. |
| Money | decimal.js | 10.6.0 | Wrapped in our own value objects. Dinero.js v2 is still alpha. |
| Unit tests | Vitest | **5.1.0** | |
| Property tests | fast-check | 4.10.2 | |
| DB integration tests | testcontainers + @testcontainers/postgresql | 12.2.1 | Docker Desktop must be running on Windows. |
| HTTP tests | supertest | 7.3.1 | |
| Scraping (only if needed) | Playwright | 1.64.1 | Crawlee 3.18.2 only if scraping grows. Respect robots.txt yourself. |
| Frontend | React / react-dom | **19.3.1** | |
| | Vite | **8.3.5** | |
| | @tanstack/react-query | 5.105.3 | |
| | Recharts | 3.10.1 | History and "cheapest by amount" charts. |
| Lint + format | Biome | 2.6.5 | One tool instead of ESLint + Prettier. |
| Mid-market data | Frankfurter v2 | API | Free, no key, 106 central banks, daily. |
| Scheduling | GitHub Actions cron | — | Free and visible. Runs can start late (store the actual time). Workflows are disabled after 60 days of repo inactivity. |
| Hosting (free) | API: Vercel (Express as a serverless function) or Render free · Web: Vercel / Cloudflare Pages · DB: Neon | — | Vercel avoids Render's cold start after idle. |

**Version policy:** commit `pnpm-lock.yaml`. Use exact pins for Node and Prisma. Use caret ranges elsewhere. Renovate opens grouped weekly PRs, and CI must pass before merging. **Re-check this table on the day the project starts.**

### Prisma usage rules
- `Decimal @db.Decimal(20,10)` for rates and amounts. Values come back as `Prisma.Decimal`, never as floats.
- Commit and review every generated `migration.sql`. Create the `latest_quotes` view in a hand-edited migration.
- For `DISTINCT ON`, window functions and the view, use **Prisma TypedSQL** (`.sql` files with generated types) or tagged `$queryRaw`. **Never use `$queryRawUnsafe`.**

---

## 6. Data model

| Table | Key columns | Purpose |
|---|---|---|
| `currencies` | code (ISO 4217), minor_units, name | Rounding rules per currency |
| `providers` | id, slug, name, type (bank / fintech / MTO), website | |
| `corridors` | id, source_ccy, target_ccy | e.g. CHF→EUR, EUR→CHF, CHF→EGP |
| `collector_runs` | id, provider_id, started_at, finished_at, status, error, quotes_count | Monitoring and alerting |
| `raw_observations` | id, run_id, provider_id, captured_at, source_kind (api / rate_sheet / calculator / manual), url, content_type, payload, sha256 | Untouched evidence (append-only) |
| `mid_market_rates` | id, base, quote, rate, source (wise_mid, ecb, cbe, nbs), as_of, fetched_at | Reference rates (append-only) |
| `quotes` | id, raw_observation_id, provider_id, corridor_id, **sender_country, recipient_country, route (convert_at_sender / sepa_then_convert_at_receiver)**, payin, payout, **disclosed_markup_vs_ecb (nullable, for future PSR/CBPR2 disclosures)**, total_paid, send_amount, fee_amount, stated_rate, received_amount, delivery_min/max, mid_rate_id, mid_alignment_minutes, parser_version, captured_at | Parsed, comparable offers (append-only) |
| `manual_fee_schedules` | provider_id, corridor_id, payin, payout, fee_mode (deducted / on_top), fixed_fee, percent_fee, min_fee, max_fee, min_amount, max_amount, valid_from, valid_to, source_url, note | For providers without an API. Combined with a published rate to *generate* quotes. |
| `latest_quotes` (view) | newest quote per provider × corridor × amount | Read model for the API |

**Rules:** never update or delete observations, rates or quotes; always insert new rows. Cost breakdowns are **computed** from `quotes` + `mid_market_rates`, not stored, so a methodology fix applies to all history.

---

## 7. Getting the data

### Step 0 deliverable: `docs/feasibility.md`
For every provider × corridor: **source type** (API / published rate sheet / calculator / manual), URL, **ToS checked (yes/no + notes)**, whether the price depends on the amount, the payout methods, and the final decision. **No provider enters v1 without a confirmed source.**

### Sources by type
> Full source-by-source details, tests and legal notes: research doc §8–§9.

- **Mid-market:** the Wise mid captured with each quote (primary) plus Frankfurter v2 **pinned by source** (`providers=ECB / CBE / NBS`). The SNB publishes only monthly averages, so it's not usable daily. Open Exchange Rates' free tier (hourly, USD base, 1,000 requests/month) is allowed for private, non-commercial use only.
- **Swiss banks and PostFinance:** many publish **daily FX rate sheets ("Devisenkurse")**, often tiered by amount. This is the preferred source, more legitimate and stable than scraping calculators. Fees come from their published price lists (stored in `manual_fee_schedules`).
- **Bank rate pages tested:** SZKB, BKB, BEKB, TKB, LUKB, GKB, AKB, BCN, BCF, BCGE and boerse.raiffeisen.ch all publish FX tables, often tiered by amount, but **all render with JavaScript**, so we need Playwright (or the page's own data request). Use the **FX ("Devisen") rate**, not the banknote ("Noten") rate. Store each page's own "as of" date, since some are months old.
- **Wise quotes** (`POST api.wise.com/v3/quotes`, no auth, documented as "example quotes"): OK at low frequency for Wise itself.
- **Rule-based adapters** from published terms when automation isn't allowed: **Revolut** (robots.txt disallows `/api/`; CHF 1,250 monthly allowance, 1% fair-usage fee, 1% weekend markup), PostFinance, Yuh (0.95%), Alpian (0.20% / 0.50% on weekends), Swissquote.
- **Fintechs in general:** public quote endpoints or calculators, **only if the ToS allow it**. Go slowly and identify the client honestly.
- **Manual entry:** allowed, always labelled `source_kind = manual` and shown as such in the UI.
- **Wise Comparison API** (`api.wise.com/v4/comparisons`): the docs say it needs authentication, but our test shows it answers publicly and Wise's robots.txt allows it. Wise's terms forbid unpermitted automated monitoring, so **ask Wise for written permission first** (comparison@wise.com). Until then: occasional development snapshots only. It returns **estimates** (observed markup applied to the current mid-market rate), covers bank transfer only, collects data about hourly, and is "not for critical flows". If granted, it becomes one adapter labelled **"estimate"**, never ground truth.
- Calculator scraping from GitHub/cloud IPs is often blocked. That's one more reason to prefer rate sheets and APIs.

### Freshness
Every result shows its capture time and source. Quotes older than the last working-day snapshot are marked **stale**, and providers with stale data are listed separately, not ranked.

---

## 8. Operations: collectors

- `collect.yml`: a GitHub Actions cron (DST-safe, see §3.1) that runs `packages/collectors`. It fetches the mid-market rate first, then each provider in turn.
- Every run writes a `collector_runs` row. A failure or zero quotes **fails the workflow**, so GitHub emails you.
- Sanity guards reject quotes that are impossible (received > ideal) or implausible (cost > X%). Rejected quotes are kept in `raw_observations` with the rejection reason.
- `ci.yml`: Biome, `tsc --noEmit`, Vitest (unit + property), adapter fixture tests, and Testcontainers integration tests on every push or PR.

---

## 9. API design

- `GET /v1/compare?from=CHF&to=EUR&amount=1000` returns providers ranked by `total_cost_CHF`. Each row has `received`, `visibleFee`, `fxMarkup`, `totalCost`, `totalCostPct`, `capturedAt`, `source`, `stale`, `notes[]`.
- `GET /v1/history?from=CHF&to=EGP&provider=wise&amount=1000` returns a time series of cost %.
- `GET /v1/providers` returns providers, data source types and last successful run.
- Money is sent as **strings**. Errors use **RFC 9457 Problem Details**. OpenAPI docs are served at `/docs` (Scalar).
- Reserved for later: `mode=receive`.

---

## 10. Testing strategy

| Layer | What | Tool |
|---|---|---|
| `core` | every fee mode, min/max fee, tiers, rounding per currency, golden provider examples | Vitest |
| `core` | invariants: `received ≤ ideal`, `visible + markup = total`, monotonic in amount, no float leaks | fast-check |
| `collectors` | each adapter parses **saved real responses** (fixtures, no network) | Vitest |
| `db` | migrations, `latest_quotes` view, TypedSQL queries on real Postgres 18 | Testcontainers |
| `api` | `/v1/compare` end-to-end with seeded data | supertest |

---

## 11. Build roadmap (about 15 h/week, 6–8 weeks)

| Step | When | Work | Done when |
|---|---|---|---|
| **0. Feasibility** | **Mostly done** (research doc), finish **in parallel** with steps 1–3 | Email Wise for permission; check in the apps which providers accept Swiss-resident senders; read the ToS of the 2 bank pages we automate; turn the research into `docs/feasibility.md`. | Every v1 provider has a confirmed source **before step 5**. |
| **1. Setup** | Week 1 | `git init`, pnpm monorepo, Biome, tsconfig, Docker PG 18.6, CI, `CLAUDE.md`, ADR 0001. **Deploy a hello-world API + page.** | CI is green; a public URL works. |
| **2. Core engine** | Week 2 | `Money`/`Rate`, fee strategies, `computeCost`, rounding, golden + property tests. | 3 real calculator results reproduced to the cent. |
| **3. v0.1 end-to-end** | Week 3 | Prisma schema + migrations, `manual_fee_schedules` seed, `/v1/compare`, basic results table. | Deployed comparison using manual data. |
| **4. Mid-market + pipeline** | Week 4 | Frankfurter adapter, raw → parse pipeline, `collector_runs`, DST-safe `collect.yml`. **Start collecting daily from here, because history only begins on the first day of collection.** | A week of daily snapshots stored. |
| **5. Provider collectors** | Weeks 5–6 | One adapter at a time (API → rate sheet → manual), with sanity guards and fixtures. | All v1 providers collected automatically or by labelled manual entry; no negative hidden costs. |
| **6. Frontend** | Week 7 | Breakdown table, cost %, freshness/stale labels, "cheapest by amount" chart, "my bank vs best" view, history chart, disclaimers. | Usable on mobile; every number shows its source. |
| **7. Polish** | Week 8 | README (diagram, maths, decisions, screenshots), `methodology.md`, World Bank comparison, ADRs. | A reviewer understands the project in 5 minutes. |
| **8. Later** | — | Hourly intraday rates (v1.1), receive mode, more payout methods, Wise API adapter, rate alerts (needs a privacy policy), more corridors, DE/FR. | |

---

## 12. Legal and trust (light, portfolio level)
- Disclaimer on every result page: estimates for information only, not financial advice.
- Respect each provider's ToS, robots.txt and rate limits, and be aware of Swiss law (UWG). Prefer published rate sheets and APIs to scraping.
- Use provider names factually. No logos without permission.
- Before collecting any email (alerts): add a privacy policy under the Swiss **revFADP** (in force since Sept 2023).
- No affiliate links, so rankings have no conflict of interest.

---

## 13. What makes it respected in fintech
- Decimal-correct money handling, currency-aware value objects, documented rounding.
- A universal, documented cost methodology, validated against real calculators and World Bank data.
- Mid-market rates captured at the same time as quotes, and honest handling of EGP and cross rates.
- Raw evidence for every number, append-only history, a re-parsable pipeline (auditability).
- Clear hexagonal boundaries enforced by packages; tests at every layer; green CI.
- Monitoring that fails loudly; freshness and manual-data labels in the UI.
- ADRs and a README that explain the *why*.

---

## 14. Working with Claude Code
- One roadmap step at a time, in order. Before each step: ask for the plan and the reasons. After it: a line-by-line walkthrough until you can explain it yourself.
- Tests are written together with the code and run every time.
- Keep a **`CLAUDE.md`** at the repo root with the project rules:
  - money only via `Money`/`Rate` (decimal.js), never `number`
  - the cost formula from §2
  - `core` has no I/O and no imports from other packages
  - Prisma stays inside `packages/db`
  - no `$queryRawUnsafe`
  - run `pnpm test` and `pnpm typecheck` after every change
  - one commit per roadmap step
- Record each significant decision as an ADR in `docs/adr/`.

---

## 15. Open decisions
- **Wise's answer on the comparison data.** If it's no, Wise quotes for Wise itself, plus bank pages, rule-based adapters and manual entry for everyone else; the mid-market fallback is the ECB fix (§3.1).
- Which 2 cantonal bank pages to automate (based on their ToS and how easy the page is to read).
- Final list of providers and corridors: proposed in §1, confirmed in step 0.
- Which big bank: UBS or ZKB (pick the one with the clearest published rate sheet).
- The sanity-guard threshold X% (start with 10%, then tune).
- When to move to Prisma 8 (once it's stable and Renovate proposes it).

---

## Sources
- **Full research with all sources:** `Research - Swiss & European Transfer Landscape.md` (2026-11-04)
- Wise Comparison API docs: https://docs.wise.com/api-reference/comparison
- Frankfurter exchange rate API (v2): https://frankfurter.dev
- Monito (Swiss competitor): https://startupticker.ch/en/news/monito-startup-launches-first-money-transfer-search-engine · https://tx.group/news-events/detail/tamedia-invests-in-the-monito-money-transfer-comparison-site/
- moneyland.ch, sending money abroad: https://moneyland.ch/en/sending-money-overseas
- World Bank Remittance Prices Worldwide (e.g. CH→Serbia): https://remittanceprices.worldbank.org/corridor/Switzerland/Serbia
- Wise comparison pages: https://wise.com/us/compare/ · SendMoneyCompare: https://sendmoneycompare.com/compare-money-transfer
- Node.js releases: https://nodejs.org/dist/index.json · PostgreSQL versions: https://www.postgresql.org/support/versioning/
- Package versions: npm registry (`npm view <pkg> dist-tags`), checked 2026-11-04
- ORM comparison: https://www.pkgpulse.com/guides/drizzle-orm-v1-vs-prisma-6-vs-kysely-2026
- Job queues: https://www.pkgpulse.com/guides/bullmq-vs-bee-queue-vs-pg-boss-job-queues-nodejs-2026
- Free FX APIs overview: https://dev.to/easysolutions906/the-best-free-currency-exchange-api-in-2026-47m0
