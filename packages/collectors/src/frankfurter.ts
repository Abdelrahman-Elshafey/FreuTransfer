// The Frankfurter collector (stage 4, ADR 0003 and ADR 0007): the official reference rate for
// every corridor, from https://api.frankfurter.dev (free, no key, robots.txt allows all; checked
// 2026-11-12). Each run:
//   1. records a run (collector_runs),
//   2. per corridor, asks for the last WINDOW_DAYS days with the source pinned (never Frankfurter's
//      blended rate: Project Plan §4),
//   3. saves the response exactly as received BEFORE parsing it (raw_observations),
//   4. reads the rates exactly (never as JS numbers) and checks them,
//   5. stores new days; a day already stored is skipped, a CHANGED day is never overwritten but
//      reported, so the run fails visibly.
// A problem with one corridor doesn't stop the others; any problem fails the run.
import {
  type CollectorStore,
  type CorridorPair,
  type CorridorRepository,
  type CurrencyCode,
  type MidRateObservation,
  Rate,
} from "@freu-transfer/core";
import { z } from "zod";

const COLLECTOR = "frankfurter";
const API = "https://api.frankfurter.dev/v2/rates";
/** Days asked for on every run: a missed run or a server outage up to this long repairs itself. */
export const WINDOW_DAYS = 10;
const TIMEOUT_MS = 30_000;
/** Identifies us to Frankfurter: the public site, never a person. */
const USER_AGENT = "FreuTransfer/0.1 (+https://freutransfer.aelshafey.com)";

/**
 * The official source pinned for each quote currency (Project Plan §4): the ECB for both v1
 * currencies (ADR 0008). Typed over every supported currency, so adding a currency to core fails
 * the typecheck until its source is chosen here.
 */
const SOURCE_FOR_QUOTE: Readonly<Record<CurrencyCode, "ECB">> = {
  CHF: "ECB",
  EUR: "ECB",
};

/** A response that can't be trusted; the raw body is already stored for a look. */
export class FrankfurterError extends Error {
  override name = "FrankfurterError";
}

export type CollectDeps = {
  readonly store: CollectorStore;
  readonly corridors: CorridorRepository;
  readonly fetch: typeof globalThis.fetch;
  readonly now: () => Date;
};

type CorridorOutcome = {
  readonly pair: CorridorPair;
  readonly source: string;
  readonly stored: number;
  readonly unchanged: number;
};

export type CollectResult = {
  readonly run: bigint;
  readonly outcomes: readonly CorridorOutcome[];
  /** Empty when the run succeeded. */
  readonly errors: readonly string[];
};

export async function collectFrankfurter(deps: CollectDeps): Promise<CollectResult> {
  const run = await deps.store.startRun(COLLECTOR, deps.now());
  const outcomes: CorridorOutcome[] = [];
  const errors: string[] = [];
  try {
    const pairs = await deps.corridors.all();
    if (pairs.length === 0) errors.push("no corridors to collect");
    for (const pair of pairs) {
      try {
        outcomes.push(await collectPair(deps, run, pair));
      } catch (error) {
        // Only the expected failures of one corridor; anything else (e.g. the database) fails
        // the whole run below.
        if (!(error instanceof FrankfurterError)) throw error;
        errors.push(`${pair.source}→${pair.target}: ${error.message}`);
      }
    }
  } catch (error) {
    // Record why the run stopped, then let the caller see the error too (never swallowed).
    await deps.store.finishRun(run, deps.now(), `unexpected: ${String(error)}`);
    throw error;
  }
  await deps.store.finishRun(run, deps.now(), errors.length > 0 ? errors.join("; ") : undefined);
  return { run, outcomes, errors };
}

