# ADR 0011: Page design foundation: Tailwind v4, Inter, lime "best" badge, system dark mode

- **Status:** accepted (owner, 2026-11-14; built in stage 6a)
- **Date:** 2026-11-14

## Context
Stage 6 turns the plain v0.1 page into the real frontend. `docs/design-inspiration.md` §8 left four
choices open: how styles are written, the font, the accent colour and dark mode. The page must be
usable on phones (Project Plan §7) and every text readable (WCAG 2.2 AA).

## Decision
- **Styling: Tailwind CSS v4** (`tailwindcss` + `@tailwindcss/vite`, 4.3.5, checked in the npm
  registry on 2026-11-14). Colours are CSS variables in `apps/web/src/styles.css`, exposed to
  Tailwind with `@theme inline`; Biome parses Tailwind's directives (`css.parser.tailwindDirectives`).
- **Font: Inter** (SIL Open Font License), self-hosted from `@fontsource-variable/inter`: bundled by
  Vite and served by our nginx, so no visitor request goes to a font CDN. **JetBrains Mono** (same
  licence, same packaging) for the small bracket labels, added with them in stage 6b.
- **Accent: the lime `#befc65`**, only as the background of the "best" badge with near-black text,
  never as text colour (it fails contrast as text). Added with the badge in stage 6b. Red only for
  errors, not for "expensive".
- **Dark mode follows the system** (`prefers-color-scheme`), no toggle. Both themes define the same
  tokens; `tokens.test.ts` checks every text/background pair the page uses against 4.5:1 in both.
- **Layout:** one card per provider on phones, one table from 768px up (Tailwind's `md`).

## Alternatives considered
- **Plain CSS with tokens:** no dependency, but more hand-written CSS for two layouts and two themes.
- **Geist + Geist Mono:** closer to the inspiration's look, slightly less readable in dense tables.
- **A darker green accent:** usable as text too, but less distinctive.
- **Light only, or system + toggle:** light only is less to test, but tokens make dark cheap now and
  expensive later; a toggle is one more control in four languages for little gain.

## Consequences
- A colour change that breaks contrast fails `pnpm check`, in either theme.
- The font adds one 48 kB file (Inter Latin, every weight in one variable font) to the first visit;
  the files for other scripts load only when a text needs them (`unicode-range`).
- Utility classes live in the components; the tokens stay the one source of every colour.
