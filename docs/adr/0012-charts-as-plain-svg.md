# ADR 0012: Charts are drawn as plain SVG, without a chart library

- **Status:** accepted (owner, 2026-11-14; first chart in stage 6e-1)
- **Date:** 2026-11-14

## Context
Stage 6 adds two charts: cost % by amount (one line per provider at 100, 500, 1,000, 2,500 and
5,000) and the reference rate over time. Both are small: two axes, at most five lines, a few dozen
points. The page formats every number and date through `Intl` in four languages (ADR 0005), its
colours are CSS variables checked for contrast in two themes (ADR 0011), and money is never a JS
number (CLAUDE.md).

## Decision
- **Plain SVG drawn by React**, no chart library. Axis labels use the page's `Intl` formatter;
  lines, grid and text use the colour tokens, so both themes and the contrast test cover the charts.
- **Series colours** follow the provider, never its rank: one fixed slot per provider
  (`apps/web/src/chart-data.ts`), from the dataviz reference palette's categorical order, validated
  on our cards in both themes (CVD and normal-vision separation pass). In light, slots 3-5 are
  below 3:1 on the card, so every chart has a legend and a table view.
- Every chart has a crosshair readout that also works by keyboard, a legend, and a table view.
- **Exception to the money rule:** a chart turns the API's strings into JS numbers only to place
  points on screen; every value it shows is the API's string, formatted by `Intl`.

## Alternatives considered
- **Recharts or visx:** ready-made tooltips, transitions and resizing, and names recruiters know.
  But they add a noticeable share to a ~75 kB (gzipped) page and new dependencies through the
  7-day release gate, and their axis ticks need per-language formatting set up to match ours.
- **Chart.js (canvas):** cannot read CSS variables without extra code, so dark mode and the
  contrast test would not cover it.

## Consequences
- About 150 lines of chart code that we own and test; the data shaping (`costSeries`,
  `percentTicks`) is pure and unit-tested, the drawing is checked in a browser.
- Interactive features beyond a readout (zoom, brushing, animation) would be our own work; if the
  charts grow that far, switching to a library is a contained change (one component per chart).
