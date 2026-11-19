import type {
  CaveatDto,
  ComparisonDto,
  HistoryDto,
  ResultRowDto,
} from "@freu-transfer/api/contract";
import { type FormEvent, useEffect, useState } from "react";
import { ApiPage } from "./ApiPage.tsx";
import {
  type ApiError,
  DIRECTIONS,
  fetchComparison,
  fetchComparisons,
  fetchHistory,
} from "./api.ts";
import { CostChart } from "./CostChart.tsx";
import { CHART_AMOUNTS } from "./chart-data.ts";
import { bankName } from "./i18n/bank.ts";
import { useI18n } from "./i18n/context.tsx";
import type { Messages } from "./i18n/en.ts";
import { type Formatter, parseAmount } from "./i18n/format.ts";
import { LOCALE_CODES, type Locale, localeInfo } from "./i18n/locales.ts";
import { PAGES } from "./i18n/pages/index.ts";
import type { LegalValues, MethodologyValues } from "./i18n/pages/types.ts";
import { METHODOLOGY } from "./methodology-values.ts";
import { PAGE_IDS, pageFromPath, pagePath } from "./pages.ts";
import { RateChart } from "./RateChart.tsx";
import { cheapestIds } from "./results.ts";
import { Link, usePathname } from "./router.tsx";
import { HOSTING_REGION, OPERATOR, SOURCE_URL } from "./site.ts";
import { readSaved, save } from "./storage.ts";
import { TextPage } from "./TextPage.tsx";

// Design: docs/adr/0011 and docs/design-inspiration.md §7 (tokens in styles.css).
// Every visible word comes from the catalogs in ./i18n (docs/adr/0005).

/** Errors are kept as codes, so switching the language also translates a message already shown. */
type PageError = ApiError | { readonly kind: "invalidAmount" };

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

