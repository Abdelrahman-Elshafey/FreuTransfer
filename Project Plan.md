# FreuTransfer — Project Plan

> v3, 2026-11-05: shortened. 2026-11-09: four languages (§2, §5a, ADR 0005). Decisions live in `docs/adr/`, versions in `package.json`, status in
> `docs/progress.md`, market research in `Research - Swiss & European Transfer Landscape.md`.

## 1. What and why

A website where you enter what you want to **pay in total** (e.g. 1,000 CHF) for a transfer
**Switzerland ⇄ Europe** (plus CHF→EGP/RSD). It shows how much **actually arrives** with each provider,
best first, and splits the cost into the **visible fee** and the **hidden cost in the exchange rate**.

- **Problem:** providers advertise "zero fees" but use a worse rate; Swiss banks rarely show their FX margin.
- **Goal:** portfolio / job. Correctness, tests, clean architecture and a clear README come first.
- **Constraints:** free tools, the owner's OVH VPS + domain, 15+ h/week, v1 in about 6–8 weeks.
- **Main users:** ~414k cross-border commuters converting CHF salary to EUR; residents sending EUR⇄CHF;
  diaspora remittances (CHF→RSD/EGP) as the hard case.
- **Edge over Monito, moneyland, ibani, getrates:** dated, source-cited Swiss bank costs next to fintechs,
  in both directions, with an open method. Views: "Am I overpaying with my bank?", the commuter's yearly
  cost, and "cheapest provider by amount".

## 2. Scope for v1
- **Corridors:** CHF→EUR, EUR→CHF (main), CHF→GBP, CHF→EGP, CHF→RSD. Bank transfer → bank account only.
- **Providers (5), only where exact public values exist** (owner, 2026-11-10; sources in `docs/feasibility.md`):
  - **rule-based** from published pricing: Wise (public pricing page only), Yuh, Revolut, Alpian
  - **manual**: PostFinance (published rate sheet / converter). Claude researches with links; the owner verifies.
  - **dropped:** ZKB, Remitly, WorldRemit, TransferGo, XE (owner, 2026-11-06); OFX, cantonal banks,
    UBS (publishes only "up to 1.70%"), Raiffeisen (prices per regional bank), Western Union (live
    calculator only), EU banks (no source without Wise data) (owner, 2026-11-10: keep only exact values).
- **Only automated source:** Frankfurter (mid-market rate). See ADR 0003.
- **Languages:** English, German, French, Italian, from v1 (owner, 2026-11-09). See §5a and ADR 0005.

## 3. The money maths
```
total_cost   = total_paid − received / mid_rate        (in the sender's currency)
visible_fee  = fees the provider states
fx_markup    = total_cost − visible_fee                (the hidden cost)
total_cost_% = total_cost / total_paid
```
`amount=1000` always means **1,000 leaves your account**:
- fee deducted: converted = total − fee
- fee on top: converted = (total − fixed_fee) / (1 + percent_fee)

**Example:** mid 1.07, fee 5 CHF deducted, rate 1.05 → received 995 × 1.05 = 1,044.75 EUR, worth
976.40 CHF at mid → total cost 23.60 CHF (2.36%), of which **18.60 CHF is hidden** in the rate.

**Money rules:** decimal.js inside our own `Money`/`Rate` objects, never JS numbers; amounts carry their
currency; round only at the end to the ISO 4217 minor unit (half-even); money crosses the API as strings;
rates stored as `NUMERIC(20,10)`; timestamps in UTC.

## 4. Data correctness (the hard parts)
- **Timing:** the ECB reference rate is set once a day (~14:10 CET); CHF/EUR can move 0.3–0.5% a day.
  Rule-based providers are computed from the mid, so no gap. Manual entries store their capture time,
  are compared with that day's rate, and are labelled "approximate".
- **Non-ECB currencies:** always pin Frankfurter's source: ECB, CBE (EGP), NBS (RSD). Note on EGP results.
- **Price depends on amount, route and method:** sample at 100 / 500 / 1,000 / 2,500 / 5,000; store
  sender and recipient country; EUR→CHF has two routes (convert at the EU bank, or SEPA then convert in CH).
- **Costs we can't measure** (SWIFT intermediary fees, weekend markups): disclose them in the UI.
- **Freshness:** every number shows its source and date; stale data is listed separately, not ranked.
- **Validation:** 2 real calculator results reproduced to the cent (a third was skipped by the owner,
  2026-11-10); compare with World Bank data.

