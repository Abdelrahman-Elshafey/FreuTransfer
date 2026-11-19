// The API page (stage 7d-2, ADR 0014): what it shows, read from the API's own OpenAPI description
// (GET /v1/openapi.json), so nothing about the API is written twice. Pure: no fetching, no React.

/** The part of JSON Schema the API's description uses (z.toJSONSchema's output). */
export type JsonSchema = {
  readonly $ref?: string;
  readonly type?: string;
  readonly format?: string;
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly items?: JsonSchema;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly anyOf?: readonly JsonSchema[];
  readonly oneOf?: readonly JsonSchema[];
  readonly description?: string;
};

type Operation = {
  readonly summary?: string;
  readonly description?: string;
  readonly parameters?: readonly {
    readonly name: string;
    readonly required: boolean;
    readonly description?: string;
    readonly schema: JsonSchema;
  }[];
  readonly responses: Readonly<
    Record<
      string,
      {
        readonly description: string;
        readonly content?: Readonly<Record<string, { readonly schema: JsonSchema }>>;
      }
    >
  >;
};

/** The part of an OpenAPI 3.1 document the page reads. */
export type OpenApiDocument = {
  readonly info: {
    readonly title: string;
    readonly version: string;
    readonly description?: string;
  };
  readonly paths: Readonly<Record<string, Readonly<Record<string, Operation>>>>;
  readonly components: { readonly schemas: Readonly<Record<string, JsonSchema>> };
};

/** A type as shown: plain text, or the name of a data type (a link to it on the page). */
export type TypePart = { readonly text: string } | { readonly ref: string };

export type Field = {
  /** "amount", or "vsCheapest.extraCost" / "unavailable[].reason" for a field inside a field. */
  readonly name: string;
  readonly type: readonly TypePart[];
  readonly required: boolean;
  readonly description?: string;
};

export type Endpoint = {
  readonly method: string;
  readonly path: string;
  readonly summary?: string;
  readonly description?: string;
  readonly parameters: readonly Field[];
  readonly responses: readonly {
    readonly status: string;
    readonly description: string;
    readonly mediaType?: string;
    readonly type?: readonly TypePart[];
  }[];
};

export type DataType = {
  readonly name: string;
  readonly description?: string;
  /** One table, or one per alternative ("one of", e.g. a Caveat). */
  readonly variants: readonly {
    readonly description?: string;
    readonly fields: readonly Field[];
  }[];
};

const REF_PREFIX = "#/components/schemas/";
const separator = (text: string): TypePart => ({ text });

/** "string (date-time)", `"CHF" | "EUR"`, Money[], `object | null`, … */
function typeOf(schema: JsonSchema): TypePart[] {
  if (schema.$ref) return [{ ref: schema.$ref.replace(REF_PREFIX, "") }];
  const alternatives = schema.anyOf ?? schema.oneOf;
  if (alternatives) {
    return alternatives.flatMap((s, i) => (i === 0 ? typeOf(s) : [separator(" | "), ...typeOf(s)]));
  }
  if (schema.const !== undefined) return [{ text: JSON.stringify(schema.const) }];
  if (schema.enum) return [{ text: schema.enum.map((v) => JSON.stringify(v)).join(" | ") }];
  if (schema.type === "array" && schema.items) return [...typeOf(schema.items), { text: "[]" }];
  const type = schema.type ?? "any";
  return [{ text: schema.format ? `${type} (${schema.format})` : type }];
}

/** The object written in place inside a field, if any: the field itself, a nullable one, or a list of them. */
function inlineObject(schema: JsonSchema): { schema: JsonSchema; suffix: string } | null {
  if (schema.properties) return { schema, suffix: "" };
  const inList = schema.type === "array" ? schema.items : undefined;
  if (inList?.properties) return { schema: inList, suffix: "[]" };
  const nullable = (schema.anyOf ?? []).find((s) => s.properties);
  return nullable ? { schema: nullable, suffix: "" } : null;
}

/** An object's fields, and the fields of objects written in place inside them ("a.b"). */
export function fieldsOf(schema: JsonSchema, prefix = ""): Field[] {
  return Object.entries(schema.properties ?? {}).flatMap(([key, property]) => {
    const name = `${prefix}${key}`;
    const field: Field = {
      name,
      type: typeOf(property),
      required: schema.required?.includes(key) ?? false,
      ...(property.description === undefined ? {} : { description: property.description }),
    };
    const inner = inlineObject(property);
    return inner ? [field, ...fieldsOf(inner.schema, `${name}${inner.suffix}.`)] : [field];
  });
}

export function endpointsOf(doc: OpenApiDocument): Endpoint[] {
  return Object.entries(doc.paths).flatMap(([path, operations]) =>
    Object.entries(operations).map(([method, op]) => ({
      method: method.toUpperCase(),
      path,
      ...(op.summary === undefined ? {} : { summary: op.summary }),
      ...(op.description === undefined ? {} : { description: op.description }),
      parameters: (op.parameters ?? []).map((p) => ({
        name: p.name,
        type: typeOf(p.schema),
        required: p.required,
        ...(p.description === undefined ? {} : { description: p.description }),
      })),
      responses: Object.entries(op.responses).map(([status, response]) => {
        const [mediaType, body] = Object.entries(response.content ?? {})[0] ?? [];
        return {
          status,
          description: response.description,
          ...(mediaType === undefined || body === undefined
            ? {}
            : { mediaType, type: typeOf(body.schema) }),
        };
      }),
    })),
  );
}

export function dataTypesOf(doc: OpenApiDocument): DataType[] {
  return Object.entries(doc.components.schemas).map(([name, schema]) => ({
    name,
    ...(schema.description === undefined ? {} : { description: schema.description }),
    variants: schema.oneOf
      ? schema.oneOf.map((variant) => ({
          ...(variant.description === undefined ? {} : { description: variant.description }),
          fields: fieldsOf(variant),
        }))
      : [{ fields: fieldsOf(schema) }],
  }));
}
