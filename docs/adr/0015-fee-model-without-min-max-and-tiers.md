# ADR 0015: The fee model has a maximum amount, no minimum/maximum fee and no fee tiers

- **Status:** accepted (owner, 2026-11-20; full review of 2026-11-20)
- **Date:** 2026-11-20

## Context
Stage 2 built every fee shape Project Plan §6 named: a fee deducted or added on top, kept between a
minimum and a maximum, and different fees by amount (any number of tiers, the last one open). The
full review of 2026-11-20 found that no provider uses most of it: the data files have no minimum or
maximum fee, and the only "tier" ever built was Western Union's maximum amount (4,700 CHF), stored
in `max_amount` and turned into a one-tier model by the repository. The unused parts ran through
four layers (loader, two database columns, repository, core) and were reached only by tests.

## Decision
- Core's `FeeModel` is `deducted` or `on_top` with a fixed fee and a percentage, plus an optional
  `maxAmount`: above it the offer can't serve the amount ("not available", caveat `amount_limit`).
- The minimum and maximum fee are removed everywhere. Migration `20261120120000_drop_min_max_fee`
  drops `min_fee` and `max_fee`, but first stops if any stored row has a value in them (history is
  evidence, never dropped silently; checked by hand against a throwaway Postgres).
- The data loader refuses `minFee` and `maxFee` instead of ignoring them.
- Markup tiers (Revolut's monthly allowance) are a different thing and stay.

## Alternatives considered
- **Keep it all:** ready for a provider that charges a minimum fee, but code nobody reads costs
  reading time in every review (CLAUDE.md rules 9 and 12).
- **Keep min/max, drop only the tiers:** still two columns and a clamp for no provider.

## Consequences
- A provider with a minimum or maximum fee, or with different fees by amount, needs this back: a
  new migration and the core rule, with tests (git history has the old version).
- Less code: one fee shape in core, no clamp, two columns fewer.
