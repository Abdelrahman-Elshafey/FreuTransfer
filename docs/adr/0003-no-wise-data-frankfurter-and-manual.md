# ADR 0003: No Wise data; Frankfurter for mid-market, manual and rule-based provider prices

- **Status:** accepted (reference-rate sources narrowed to the ECB by ADR 0008)
- **Date:** 2026-11-05

## Context
Plan v2.1 used Wise's comparison and quote endpoints for two things: other providers' prices, and a
mid-market rate captured at the same moment as each quote. Wise's terms forbid automated monitoring
without written permission. A permission request was emailed on 2026-11-04, but the answer may take
weeks or never come, and the project shouldn't wait on it.

## Decision
- **Mid-market rate:** Frankfurter v2 only, pinned per source (ECB, CBE for EGP, NBS for RSD; since ADR 0008
  only the ECB: v1 is CHF⇄EUR). It is
  the only automated data source in v1, fetched daily after the ECB publishes.
- **Provider prices:**
  - **Rule-based** where the provider publishes its pricing (Revolut, Yuh, Wise's public pricing page):
    rate = mid × (1 − markup), plus the published fees. No timing gap with the mid rate.
  - **Manual** for banks and others: the owner reads the published rate sheet, price list or
    calculator and enters it. Claude researches first and lists the figures with source links; the
    owner verifies them. Entries carry `source_url`, `checked_at` and `source_kind = manual`.
- Manual data is stored as reviewed files in `data/manual/` (validated with Zod), so every change is
  visible in git history.
- No calls to `api.wise.com` (comparisons or quotes).

## Alternatives considered
- **Wait for Wise's answer:** blocks steps 3–5 for an unknown time.
- **Use Wise data without permission:** against Wise's terms; not acceptable.
- **Scrape bank calculators / rate pages now:** needs Playwright and a ToS check per bank; kept as an
  optional later step.

## Consequences
- Fully within every source's terms, and no dependence on a competitor's data.
- Manual quotes are compared with that working day's ECB rate, not a same-second rate, so they are
  labelled "approximate" with the capture time. Rule-based providers are unaffected.
- Data freshness depends on the owner re-checking manual entries; stale entries are shown separately.
- If Wise grants permission later, it can be added as one more adapter without changing `core`.
