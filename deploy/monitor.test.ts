import type { ComparisonDto, ResultRowDto } from "@freu-transfer/api/contract";
import { describe, expect, it } from "vitest";
import { DIRECTIONS as PAGE_DIRECTIONS } from "../apps/web/src/api.ts";
import {
  BACKUP_MAX_AGE_HOURS,
  backupProblems,
  comparisonProblems,
  DIRECTIONS,
  MID_RATE_ALERT_DAYS,
  RECHECK_REMIND_DAYS,
} from "./monitor/checks.ts";

// Rules for the daily check (.github/workflows/monitor.yml): alert when the site doesn't answer,
// the collector has stopped, data is broken or no longer ranked, a price needs re-checking within
// a week, or the newest off-site backup is too old. Silent when all is well.

// Saturday 21 Nov 2026, 08:00 in Zurich.
const now = new Date("2026-11-21T07:00:00Z");
const money = (amount: string, currency: "CHF" | "EUR" = "CHF") => ({ amount, currency });
const mid = (asOf: string) => ({ rate: "1.08", source: "ecb", asOf });

function row(providerName: string, checkedAt: string, rateCapturedAt: string | null = null) {
  return {
    providerId: providerName.toLowerCase(),
    providerName,
    providerKind: "fintech",
    sourceKind: rateCapturedAt === null ? "rule_based" : "manual",
    received: money("1080.00", "EUR"),
    visibleFee: money("0.00"),
    fxMarkup: money("0.00"),
    totalCost: money("0.00"),
    totalCostPercent: "0.00",
    approximate: rateCapturedAt !== null,
    midRate: mid("2026-11-20"),
    rateCapturedAt,
    measuredAgainst: null,
    caveats: [],
    vsCheapest: null,
    checkedAt,
    sourceUrl: "https://example.test/",
  } satisfies ResultRowDto;
}

function comparison(change: Partial<ComparisonDto> = {}): ComparisonDto {
  return {
    from: "CHF",
    to: "EUR",
    amount: money("1000.00"),
    midRate: mid("2026-11-20"),
    midRateTooOld: false,
    midRateMaxAgeDays: 5,
    recheckDays: 30,
    results: [],
    stale: [],
    unavailable: [],
    ...change,
  };
}

const problems = (change: Partial<ComparisonDto>) =>
  comparisonProblems("CHF→EUR", { ok: true, data: comparison(change) }, now);

describe("daily check: the comparison", () => {
  it("checks the same directions as the page offers", () => {
    expect(DIRECTIONS).toEqual(PAGE_DIRECTIONS);
  });

  it("is silent when all is well", () => {
    expect(problems({ results: [{ rank: 1, ...row("Wise", "2026-11-13T08:00:00Z") }] })).toEqual(
      [],
    );
  });

  it("alerts when the site gives no comparison", () => {
    expect(comparisonProblems("CHF→EUR", { ok: false, reason: "HTTP 502" }, now)).toEqual([
      "CHF→EUR: the site gave no comparison (HTTP 502)",
    ]);
  });

  it(`alerts when the newest reference rate is more than ${MID_RATE_ALERT_DAYS} days old`, () => {
    // Today in Zurich: 2026-11-21. 2026-11-17 is 4 days ago (fine), 2026-11-16 is 5 (alert).
    expect(problems({ midRate: mid("2026-11-17") })).toEqual([]);
    expect(problems({ midRate: mid("2026-11-16") })).toEqual([
      "CHF→EUR: the newest reference rate is from 2026-11-16 (5 days ago); is the collector running? (docs/deploy.md)",
    ]);
  });

  it("alerts on data errors, not on a provider's own amount limit", () => {
    const unavailable = (reason: ComparisonDto["unavailable"][number]["reason"]) => ({
      providerId: "x",
      providerName: "X",
      reason,
    });
    expect(problems({ unavailable: [unavailable("amount_not_supported")] })).toEqual([]);
    expect(
      problems({
        unavailable: [unavailable("implausible_cost"), unavailable("no_reference_rate")],
      }),
    ).toEqual([
      "CHF→EUR: X is not compared: implausible_cost (data error?)",
      "CHF→EUR: X is not compared: no_reference_rate (data error?)",
    ]);
  });

  it("alerts when a price is no longer ranked", () => {
    expect(problems({ stale: [row("Yuh", "2026-10-01T08:00:00Z")] })).toEqual([
      "CHF→EUR: Yuh is no longer ranked: its price is older than 30 days; re-check it",
    ]);
  });

  it(`reminds ${RECHECK_REMIND_DAYS} days before a price stops being ranked, not earlier`, () => {
    // Stops being ranked 30 days after the check. Checked 2026-10-29T07:00Z → 2026-11-28T07:00Z,
    // exactly 7 days after now: reminded. One minute later: 7 days and 1 minute: not yet.
    const due = { rank: 1, ...row("Yuh", "2026-10-29T07:00:00Z") };
    expect(problems({ results: [due] })).toEqual([
      "CHF→EUR: re-check Yuh before 2026-11-28; after that it is no longer ranked",
    ]);
    const notYet = { rank: 1, ...row("Yuh", "2026-10-29T07:01:00Z") };
    expect(problems({ results: [notYet] })).toEqual([]);
  });

  it("counts a manual price from its rate reading when that is older than the check", () => {
    // Checked recently, but the rate was read on 2026-10-25T07:00Z → stale from 2026-11-24T07:00Z.
    const manual = {
      rank: 1,
      ...row("PostFinance", "2026-11-20T08:00:00Z", "2026-10-25T07:00:00Z"),
    };
    expect(problems({ results: [manual] })).toEqual([
      "CHF→EUR: re-check PostFinance before 2026-11-24; after that it is no longer ranked",
    ]);
  });
});

describe("daily check: off-site backups", () => {
  // now = 2026-11-21T07:00:00Z; 31 hours earlier = 2026-11-20T00:00:00Z.
  it(`is silent while the newest dump is at most ${BACKUP_MAX_AGE_HOURS} hours old`, () => {
    expect(
      backupProblems(
        ["freutransfer-20261119-060000.dump", "freutransfer-20261120-000000.dump", "notes.txt"],
        now,
      ),
    ).toEqual([]);
  });

  it("alerts when the newest dump is older", () => {
    expect(backupProblems(["freutransfer-20261119-235959.dump"], now)).toEqual([
      "backups: the newest off-site dump is 31 hours old (from 2026-11-19T23:59:59.000Z); check the backup and offsite services (docs/deploy.md)",
    ]);
  });

  it("alerts when there is no dump, or the bucket can't be listed", () => {
    expect(backupProblems(["notes.txt"], now)).toEqual(["backups: no dump in the off-site bucket"]);
    expect(backupProblems(null, now)).toEqual([
      "backups: the off-site bucket could not be listed (set the MONITOR_S3_* settings, docs/deploy.md)",
    ]);
  });
});
