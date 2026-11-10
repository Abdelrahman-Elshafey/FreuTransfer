# Feasibility: where every v1 price comes from

Stage 0 result (2026-11-10). Rule from the owner: **only providers whose exact values are public**;
anything we can only estimate is dropped. Data rules: ADR 0003 (Frankfurter for mid-market rates;
provider prices rule-based or manual, no Wise API data). The values themselves live in
`data/manual/fee-schedules.json`, each with its source link and check date.

## v1 providers

| Provider | Kind | How | Source (CHF→EUR) | Status |
|---|---|---|---|---|
| Wise | fintech | rule-based | Public pricing page / calculator: fee 1.21 CHF + 0.23% on top, mid-market rate | ✅ verified 2026-11-05 (golden test 1) |
| Yuh | fintech | rule-based | yuh.com/en/pricing: 0.95% over mid-market, SEPA in EUR free | ✅ verified 2026-11-06 |
| Revolut | fintech | rule-based | Fee document for Swiss clients (Revolut Bank UAB, from 21 Nov 2025): Standard plan CHF 1'250/month free, 1% above; SEPA free | ✅ verified 2026-11-10 |
| PostFinance | bank | manual | Rate sheet "electronic payments" / currency converter (rate read by the owner) | ✅ verified 2026-11-06 (golden test 2) |
| Alpian | bank | rule-based | alpian.com/en/pricing (from 15 Feb 2026): 0.2% FX markup on weekdays; EUR to the Eurozone free | 🟡 draft: owner to confirm |

**Not modelled yet** (stage 6 shows them to the reader as caveats): weekend markups (Revolut 1%,
Alpian 0.5%), Revolut's allowance being per month (we assume it is unused), intermediary bank fees
for non-SEPA payments.

**Other corridors** (EUR→CHF, CHF→GBP, CHF→EGP, CHF→RSD): the same five providers, researched from
the same kinds of sources in stage 5. A provider without an exact public value for a corridor is
left out of that corridor.

## Dropped

| Provider | Why | Decided |
|---|---|---|
| ZKB | UBS was meant as the big bank; later dropped too | owner, 2026-11-06 |
| Remitly | Doesn't send from Switzerland | owner, 2026-11-06 |
| WorldRemit, TransferGo | Not usable for these corridors | owner, 2026-11-06 |
| XE | Prices only after sign-up | owner, 2026-11-06 |
| OFX | Not checked further; dropped | owner, 2026-11-10 |
| UBS | Price list gives only "up to 1.70%"; FX calculator shows no rates | owner, 2026-11-10 |
| Raiffeisen | Each regional bank sets its own prices; rate pages are rendered by JavaScript | owner, 2026-11-10 |
| Cantonal banks | Owner's choice: none in v1 | owner, 2026-11-10 |
| Western Union | Prices only in its live calculator | owner, 2026-11-10 |
| EU banks (EUR→CHF) | No exact source without Wise's comparison data (ADR 0003) | owner, 2026-11-10 |

## Reference rates
Frankfurter v2, pinned per source: ECB (EUR, GBP, CHF), CBE (EGP), NBS (RSD). Stage 4 automates the
daily fetch; until then the rates in `data/manual/mid-rates.json` were read by hand.
