import type { ComparisonDto, ResultRowDto } from "@freu-transfer/api/contract";
import { type FormEvent, useState } from "react";
import { type CompareError, fetchComparison } from "./api.ts";
import { useI18n } from "./i18n/context.tsx";
import type { Messages } from "./i18n/en.ts";
import { parseAmount } from "./i18n/format.ts";
import { LOCALE_CODES, type Locale, localeInfo } from "./i18n/locales.ts";

// v0.1 page: deliberately plain. The real design comes in stage 6 (docs/design-inspiration.md).
// Every visible word comes from the catalogs in ./i18n (docs/adr/0005).

/** Errors are kept as codes, so switching the language also translates a message already shown. */
type PageError = CompareError | { readonly kind: "invalidAmount" };

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

function ResultsTable({
  rows,
  ranked,
}: {
  rows: readonly (ResultRowDto & { rank?: number })[];
  ranked: boolean;
}) {
  const { t, f } = useI18n();
  return (
    <table>
      <thead>
        <tr>
          {ranked && <th>{t.table.rank}</th>}
          <th>{t.table.provider}</th>
          <th className="num">{t.table.arrives}</th>
          <th className="num">{t.table.fee}</th>
          <th className="num">{t.table.hidden}</th>
          <th className="num">{t.table.totalCost}</th>
          <th>{t.table.source}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.providerId}>
            {ranked && <td>{r.rank}</td>}
            <td>{r.providerName}</td>
            <td className="num strong">{f.money(r.received)}</td>
            <td className="num">{f.money(r.visibleFee)}</td>
            <td className="num">{f.money(r.fxMarkup)}</td>
            <td className="num">
              {f.money(r.totalCost)} ({f.percent(r.totalCostPercent)})
            </td>
            <td>
              <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                {r.sourceKind === "rule_based"
                  ? t.source.ruleBased
                  : r.approximate
                    ? t.source.manualApproximate
                    : t.source.manual}
              </a>
              <div className="note">{t.source.checked(f.instant(r.checkedAt))}</div>
              {r.measuredAgainst && (
                <div className="note">
                  {t.source.measuredAgainst(
                    f.decimal(r.measuredAgainst.rate),
                    bankName(t, r.measuredAgainst.source),
                    f.day(r.measuredAgainst.asOf),
                  )}
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Results({ data }: { data: ComparisonDto }) {
  const { t, f } = useI18n();
  return (
    <>
      {data.midRateTooOld && (
        <p className="warning" role="alert">
          {t.results.midRateTooOld({ day: f.day(data.midRate.asOf), days: data.midRateMaxAgeDays })}
        </p>
      )}
      <p className="note">
        {t.results.midRate({
          from: data.from,
          to: data.to,
          rate: f.decimal(data.midRate.rate),
          bank: bankName(t, data.midRate.source),
          day: f.day(data.midRate.asOf),
        })}
      </p>
      {data.results.length > 0 ? (
        <ResultsTable rows={data.results} ranked />
      ) : (
        <p>{t.results.none}</p>
      )}
      {data.stale.length > 0 && (
        <>
          <h2>{t.results.staleHeading(data.recheckDays)}</h2>
          <ResultsTable rows={data.stale} ranked={false} />
        </>
      )}
      {data.unavailable.length > 0 && (
        <>
          <h2>{t.results.unavailableHeading}</h2>
          <ul>
            {data.unavailable.map((u) => (
              <li key={u.providerId}>
                {u.providerName}: {t.unavailable[u.reason]}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="language">
      {t.language}{" "}
      <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
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
      const outcome = await fetchComparison(parsed);
      setData(outcome.ok ? outcome.data : null);
      setError(outcome.ok ? null : outcome.error);
    } finally {
      setLoading(false); // also after an unexpected error, so the button never stays disabled
    }
  }

  return (
    <main>
      <LanguageSwitcher />
      <h1>FreuTransfer</h1>
      <p>{t.intro}</p>

      <form onSubmit={compare}>
        <label>
          {t.form.iPay}{" "}
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            aria-label={t.form.amountLabel("CHF")}
          />{" "}
          CHF → EUR
        </label>{" "}
        <button type="submit" disabled={loading}>
          {loading ? t.form.comparing : t.form.compare}
        </button>
      </form>

      {error && <p className="error">{errorText(t, error, f.decimal("1000.50"))}</p>}
      {data && <Results data={data} />}

      <p className="note">{t.disclaimer}</p>
    </main>
  );
}
