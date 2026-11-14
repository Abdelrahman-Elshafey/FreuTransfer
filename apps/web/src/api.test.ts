import { PROBLEM_TYPES } from "@freu-transfer/api/contract";
import { describe, expect, it } from "vitest";
import { DIRECTIONS, fetchComparison } from "./api.ts";

const respond = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

const [CHF_EUR, EUR_CHF] = DIRECTIONS;

describe("DIRECTIONS", () => {
  it("offers exactly the two v1 corridors, CHF → EUR first (the default; ADR 0008)", () => {
    expect(DIRECTIONS).toEqual([
      { from: "CHF", to: "EUR" },
      { from: "EUR", to: "CHF" },
    ]);
  });
});

describe("fetchComparison", () => {
  it("asks for the chosen direction with the amount as given", async () => {
    const urls: string[] = [];
    const spy = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }) as typeof fetch;
    await fetchComparison(CHF_EUR, "1000.50", spy);
    await fetchComparison(EUR_CHF, "250", spy);
    expect(urls).toEqual([
      "/v1/compare?from=CHF&to=EUR&amount=1000.50",
      "/v1/compare?from=EUR&to=CHF&amount=250",
    ]);
  });

  it("returns the data on success", async () => {
    const outcome = await fetchComparison(
      CHF_EUR,
      "1000",
      respond(200, { results: [{ rank: 1 }] }),
    );
    expect(outcome.ok && outcome.data.results[0]?.rank).toBe(1);
  });

  it("recognises the API's problem types, not its English titles", async () => {
    const invalid = respond(400, { type: PROBLEM_TYPES.invalidQuery, title: "Invalid query" });
    expect(await fetchComparison(CHF_EUR, "0", invalid)).toEqual({
      ok: false,
      error: { kind: "invalidQuery" },
    });
    const noRate = respond(404, { type: PROBLEM_TYPES.corridorNotAvailable, title: "x" });
    expect(await fetchComparison(CHF_EUR, "1", noRate)).toEqual({
      ok: false,
      error: { kind: "corridorNotAvailable" },
    });
  });

  it("reports any other problem by its HTTP status", async () => {
    const notFound = respond(404, { type: "about:blank", title: "Not Found", status: 404 });
    expect(await fetchComparison(CHF_EUR, "1", notFound)).toEqual({
      ok: false,
      error: { kind: "http", status: 404 },
    });
    expect(await fetchComparison(CHF_EUR, "1", respond(500, null))).toEqual({
      ok: false,
      error: { kind: "http", status: 500 },
    });
  });

  it("explains a non-JSON error and an unreachable API", async () => {
    const html = (async () =>
      new Response("<h1>Bad gateway</h1>", { status: 502 })) as typeof fetch;
    expect(await fetchComparison(CHF_EUR, "1", html)).toEqual({
      ok: false,
      error: { kind: "http", status: 502 },
    });

    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect(await fetchComparison(CHF_EUR, "1", down)).toEqual({
      ok: false,
      error: { kind: "unreachable" },
    });
  });

  it("explains a 200 that isn't JSON (e.g. a proxy serving index.html) instead of throwing", async () => {
    const page = (async () => new Response("<!doctype html>", { status: 200 })) as typeof fetch;
    expect(await fetchComparison(CHF_EUR, "1", page)).toEqual({
      ok: false,
      error: { kind: "notJson", status: 200 },
    });
  });
});
