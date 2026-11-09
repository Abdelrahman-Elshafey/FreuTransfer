import { describe, expect, it } from "vitest";
import { fetchComparison } from "./api.ts";

const respond = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe("fetchComparison", () => {
  it("asks for CHF → EUR with the amount as given", async () => {
    let url = "";
    const spy = (async (input: RequestInfo | URL) => {
      url = String(input);
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }) as typeof fetch;
    await fetchComparison("1000.50", spy);
    expect(url).toBe("/v1/compare?from=CHF&to=EUR&amount=1000.50");
  });

  it("returns the data on success", async () => {
    const outcome = await fetchComparison("1000", respond(200, { results: [{ rank: 1 }] }));
    expect(outcome.ok && outcome.data.results[0]?.rank).toBe(1);
  });

  it("turns an RFC 9457 problem into a readable message", async () => {
    const outcome = await fetchComparison(
      "0",
      respond(400, {
        title: "Invalid query",
        errors: [{ field: "amount", message: "must be greater than 0" }],
      }),
    );
    expect(outcome).toEqual({
      ok: false,
      message: "Invalid query. amount: must be greater than 0",
    });
  });

  it("explains a non-JSON error and an unreachable API", async () => {
    const html = (async () =>
      new Response("<h1>Bad gateway</h1>", { status: 502 })) as typeof fetch;
    expect(await fetchComparison("1", html)).toEqual({
      ok: false,
      message: "The API answered with HTTP 502.",
    });

    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect((await fetchComparison("1", down)).ok).toBe(false);

    expect(await fetchComparison("1", respond(500, null))).toEqual({
      ok: false,
      message: "The API answered with HTTP 500.",
    });
  });

  it("explains a 200 that isn't JSON (e.g. a proxy serving index.html) instead of throwing", async () => {
    const page = (async () => new Response("<!doctype html>", { status: 200 })) as typeof fetch;
    expect(await fetchComparison("1", page)).toEqual({
      ok: false,
      message: "The API answered with something that isn't JSON (HTTP 200).",
    });
  });
});
