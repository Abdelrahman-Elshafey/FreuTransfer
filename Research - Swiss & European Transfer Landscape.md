# Research: Swiss & European Money-Transfer Landscape

> **Note (2026-11-05):** the Wise API/comparison data described below is no longer used (ADR 0003). This overrides every recommendation below that relies on it: the "primary: Wise mid" choice in §8 (Frankfurter is the only mid-market source) and the "via Wise data" rows in §9 (those providers are researched manually or dropped). The rest of the research still applies.
>
> Research date: **2026-11-04**. Scope: transfers **Switzerland → Europe** and **Europe → Switzerland**, plus the earlier CHF→EGP and CHF→RSD corridors.
> Confidence labels: ✅ **verified** (official source or our own live test) · ◐ **secondary source** (comparison site, blog, press) · ❓ **unconfirmed / conflicting**.
> Fees and rates change often. Re-verify before using any figure in code or the README.

---

## 0. Key findings (what changes the project)

1. **The biggest real need is CHF ⇄ EUR, in both directions.** Switzerland has **414,262 cross-border commuters** (Q2 2026): 58% from France, 22% from Italy, 16% from Germany. They earn CHF and spend EUR every month. A St. Gallen University study says most Swiss "remittance outflows" are actually these commuters' wages. ◐
2. **Wise's comparison data is publicly reachable** (`api.wise.com/v4/comparisons`), and Wise's robots.txt explicitly *allows* bots on it. It returned **5 providers for CHF→EUR, 14 for EUR→CHF and 2 for CHF→EGP**. UBS, PostFinance, Raiffeisen, Revolut and most cantonal banks are **missing**. That gap is our edge. ✅ (our own test)
3. **Wise's quote endpoint works without authentication** (`POST api.wise.com/v3/quotes`). It returns fee, rate, received amount, and the cost of each pay-in method (bank / debit card / credit card). Wise's docs call it "example quotes for illustrative purposes". ✅
4. **Wise's mid-market rate is in every quote**, which gives us a mid-market rate captured at the same moment as the quote, for free. Cross-check it against the ECB rate (A1 in the plan). ✅
5. **Swiss banks do publish exchange rate tables** ("Devisenkurse"), often **tiered by amount**: SZKB, BKB, BEKB, TKB, LUKB, GKB, AKB, BCN, BCF, BCGE, Raiffeisen. All the ones we tested **render the rates with JavaScript**, so we need Playwright or the page's underlying data request. ✅
6. **There are more competitors than we thought:** Monito (Lausanne), **ibani.com** (a Swiss FX platform with CHF-EUR guides for cross-border commuters in 6 languages), getrates.ch, neo-banques.ch, moneyland.ch and changenligne.ch. Most publish **static** margin tables. None that we found shows **live, dated quotes for Swiss banks alongside fintechs in both directions**. ◐
7. **Prices depend on the route, not just the currency pair.** Western Union's CHF→EUR offer for 1,000 CHF ranges from **1,011.67 to 1,062.42 EUR depending on the destination country** (~5%). The data model needs sender and recipient country. ✅
8. **"Mid-market" isn't one number for exotic currencies.** For CHF/EGP today: Wise 67.014 · Central Bank of Egypt 66.942 · Frankfurter's blended rate 67.377. That's a 0.65% spread, larger than many providers' whole margin. ✅
9. **EU banks charge a lot for EUR→CHF:** on 1,000 EUR, Sparkasse charges a €50 fee (5.1% total cost), Deutsche Bank €36.55 (3.9%) and La Banque Postale €37.90 plus a 6.2% markup (**9.7%**), compared with Wise at 0.60%. ✅ (from Wise's comparison data, see §4)
10. **Regulation is moving towards transparency:** the EU's CBPR2 already requires conversion charges to be shown as a **% markup over the ECB rate**, and the EU Payment Services Regulation (PSR, agreed April 2026) extends cost transparency and payee verification to "one leg out" transfers (where only one side is in the EU), which covers transfers between the EU and Switzerland. This is a good argument for the README: *"we compute what the regulation is pushing banks to disclose."* ◐

---

## 1. Previously unchecked items, now checked

| Item | Finding | Status |
|---|---|---|
| Open Exchange Rates free tier | **1,000 requests/month, hourly updates, USD base only.** Paid plans start at $12/month. The terms say private consumers may use it only for "domestic and private use" and may not "profit directly". That's fine for a non-commercial portfolio project but not for a product. | ✅ |
| Wise Comparison API | Docs say it needs auth, but `GET api.wise.com/v4/comparisons/?sourceCurrency=CHF&targetCurrency=EUR&sendAmount=1000` answers without it. robots.txt has `Allow: *comparisons*sourceCurrency=*`. Data includes per-provider `fee`, `rate`, `markup`, `receivedAmount`, `dateCollected`, route countries and delivery estimates. Docs: estimates, bank transfer only, collected about hourly, "not for critical flows". | ✅ |
| Wise ToS on automation | Wise's customer agreement bars using "any robot, spider… to monitor or copy our websites without our prior written permission" (via a ConductAtlas summary, ❓ exact current wording). It conflicts with the robots.txt allowance, so **ask Wise for written permission** (comparison@wise.com is listed in their docs) or join the **Wise affiliate programme** (personal API token, `/v1/rates`). | ◐ |
| Wise quote endpoint | `POST /v3/quotes` with `{sourceCurrency,targetCurrency,sourceAmount}` and no auth: for 1,000 CHF→EUR, fee **3.50 CHF** (bank transfer), and pay-in fees of 10.84 CHF (debit card) or 34.54 CHF (credit card). Matches Wise's published CH formula **1.21 CHF + 0.23%**. | ✅ |
| Revolut (Swiss terms) | Swiss customers are served by **Revolut Bank UAB (Lithuania)**. Revolut **applied for a Swiss banking licence in Sept 2026** (CHF 150M investment). Standard plan: **CHF 1,250/month** exchange allowance, then a **1% fair-usage fee**; **weekend markup of 1%** (Fri 17:00 – Sun 18:00 ET). robots.txt **disallows `/api/`**, so no automated fetching: build a rule-based adapter from the published terms. | ✅ (help centre) / ◐ (licence press) |
| Bank rate sheets with amount tiers | Yes. Examples: SZKB note rates up to CHF 5,000 and FX rates up to CHF 50,000; BKB tiers up to 50k and 250k; TKB "better rates above CHF 4,000"; BCN valid up to CHF 10,000. **All rendered client-side**, so collecting them needs Playwright. | ✅ |
| Swiss scraping law | Art. 5 lit. c UWG (taking over a "market-ready work result by technical reproduction"; leading case BGE 139 IV 17). Commentary: **manual typing is not "technical reproduction"**, but automated scraping is more exposed. Prefer APIs, permission or manual entry. *Not legal advice.* | ◐ |
| SNB as mid-market source | The SNB data portal API (`data.snb.ch/api/cube/devkum/data/csv/en`) has **monthly and annual** averages only, no daily cube. ❌ Not usable as a daily reference. | ✅ |
| Frankfurter v2 per-source rates | `?providers=ECB`, `CBE` (Central Bank of Egypt, official rate) and `NBS` (National Bank of Serbia, official middle rate) all work with CHF. 108 sources. **Without a provider filter, values get blended across sources and dates** (we saw an EUR value dated 2026-11-05 on 11-04). Always pin the source. | ✅ |

---

## 2. Market and users

| Segment | Size / evidence | Direction | Typical need |
|---|---|---|---|
| **Cross-border commuters** (frontaliers / Grenzgänger / frontalieri) | 414,262 (Q2 2026, FSO via bluewin): FR 58.3%, IT 22.3%, DE 16.3% | CHF→EUR, monthly salary | Best recurring conversion; standing orders |
| Residents with family or property in the EU | Most Swiss outflows go to European neighbours (G20 remittance plan, ~USD 27.9bn outflows in 2020) | CHF→EUR | One-off and recurring transfers |
| EU residents moving to or paying in CH | Students, new arrivals, owners of Swiss property | EUR→CHF | Rent deposits, Swiss bills (QR-bill) |
| Diaspora remittances | World Bank RPW has CH corridors (e.g. Serbia, Albania, Kosovo, Sri Lanka, Hungary) | CHF→RSD/ALL/EUR/LKR… | Small amounts, cash pickup, mobile wallet |
| Personal corridor | CHF→EGP | CHF→EGP | Official vs market rate (see §8) |

**Implication:** make **CHF⇄EUR the primary product**, framed around cross-border commuters, and keep EGP/RSD as the "hard corridor" showcase.

---

## 3. Competitors

| Site | What it does | Live data? | Gap for us |
|---|---|---|---|
| **Monito** (Lausanne, since 2013, Tamedia-backed) | Global transfer comparison, 400+ providers | Yes, mostly transfer services | Few Swiss banks; general rather than CH-specific |
| **Wise comparison** (wise.com/compare) | Comparison run by Wise itself | Yes (estimates, ~hourly) | CHF→EUR: only 5 providers; not neutral |
| **ibani.com** | Swiss FX platform (0.40–0.15% margin, SO-FIT member); detailed CHF-EUR guides for cross-border commuters in FR/DE/IT/ES/PT/EN | Static tables in guides | It sells its own service, so its tables aren't neutral |
| **moneyland.ch** | Swiss account and card comparison | Mostly static | Account comparison **excludes FX spreads** |
| **getrates.ch** | Neobank and account rankings with card FX markups | Static | No transfer comparison tool |
| **neo-banques.ch** | Fee guides; category averages (large banks avg 1.69%, regional 1.50%) | Static (brochures, Feb 2026) | No per-bank live data |
| **changenligne.ch**, Banque du Léman guides, guidedufrontalier.com | Cross-border commuter content | Static | Content only, not comparison tools |
| **Alpian FX study** | 71 institutions, data from 30 June 2025: average bank margin **1.7%**; only **8 of 36** below 1% (all digital banks or FX platforms) | One-off | Run by an interested party (Alpian); no per-bank figures published |

**Refined edge:** *live, dated, source-cited quotes for Swiss banks (from their own rate sheets) next to fintechs, in both directions, with an open methodology and history.*

---

## 4. Live snapshot: Wise comparison data, 2026-11-04 ~17:40 UTC

Send amount 1,000. Reference = Wise's mid-market rate at capture time. Total cost % = (ideal − received) / ideal. ⚠ The markup column is relative to **Wise's** mid rate, so Wise is 0% by definition.

**CHF → EUR** (Wise mid 1.08992; ECB reference rate on 11-04: 1.0884)

| Provider | Type | Route | Received EUR | Fee | Markup | **Total cost** | Collected |
|---|---|---|---|---|---|---|---|
| Wise | fintech | – | 1,086.11 | 3.50 CHF | 0.00% | **0.35%** | 17:38Z |
| Zürcher Kantonalbank | bank | CH→DE | 1,078.70 | 0 | 1.04% | **1.03%** | 16:50Z |
| Migros Bank | bank | CH | 1,071.09 | 0.30 | 1.71% | **1.73%** | 17:20Z |
| Western Union | MTO | CH→SK (best of 24 countries) | 1,062.42 | 0 | 2.53% | **2.52%** | 16:36Z |
| PayPal | MTO | CH→DE | 1,042.31 | 2.49 | 4.14% | **4.37%** | 16:42Z |

**EUR → CHF** (Wise mid 0.9175)

| Provider | Type | Route | Received CHF | Fee (EUR) | Markup | **Total cost** | Collected |
|---|---|---|---|---|---|---|---|
| Wise | fintech | – | 912.02 | 5.97 | 0.00% | **0.60%** | 11-04 |
| Western Union | MTO | FR→CH | 903.90 | 3.99 | 1.09% | **1.48%** | 11-04 |
| Commerzbank | bank | DE | 895.68 | 15.00 | 0.89% | **2.38%** | 11-04 |
| Xoom (PayPal) | MTO | →CH | 895.06 | 2.99 | 2.15% | **2.45%** | 11-04 |
| ABN AMRO | bank | NL→CH | 894.95 | 16.00 | 0.87% | **2.46%** | 11-04 |
| Rabobank | bank | NL | 892.36 | 16.00 | 1.16% | **2.74%** | 11-04 |
| OFX | MTO | – | 887.50 | 10.00 | 2.29% | **3.27%** | 11-04 |
| Deutsche Bank | bank | DE | 881.31 | 36.55 | 0.30% | **3.94%** | 11-04 |
| ING Germany | bank | DE→CH | 877.98 | 32.00 | 1.14% | **4.31%** | 11-03 |
| PayPal | MTO | ES→CH | 873.94 | 1.99 | 4.56% | **4.75%** | 11-04 |
| CaixaBank | bank | ES | 872.82 | 27.00 | 2.23% | **4.87%** | 11-04 |
| Sparkasse | bank | DE→CH | 870.86 | 50.00 | 0.09% | **5.08%** | 11-03 |
| Sabadell | bank | ES | 870.38 | 22.00 | 3.00% | **5.14%** | 11-04 |
| La Banque Postale | bank | FR→CH | 828.22 | 37.90 | 6.17% | **9.73%** | 11-02 |

**CHF → EGP** (Wise mid 67.0137; CBE official 66.942)

| Provider | Received EGP | Fee | Markup | Total cost |
|---|---|---|---|---|
| Wise | 65,953.54 | 15.82 CHF | 0.00% | 1.58% |
| Western Union (CH→EG) | 65,802.17 | 3.99 | 1.41% | 1.81% |

**What the snapshot shows:**
- EU banks hide little in the rate but charge **large fixed fees** for EUR→CHF (a non-SEPA currency). Swiss banks charge **no fee but a 1–2% markup**. Both pricing styles exist, so the universal cost formula is essential.
- Data ages vary (some quotes are 1–2 days old), so we must store each quote's own `dateCollected`.
- **Missing from Wise's data:** UBS, PostFinance, Raiffeisen, the cantonal banks other than ZKB, Revolut, Yuh, neon, the FX platforms (ibani, B-Sharpe), N26 and bunq. **These are the providers we should add.**

---

## 5. Swiss providers (sending from or receiving in Switzerland)

### 5.1 Big banks and PostFinance

| Provider | Transfer fees | FX cost | Data source for us | Status |
|---|---|---|---|---|
| **UBS** (incl. former Credit Suisse) | SEPA supported; OUR/BEN/SHA for SWIFT; key4 Pure non-SEPA CHF 5 | Estimated 1.7–3.6% margin; key4 FX plans **1.2% / 0.8% / 0.4%** | No public rate table found → published price list + manual entry | ◐ |
| **PostFinance** | **SEPA EUR free** in e-finance/app; SWIFT e.g. PLN/HUF reduced from CHF 22 to **CHF 7 until 31.12.2026** (OUR) | ~1.5–2% (Alpian estimate); 2018 study: rates set **once a day** | Price list + realtime trading in e-finance (not public) → manual entry | ✅ fees / ◐ FX |
| **Raiffeisen** (independent local banks) | Set by each local bank | Not published centrally | Public rate pages at **boerse.raiffeisen.ch** (notes / FX calculator; JS-rendered) | ✅ page exists |
| **Zürcher Kantonalbank** | 0 (in Wise data) | **1.04%** live (Wise data); trading tiers ≤50k: max 1% for major currencies | Wise comparison + zkb.ch | ✅ |
| **Migros Bank** | 0.30 (Wise data) | **1.71%** live (Wise data) | Wise comparison | ✅ |

### 5.2 Cantonal and regional banks with public rate pages (all JS-rendered)

| Bank | Page | Amount tiers stated | Last date seen |
|---|---|---|---|
| Schwyzer KB (SZKB) | szkb.ch → Konditionen & Kurse → Devisen, Noten, Edelmetall | Notes ≤ CHF 5,000; FX ≤ CHF 50,000 | 29.10.2026 |
| Basler KB (BKB) | quotes.bkb.ch/market/currency | ≤ 50,000 and ≤ 250,000 | 07.10.2026 |
| Berner KB (BEKB) | bekb.ch → Währungsrechner | – | – |
| Thurgauer KB (TKB) | tkb.ch → Wechselkurse & Währungsrechner | Better rates > CHF 4,000 | – |
| Luzerner KB (LUKB) | lukb.ch → Währungsrechner | – | 03.11.2026 |
| Graubündner KB (GKB) | gkb.ch → Konditionen → Noten & Devisen | – | 05.01.2026 (stale) |
| Aargauische KB (AKB) | akb.ch → Währungsrechner (mid rates only) | – | – |
| BC Neuchâtel (BCN) | bcn.ch → Devises et billets | Valid ≤ CHF 10,000 | 02.11.2026 |
| BC Fribourg (BCF) | bcf.ch → Devises / Billets | FX ≤ 50,000; notes ≤ 5,000 | 09.09.2025 (stale) |
| BC Genève (BCGE) | bcge.ch → Cours billets et devises | – | 30.01.2026 |

⚠ Use the **FX ("Devisen") rate**, which applies to transfers and card payments, not the **banknote ("Noten") rate**, which applies to cash and is wider. Several pages are **stale**, so store each page's own "as of" date and treat it as a freshness signal.

### 5.3 Digital banks (Swiss licence unless noted)

| Provider | FX cost | Transfers | Notes | Status |
|---|---|---|---|---|
| **neon** | Free plan: 0.35% card surcharge; paid plans 0% | International transfers **powered by Wise** (Wise fee plus neon fee combined since June 2024) | ibani estimates 0.8–1.7% through Wise | ◐ |
| **Yuh** (PostFinance + Swissquote) | **0.95%** per conversion | SEPA with no Yuh fee | 13-currency account | ◐ |
| **Alpian** | **0.20% weekdays / 0.50% weekends** | CHF/EUR/USD/GBP **7** outside the currency zone | Published its own FX study | ◐ |
| **Zak** (Bank Cler) | **2%** | – | Most expensive of the digital banks | ◐ |
| **Swissquote** | Light: 0.95% | **SEPA EUR 2**; non-SEPA CHF 10 | Official pricing page | ✅ |
| **Radicant** (BLKB) | ~0% claimed | – | ❓ May not accept new customers | ❓ |
| **UBS key4** | 2% card (min CHF 1); FX plans 0.4–1.2% | Non-SEPA CHF 5 | | ◐ |
| **CSX** | – | – | No 2026 data found | ❓ |
| **Banque du Léman** | ~1.25–1.5% (ibani) | CHF + EUR accounts; offer for cross-border commuters | Inconsistent figures | ◐ |

### 5.4 Swiss FX platforms (often the cheapest for large CHF↔EUR amounts)

| Provider | Pricing | Regulation | Status |
|---|---|---|---|
| **ibani** | Interbank + **0.40% → 0.15%** (decreasing with amount); personal Swiss IBAN | SO-FIT (FINMA-recognised self-regulatory body) | ◐ (own marketing) |
| **B-Sharpe** (Geneva) | From **0.12%**; **CHF 5 fixed fee under CHF 4,900** (per ibani) | SO-FIT | ◐ |
| changenligne.ch | Not checked | – | ❓ |

### 5.5 Money transfer operators and remittance apps (sending from CH)

| Provider | CH availability | Pricing seen | Status |
|---|---|---|---|
| **Wise** | ✅ | CHF→EUR 1.21 CHF + 0.23%; mid-market rate | ✅ |
| **Revolut** | ✅ (Lithuanian bank) | See §1 | ✅ |
| **Western Union** | ✅ online, app, **~180 SBB station counters** (from CHF 5, cash at ticket machines via app); up to CHF 14,000 | CHF→EUR markup 2.5% (Wise data), varies by destination country | ✅ |
| **PayPal** | ✅ | CHF→EUR 4.37% total | ✅ |
| **MoneyGram** | ✅ CH site exists | – | ◐ |
| **Paysend** | ✅ CH site exists | 0.5–2% (2024 guide) | ◐ |
| **Ria** | CH site exists (403 to our test) | – | ◐ |
| **Remitly**, **WorldRemit**, **TransferGo** | Owner checked 2026-11-06: Remitly doesn't send from Switzerland; WorldRemit and TransferGo not usable for these corridors | – | ❌ dropped |
| **Taptap Send** | Not in its sending-country list | – | ❓ (probably not) |
| **XE**, **OFX** | Owner checked 2026-11-06: XE shows prices only after sign-up (dropped). OFX: in Wise data for EUR→CHF; CH-resident sending still unchecked | – | XE ❌ · OFX ❓ |
| CurrencyFair (Zai) | Still listed by aggregators | €3-style fixed fee (old) | ❓ |

### 5.6 Wallets and P2P

- **TWINT** (Swiss): **domestic only**. It is **not** part of the new European interoperability hub. ✅
- **Wero / EPI** (EU, ~58M users): the **European Network for Payments** (Bizum, Bancomat, Wero, MB WAY, Vipps MobilePay; set up 30 Sept 2026) plans cross-border P2P first. No Swiss participant. ◐
- **Liechtenstein** uses CHF but is in the EEA, so EU payment rules apply to Liechtenstein banks. A possible later corridor. ◐

---

## 6. European side (sending from or receiving in the EU)

- **Banks in Wise's data (EUR→CHF):** Deutsche Bank, Commerzbank, ING Germany, Sparkasse, ABN AMRO, Rabobank, CaixaBank, Sabadell, La Banque Postale. They are in a ready-made dataset for EU→CH (§4).
- **Neobanks:** Revolut (EU), **N26** (international transfers via Wise), **bunq** (plan-dependent, e.g. 0.5% on Easy Bank, 0% on Pro ◐), Wise (EU entity). EUR→CHF pricing for N26 and bunq wasn't verified ❓.
- **Accounts for cross-border commuters:** Crédit Mutuel "compte frontalier" (salary paid in CHF directly; a standing exchange contract) ◐. Others to check: Crédit Agricole (Savoie/Franche-Comté), Banque Populaire, Banca Popolare di Sondrio (IT), Sparkassen in border regions (DE).
- **Two ways to move EUR→CHF:** (a) **convert at the sending EU bank** (EUR→CHF via SWIFT, usually high fees, see §4), or (b) **send EUR by SEPA to a Swiss EUR or CHF account and let the Swiss bank convert** (cheap transfer, but the Swiss bank's 1–2% markup applies). **Our comparison should model both.**

---

## 7. Payment rails and regulation

| Topic | Facts | Status | Relevance |
|---|---|---|---|
| **SEPA** | Switzerland is a SEPA member outside the EU/EEA. EUR SEPA transfers CH⇄EU are common and often free (PostFinance, Yuh). Swissquote charges EUR 2. | ✅ | Cheap EUR leg |
| **Reg. 924/2009 (equal charges)** | Equal fees for cross-border and domestic EUR payments apply **within the Union**. Switzerland is outside it, so EU banks may charge more for transfers to CH (my reading, ❓ not explicitly confirmed). | ❓ | Explains high EU bank fees to CH |
| **SIC Instant Payments (CH)** | Launched Nov 2023 (SNB/SIX). Big banks must receive since **Aug 2024**; **all banks by end of 2026**. Sending is still rolling out (UBS, Raiffeisen early). | ✅ | Domestic only |
| **EU Instant Payments Regulation** | Receiving mandatory **9 Jan 2025**, sending plus payee verification **9 Oct 2025**, for EU PSPs. It doesn't bind Swiss banks; SEPA Instant from CH is uneven (UBS offers it). | ✅ | Speed column |
| **CBPR2 (Reg. 2019/518)** | Card conversion charges must be shown as a **% markup over the ECB rate** (since 2020/2021). For credit transfers: estimated charges, total and received amount disclosed upfront. Whether this must be an ECB markup is debated. | ◐ | Use the ECB markup as our standard metric |
| **PSR / PSD3** | Final texts agreed **23 Apr 2026**, approved 5 May 2026; Official Journal publication expected around **Dec 2026**; full application later (~2028 per some sources). Extends conversion-charge disclosure and payee verification to **one-leg-out** and non-EUR SEPA transfers. | ◐ | Future-proof the data model (a `disclosed_markup` field) |
| **Revolut Swiss licence** | Applied Sept 2026. If granted: Swiss IBAN, eBill, Swiss deposit protection. | ◐ | Watch; it will change Revolut's CH data |
| **Swiss UWG Art. 5 lit. c** | Scraping risk; manual entry is safer | ◐ | Data-sourcing policy |

---

## 8. Mid-market reference sources (tested 2026-11-04)

| Source | CHF/EUR | CHF/EGP | CHF/RSD | Cadence | Notes |
|---|---|---|---|---|---|
| **Wise mid (in each quote)** | 1.08992 (17:38Z) | 67.0137 | – | at capture time | Same moment as the quote. A commercial source, so cross-check it |
| **Frankfurter `providers=ECB`** | 1.0884 | ✗ (ECB has no EGP) | ✗ | daily ~14:10 CET | Official reference |
| **Frankfurter `providers=CBE`** | – | **66.942** | – | daily | Egypt's official rate |
| **Frankfurter `providers=NBS`** | – | – | **128.092** | daily | Serbia's official middle rate |
| Frankfurter (no filter, blended) | 1.0892 (dated 11-05!) | 67.377 | 128.16 | mixed | ⚠ Don't use without a provider filter |
| SNB data portal | – | – | – | monthly/annual only | Not usable daily |
| Open Exchange Rates (free) | hourly, USD base | ✓ | ✓ | hourly | Private, non-commercial use only |

**Recommendation:**
- **Primary:** the Wise mid captured with each quote.
- **Official cross-check:** the ECB rate (Frankfurter `providers=ECB`), and **CBE** / **NBS** for EGP / RSD.
- Flag any day where the two differ by more than a threshold (e.g. 0.5%).
- Show the **ECB markup** column, since it's the regulatory standard.

---

## 9. Data-access policy per source

| Source | Method | Permission signal | Recommendation |
|---|---|---|---|
| Wise comparisons (v4) | JSON GET | robots `Allow`; ToS forbids unpermitted automated monitoring ❓ | **Email Wise for written permission** and apply to the affiliate programme. Until then: development snapshots only, ≤1 request per corridor per day |
| Wise quotes (v3) | JSON POST, no auth | Documented as public "example quotes" | OK at low frequency; label as Wise's own quote |
| Frankfurter v2 | JSON GET | Open, free, no key | ✅ Primary official source |
| Swiss bank rate pages | Playwright (JS-rendered) or the page's own data request | Check each bank's ToS and robots.txt; UWG risk | Ask the banks (a portfolio project is a good reason); otherwise manual entry from the page, dated |
| Revolut | — | robots disallows `/api/` | **Rule-based adapter** from the published Swiss fee terms |
| Western Union / PayPal / ZKB / Migros | via Wise data | — | Use Wise data; no direct scraping |
| Price lists (PostFinance, UBS, Swissquote, Alpian, Yuh) | PDF/HTML, manual | Public documents | `manual_fee_schedules` with `source_url` and date |
| World Bank RPW | Excel download | **CC BY 4.0** (attribution required) | Validation dataset |

---

## 10. Still open (needs a human or later work)

- Written permission from **Wise** (comparison data) and possibly from 1–2 cantonal banks.
- ToS and robots.txt check for each bank rate page we automate.
- Current **UBS** and **Raiffeisen** transfer price lists (PDFs) for manual schedules.
- ~~Whether Remitly, WorldRemit, TransferGo, XE and OFX accept Swiss-resident senders~~ — checked 2026-11-06, all dropped except **OFX** (still unchecked).
- Verified **N26 / bunq** EUR→CHF pricing.
- A legal reading of 924/2009 scope for transfers to CH, and PSR article numbers once it's published in the Official Journal.
- World Bank RPW: download the Excel file and filter for Switzerland-origin corridors (the site blocked our automated fetch).

---

## Sources

**Our own tests (2026-11-04):** `api.wise.com/v4/comparisons` and `/v3/comparisons` (CHF→EUR, EUR→CHF, CHF→EGP); `POST api.wise.com/v3/quotes`; `api.frankfurter.dev/v2/rates` and `/v2/providers`; `data.snb.ch/api/cube/{devkum,devkua}`; robots.txt of wise.com, revolut.com, westernunion.com, postfinance.ch, zkb.ch, remitly.com, paypal.com, xe.com; bank rate pages (HTML probe).

**Official / primary**
- Wise Comparison API: https://docs.wise.com/api-reference/comparison · Quote API: https://docs.wise.com/api-reference/quote · Affiliates: https://docs.wise.com/guides/product/send-money/use-cases/affiliates · Wise CH fees page: https://wise.com/ch/wishes/
- Revolut CH help (exchange fees, weekend): https://help.revolut.com/en-CH/help/wealth/exchanging-money/how-much-does-it-cost-to-make-an-exchange/will-i-be-charged-for-exchanging-foreign-currencies/ · Paid plans CH: https://www.revolut.com/en-CH/legal/paid-plans-ch/ · Licence application: https://www.revolut.com/news/revolut_applies_for_swiss_banking_licence_and_commits_chf_150_million_investment/
- PostFinance foreign payments: https://www.postfinance.ch/de/privat/zahlen-sparen/zahlungen-ausland/auslandzahlung.html · PL/HU price cut: https://www.postfinance.ch/en/about-us/media/newsroom/postfinance-reduce-prices-international-payments-seven-countries.html
- Swissquote payment fees: https://www.swissquote.com/private/bank/pricing/payment-fees
- SBB Western Union: https://www.sbb.ch/en/travel-information/stations/find-station/western-union-fees.html · https://www.zentralbahn.ch/en/plan/at-the-station/services/western-union · WU CH: https://www.westernunion.com/ch/en/home.html
- Bank rate pages: https://www.szkb.ch/kontakte-services/konditionen-kurse/devisen-noten-edelmetall · https://quotes.bkb.ch/market/currency · https://www.bekb.ch/services/zinsen-und-boerseninformationen/wahrungsrechner · https://www.tkb.ch/private/services/boersen-und-maerkte/wechselkurse-waehrungsrechner · https://www.lukb.ch/private/zahlen-sparen/digital-banking/waehrungsrechner · https://www.gkb.ch/de/ueber-uns/kontakt-services/konditionen/noten-devisen · https://www.akb.ch/kundencenter/portale-tools/berechnungsmodule/waehrungsrechner · https://www.bcn.ch/prives/investir/cours-et-taux/devises-et-billets · https://www.bcf.ch/fr/prives/services-digitaux/calculateurs-et-outils/devises · https://mobile.bcge.ch/fr/cours-billets-et-devises-particuliers · https://boerse.raiffeisen.ch/devisen/notequotes
- SIX instant payments: https://www.six-group.com/en/products-services/banking-services/billing-and-payments/instant-payments.html · UBS SEPA: https://www.ubs.com/ch/en/services/payments/international-payments/sepa.html
- EU Reg. 2019/518 (CBPR2): https://eur-lex.europa.eu/eli/reg/2019/518/oj/eng · Reg. 924/2009: https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32009R0924
- European Network for Payments: https://newsroom.kbc.com/bancomat-bizum-epiwero-sibs-mb-way-and-vipps-mobilepay-announce-the-creation-of-a-european-interoperability-entity-to-connect-their-respective-solution
- Open Exchange Rates plans: https://openexchangerates.org/signup · terms: https://openexchangerates.org/terms
- Frankfurter: https://frankfurter.dev · World Bank RPW: https://remittanceprices.worldbank.org · RPW data catalog (CC BY 4.0): https://datacatalog.worldbank.org/search/dataset/0037898/remittance-prices-worldwide

**Secondary (comparison sites, press, commentary)**
- Cross-border commuters: https://www.bluewin.ch/en/news/more-female-cross-border-workers-from-france-fewer-from-italy-li.3554115 · https://frontaliereticino.ch/en/cross-border-articles/cross-border-workers-ticino-decline-2026/
- Swiss outflows: https://www.gpfi.org/sites/gpfi/files/sites/default/files/Switzerland.pdf · HSG study: https://www.alexandria.unisg.ch/publications/213052
- Alpian FX study: https://www.alpian.com/news/money/comparative-study-fx-rates · neo-banques.ch: https://neo-banques.ch/en/banking-fees-switzerland.htm · getrates.ch: https://getrates.ch/en/bank-accounts/private/neobanks
- ibani: https://www.ibani.com/en/compare-exchange-rates · https://www.ibani.com/guides/rapatrier-salaire-suisse-france · B-Sharpe: https://www.b-sharpe.com/en/
- Monito: https://startupticker.ch/en/news/monito-startup-launches-first-money-transfer-search-engine · moneyland: https://moneyland.ch/en/sending-money-overseas
- neon × Wise: https://www.neon-free.ch/en/blog/international-transfers · Neon vs Yuh: https://thepoorswiss.com/neon-vs-yuh/
- PSR/PSD3: https://www.adyen.com/knowledge-hub/psd3 · https://www.soprasteria.com/insights/details/payment-services-regulation-psr-in-2026--the-state-of-play-for-banks · https://www.mofo.com/resources/insights/260430-psd3-and-the-payment-services-regulation-key-developments
- CBPR2 commentary: https://www.cliffordchance.com/content/dam/cliffordchance/briefings/2019/07/eu-crossborder-payments-price-equality-and-fx-transparency.pdf
- Swiss instant payments rollout: https://www.atlar.com/blog/bank-payments-in-switzerland · SEPA in CH: https://heyneo.ch/en/news/sepa-in-switzerland/
- UWG 5c: https://mll-legal.com/wp-content/uploads/2023/11/Data-Scraping-Torino-Reinhard-Oertli.pdf · https://francoischarlet.ch/2014/le-screen-scraping-ne-constitue-pas-un-comportement-deloyal/
- Cross-border commuter accounts: https://www.creditmutuel.fr/fr/frontaliers/suisse/comptes-virements.html · https://hellosafe.ch/banque/banque-du-leman
- Wise ToS summary (unverified): https://conductatlas.com/platform/wise/wise-us-customer-agreement/provision/CA-P-036076/prohibition-on-automated-scraping-without-permission/

## Addendum 2026-11-05: owner-verified screenshots (21:18–21:35 CET)

| Source | What it showed | What it proves |
|---|---|---|
| Wise calculator, 1,000 CHF→EUR | fee 3.50 CHF, receives 1,087.88 EUR | Fee is **on top**: 1.21 + 0.23% of the converted amount (deducted would be 3.51). Golden test 1. |
| Wise compare, 1,000 EUR→CHF | Wise 0.9164 / 5.97 EUR / 910.88 CHF; WU 0.9055 / 15.76 / 901.91; PayPal 0.8782 / 43.57 / 876.42 | Shown rates are rounded (910.88 needs 0.916351, shown 0.9164), so the received amount is the truth. |
| Wise comparison, 1,000 CHF→EUR | Migros Bank 1,072.85; Western Union 1,063.88; PayPal 1,039.19 EUR | Against Wise's implied mid (~1.0917): 1.73% / 2.55% / 4.81%. **Not used as data (ADR 0003)**, only as a cross-check. |
| Wise method ([disclaimer](https://wise.com/gb/compare/disclaimer)) | Bloomberg mid; other providers' markup recorded once, re-applied to today's mid; between thresholds the higher threshold's price is used | Their figures for others are estimates, possibly flattering. Same "received / mid" idea as ours. |
| Yuh pricing | SEPA in EUR free; other currencies in SEPA 4 CHF; intermediary fees CHF 10–50 possible | Transfer fee verified; 0.95% FX fee still to verify. |
| Revolut (UK page), 1,000 CHF→EUR | rate 1.09086, no fee, receives 1,090.85 | 1,000 × 1.09086 = 1,090.86 exactly, so the shown rate is rounded up: not usable as a golden test. |
| Revolut (UK page), 1,000 EUR→CHF | rate 0.91390, fee 1.20 EUR, receives 912.79 | Same: 998.80 × 0.9139 = 912.80. EUR bank transfers cost 1.20 EUR there. |
| UBS Pay Worldwide (valid 19.10.2026) | max fee on the external provider's rate: PWW1 (incl. **EGP, RSD**) 3.60% up to 25k CHF; PWW2 4.00% | Needed for the CHF→EGP/RSD corridors (stage 5). Not EUR. |
| PostFinance currency overview | EUR buy 0.9068 / **sell 0.9288** CHF per EUR (electronic payments, up to 50k CHF) | CHF→EUR at 1/0.9288 = 1.07666: **1.16%** vs the ECB rate of the day. |

**Timing lesson (Project Plan §4):** Revolut's 21:28 quote gives *more* than the 14:10 ECB rate allows
(-1.42 CHF "cost"). Evening quotes can't be compared with the ECB fix; that's why rule-based providers
are computed from the mid, and manual quotes are labelled "approximate".
