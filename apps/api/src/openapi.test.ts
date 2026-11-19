import { readFileSync } from "node:fs";
import { CURRENCY_CODES } from "@freu-transfer/core";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { openApiDocument } from "./openapi.ts";

// Rules for /v1/openapi.json (7d): every endpoint with its parameters and answers; every
// reference resolves; the parameters are the handlers' own; money is a string; served by the API.
// That the response schemas equal what the API really sends: app.test.ts.

const doc = openApiDocument();
const app = createApp({
  offers: { latestOffers: async () => [] },
  midRates: { latest: async () => null },
  history: { between: async () => [] },
  now: () => new Date("2026-11-19T12:00:00Z"),
});

/** Every `$ref` anywhere in a value. */
const refs = (value: unknown): string[] =>
  value === null || typeof value !== "object"
    ? []
    : Object.entries(value).flatMap(([key, v]) =>
        key === "$ref" && typeof v === "string" ? [v] : refs(v),
      );

type Parameter = { name: string; required: boolean; schema: { enum?: string[] } };
const parameters = (path: keyof typeof doc.paths) =>
  Object.fromEntries(
    ("parameters" in doc.paths[path].get
      ? (doc.paths[path].get.parameters as Parameter[])
      : []
    ).map((p) => [p.name, p]),
  );

describe("OpenAPI description", () => {
  it("is served by the API as OpenAPI 3.1", async () => {
    const res = await request(app).get("/v1/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    // What a client receives is the document, nothing lost on the way to JSON.
    expect(res.body).toEqual(JSON.parse(JSON.stringify(doc)));
  });

  it("describes every route the API answers", () => {
    // The routes registered in app.ts, compare-route.ts and history-route.ts.
    expect(Object.keys(doc.paths).sort()).toEqual(
      ["/health", "/v1/compare", "/v1/history", "/v1/openapi.json"].sort(),
    );
  });

  it("resolves every reference to a named schema", () => {
    const all = refs(doc);
    expect(all.length).toBeGreaterThan(10);
    for (const ref of all) {
      const id = ref.replace("#/components/schemas/", "");
      expect(doc.components.schemas, ref).toHaveProperty(id);
    }
  });

  it("takes the query parameters from the handlers' own schemas", () => {
    const compare = parameters("/v1/compare");
    expect(Object.keys(compare).sort()).toEqual(["amount", "from", "to"]);
    for (const name of ["from", "to", "amount"]) expect(compare[name]?.required, name).toBe(true);
    expect(compare.from?.schema.enum).toEqual(CURRENCY_CODES);
    const history = parameters("/v1/history");
    expect(Object.keys(history).sort()).toEqual(["days", "from", "to"]);
    expect(history.days?.required).toBe(false);
  });

  it("documents the errors each endpoint can answer", () => {
    const codes = (path: keyof typeof doc.paths) =>
      Object.keys(doc.paths[path].get.responses).sort();
    expect(codes("/v1/compare")).toEqual(["200", "400", "404", "429", "500"]);
    expect(codes("/v1/history")).toEqual(["200", "400", "429", "500"]);
  });

  it("describes money as strings, never numbers", () => {
    const money = doc.components.schemas.Money as unknown as {
      properties: { amount: { type: string } };
    };
    expect(money.properties.amount.type).toBe("string");
    expect(JSON.stringify(doc.components.schemas)).not.toContain('"type":"number"');
  });

  it("keeps contract.ts free of runtime imports, so the page's bundle gets no Zod", () => {
    const source = readFileSync(new URL("contract.ts", import.meta.url), "utf8");
    const imports = source.match(/^import .*$/gm) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) expect(line).toMatch(/^import type /);
  });
});
