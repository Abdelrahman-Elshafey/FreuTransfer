import type { ComparisonDto } from "@freu-transfer/api/contract";
import { useState } from "react";
import { CHART_AMOUNTS, costSeries, percentTicks, type Series, seriesSlot } from "./chart-data.ts";
import { linePath, useWidth } from "./chart-svg.ts";
import { useI18n } from "./i18n/context.tsx";

// "Cost by amount" (Project Plan §1, "cheapest provider by amount"): plain SVG (docs/adr/0012),
// following the dataviz rules: 2px lines, 8px markers with a surface ring, hairline grid, one
// y-axis, colour by provider, a legend, a crosshair tooltip that also works by keyboard, and a
// table view. Exception to the money rule (CLAUDE.md, rule 13): the API's percent strings become
// JS numbers here only to place points on screen; every label shows the API's string via Intl.

const HEIGHT = 260;
/** Wide enough for "2.33%  Western Union": names in the readout are never cut. */
const READOUT_WIDTH = 208;
const PAD = { top: 12, right: 20, bottom: 36, left: 52 };

const color = (providerId: string) => {
  const slot = seriesSlot(providerId);
  return slot === null ? "var(--muted)" : `var(--series-${slot})`;
};

export function CostChart({
  comparisons,
  currency,
}: {
  comparisons: readonly ComparisonDto[];
  currency: string;
}) {
  const { t, f } = useI18n();
  const [box, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const series = costSeries(comparisons);
  const values = series.flatMap((s) => s.points).flatMap((p) => (p === null ? [] : [Number(p)]));
  const ticks = percentTicks(Math.max(0, ...values));
  const top = Number(ticks.at(-1));
  const plotWidth = Math.max(0, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (plotWidth * i) / (CHART_AMOUNTS.length - 1);
  const y = (percent: number) => PAD.top + plotHeight * (1 - percent / top);
  const amount = (a: string) => f.money({ amount: a, currency });
  const points = (s: Series) =>
    s.points.map((p, i) => (p === null ? null : ([x(i), y(Number(p))] as const)));
  const column = plotWidth / (CHART_AMOUNTS.length - 1);

  return (
    <section className="mt-10">
      <h2 className="text-xl font-medium tracking-tight">{t.chart.costTitle}</h2>
      <p className="mt-1 text-sm text-muted">
        {t.chart.costSubtitle(amount(CHART_AMOUNTS[0]), amount(CHART_AMOUNTS[4]))}
      </p>
      <div className="mt-4 rounded-3xl bg-card p-4 sm:p-6">
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {series.map((s) => (
            <li key={s.providerId} className="flex items-center gap-2">
              <span
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ background: color(s.providerId) }}
              />
              {s.providerName}
            </li>
          ))}
        </ul>
        <div ref={box} className="relative">
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={t.chart.costTitle}
            className="block overflow-visible"
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + plotWidth}
                  y1={y(Number(tick))}
                  y2={y(Number(tick))}
                  stroke="var(--line)"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y(Number(tick))}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted text-xs tabular-nums"
                >
                  {f.percent(tick)}
                </text>
              </g>
            ))}
            {CHART_AMOUNTS.map((a, i) => (
              <text
                key={a}
                x={x(i)}
                y={HEIGHT - 12}
                textAnchor={i === 0 ? "start" : i === CHART_AMOUNTS.length - 1 ? "end" : "middle"}
                className="fill-muted text-xs tabular-nums"
              >
                {/* Plain amounts: the subtitle names the currency, and "CHF 2'500" collides on phones. */}
                {f.decimal(a)}
              </text>
            ))}
            {active !== null && (
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + plotHeight}
                stroke="var(--muted)"
                strokeWidth={1}
              />
            )}
            {series.map((s) => (
              <g key={s.providerId}>
                <path
                  d={linePath(points(s))}
                  fill="none"
                  stroke={color(s.providerId)}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {points(s).map((p, i) =>
                  p === null ? null : (
                    <circle
                      // biome-ignore lint/suspicious/noArrayIndexKey: one point per fixed amount
                      key={i}
                      cx={p[0]}
                      cy={p[1]}
                      r={4}
                      fill={color(s.providerId)}
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                  ),
                )}
              </g>
            ))}
            {CHART_AMOUNTS.map((a, i) => (
              // The hit area is the whole column around an amount: readers aim at an amount,
              // never at a 2px line. Focusable, so the keyboard gets the same readout as hover.
              // biome-ignore lint/a11y/noStaticElementInteractions: a focusable chart column
              <rect
                key={a}
                x={x(i) - column / 2}
                y={PAD.top}
                width={column}
                height={plotHeight}
                fill="transparent"
                tabIndex={0}
                aria-label={amount(a)}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            ))}
          </svg>
          {active !== null && (
            <Readout
              series={series}
              index={active}
              title={amount(CHART_AMOUNTS[active] ?? "")}
              left={Math.min(Math.max(x(active) - 80, 0), Math.max(0, width - READOUT_WIDTH))}
            />
          )}
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted">{t.chart.showTable}</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full tabular-nums">
              <thead>
                <tr>
                  <th className="py-1 pr-3 text-left font-medium text-muted">{t.chart.amount}</th>
                  {series.map((s) => (
                    <th key={s.providerId} className="py-1 pr-3 text-right font-medium text-muted">
                      {s.providerName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CHART_AMOUNTS.map((a, i) => (
                  <tr key={a} className="border-t border-line">
                    <td className="py-1 pr-3">{amount(a)}</td>
                    {series.map((s) => {
                      const p = s.points[i];
                      return (
                        <td key={s.providerId} className="py-1 pr-3 text-right">
                          {p == null ? t.chart.notAvailable : f.percent(p)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}

/** One readout for every provider at the active amount: the value leads, the name follows. */
function Readout(props: { series: readonly Series[]; index: number; title: string; left: number }) {
  const { t, f } = useI18n();
  return (
    <div
      className="pointer-events-none absolute top-0 rounded-lg border border-line bg-card p-3 text-sm shadow-sm"
      style={{ left: props.left, width: READOUT_WIDTH }}
    >
      <div className="mb-1 text-muted tabular-nums">{props.title}</div>
      {props.series.map((s) => {
        const p = s.points[props.index];
        return (
          <div key={s.providerId} className="flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-3 shrink-0 rounded-full"
              style={{ background: color(s.providerId) }}
            />
            <span className="font-semibold tabular-nums">
              {p == null ? t.chart.notAvailable : f.percent(p)}
            </span>
            <span className="whitespace-nowrap text-muted">{s.providerName}</span>
          </div>
        );
      })}
    </div>
  );
}
