import { describe, expect, it } from "vitest";
import { openApiDocument } from "../../api/src/openapi.ts";
import {
  dataTypesOf,
  endpointsOf,
  fieldsOf,
  type OpenApiDocument,
  type TypePart,
} from "./api-docs.ts";

// The API's real description (what /v1/openapi.json serves), so the page is tested against what it
// will read, not against a hand-made copy.
const doc = JSON.parse(JSON.stringify(openApiDocument())) as OpenApiDocument;

const label = (parts: readonly TypePart[]) =>
  parts.map((p) => ("ref" in p ? `<${p.ref}>` : p.text)).join("");

describe("API page: reading the description", () => {
  it("lists every endpoint with its method", () => {
    expect(endpointsOf(doc).map((e) => `${e.method} ${e.path}`)).toEqual(
      Object.keys(doc.paths).map((path) => `GET ${path}`),
    );
  });

  it("shows a parameter's allowed values, whether it is required, and its description", () => {
    const compare = endpointsOf(doc).find((e) => e.path === "/v1/compare");
    const from = compare?.parameters.find((p) => p.name === "from");
    expect(from && label(from.type)).toBe('"CHF" | "EUR"');
    expect(from?.required).toBe(true);
    expect(from?.description).toMatch(/case-insensitive/);
    const days = endpointsOf(doc)
      .find((e) => e.path === "/v1/history")
      ?.parameters.find((p) => p.name === "days");
    expect(days?.required).toBe(false);
  });

  it("names each answer's data type, and problems by their media type", () => {
    const responses = endpointsOf(doc).find((e) => e.path === "/v1/compare")?.responses ?? [];
    const byStatus = Object.fromEntries(responses.map((r) => [r.status, r]));
    expect(byStatus["200"]?.type && label(byStatus["200"].type)).toBe("<Comparison>");
    expect(byStatus["404"]).toMatchObject({ mediaType: "application/problem+json" });
    expect(Object.keys(byStatus).sort()).toEqual(["200", "400", "404", "429", "500"]);
  });

  it("lists every named data type, a union as one table per alternative", () => {
    const types = dataTypesOf(doc);
    expect(types.map((t) => t.name)).toEqual(Object.keys(doc.components.schemas));
    const caveat = types.find((t) => t.name === "Caveat");
    expect(caveat?.variants.map((v) => v.fields.map((f) => `${f.name}: ${label(f.type)}`))).toEqual(
      [
        ['code: "monthly_allowance"', "allowance: <Money>"],
        ['code: "amount_limit"', "max: <Money>"],
      ],
    );
  });

  it("shows the fields of an object written in place, nullable or in a list, with a path", () => {
    const fields = (name: string) =>
      Object.fromEntries(
        (dataTypesOf(doc).find((t) => t.name === name)?.variants[0]?.fields ?? []).map((f) => [
          f.name,
          label(f.type),
        ]),
      );
    const row = fields("ResultRow");
    expect(row.vsCheapest).toBe("object | null");
    expect(row["vsCheapest.extraCost"]).toBe("<Money>");
    expect(row.measuredAgainst).toBe("<MidRate> | null");
    expect(row.checkedAt).toBe("string (date-time)");
    expect(fields("Comparison")["unavailable[].reason"]).toBe(
      '"no_reference_rate" | "amount_not_supported" | "implausible_cost"',
    );
    expect(fields("Comparison").results).toBe("<RankedRow>[]");
  });

  it("marks which fields are required", () => {
    const fields = fieldsOf({
      properties: { a: { type: "string" }, b: { type: "string" } },
      required: ["a"],
    });
    expect(fields.map((f) => [f.name, f.required])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });
});
