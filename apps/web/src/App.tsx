import type { ComparisonDto, ResultRowDto } from "@freu-transfer/api/contract";
import { type FormEvent, useState } from "react";
import { type CompareError, DIRECTIONS, fetchComparison } from "./api.ts";
import { useI18n } from "./i18n/context.tsx";
import type { Messages } from "./i18n/en.ts";
import { parseAmount } from "./i18n/format.ts";
import { LOCALE_CODES, type Locale, localeInfo } from "./i18n/locales.ts";
import { cheapestIds } from "./results.ts";

// Design: docs/adr/0011 and docs/design-inspiration.md §7 (tokens in styles.css).
// Every visible word comes from the catalogs in ./i18n (docs/adr/0005).

/** Errors are kept as codes, so switching the language also translates a message already shown. */
type PageError = CompareError | { readonly kind: "invalidAmount" };

type Row = ResultRowDto & { readonly rank?: number };

function errorText(t: Messages, error: PageError, example: string): string {
  switch (error.kind) {
    case "invalidAmount":
      return t.form.invalidAmount(example);
    case "unreachable":
      return t.errors.unreachable;
    case "notJson":
      return t.errors.notJson(error.status);
    case "http":
      return t.errors.http(error.status);
    case "invalidQuery":
      return t.errors.invalidQuery;
    case "corridorNotAvailable":
      return t.errors.corridorNotAvailable;
  }
}

/** The publisher's name in the reader's language; an unknown source shows as its code. */
function bankName(t: Messages, source: string): string {
  return Object.hasOwn(t.rateSources, source)
    ? t.rateSources[source as keyof Messages["rateSources"]]
    : source.toUpperCase();
}

const card = "rounded-3xl bg-card p-5 sm:p-6";
const note = "text-sm text-muted";

/** A small label in brackets, "(Fee)" (docs/design-inspiration.md §7). Brackets in every language. */
function Label({ children }: { children: string }) {
  return <span className="font-mono text-xs text-muted">({children})</span>;
}

/** The one accent on the page: lime behind dark text, never lime text (ADR 0011). */
function CheapestBadge() {
  const { t } = useI18n();
  return (
    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-accent-ink">
      {t.results.cheapest}
    </span>
  );
}

type ListProps = {
  readonly rows: readonly Row[];
  readonly ranked: boolean;
  /** Providers that get the badge: the cheapest ranked rows (cheapestIds), none for stale ones. */
  readonly cheapest: ReadonlySet<string>;
};

/** Where a row's price comes from and when it was checked: the same in the table and the cards. */
function Source({ row }: { row: Row }) {
  const { t, f } = useI18n();
  return (
    <div className={note}>
      <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="font-mono text-xs">
        (
        {row.sourceKind === "rule_based"
          ? t.source.ruleBased
          : row.approximate
            ? t.source.manualApproximate
            : t.source.manual}
        )
      </a>
      <div>{t.source.checked(f.instant(row.checkedAt), f.ago(row.checkedAt, new Date()))}</div>
      {row.measuredAgainst && (
        <div>
          {t.source.measuredAgainst(
            f.decimal(row.measuredAgainst.rate),
            bankName(t, row.measuredAgainst.source),
            f.day(row.measuredAgainst.asOf),
          )}
        </div>
      )}
    </div>
  );
}