function caveatText(t: Messages, f: Formatter, caveat: CaveatDto): string {
  switch (caveat.code) {
    case "monthly_allowance":
      return t.caveats.monthly_allowance(f.money(caveat.allowance));
    case "amount_limit":
      return t.caveats.amount_limit(f.money(caveat.max));
  }
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
      {row.caveats.length > 0 && (
        <ul className="mt-2 space-y-1 text-ink">
          {row.caveats.map((c) => (
            <li key={c.code}>{caveatText(t, f, c)}</li>
          ))}
        </ul>
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

const MY_PROVIDER_KEY = "freu-transfer.my-provider";

/**
 * "Am I overpaying with my bank?" (Project Plan §1): the reader picks their provider and sees what
 * it costs more than the cheapest. The API computes the amounts (`vsCheapest`); the choice is
 * remembered in the browser for the next visit.
 */
function MyProvider({ ranked }: { ranked: ComparisonDto["results"] }) {
  const { t, f } = useI18n();
  const [mine, setMine] = useState(() => readSaved(MY_PROVIDER_KEY) ?? "");
  const row = ranked.find((r) => r.providerId === mine);
  const best = ranked[0];
  let sentence: string | null = null;
  if (row?.vsCheapest && best) {
    sentence = cheapestIds(ranked).has(row.providerId)
      ? t.myProvider.cheapest(row.providerName)
      : t.myProvider.difference({
          mine: row.providerName,
          best: best.providerName,
          extraCost: f.money(row.vsCheapest.extraCost),
          lessReceived: f.money(row.vsCheapest.lessReceived),
          perYear: f.money(row.vsCheapest.extraCostPerYear),
        });
  }
  return (
    <div className={`${card} mb-4 flex flex-col gap-3 sm:flex-row sm:items-center`}>
      <label className="flex shrink-0 flex-col gap-1.5 text-sm text-muted">
        {t.myProvider.label}
        <select
          value={row ? mine : ""}
          onChange={(e) => {
            setMine(e.target.value);
            save(MY_PROVIDER_KEY, e.target.value);
          }}
          className={`${field} text-ink`}
        >
          <option value="">{t.myProvider.choose}</option>
          {ranked.map((r) => (
            <option key={r.providerId} value={r.providerId}>
              {r.providerName}
            </option>
          ))}
        </select>
      </label>
      {sentence && (
        <p className="text-lg" aria-live="polite">
          {sentence}
        </p>
      )}
    </div>
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
      {data.results.length > 1 && <MyProvider ranked={data.results} />}
      {data.results.length > 0 ? (
        <ResultList rows={data.results} ranked cheapest={cheapestIds(data.results)} />
      ) : (
        <p className={card}>{t.results.none}</p>
      )}
      <p className={`${note} mt-4`}>{t.results.notIncluded}</p>
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

/** The comparison: the form, the results and the charts (the home page). */
function ComparePage() {
  const { t, f } = useI18n();
  const [directionIndex, setDirectionIndex] = useState(0);
  const direction = DIRECTIONS[directionIndex] ?? DIRECTIONS[0];
  const [amount, setAmount] = useState("1000");
  const [data, setData] = useState<ComparisonDto | null>(null);
  const [error, setError] = useState<PageError | null>(null);
  const [loading, setLoading] = useState(false);
  /** The "cost by amount" chart: comparisons at CHART_AMOUNTS, or "failed" (shown as a note). */
  const [chart, setChart] = useState<readonly ComparisonDto[] | "failed" | null>(null);
  /** The reference rate over time, or "failed" (shown as a note). */
  const [history, setHistory] = useState<HistoryDto | "failed" | null>(null);

  async function compare(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (parsed === null) {
      setData(null);
      setChart(null);
      setHistory(null);
      setError({ kind: "invalidAmount" });
      return;
    }
    setLoading(true);
    try {
      const [outcome, byAmount, rates] = await Promise.all([
        fetchComparison(direction, parsed),
        fetchComparisons(direction, CHART_AMOUNTS),
        fetchHistory(direction),
      ]);
      setData(outcome.ok ? outcome.data : null);
      setError(outcome.ok ? null : outcome.error);
      setChart(byAmount.ok ? byAmount.data : "failed");
      setHistory(rates.ok ? rates.data : "failed");
    } finally {
      setLoading(false); // also after an unexpected error, so the button never stays disabled
    }
  }

  const label = "flex flex-col gap-1.5 text-sm text-muted";
  return (
    <>
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
              // results of the other direction must not stay under the new choice
              setData(null);
              setChart(null);
              setHistory(null);
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
      {data &&
        (chart === "failed" ? (
          <p className={`${note} mt-10`}>{t.chart.unavailable}</p>
        ) : (
          chart && <CostChart comparisons={chart} currency={direction.from} />
        ))}
      {data &&
        (history === "failed" ? (
          <p className={`${note} mt-10`}>{t.rateChart.unavailable}</p>
        ) : (
          history && <RateChart history={history} />
        ))}
    </>
  );
}

/** The values the methodology quotes, formatted for the reader's locale. */
function methodologyValues(f: Formatter): MethodologyValues {
  const { example: e } = METHODOLOGY;
  const from = (amount: string) => f.money({ amount, currency: e.from });
  return {
    recheckDays: METHODOLOGY.recheckDays,
    maxAgeDays: METHODOLOGY.maxAgeDays,
    maxCost: f.percent(METHODOLOGY.maxCostPercent),
    sourceUrl: SOURCE_URL,
    example: {
      paid: from(e.paid),
      fee: from(e.fee),
      converted: from(e.converted),
      rate: f.decimal(e.rate),
      mid: f.decimal(e.mid),
      received: f.money({ amount: e.received, currency: e.to }),
      worth: from(e.worth),
      totalCost: from(e.totalCost),
      hidden: from(e.hidden),
      percent: f.percent(e.percent),
    },
  };
}

const legalValues = (f: Formatter): LegalValues => ({
  name: OPERATOR.name,
  email: OPERATOR.email,
  hostingCountry: f.region(HOSTING_REGION),
});

function NotFound() {
  const { t, locale } = useI18n();
  return (
    <article>
      <h1 className="mt-6 text-4xl leading-tight font-normal tracking-tight sm:mt-12 sm:text-5xl">
        {t.notFound.title}
      </h1>
      <p className="mt-4 text-lg text-muted">{t.notFound.text}</p>
      <p className="mt-6">
        <Link to={pagePath(locale, "home")}>{t.notFound.home}</Link>
      </p>
    </article>
  );
}

/**
 * The site: header, the page the address names (docs/adr/0005), footer. The comparison stays
 * mounted while another page shows, so its results are still there on the way back.
 */
export function App() {
  const { t, f, locale } = useI18n();
  const page = pageFromPath(usePathname());
  const pages = PAGES[locale];
  const text =
    page === "methodology"
      ? pages.methodology(methodologyValues(f))
      : page === "privacy"
        ? pages.privacy(legalValues(f))
        : null;
  const title = page === null ? t.notFound.title : page === "api" ? t.apiPage.title : text?.title;

  useEffect(() => {
    document.title = title ? `${title} — FreuTransfer` : t.title;
  }, [title, t.title]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between gap-4 py-5">
        <Link
          to={pagePath(locale, "home")}
          className="text-lg font-semibold tracking-tight text-ink no-underline"
        >
          FreuTransfer
        </Link>
        <LanguageSwitcher />
      </header>

      <main>
        <div hidden={page !== "home"}>
          <ComparePage />
        </div>
        {text && <TextPage text={text} />}
        {page === "api" && <ApiPage />}
        {page === null && <NotFound />}
      </main>

      <footer className={`${note} mt-16 space-y-2`}>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          {PAGE_IDS.filter((p) => p !== "home").map((p) => (
            <Link key={p} to={pagePath(locale, p)} className="text-muted">
              {t.nav[p]}
            </Link>
          ))}
        </nav>
        <p>{t.disclaimer}</p>
      </footer>
    </div>
  );
}
