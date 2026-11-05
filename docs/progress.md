# Progress

Roadmap from `Project Plan.md` §7. Updated at the end of every stage.

**Now:** stage 2 in progress: engine built and tested; waiting for 3 real calculator results (golden tests). Stage 0 continues alongside.

| # | Stage | Status | What it delivers | Done when |
|---|---|---|---|---|
| 0 | Feasibility | 🟡 In progress (in parallel) | Research doc ✅ · Wise removed as a source (ADR 0003) ✅ · app checks (Remitly, WorldRemit, TransferGo, XE, OFX) ⬜ · `docs/feasibility.md` ⬜ | Every v1 provider has a confirmed data source **before stage 5** |
| 1 | Setup | ✅ Done (`d555741`) | Monorepo, Biome, TypeScript, Docker Postgres, CI, `CLAUDE.md`, ADR 0001; renamed to FreuTransfer + OVH hosting (ADR 0002) | CI green on GitHub ✅ |
| 2 | Core engine | 🟡 **In progress**: code + 35 tests ✅, 3 golden tests ⬜ | `Money`/`Rate` value objects, fee strategies, `computeCost`, rounding, golden + property tests | 3 real calculator results reproduced to the cent |
| 3 | v0.1 end-to-end | ⬜ Not started | Prisma schema + migrations, first manual provider data (Claude researches → you verify at the banks), `/v1/compare`, results table, **first deploy to the OVH VPS** | Comparison with manual data live on your domain |
| 4 | Mid-market + pipeline | ⬜ Not started | Frankfurter adapter, raw → parse pipeline, `collector_runs`, daily timer on the VPS | A week of daily snapshots stored |
| 5 | Provider data | ⬜ Not started | Full provider list: Claude researches fees/rates → you verify → entered as rule-based or manual data; sanity guards | All v1 providers collected; no negative hidden costs |
| 6 | Frontend | ⬜ Not started | Breakdown table, cost %, freshness labels, charts, "my bank vs best" | Usable on mobile; every number shows its source |
| 7 | Polish | ⬜ Not started | README, `methodology.md`, World Bank comparison, ADRs | A reviewer understands the project in 5 minutes |
| 8 | Later | ⬜ Backlog | Intraday rates, receive mode, more corridors, alerts, DE/FR | — |

Legend: ✅ done · 🟡 in progress · ⏭️ next · ⬜ not started

## Log
- **2026-11-04:** Plan v2 → v2.2 and market research. Stage 1 built, committed (`d555741`), pushed; CI green.
  Project renamed to FreuTransfer, fresh local DB, hosting moved to the OVH VPS (ADR 0002). Wise email sent.
- **2026-11-05:** Wise removed as a data source (ADR 0003, plan v2.3). Frankfurter is the only automated
  source; provider prices are rule-based or manual, verified by the owner. Nothing committed yet (owner asked to wait).
- **2026-11-05:** Plan shortened to ~100 lines (v3). Stage 2 built: Money, Rate, fee models (deducted / on top /
  min-max / tiers), quoteFromRule, computeCost; 35 tests incl. property tests. Golden tests wait for real data.
- **2026-11-05:** `docs/design-inspiration.md` (bejamas.com) verified against the live site and completed with
  real colours, fonts and shapes. Used in stage 6.
