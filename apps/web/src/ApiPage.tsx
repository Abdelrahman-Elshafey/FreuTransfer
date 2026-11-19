import { useEffect, useState } from "react";
import { fetchApiDescription } from "./api.ts";
import {
  type DataType,
  dataTypesOf,
  type Endpoint,
  endpointsOf,
  type Field,
  type OpenApiDocument,
  type TypePart,
} from "./api-docs.ts";
import { useI18n } from "./i18n/context.tsx";

// The API page (stage 7d-2, ADR 0014), made from GET /v1/openapi.json. The frame is in the reader's
// language; what comes from the description (summaries, field descriptions) is the API's English,
// marked lang="en" so screen readers read it as English.

const card = "rounded-3xl bg-card p-5 sm:p-6";
const th = "py-2 pr-4 text-left text-sm font-medium text-muted";
const td = "border-t border-line py-2 pr-4 align-top";
/** Descriptions hold long tag URIs (tag:aelshafey.com,2026:…): they may break anywhere on a phone. */
const prose = `${td} text-sm [overflow-wrap:anywhere]`;

/** English text from the description; `code` in backticks is shown as code. */
function English({ text }: { text: string }) {
  return (
    <span lang="en">
      {text.split("`").map((part, i) =>
        i % 2 === 1 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed text never move
          <code key={i} className="font-mono text-sm">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </span>
  );
}

/** A type: plain text, with the names of data types as links to them. */
function Type({ parts }: { parts: readonly TypePart[] }) {
  return (
    <code className="font-mono text-sm">
      {parts.map((part, i) =>
        "ref" in part ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one type never move
          <a key={i} href={`#type-${part.ref}`}>
            {part.ref}
          </a>
        ) : (
          part.text
        ),
      )}
    </code>
  );
}

/**
 * A table of fields from 768px up; below, each field is a block (name, type, description), since
 * three columns of code don't fit a phone.
 */
function Fields({ fields }: { fields: readonly Field[] }) {
  const { t } = useI18n();
  const stacked = "max-md:block max-md:border-0 max-md:py-0.5";
  return (
    <table className="mt-2 w-full">
      <thead className="max-md:hidden">
        <tr>
          <th className={th}>{t.apiPage.field}</th>
          <th className={th}>{t.apiPage.type}</th>
          <th className={th}>{t.apiPage.description}</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((f) => (
          <tr key={f.name} className="max-md:block max-md:border-t max-md:border-line max-md:py-2">
            <td className={`${td} ${stacked}`}>
              <span className="font-mono text-sm">{f.name}</span>
              <span className="text-xs text-muted max-md:ml-2 md:block">
                {f.required ? t.apiPage.required : t.apiPage.optional}
              </span>
            </td>
            <td className={`${td} ${stacked}`}>
              <Type parts={f.type} />
            </td>
            <td className={`${prose} ${stacked}`}>
              {f.description && <English text={f.description} />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EndpointCard({ endpoint: e }: { endpoint: Endpoint }) {
  const { t } = useI18n();
  return (
    <section className={`${card} mt-4`}>
      <h3 className="font-mono text-lg font-medium">
        <span className="mr-3 rounded-full bg-ink px-2.5 py-0.5 text-sm text-page">{e.method}</span>
        {e.path}
      </h3>
      {e.summary && (
        <p className="mt-2 font-medium">
          <English text={e.summary} />
        </p>
      )}
      {e.description && (
        <p className="mt-1 text-muted">
          <English text={e.description} />
        </p>
      )}
      {e.parameters.length > 0 && (
        <>
          <h4 className="mt-4 text-sm font-medium">{t.apiPage.parameters}</h4>
          <Fields fields={e.parameters} />
        </>
      )}
      <h4 className="mt-4 text-sm font-medium">{t.apiPage.answers}</h4>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>{t.apiPage.status}</th>
              <th className={th}>{t.apiPage.type}</th>
              <th className={th}>{t.apiPage.description}</th>
            </tr>
          </thead>
          <tbody>
            {e.responses.map((r) => (
              <tr key={r.status}>
                <td className={`${td} font-mono text-sm`}>{r.status}</td>
                <td className={td}>
                  {r.type && <Type parts={r.type} />}
                  {r.mediaType && r.mediaType !== "application/json" && (
                    <div className="font-mono text-xs break-all text-muted">{r.mediaType}</div>
                  )}
                </td>
                <td className={prose}>
                  <English text={r.description} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DataTypeCard({ type }: { type: DataType }) {
  const { t } = useI18n();
  return (
    <section id={`type-${type.name}`} className={`${card} mt-4 scroll-mt-4`}>
      <h3 className="font-mono text-lg font-medium">{type.name}</h3>
      {type.description && (
        <p className="mt-1 text-muted">
          <English text={type.description} />
        </p>
      )}
      {type.variants.length > 1 && <p className="mt-3 text-sm">{t.apiPage.oneOf}</p>}
      {type.variants.map((v, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a type's alternatives are fixed
        <div key={i} className="mt-2">
          {v.description && (
            <p className="text-sm text-muted">
              <English text={v.description} />
            </p>
          )}
          <Fields fields={v.fields} />
        </div>
      ))}
    </section>
  );
}

export function ApiPage() {
  const { t } = useI18n();
  const [doc, setDoc] = useState<OpenApiDocument | "failed" | null>(null);

  useEffect(() => {
    let shown = true;
    void fetchApiDescription().then((outcome) => {
      if (shown) setDoc(outcome.ok ? outcome.data : "failed");
    });
    return () => {
      shown = false;
    };
  }, []);

  const heading = "mt-10 text-2xl font-medium tracking-tight";
  return (
    <article>
      <h1 className="mt-6 text-4xl leading-tight font-normal tracking-tight sm:mt-12 sm:text-5xl">
        {t.apiPage.title}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        {t.apiPage.intro}{" "}
        <a href="/v1/openapi.json" className="font-mono">
          /v1/openapi.json
        </a>
      </p>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t.apiPage.english}</p>
      {doc === null && <p className="mt-8">{t.apiPage.loading}</p>}
      {doc === "failed" && (
        <p className="mt-8 text-danger" role="alert">
          {t.apiPage.unavailable}
        </p>
      )}
      {doc !== null && doc !== "failed" && (
        <>
          {doc.info.description && (
            <p className="mt-6 max-w-2xl">
              <English text={doc.info.description} />
            </p>
          )}
          <h2 className={heading}>{t.apiPage.endpoints}</h2>
          {endpointsOf(doc).map((e) => (
            <EndpointCard key={`${e.method} ${e.path}`} endpoint={e} />
          ))}
          <h2 className={heading}>{t.apiPage.dataTypes}</h2>
          {dataTypesOf(doc).map((type) => (
            <DataTypeCard key={type.name} type={type} />
          ))}
        </>
      )}
    </article>
  );
}
