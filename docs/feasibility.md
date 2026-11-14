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
| Western Union | money transfer operator | manual | Its own calculator, westernunion.com/ch (bank transfer in, bank account out): fee 0.00 CHF, rate 1.054014 (displayed rounded as 1.0540; derived from 100 → 105.40, 1,000 → 1,054.01 and 4,700 → 4,953.87 EUR), online limit 4,700 CHF; same rate to Italy and Spain | ✅ read by the owner 2026-11-13 09:25 (added by ADR 0008); in the data since 5c |

**Not modelled yet** (stage 6 shows them to the reader as caveats): weekend markups (Revolut 1%), Revolut's allowance being per month (we assume it is unused), intermediary bank fees
for non-SEPA payments.

## EUR→CHF (stage 5, researched 2026-11-13)

You pay euros from your account at the provider; the recipient gets francs in a Swiss account.

| Provider | Kind | Source (EUR→CHF) | Status |
|---|---|---|---|
| Wise | rule-based | Its own calculator: 1.69 EUR + 0.4301% on top, mid-market rate. Derived from three readings (100 → 2.11, 1,000 → 5.97, 5,000 → 23.10 EUR); Wise's breakdown shows only "Our fee", no split | ✅ owner screenshots 2026-11-13 |
| Yuh | rule-based | yuh.com/en/pricing: one exchange fee, 0.95% over mid-market, no difference by direction; transfers in Switzerland free | ✅ confirmed by the owner 2026-11-13 |
| Revolut | rule-based | Same Swiss fee document: exchanges free within **CHF 1ʼ250 per month** (stated in CHF, whichever direction), 1% above; "Local payments… in your base currency… to an account in your country": free | ✅ confirmed by the owner 2026-11-13 |
| PostFinance | manual | The other column of the same rate sheet: the bank **buys** euros. Owner's reading 2026-11-05 21:35: buy 0.9068 CHF per EUR (electronic payments, up to 50,000 CHF) | ✅ confirmed by the owner 2026-11-13 |

All four are in `data/manual/fee-schedules.json` since stage 5c (2026-11-13), with the EUR→CHF
reference rate of 2026-11-05 (0.918, ECB) for PostFinance's reading of that day. A test reproduces
every calculator reading above to the cent from the stored entries
(`packages/db/src/real-data.integration.test.ts`).

Western Union is not offered for EUR→CHF: its price depends on the sending country (ADR 0008). (A
reading from Spain on 2026-11-13, paid by card: 0.9187 CHF per EUR, no fee, up to 3,000 EUR. Not a
Swiss offer, so not used.)

**Dropped corridors** (owner, 2026-11-13, ADR 0008): CHF→GBP, CHF→EGP, CHF→RSD.

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
| Western Union | Prices only in its live calculator (back for CHF→EUR, read by the owner: ADR 0008); EUR→CHF stays out: price depends on the sending country | owner, 2026-11-10 / 2026-11-13 |
| EU banks (EUR→CHF) | No exact source without Wise's comparison data (ADR 0003) | owner, 2026-11-10 |
| Alpian | Owner's choice: not in v1 | owner, 2026-11-10 |
| PayPal | Fee policy blocks automated reading; delivers to a PayPal balance, not a bank account | owner, 2026-11-13 |
| Migros Bank | Owner's choice: too many conditions to model (published: SEPA CHF 0.30, rates by amount tab) | owner, 2026-11-13 |

## Reference rates
Frankfurter v2, pinned to the ECB (both v1 currencies, ADR 0008). Since stage 4
(2026-11-13) the `collect` service fetches them every hour (ADR 0007); the two rates in
`data/manual/mid-rates.json` were read by hand before that and match Frankfurter exactly.
