# ADR 0008: v1 compares CHF⇄EUR only; Western Union added for CHF→EUR

- **Status:** accepted (owner, 2026-11-13)
- **Date:** 2026-11-13
- **Supersedes:** the corridor list of Project Plan §2 (CHF→GBP, CHF→EGP, CHF→RSD) and the CBE/NBS
  sources in ADR 0003

## Context
The plan listed five corridors: CHF→EUR and EUR→CHF as the main ones, plus CHF→GBP, CHF→EGP and
CHF→RSD. Stage 5 brings the provider data for every corridor. For the extra corridors, exact public
prices are rarer (Project Plan §4), the reference rate has to come from other central banks (CBE,
NBS), and the reader the site is built for sends money between Switzerland and the euro area.

While researching EUR→CHF (2026-11-13), the owner also asked to add Western Union, PayPal and Migros
Bank, first from screenshots of Wise's comparison page. That page is Wise's own data about its
competitors; ADR 0003 rules it out (Wise's terms), so each provider's own source was checked instead.

## Decision
- **Corridors:** **CHF→EUR and EUR→CHF** only: transfers between Switzerland and euro-area countries.
  The supported currencies are CHF and EUR; the only reference rate source is the **ECB**
  (Frankfurter, pinned).
- **Providers:**
  - **Wise, Yuh, Revolut, PostFinance:** both directions (Wise and Yuh rule-based, Revolut
    rule-based with its monthly allowance stated in CHF, PostFinance manual from its rate sheet).
  - **Western Union: CHF→EUR only**, manual, read by the owner from Western Union's own calculator
    on westernunion.com/ch (paid by bank transfer, delivered to a bank account). Not EUR→CHF: its
    price there depends on the sending country.
- **Not added:** PayPal (fee policy blocks automated reading; delivers to a PayPal balance, not a
  bank account), Migros Bank (owner's choice: too many conditions to model). Wise's comparison data
  is used only to cross-check values taken from the providers themselves, never as a source.

## Alternatives considered
- **Keep the five corridors:** more research for fewer exact sources and two more reference-rate
  sources, for readers the site doesn't target yet. Can come back after v1.
- **Take Western Union, PayPal and Migros from Wise's comparison page:** quick, but against Wise's
  terms (ADR 0003) and it would show Wise's view of its competitors as our source.

## Consequences
- Every number on the site comes from the provider itself or the ECB, with its link and date.
- Western Union's rate changes during the day: like PostFinance it is labelled "approximate" and
  must be re-read within 30 days (`RECHECK_DAYS`). Its online limit (4,700 CHF when read) needs a
  maximum amount per fee schedule (stage 5a).
- Adding a corridor later means a new currency in core (the collector's typed source table then
  requires its reference-rate source) and new research.
