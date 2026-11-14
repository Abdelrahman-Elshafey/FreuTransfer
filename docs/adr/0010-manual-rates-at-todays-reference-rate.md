# ADR 0010: A manual rate is shown at today's reference rate

- **Status:** accepted (owner, 2026-11-13; built in stage 5d)
- **Date:** 2026-11-14

## Context
A manual rate (PostFinance, Western Union) is read by hand on one day. Until 5d its amount
received was computed with the rate as read, and its cost with that day's reference rate. The cost
% was right, but the amount was not comparable with the rule-based providers, which are computed
from today's reference rate. Seen in the review of 2026-11-13: for 2,500 CHF, PostFinance (read on
6 Nov, when the franc was stronger) showed 2,700.95 EUR, more than Wise's 2,700.48, yet ranked last.

## Decision
- A manual rate keeps the **distance from the reference rate measured on the day it was read**,
  applied to today's reference rate:
  `estimate = rate read × today's reference rate / that day's reference rate`.
- The row is compared with today's reference rate like every other row, and also carries the
  reference rate it was measured against (API: `measuredAgainst`), shown on the page under the
  "Manual · approximate" label.
- A rate read today stays as it is. A rate better than its day's reference rate still fails the
  sanity guard (Project Plan §9).

## Alternatives considered
- **Keep the amount as read and explain it next to it** (stage 6): honest, but the table would
  still show a provider with more arriving ranked below one with less.
- **Re-read manual rates daily:** exact, but by hand every day, or automated against the
  providers' terms (ADR 0003).

## Consequences
- What arrives and the ranking always agree; the amount for a manual rate is an estimate, labelled.
- The estimate assumes the provider moves its rate with the market and keeps its margin. A bank
  that changes its margin is only caught by re-reading (`RECHECK_DAYS`, 30 days).
- The cost % is the same as before up to rounding: the distance is the cost.
