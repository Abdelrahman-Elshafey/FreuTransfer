import type {
  CollectorStore,
  CorridorPair,
  MidRateConflict,
  MidRateObservation,
} from "@freu-transfer/core";
import { describe, expect, it } from "vitest";
import { collectFrankfurter, FrankfurterError, parseRates, WINDOW_DAYS } from "./frankfurter.ts";

// "Now" for every test: 2026-11-12 16:30 UTC. The window is the 10 days before it:
// 2026-11-12 − 10 days = 2026-11-02 (from), 2026-11-12 (to).
const NOW = new Date("2026-11-12T16:30:00Z");
const WINDOW = { from: "2026-11-02", to: "2026-11-12" };
const CHF_EUR: CorridorPair = { source: "CHF", target: "EUR" };

/** In-memory store that records the order of calls (raw must come before parsing). */
class FakeStore implements CollectorStore {
  readonly events: string[] = [];
  readonly raws: { url: string; httpStatus: number; body: string }[] = [];
  readonly rates = new Map<string, MidRateObservation>();
  readonly runs = new Map<bigint, { finished: boolean; error: string | undefined }>();
  #next = 1n;

  async startRun(collector: string) {
    const id = this.#next++;
    this.events.push(`start ${collector}`);
    this.runs.set(id, { finished: false, error: undefined });
    return id;
  }
  async saveRaw(_run: bigint, raw: { url: string; httpStatus: number; body: string }) {
    this.events.push(`raw ${raw.httpStatus}`);
    this.raws.push(raw);
    return this.#next++;
  }
  async saveMidRates(_raw: bigint, rates: readonly MidRateObservation[]) {
    this.events.push(`rates ${rates.length}`);
    let stored = 0;
    let unchanged = 0;
    const conflicts: MidRateConflict[] = [];
    for (const r of rates) {
      const key = `${r.rate.base}|${r.rate.quote}|${r.source}|${r.asOf}`;
      const old = this.rates.get(key);
      if (!old) {
        this.rates.set(key, r);
        stored++;
      } else if (old.rate.value.equals(r.rate.value)) {
        unchanged++;
      } else {
        conflicts.push({
          base: r.rate.base,
          quote: r.rate.quote,
          source: r.source,
          asOf: r.asOf,
          stored: old.rate.value.toString(),
          received: r.rate.value.toString(),
        });
      }
    }
    return { stored, unchanged, conflicts };
  }
  async finishRun(run: bigint, _at: Date, error?: string) {
    this.events.push(error === undefined ? "finish ok" : "finish failed");
    this.runs.set(run, { finished: true, error });
  }
}

const body = (items: object[]) => JSON.stringify(items);
/** A Frankfurter-shaped body with the rate written as a raw JSON number (as the API sends it). */
const rawBody = (rows: [date: string, rate: string][], base = "CHF", quote = "EUR") =>
  `[${rows.map(([d, r]) => `{"date":"${d}","base":"${base}","quote":"${quote}","rate":${r}}`).join(",")}]`;

function fakeFetch(responses: Record<string, () => Response | Promise<Response>>) {
  const urls: string[] = [];
  const fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    const quote = new URL(url).searchParams.get("quotes") ?? "";
    const respond = responses[quote];
    if (!respond) throw new Error(`no fake response for ${quote}`);
    return respond();
  }) as typeof globalThis.fetch;
  return { fetch, urls };
}

function deps(store: FakeStore, pairs: CorridorPair[], fetch: typeof globalThis.fetch) {
  return { store, corridors: { all: async () => pairs }, fetch, now: () => NOW };
}

