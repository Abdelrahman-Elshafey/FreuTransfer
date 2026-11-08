import { type FormEvent, useState } from "react";
import { type CompareOutcome, fetchComparison, type MoneyDto, type ResultRow } from "./api.ts";

// v0.1 page: deliberately plain. The real design comes in stage 6 (docs/design-inspiration.md).

const money = (m: MoneyDto) => `${m.amount} ${m.currency}`;

function sourceLabel(row: ResultRow): string {
  if (row.sourceKind === "rule_based") return "Rule-based";
  return row.approximate ? "Manual · approximate" : "Manual";
}

function ResultsTable({
  rows,
  ranked,
}: {
  rows: (ResultRow & { rank?: number })[];
  ranked: boolean;
}) {
  return (
    <table>
      <thead>
        <tr>
          {ranked && <th>#</th>}
          <th>Provider</th>
          <th className="num">Arrives</th>
          <th className="num">Fee</th>
          <th className="num">Hidden in rate</th>
          <th className="num">Total cost</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.providerId}>
            {ranked && <td>{r.rank}</td>}
            <td>
              {r.providerName}
              {r.note && <div className="note">{r.note}</div>}
            </td>
            <td className="num strong">{money(r.received)}</td>
            <td className="num">{money(r.visibleFee)}</td>
            <td className="num">{money(r.fxMarkup)}</td>
            <td className="num">
              {money(r.totalCost)} ({r.totalCostPercent}%)
            </td>
            <td>
              <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                {sourceLabel(r)}
              </a>
              <div className="note">checked {r.checkedAt.slice(0, 10)}</div>
              {r.approximate && (
                <div className="note">
                  vs mid {r.midRate.rate} ({r.midRate.source.toUpperCase()}, {r.midRate.asOf})
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function App() {
  const [amount, setAmount] = useState("1000");
  const [outcome, setOutcome] = useState<CompareOutcome | null>(null);
  const [loading, setLoading] = useState(false);

  async function compare(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      setOutcome(await fetchComparison(amount.trim()));
    } finally {
      setLoading(false); // also after an unexpected error, so the button never stays disabled
    }
  }

  const data = outcome?.ok ? outcome.data : null;

  return (
    <main>
      <h1>FreuTransfer</h1>
      <p>
        You send francs. Find out what really arrives, and how much is hidden in the exchange rate.
      </p>

      <form onSubmit={compare}>
        <label>
          I pay{" "}
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            aria-label="Amount in CHF"
          />{" "}
          CHF → EUR
        </label>{" "}
        <button type="submit" disabled={loading}>
          {loading ? "Comparing…" : "Compare"}
        </button>
      </form>

      {outcome && !outcome.ok && <p className="error">{outcome.message}</p>}

      {data && (
        <>
          <p className="note">
            Compared with the mid-market rate 1 CHF = {data.midRate.rate} EUR (
            {data.midRate.source.toUpperCase()}, {data.midRate.asOf}); manual rates with the rate of
            the day they were read.
          </p>
          {data.results.length > 0 ? (
            <ResultsTable rows={data.results} ranked />
          ) : (
            <p>No verified provider data yet.</p>
          )}
          {data.stale.length > 0 && (
            <>
              <h2>Not re-checked for over {data.recheckDays} days</h2>
              <ResultsTable rows={data.stale} ranked={false} />
            </>
          )}
          {data.unavailable.length > 0 && (
            <>
              <h2>Not available for this amount</h2>
              <ul>
                {data.unavailable.map((u) => (
                  <li key={u.providerId}>
                    {u.providerName}: {u.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <p className="note">Estimates for information only, not financial advice.</p>
    </main>
  );
}