## 5. Architecture (ADR 0001, hosting ADRs 0002 and 0004)
Modular monolith with ports & adapters:
- `packages/core`: pure domain (Money, Rate, fee strategies, `computeCost`, ports). No I/O.
- `packages/db`: Prisma, repositories return core types.
- `packages/collectors`: Frankfurter, rule-based and manual adapters; raw data stored before parsing.
- `apps/api`: Express 5, `/v1/compare`, `/v1/history`, `/v1/providers`; Zod; errors as RFC 9457.
- `apps/web`: React + Vite.

Data is **append-only** (raw observations → parsed quotes → `latest_quotes` view). Cost breakdowns are
computed, not stored, so a fix to the method applies to all history.

## 5a. Languages (ADR 0005)
EN / DE / FR / IT. Rules for every stage from now on, so no language work piles up for the end:
- **Language lives only in `apps/web`.** Core, db and API are language-neutral: the API sends codes,
  money and dates (error *types*, reason codes), never sentences for the reader.
- **One catalog per language** in `apps/web/src/i18n/` (`en.ts` is the source; the others are typed
  against it, so a missing text fails `pnpm typecheck`). A new visible text is added in all four
  languages in the same change. No i18n library.
- **Numbers and dates via `Intl`** from the API's strings (never floats, never re-rounded), Swiss
  formatting in every language (CHF 1'000.50), dates as the Zurich day. Amount input accepts
  `1000,50`, `1'000.50` and `1 000,50`.
- **Content:** provider names are not translated; research notes stay English (evidence, not page
  text); reader-facing caveats become codes with translated text (stage 6); disclaimer, privacy
  policy and methodology exist in all four languages before launch (stage 7).
- Translations are drafted by Claude and reviewed by the owner (formal "Sie / vous / Lei"; accepted 2026-11-10).

## 6. Testing
| Layer | What |
|---|---|
| core | every fee mode, tiers, rounding; golden provider examples; property tests (received ≤ ideal, fee + markup = total) |
| collectors | adapters parse saved real responses, no network |
| db | migrations and queries on real Postgres (Testcontainers) |
| api | `/v1/compare` end to end (supertest) |
| web | API client, amount parsing, formatting per locale, catalogs (no empty texts, Swiss German spelling) |

## 7. Roadmap (status: `docs/progress.md`)
| # | Stage | Done when |
|---|---|---|
| 0 | Feasibility (in parallel): app checks, `docs/feasibility.md` | every provider has a confirmed source before stage 5 |
| 1 | Setup | CI green |
| 2 | Core engine: Money/Rate, fee strategies, `computeCost`, rounding, tests | 2 real calculator results reproduced to the cent |
| 3 | v0.1: DB schema, first manual data, `/v1/compare`, results table, i18n foundation (EN/DE/FR/IT), first VPS deploy | live on your domain with manual data, in four languages |
| 4 | Frankfurter adapter, raw → parse pipeline, daily timer | a week of daily rates stored |
| 5 | Provider data: researched by Claude, verified by the owner | all v1 providers present, labelled, no negative hidden costs |
| 6 | Frontend: breakdown, charts, "my bank vs best", translated caveat codes | usable on mobile, every number shows its source, every text in four languages |
| 7 | Polish: README, methodology and legal texts in four languages, OpenAPI from the Zod schemas (ADR 0001), language URLs/SEO decision | a reviewer understands it in 5 minutes |
| 8 | Later: intraday rates, receive mode, more corridors, bank page automation | — |

## 8. Legal and trust
Disclaimer (estimates, not financial advice), in all four languages; respect ToS and robots.txt; provider names used factually,
no logos; no affiliate links; a privacy policy (revFADP) before collecting any email.

## 9. Decisions
Decided by the owner (2026-11-06):
- Re-check period before manual data counts as stale: **30 days** (`RECHECK_DAYS` in core).
- No extra Swiss/EU banks for now: v1 providers are those in §2.
- (2026-11-10) Only providers with exact public values; UBS, Raiffeisen, Western Union, cantonal and
  EU banks and OFX dropped. Golden test 3 skipped. Translations accepted, formal register.
- Languages (2026-11-09): English, German, French and Italian from v1; Swiss number formatting in all.
- Sanity guard (stage 5): a total cost **above 10%** or **below 0%** is treated as a data error: the
  offer isn't ranked but listed for checking. Can be raised per corridor (e.g. EGP/RSD) if needed.

Still open:
- Production domain (subdomain of `aelshafey.com`?), to discuss before stage 3e.
- Whether to automate any bank rate page later.
- Language-specific URLs (`/de/…`) for search engines, or one URL with a switcher (stage 7).