async function collectPair(
  deps: CollectDeps,
  run: bigint,
  pair: CorridorPair,
): Promise<CorridorOutcome> {
  const source = SOURCE_FOR_QUOTE[pair.target];
  const today = utcDay(deps.now());
  const window = { from: addDays(today, -WINDOW_DAYS), to: today };
  const url = `${API}?base=${pair.source}&quotes=${pair.target}&providers=${source}&from=${window.from}&to=${window.to}`;

  let response: Response;
  let body: string;
  try {
    response = await deps.fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Inside the try: the connection can also break (or time out) while the body arrives.
    body = await response.text();
  } catch (error) {
    // No complete response (network, DNS, timeout): nothing to store as raw.
    throw new FrankfurterError(`request failed: ${String(error)}`, { cause: error });
  }
  const fetchedAt = deps.now();
  // Stored before anything is parsed or checked, so even a broken response can be looked at.
  const raw = await deps.store.saveRaw(run, { url, httpStatus: response.status, body, fetchedAt });
  if (!response.ok) throw new FrankfurterError(`HTTP ${response.status}`);

  const rates = parseRates(body, { pair, source, window, fetchedAt });
  const saved = await deps.store.saveMidRates(raw, rates);
  if (saved.conflicts.length > 0) {
    const changes = saved.conflicts.map(
      (c) => `the ${c.source} rate of ${c.asOf} changed from ${c.stored} to ${c.received}`,
    );
    throw new FrankfurterError(`${changes.join(", ")}; stored values kept`);
  }
  return { pair, source: source.toLowerCase(), stored: saved.stored, unchanged: saved.unchanged };
}

/** Exactly what fits the database column NUMERIC(20,10); no exponent, no sign. */
const RATE_TEXT = /^\d{1,10}(\.\d{1,10})?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const responseSchema = z.array(
  z.object({
    date: z.string().regex(DAY, "date must be YYYY-MM-DD"),
    base: z.string(),
    quote: z.string(),
    rate: z.string().regex(RATE_TEXT, "rate must be a plain decimal with at most 10 decimals"),
  }),
);

/**
 * Reads a Frankfurter response without ever turning a rate into a JS number: JSON.parse hands the
 * reviver each number's source text, which is kept as the rate. (A normal parse would turn
 * 123456789.1234567891 into 123456789.12345679.)
 */
export function parseRates(
  body: string,
  expected: {
    readonly pair: CorridorPair;
    readonly source: string;
    readonly window: { readonly from: string; readonly to: string };
    readonly fetchedAt: Date;
  },
): MidRateObservation[] {
  let json: unknown;
  try {
    json = JSON.parse(body, (key, value, context?: { source?: string }) => {
      if (key !== "rate" || typeof value !== "number") return value;
      if (context?.source === undefined) {
        // This Node can't give the exact digits: refuse rather than store a rounded number.
        throw new FrankfurterError(
          "JSON source text is not available; rates can't be read exactly",
        );
      }
      return context.source;
    });
  } catch (error) {
    if (error instanceof FrankfurterError) throw error;
    if (!(error instanceof SyntaxError)) throw error;
    throw new FrankfurterError(`not JSON: ${error.message}`);
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    throw new FrankfurterError(`unexpected response: ${z.prettifyError(parsed.error)}`);
  }

  const { pair, window } = expected;
  const seen = new Set<string>();
  return parsed.data.map((item) => {
    if (item.base !== pair.source || item.quote !== pair.target) {
      throw new FrankfurterError(
        `asked for ${pair.source}→${pair.target}, got ${item.base}→${item.quote}`,
      );
    }
    // Text comparison works: both sides are YYYY-MM-DD. Also rejects impossible dates (2026-02-30).
    if (utcDay(new Date(`${item.date}T00:00:00Z`)) !== item.date) {
      throw new FrankfurterError(`not a real date: ${item.date}`);
    }
    if (item.date < window.from || item.date > window.to) {
      throw new FrankfurterError(
        `date ${item.date} outside the requested ${window.from}..${window.to}`,
      );
    }
    if (seen.has(item.date)) throw new FrankfurterError(`date ${item.date} appears twice`);
    seen.add(item.date);
    if (/^0+(\.0+)?$/.test(item.rate)) throw new FrankfurterError(`rate of ${item.date} is zero`);
    return {
      rate: Rate.of(pair.source, pair.target, item.rate),
      source: expected.source.toLowerCase(),
      asOf: item.date,
      fetchedAt: expected.fetchedAt,
    };
  });
}

/** "YYYY-MM-DD" of a moment, in UTC (Frankfurter's dates are publication days). */
function utcDay(moment: Date): string {
  return moment.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDay(date);
}
