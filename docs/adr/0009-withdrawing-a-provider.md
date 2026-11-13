# ADR 0009: A provider is withdrawn with a withdrawal entry, not by deleting it

- **Status:** accepted (owner, 2026-11-13; built in stage 5b)
- **Date:** 2026-11-13

## Context
Fee schedules are append-only history (database triggers refuse UPDATE and DELETE), and the seed
only ever inserts. So deleting a provider's entries from `data/manual/fee-schedules.json` did
nothing: the stored rows stayed, the provider stayed on the live site, and after 30 days it only
moved to "not re-checked" (review of 2026-11-09, "For the owner" 2). UBS and Alpian were removed
this way before production had data, so nothing was wrong yet.

## Decision
- A **withdrawal entry** in `fee-schedules.json`: `"withdrawn": true` for one provider × corridor,
  with `checkedAt`, a source link and a reason (`note`, required), and no prices. It is stored as a
  `fee_schedules` row with `withdrawn = true`; a CHECK constraint refuses prices, limits or an empty
  reason on it.
- The newest row per provider × corridor still decides: while it is a withdrawal, the provider isn't
  shown in that direction. A newer priced entry brings it back. The other direction is unaffected.
- The seed **refuses** a stored fee schedule that is missing from the files, with a message that
  points to the withdrawal entry. Deleting is never silently ignored again.

## Alternatives considered
- **`withdrawnAt` on the provider** (`providers.json`): one field and one filter, but it hides both
  directions at once, and clearing the date to bring a provider back erases when and why it left.
- **A separate `withdrawals` table:** keeps `source_kind` and `fee_mode` required, but needs its own
  triggers and seed comparison, and a withdrawal and a price could share a check time with no rule
  for which wins. One table keeps a single "newest row wins" rule and a single unique key.

## Consequences
- `fee_schedules.source_kind` and `fee_mode` are empty on withdrawal rows (and only there).
- History stays complete: when a provider left, why, and when it came back.
- A local database seeded with entries that were later deleted (e.g. old drafts) stops the seed:
  put the entries back, or start the local database afresh (`docker compose down -v` deletes its
  data; then `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`).