describe("parseRates: reading Frankfurter's answer", () => {
  const expected = (pair = CHF_EUR) => ({ pair, source: "ECB", window: WINDOW, fetchedAt: NOW });

  it("keeps every digit of a rate, never a JS number", () => {
    const rates = parseRates(
      rawBody([
        ["2026-11-11", "1.083"],
        ["2026-11-12", "123456789.1234567891"], // a normal JSON.parse gives 123456789.12345679
      ]),
      expected(),
    );
    expect(rates.map((r) => r.rate.value.toString())).toEqual(["1.083", "123456789.1234567891"]);
    expect(rates[0]).toMatchObject({ source: "ecb", asOf: "2026-11-11", fetchedAt: NOW });
  });

  it.each([
    [
      "the wrong pair",
      rawBody([["2026-11-12", "1.08"]], "EUR", "CHF"),
      /asked for CHF→EUR, got EUR→CHF/,
    ],
    [
      "a future date",
      rawBody([["2026-11-13", "1.08"]]),
      /outside the requested 2026-11-02..2026-11-12/,
    ],
    ["a date before the window", rawBody([["2026-11-01", "1.08"]]), /outside the requested/],
    ["an impossible date", rawBody([["2026-02-30", "1.08"]]), /not a real date: 2026-02-30/],
    [
      "the same date twice",
      rawBody([
        ["2026-11-12", "1.08"],
        ["2026-11-12", "1.09"],
      ]),
      /appears twice/,
    ],
    ["a zero rate", rawBody([["2026-11-12", "0.0"]]), /is zero/],
    ["a negative rate", rawBody([["2026-11-12", "-1.08"]]), /plain decimal/],
    ["a rate in exponent form", rawBody([["2026-11-12", "1.08e0"]]), /plain decimal/],
    [
      "more decimals than the database keeps",
      rawBody([["2026-11-12", "1.12345678901"]]),
      /at most 10 decimals/,
    ],
    [
      "something that isn't a list",
      body([{ date: "2026-11-12" }]).slice(1, -1),
      /unexpected response/,
    ],
    ["something that isn't JSON", "<html>busy</html>", /not JSON/],
  ])("refuses %s", (_name, text, message) => {
    expect(() => parseRates(text, expected())).toThrow(FrankfurterError);
    expect(() => parseRates(text, expected())).toThrow(message);
  });

  it("accepts an empty answer (no publication in the window)", () => {
    expect(parseRates("[]", expected())).toEqual([]);
  });
});

