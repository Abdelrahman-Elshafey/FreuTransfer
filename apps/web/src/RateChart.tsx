import type { HistoryDto } from "@freu-transfer/api/contract";
import { type KeyboardEvent, type PointerEvent, useState } from "react";
import { rateTicks } from "./chart-data.ts";
import { linePath, useWidth } from "./chart-svg.ts";
import { bankName } from "./i18n/bank.ts";
import { useI18n } from "./i18n/context.tsx";
import { h2, section } from "./ui.ts";

// The reference rate over time (Project Plan §5, /v1/history): plain SVG (docs/adr/0012). One
// series, so no legend box: the title names it. The y-axis fits the rates (a rate chart shows how
// a rate moves, it doesn't start at 0); the x-axis is time, so weekends are simply gaps between
// points. A crosshair readout snaps to the nearest day, by pointer or arrow keys; a table view
// lists every rate. Rates and days become numbers only to place points (ADR 0012); every label
// is the API's string, formatted by Intl.

const HEIGHT = 220;
const PAD = { top: 12, right: 20, bottom: 36, left: 60 };
const dayTime = (day: string) => Date.parse(`${day}T00:00:00Z`);

export function RateChart({ history }: { history: HistoryDto }) {
  const { t, f } = useI18n();
  const [box, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const { rates } = history;
  const first = rates[0];
  const last = rates.at(-1);

  const heading = <h2 className={h2}>{t.rateChart.title(history.from, history.to)}</h2>;
  if (!first || !last) {
    return (
      <section className={section}>
        {heading}
        <p className="mt-2 text-sm text-muted">{t.rateChart.none}</p>
      </section>
    );
  }

  const values = rates.map((r) => Number(r.rate));
  const ticks = rateTicks(Math.min(...values), Math.max(...values));
  const low = Number(ticks[0]);
  const high = Number(ticks.at(-1));
  const plotWidth = Math.max(0, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const start = dayTime(first.asOf);
  const span = dayTime(last.asOf) - start;
  // A single day sits in the middle instead of dividing by a zero span.
  const x = (day: string) =>
    PAD.left + (span === 0 ? plotWidth / 2 : (plotWidth * (dayTime(day) - start)) / span);
  const y = (rate: number) => PAD.top + plotHeight * (1 - (rate - low) / (high - low));
  const points = rates.map((r, i) => [x(r.asOf), y(values[i] ?? 0)] as const);
  const shown = active === null ? null : rates[active];

  const nearest = (event: PointerEvent<SVGRectElement>) => {
    const left = event.currentTarget.getBoundingClientRect().left;
    const px = event.clientX - left + PAD.left;
    let best = 0;
    points.forEach(([pxPoint], i) => {
      if (Math.abs(pxPoint - px) < Math.abs((points[best]?.[0] ?? 0) - px)) best = i;
    });
    setActive(best);
  };
  const step = (event: KeyboardEvent<SVGRectElement>) => {
    const move = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (move === 0) return;
    event.preventDefault();
    setActive((i) => Math.min(rates.length - 1, Math.max(0, (i ?? rates.length - 1) + move)));
  };

  return (
    <section className={section}>
      {heading}
      <p className="mt-1 text-sm text-muted">
        {t.rateChart.subtitle(bankName(t, last.source), f.day(first.asOf), f.day(last.asOf))}
      </p>
      <div className="mt-4 rounded-3xl bg-card p-4 sm:p-6">
        <div ref={box} className="relative">
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={t.rateChart.title(history.from, history.to)}
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
                  {f.decimal(tick)}
                </text>
              </g>
            ))}
            {(span === 0 ? [first] : [first, last]).map((r, i) => (
              <text
                key={r.asOf}
                x={x(r.asOf)}
                y={HEIGHT - 12}
                textAnchor={span === 0 ? "middle" : i === 0 ? "start" : "end"}
                className="fill-muted text-xs tabular-nums"
              >
                {f.day(r.asOf)}
              </text>
            ))}
            <path
              d={linePath(points)}
              fill="none"
              stroke="var(--series-1)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {shown && active !== null && (
              <line
                x1={points[active]?.[0]}
                x2={points[active]?.[0]}
                y1={PAD.top}
                y2={PAD.top + plotHeight}
                stroke="var(--muted)"
                strokeWidth={1}
              />
            )}
            {/* The newest rate, and the one the readout shows, as ringed end-dots. */}
            {[rates.length - 1, ...(active === null ? [] : [active])].map((i) => (
              <circle
                key={i}
                cx={points[i]?.[0]}
                cy={points[i]?.[1]}
                r={4}
                fill="var(--series-1)"
                stroke="var(--card)"
                strokeWidth={2}
              />
            ))}
            {/* The whole plot is the hit area: readers aim at a day, never at a 2px line. */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: a focusable chart area, arrow keys move the readout */}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={plotWidth}
              height={plotHeight}
              fill="transparent"
              tabIndex={0}
              aria-label={t.rateChart.keyboard}
              onPointerMove={nearest}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(rates.length - 1)}
              onBlur={() => setActive(null)}
              onKeyDown={step}
            />
          </svg>
          {shown && active !== null && (
            <div
              className="pointer-events-none absolute top-0 rounded-xl border border-line bg-card p-3 text-sm shadow-lg shadow-black/5"
              style={{
                left: Math.min(
                  Math.max((points[active]?.[0] ?? 0) - 70, 0),
                  Math.max(0, width - 140),
                ),
                width: 140,
              }}
            >
              <div className="text-muted">{f.day(shown.asOf)}</div>
              <div className="font-semibold tabular-nums">{f.decimal(shown.rate)}</div>
            </div>
          )}
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted transition-colors duration-200 hover:text-ink">
            {t.chart.showTable}
          </summary>
          <div className="mt-2 max-h-72 overflow-y-auto">
            <table className="w-full tabular-nums">
              <thead>
                <tr>
                  <th className="py-1 pr-3 text-left font-medium text-muted">{t.rateChart.day}</th>
                  <th className="py-1 text-right font-medium text-muted">{t.rateChart.rate}</th>
                </tr>
              </thead>
              <tbody>
                {[...rates].reverse().map((r) => (
                  <tr key={r.asOf} className="border-t border-line">
                    <td className="py-1 pr-3">{f.day(r.asOf)}</td>
                    <td className="py-1 text-right">{f.decimal(r.rate)}</td>
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
