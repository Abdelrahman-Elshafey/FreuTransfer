# ADR 0014: The OpenAPI description is generated from the Zod schemas

- **Status:** accepted (owner, 2026-11-18: response shapes as Zod schemas; built in stage 7d-1)
- **Date:** 2026-11-19

## Context
ADR 0001 promised "OpenAPI generated from the Zod schemas", but only the queries were Zod schemas:
the responses were plain TypeScript types in `apps/api/src/contract.ts`, which the page imports.
A hand-written OpenAPI file would be a second copy of every shape (CLAUDE.md rule 5).

## Decision
- **Responses are Zod schemas** in `apps/api/src/schemas.ts`, with developer descriptions in
  `.meta()`. `contract.ts` derives the types from them (`z.infer`) with **type-only imports**, so
  the page's bundle gets no Zod (checked: no Zod in the built page, size unchanged; a test fails if
  `contract.ts` gains a runtime import).
- **The document** (`apps/api/src/openapi.ts`) is OpenAPI 3.1, built with Zod 4's own
  `z.toJSONSchema` (no extra dependency): named schemas from a registry become
  `#/components/schemas/*`; the query parameters come from the handlers' own query schemas (their
  input side). Served at **GET `/v1/openapi.json`** (built once per app, under nginx's request limit).
- **Tests:** every kind of real answer (ranked, manual, stale and unavailable rows, both caveats,
  each problem, health) parses to exactly itself, so an undocumented or missing field fails
  (`app.test.ts`); the document lists every route and error, its references resolve, money is a
  string (`openapi.test.ts`).
- The supported currencies come from core (`CURRENCY_CODES`), for the response enum and the
  parameters alike.
- Descriptions are **English, for developers** (like a problem's `title`): the API still sends the
  page codes, money and dates only (ADR 0005).

## Alternatives considered
- **A hand-written `openapi.yaml`:** a second copy of every shape, with nothing keeping it equal.
- **`zod-openapi` / `@asteasolutions/zod-to-openapi`:** more features (route registries, examples),
  but a dependency for what `z.toJSONSchema` plus 100 lines already do.
- **Schemas in `contract.ts` itself:** the page would import Zod at runtime (the schemas are built
  when the module loads), downloaded by every visitor for nothing.

## Consequences
- Changing a response means changing its schema; the types, the document and the tests follow.
- Zod's input view of a transformed query field is only "string": the allowed currencies and the
  amount's pattern are added with `.meta()`, from the same constants the validation uses.
- A viewer page for the document is stage 7d-2.