describe("collectFrankfurter: one run", () => {
  it("asks for the last 10 days with the source pinned per currency", async () => {
    const store = new FakeStore();
    const { fetch, urls } = fakeFetch({
      EUR: () => new Response(rawBody([["2026-11-12", "1.0832"]])),
      EGP: () => new Response(rawBody([["2026-11-11", "64.5717"]], "CHF", "EGP")),
    });
    await collectFrankfurter(deps(store, [CHF_EUR, { source: "CHF", target: "EGP" }], fetch));

    expect(WINDOW_DAYS).toBe(10);
    expect(urls).toEqual([
      "https://api.frankfurter.dev/v2/rates?base=CHF&quotes=EUR&providers=ECB&from=2026-11-02&to=2026-11-12",
      "https://api.frankfurter.dev/v2/rates?base=CHF&quotes=EGP&providers=CBE&from=2026-11-02&to=2026-11-12",
    ]);
    expect([...store.rates.values()].map((r) => `${r.source} ${r.rate.toString()}`)).toEqual([
      "ecb 1 CHF = 1.0832 EUR",
      "cbe 1 CHF = 64.5717 EGP",
    ]);
  });

  it("stores the raw answer before reading it, and finishes the run as succeeded", async () => {
    const store = new FakeStore();
    const { fetch } = fakeFetch({ EUR: () => new Response(rawBody([["2026-11-12", "1.0832"]])) });
    const result = await collectFrankfurter(deps(store, [CHF_EUR], fetch));

    expect(store.events).toEqual(["start frankfurter", "raw 200", "rates 1", "finish ok"]);
    expect(store.raws[0]?.body).toBe(rawBody([["2026-11-12", "1.0832"]]));
    expect(result.errors).toEqual([]);
    expect(result.outcomes).toEqual([{ pair: CHF_EUR, source: "ecb", stored: 1, unchanged: 0 }]);
  });

  it("stores nothing twice when run again", async () => {
    const store = new FakeStore();
    const answer = rawBody([
      ["2026-11-11", "1.083"],
      ["2026-11-12", "1.0832"],
    ]);
    const { fetch } = fakeFetch({ EUR: () => new Response(answer) });
    await collectFrankfurter(deps(store, [CHF_EUR], fetch));
    const second = await collectFrankfurter(deps(store, [CHF_EUR], fetch));

    expect(second.outcomes[0]).toMatchObject({ stored: 0, unchanged: 2 });
    expect(second.errors).toEqual([]);
    expect(store.rates.size).toBe(2);
  });

  it("keeps a stored day whose rate changed, and fails the run saying so", async () => {
    const store = new FakeStore();
    const first = fakeFetch({ EUR: () => new Response(rawBody([["2026-11-12", "1.0832"]])) });
    await collectFrankfurter(deps(store, [CHF_EUR], first.fetch));
    const changed = fakeFetch({ EUR: () => new Response(rawBody([["2026-11-12", "1.0899"]])) });
    const result = await collectFrankfurter(deps(store, [CHF_EUR], changed.fetch));

    expect(result.errors).toEqual([
      "CHF→EUR: the ecb rate of 2026-11-12 changed from 1.0832 to 1.0899; stored values kept",
    ]);
    expect([...store.rates.values()][0]?.rate.value.toString()).toBe("1.0832");
    expect(store.runs.get(result.run)).toEqual({ finished: true, error: result.errors[0] });
  });

  it("stores the raw answer of a server error, and fails the run with the status", async () => {
    const store = new FakeStore();
    const { fetch } = fakeFetch({
      EUR: () => new Response("Service Unavailable", { status: 503 }),
    });
    const result = await collectFrankfurter(deps(store, [CHF_EUR], fetch));

    expect(store.events).toEqual(["start frankfurter", "raw 503", "finish failed"]);
    expect(store.raws[0]?.body).toBe("Service Unavailable");
    expect(result.errors).toEqual(["CHF→EUR: HTTP 503"]);
  });

  it("stores the raw answer of an invalid response, and stores no rates from it", async () => {
    const store = new FakeStore();
    const { fetch } = fakeFetch({
      EUR: () => new Response(rawBody([["2026-11-12", "1.08"]], "EUR", "CHF")),
    });
    const result = await collectFrankfurter(deps(store, [CHF_EUR], fetch));

    expect(store.events).toEqual(["start frankfurter", "raw 200", "finish failed"]);
    expect(store.rates.size).toBe(0);
    expect(result.errors[0]).toMatch(/^CHF→EUR: asked for CHF→EUR, got EUR→CHF/);
  });

  it("records a network failure, and still collects the other corridors", async () => {
    const store = new FakeStore();
    const { fetch } = fakeFetch({
      EUR: () => Promise.reject(new TypeError("fetch failed")),
      EGP: () => new Response(rawBody([["2026-11-11", "64.5717"]], "CHF", "EGP")),
    });
    const result = await collectFrankfurter(
      deps(store, [CHF_EUR, { source: "CHF", target: "EGP" }], fetch),
    );

    expect(result.errors).toEqual(["CHF→EUR: request failed: TypeError: fetch failed"]);
    expect(result.outcomes).toEqual([
      { pair: { source: "CHF", target: "EGP" }, source: "cbe", stored: 1, unchanged: 0 },
    ]);
    expect(store.events).toEqual(["start frankfurter", "raw 200", "rates 1", "finish failed"]);
  });

  it("records a connection that breaks while the answer arrives as that corridor's failure", async () => {
    const store = new FakeStore();
    const broken = {
      ok: true,
      status: 200,
      text: () => Promise.reject(new TypeError("terminated")),
    } as unknown as Response;
    const { fetch } = fakeFetch({ EUR: () => broken });
    const result = await collectFrankfurter(deps(store, [CHF_EUR], fetch));

    expect(result.errors).toEqual(["CHF→EUR: request failed: TypeError: terminated"]);
    expect(store.events).toEqual(["start frankfurter", "finish failed"]);
  });

  it("succeeds when nothing new was published (weekend, holiday)", async () => {
    const store = new FakeStore();
    const { fetch } = fakeFetch({ EUR: () => new Response("[]") });
    const result = await collectFrankfurter(deps(store, [CHF_EUR], fetch));

    expect(result.errors).toEqual([]);
    expect(result.outcomes[0]).toMatchObject({ stored: 0, unchanged: 0 });
  });

  it("fails a run when there are no corridors to collect", async () => {
    const store = new FakeStore();
    const result = await collectFrankfurter(deps(store, [], fakeFetch({}).fetch));
    expect(result.errors).toEqual(["no corridors to collect"]);
    expect(store.events).toEqual(["start frankfurter", "finish failed"]);
  });

  it("records an unexpected error (e.g. the database) on the run, then passes it on", async () => {
    const store = new FakeStore();
    store.saveMidRates = async () => {
      throw new Error("database is down");
    };
    const { fetch } = fakeFetch({ EUR: () => new Response(rawBody([["2026-11-12", "1.0832"]])) });

    await expect(collectFrankfurter(deps(store, [CHF_EUR], fetch))).rejects.toThrow(
      "database is down",
    );
    expect(store.runs.get(1n)).toEqual({
      finished: true,
      error: "unexpected: Error: database is down",
    });
  });
});
