/**
 * The OpenAPI 3.1 description of the API (ADR 0001: generated from the Zod schemas), served at
 * GET /v1/openapi.json. Nothing in it is written twice: the responses come from schemas.ts, the
 * query parameters from the same schemas the handlers validate with.
 */
import { z } from "zod";
import { compareQuery } from "./compare-route.ts";
import { PROBLEM_TYPES } from "./contract.ts";
import { historyQuery } from "./history-route.ts";
import { components, healthSchema } from "./schemas.ts";

const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });

/** A query schema as OpenAPI parameters, from its input side (what a client sends). */
function queryParameters(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { io: "input" }) as {
    properties?: Record<string, { description?: string }>;
    required?: string[];
  };
  return Object.entries(json.properties ?? {}).map(([name, { description, ...rest }]) => ({
    name,
    in: "query",
    required: json.required?.includes(name) ?? false,
    ...(description === undefined ? {} : { description }),
    schema: rest,
  }));
}

/** A schema written in place (not named in components), without its own `$schema` line. */
function inline(schema: z.ZodType) {
  const { $schema: _, ...rest } = z.toJSONSchema(schema);
  return rest;
}

/**
 * The named schemas for `components.schemas`. Without the `$schema` and `$id` that
 * z.toJSONSchema gives each: the document already says which JSON Schema it uses, and an `$id`
 * that is only a fragment ("#/components/schemas/Money") is not allowed in JSON Schema 2020-12.
 */
function namedSchemas() {
  const { schemas } = z.toJSONSchema(components, { uri: (id) => ref(id).$ref });
  return Object.fromEntries(
    Object.entries(schemas).map(([id, { $schema: _, $id: __, ...rest }]) => [id, rest]),
  );
}

const json = (schema: object) => ({ "application/json": { schema } });
const problem = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: ref("Problem") } },
});

/** Answers every /v1 endpoint can give besides its own. */
const commonProblems = {
  "400": problem(
    `The query is invalid (type ${PROBLEM_TYPES.invalidQuery}); \`errors\` lists every field.`,
  ),
  "429": problem("More than 10 requests a second from one visitor (bursts of 20)."),
  "500": problem("An unexpected error; no details are given."),
};

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "FreuTransfer API",
      version: "1",
      description:
        "What really arrives when sending money between Switzerland and the euro area (CHF→EUR, EUR→CHF), and how much is hidden in the exchange rate. Money and rates are strings, never JSON numbers; reasons and caveats are codes, never sentences. Estimates for information only, not financial advice.",
    },
    paths: {
      "/v1/compare": {
        get: {
          summary: "Compare every provider for one amount",
          description:
            "`from` and `to` must differ. The total cost is what was paid minus what arrives valued at the reference rate; the hidden part is the total cost minus the visible fee.",
          parameters: queryParameters(compareQuery),
          responses: {
            "200": { description: "The comparison.", content: json(ref("Comparison")) },
            "404": problem(
              `No reference rate is stored for this direction (type ${PROBLEM_TYPES.corridorNotAvailable}).`,
            ),
            ...commonProblems,
          },
        },
      },
      "/v1/history": {
        get: {
          summary: "The reference rate over time",
          description: "`from` and `to` must differ.",
          parameters: queryParameters(historyQuery),
          responses: {
            "200": { description: "The reference rates.", content: json(ref("History")) },
            ...commonProblems,
          },
        },
      },
      "/v1/openapi.json": {
        get: {
          summary: "This description",
          responses: {
            "200": { description: "OpenAPI 3.1.", content: json({ type: "object" }) },
            "429": commonProblems["429"],
          },
        },
      },
      "/health": {
        get: {
          summary: "Whether the API is running",
          responses: {
            "200": { description: "Running.", content: json(inline(healthSchema)) },
          },
        },
      },
    },
    components: {
      schemas: namedSchemas(),
    },
  };
}