/** From 768px up: one table, the amounts in aligned columns. */
function ResultsTable({ rows, ranked, cheapest }: ListProps) {
  const { t, f } = useI18n();
  const th = "px-4 py-3 text-left text-sm font-medium text-muted";
  const td = "border-t border-line px-4 py-4 align-top";
  const num = "text-right tabular-nums whitespace-nowrap";
  return (
    // The wrapper rounds the corners: a table with collapsed borders can't.
    <div className="hidden overflow-hidden rounded-3xl bg-card md:block">
      <table className="w-full">
        <thead>
          <tr>
            {ranked && <th className={th}>{t.table.rank}</th>}
            <th className={th}>{t.table.provider}</th>
            <th className={`${th} text-right`}>{t.table.arrives}</th>
            <th className={`${th} text-right`}>{t.table.fee}</th>
            <th className={`${th} text-right`}>{t.table.hidden}</th>
            <th className={`${th} text-right`}>{t.table.totalCost}</th>
            <th className={th}>{t.table.source}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.providerId}>
              {ranked && <td className={`${td} tabular-nums`}>{r.rank}</td>}
              <td className={td}>
                <div className="font-medium">{r.providerName}</div>
                {cheapest.has(r.providerId) && (
                  <div className="mt-1">
                    <CheapestBadge />
                  </div>
                )}
              </td>
              <td className={`${td} ${num} text-lg font-semibold`}>{f.money(r.received)}</td>
              <td className={`${td} ${num}`}>{f.money(r.visibleFee)}</td>
              <td className={`${td} ${num}`}>{f.money(r.fxMarkup)}</td>
              <td className={`${td} ${num}`}>
                {f.money(r.totalCost)}
                <div className={note}>{f.percent(r.totalCostPercent)}</div>
              </td>
              <td className={td}>
                <Source row={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Below 768px: one card per provider, what arrives as the biggest number. */
function ResultCards({ rows, ranked, cheapest }: ListProps) {
  const { t, f } = useI18n();
  return (
    <ol className="space-y-3 md:hidden">
      {rows.map((r) => (
        <li key={r.providerId} className={card}>
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">
              {ranked && <span className="mr-2 text-muted tabular-nums">{r.rank}</span>}
              {r.providerName}
            </span>
            {cheapest.has(r.providerId) && <CheapestBadge />}
          </div>
          <div className="mt-2">
            <Label>{t.table.arrives}</Label>
          </div>
          <div className="text-3xl font-semibold tracking-tight tabular-nums">
            {f.money(r.received)}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-x-2 gap-y-1 text-sm">
            {(
              [
                [t.table.fee, r.visibleFee, null],
                [t.table.hidden, r.fxMarkup, null],
                [t.table.totalCost, r.totalCost, r.totalCostPercent],
              ] as const
            ).map(([label, value, percent]) => (
              // One shared label row (subgrid): a label that wraps doesn't push its amount down.
              <div key={label} className="row-span-2 grid grid-rows-subgrid">
                <dt>
                  <Label>{label}</Label>
                </dt>
                <dd className="tabular-nums">
                  {f.money(value)}
                  {percent && <div className="text-muted">{f.percent(percent)}</div>}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 border-t border-line pt-3">
            <Source row={r} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function ResultList(props: ListProps) {
  return (
    <>
      <ResultsTable {...props} />
      <ResultCards {...props} />
    </>
  );
}

function Results({ data }: { data: ComparisonDto }) {
  const { t, f } = useI18n();
  const heading = "mt-10 mb-3 text-xl font-medium tracking-tight";
  return (
    <section className="mt-8">
      {data.midRateTooOld && (
        <p
          className="mb-4 rounded-lg border-l-4 border-warn-line bg-warn-bg px-4 py-3 text-warn-ink"
          role="alert"
        >
          {t.results.midRateTooOld({ day: f.day(data.midRate.asOf), days: data.midRateMaxAgeDays })}
        </p>
      )}
      <p className={`${note} mb-4`}>
        {t.results.midRate({
          from: data.from,
          to: data.to,
          rate: f.decimal(data.midRate.rate),
          bank: bankName(t, data.midRate.source),
          day: f.day(data.midRate.asOf),
        })}
      </p>
      {data.results.length > 0 ? (
        <ResultList rows={data.results} ranked cheapest={cheapestIds(data.results)} />
      ) : (
        <p className={card}>{t.results.none}</p>
      )}
      {data.stale.length > 0 && (
        <>
          <h2 className={heading}>{t.results.staleHeading(data.recheckDays)}</h2>
          <ResultList rows={data.stale} ranked={false} cheapest={new Set()} />
        </>
      )}
      {data.unavailable.length > 0 && (
        <>
          <h2 className={heading}>{t.results.unavailableHeading}</h2>
          <ul className={`${card} space-y-1`}>
            {data.unavailable.map((u) => (
              <li key={u.providerId}>
                <span className="font-medium">{u.providerName}</span>
                <span className="text-muted">: {t.unavailable[u.reason]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

const field = "rounded-lg border border-line bg-card px-3 py-2.5";

function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {t.language}
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className={`${field} py-1.5 text-ink`}
      >
        {LOCALE_CODES.map((code) => (
          // The language's own name, so readers find theirs whatever is selected now.
          <option key={code} value={code} lang={code}>
            {localeInfo(code).name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function App() {
  const { t, f } = useI18n();
  const [directionIndex, setDirectionIndex] = useState(0);
  const direction = DIRECTIONS[directionIndex] ?? DIRECTIONS[0];
  const [amount, setAmount] = useState("1000");
  const [data, setData] = useState<ComparisonDto | null>(null);
  const [error, setError] = useState<PageError | null>(null);
  const [loading, setLoading] = useState(false);

  async function compare(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (parsed === null) {
      setData(null);
      setError({ kind: "invalidAmount" });
      return;
    }
    setLoading(true);
    try {
      const outcome = await fetchComparison(direction, parsed);
      setData(outcome.ok ? outcome.data : null);
      setError(outcome.ok ? null : outcome.error);
    } finally {
      setLoading(false); // also after an unexpected error, so the button never stays disabled
    }
  }

  const label = "flex flex-col gap-1.5 text-sm text-muted";
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between gap-4 py-5">
        <span className="text-lg font-semibold tracking-tight">FreuTransfer</span>
        <LanguageSwitcher />
      </header>

      <main>
        <h1 className="mt-6 max-w-3xl text-4xl leading-tight font-normal tracking-tight sm:mt-12 sm:text-6xl">
          {t.headline}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">{t.intro}</p>

        <form
          onSubmit={compare}
          className={`${card} mt-8 flex flex-col gap-4 sm:flex-row sm:items-end`}
        >
          <label className={label}>
            {t.form.direction}
            <select
              value={directionIndex}
              disabled={loading} // an answer still on its way is for the direction it asked
              onChange={(e) => {
                setDirectionIndex(Number(e.target.value));
                setData(null); // results of the other direction must not stay under the new choice
              }}
              className={`${field} text-ink`}
            >
              {DIRECTIONS.map((d, i) => (
                <option key={`${d.from}-${d.to}`} value={i}>
                  {d.from} → {d.to}
                </option>
              ))}
            </select>
          </label>
          <label className={`${label} sm:flex-1`}>
            {t.form.iPay}
            <span
              className={`${field} flex items-center gap-2 text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink`}
            >
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                aria-label={t.form.amountLabel(direction.from)}
                className="w-full min-w-0 bg-transparent text-lg tabular-nums outline-none"
              />
              <span className="text-muted">{direction.from}</span>
            </span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-full bg-ink px-8 font-medium text-page transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? t.form.comparing : t.form.compare}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-danger" role="alert">
            {errorText(t, error, f.decimal("1000.50"))}
          </p>
        )}
        {data && <Results data={data} />}
      </main>

      <footer className={`${note} mt-16`}>{t.disclaimer}</footer>
    </div>
  );
}
