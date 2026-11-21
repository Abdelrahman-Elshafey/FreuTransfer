// The daily check from outside (.github/workflows/monitor.yml): what is wrong with the live site
// and its backups, as sentences for the owner (English, like the logs; never shown on the page).
// Pure: the command (monitor-cli.ts) fetches, this decides. No dependencies, so the workflow runs
// it with plain Node, without installing anything; the API's types come in as types only.
import type { ComparisonDto, ResultRowDto } from "../../apps/api/src/contract.ts";

/** The directions the site compares (apps/web/src/api.ts DIRECTIONS; monitor.test.ts keeps them equal). */
export const DIRECTIONS = [
  { from: "CHF", to: "EUR" },
  { from: "EUR", to: "CHF" },
] as const;

/**
 * A reference rate published more than this many days ago means the collector has stopped. ECB
 * rates appear on working days around 16:00 CET, so a morning check normally sees yesterday's
 * (Monday: Friday's, 3 days). 4 allows one holiday next to a weekend; Easter (Thursday's rate
 * until Tuesday afternoon, 5 days) gives one false alarm a year. Earlier than the page's own
 * warning (core MID_RATE_MAX_AGE_DAYS, 5), which is for readers.
 */
export const MID_RATE_ALERT_DAYS = 4;
/** Remind this many days before a price stops being ranked (it is then re-checked in time). */
export const RECHECK_REMIND_DAYS = 7;
/**
 * The newest off-site dump may be this old: backup.sh writes one every 24 hours and offsite.sh
 * copies every 6 hours (compose.prod.yml), plus an hour for a slow copy. Older means one of them
 * stopped. Its time comes from its name, freutransfer-YYYYMMDD-HHMMSS.dump (UTC), as old-dumps.sh reads it.
 */
export const BACKUP_MAX_AGE_HOURS = 31;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** "YYYY-MM-DD" in Zurich, the site's day (core's zurichDay). */
const zurichDay = (instant: Date) =>
  instant.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });

/** One direction's answer from GET /v1/compare: the body, or why there is none. */
export type CompareResult =
  | { readonly ok: true; readonly data: ComparisonDto }
  | { readonly ok: false; readonly reason: string };

/** What is wrong in one direction's comparison (empty: nothing). */
export function comparisonProblems(direction: string, result: CompareResult, now: Date): string[] {
  if (!result.ok) return [`${direction}: the site gave no comparison (${result.reason})`];
  const { data } = result;
  const problems: string[] = [];

  const midAge = (Date.parse(zurichDay(now)) - Date.parse(data.midRate.asOf)) / DAY_MS;
  if (midAge > MID_RATE_ALERT_DAYS) {
    problems.push(
      `${direction}: the newest reference rate is from ${data.midRate.asOf} (${midAge} days ago); is the collector running? (docs/deploy.md)`,
    );
  }
  for (const u of data.unavailable) {
    if (u.reason === "amount_not_supported") continue; // a real limit, not a fault
    problems.push(`${direction}: ${u.providerName} is not compared: ${u.reason} (data error?)`);
  }
  for (const row of data.stale) {
    problems.push(
      `${direction}: ${row.providerName} is no longer ranked: its price is older than ${data.recheckDays} days; re-check it`,
    );
  }
  for (const row of data.results) {
    const staleAt = staleFrom(row, data.recheckDays);
    if (staleAt.getTime() - now.getTime() <= RECHECK_REMIND_DAYS * DAY_MS) {
      problems.push(
        `${direction}: re-check ${row.providerName} before ${zurichDay(staleAt)}; after that it is no longer ranked`,
      );
    }
  }
  return problems;
}

/**
 * When a ranked row stops being ranked: `recheckDays` after its check, or after the rate reading if
 * that is older (core's rankOffers: a row is stale when its age is MORE than recheckDays).
 */
function staleFrom(row: ResultRowDto, recheckDays: number): Date {
  const since = Math.min(
    Date.parse(row.checkedAt),
    row.rateCapturedAt === null ? Number.POSITIVE_INFINITY : Date.parse(row.rateCapturedAt),
  );
  return new Date(since + recheckDays * DAY_MS);
}

const DUMP = /^freutransfer-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.dump$/;

/**
 * What is wrong with the off-site backups, from the bucket's file names (empty: nothing). `null`:
 * the bucket could not be listed (no key set, or the listing failed).
 */
export function backupProblems(names: readonly string[] | null, now: Date): string[] {
  if (names === null) {
    return [
      "backups: the off-site bucket could not be listed (set the MONITOR_S3_* settings, docs/deploy.md)",
    ];
  }
  const times = names.flatMap((name) => {
    const m = DUMP.exec(name);
    if (!m) return [];
    const [, year, month, day, hour, minute, second] = m;
    return [Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`)];
  });
  if (times.length === 0) return ["backups: no dump in the off-site bucket"];
  const newest = Math.max(...times);
  const hours = (now.getTime() - newest) / HOUR_MS;
  if (hours > BACKUP_MAX_AGE_HOURS) {
    return [
      `backups: the newest off-site dump is ${Math.floor(hours)} hours old (from ${new Date(newest).toISOString()}); check the backup and offsite services (docs/deploy.md)`,
    ];
  }
  return [];
}
