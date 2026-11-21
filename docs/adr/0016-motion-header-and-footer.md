# ADR 0016: Motion, a sticky header and a footer with columns

- **Status:** accepted (owner asked for it, 2026-11-21; built in stage 8c)
- **Date:** 2026-11-21

## Context
ADR 0011 set the page's colours, font and shapes, but no motion. The owner asked for easing
animations, hover states, better proportions between the elements, and a real header and footer
("the most accepted current option for every element"). The page must stay calm (ADR 0011), readable
(WCAG 2.2 AA) and within the CSP (`style-src 'self'`, `img-src 'self' data:`).

## Decision
- **One easing curve, `ease-out-expo`** (`cubic-bezier(0.16, 1, 0.3, 1)`): fast to start, soft to
  land. One entry animation, `animate-enter` (fade up by 0.5rem, 600 ms). Pages fade in when shown;
  result rows and cards enter one after another (60 ms apart, set with React's `style`, which the CSP
  allows because React sets it through the CSSOM); a new answer plays the entry again.
- **Less motion when asked:** under `prefers-reduced-motion: reduce` the entry animation is `none`
  (the `--animate-enter` variable), and movements on hover and the spinner are `motion-safe:` only.
  Colour fades stay: they move nothing.
- **Hover:** table rows tint (a new token `--hover`, checked for contrast in both themes by
  `tokens.test.ts`), links fade their underline in, fields darken their border, the button's arrow
  moves right, the logo's arrows turn once.
- **Header:** sticky, translucent with a blur behind it, a hairline border; logo, the page links in
  one pill group (the current page filled, `aria-current="page"`), the language as a compact pill with
  a globe. The links show from 1024px up (at 768px the French ones covered the logo); narrower,
  they are in the footer. `scroll-padding-top` keeps anchor jumps below the header.
- **Footer:** three columns (logo and headline, "(Pages)", "(Data)": the reference rate's source and
  the source code), then the disclaimer.
- **Proportions:** every form control is 48px high, like the button; selects stay native (keyboard,
  phone pickers, screen readers) with a CSS chevron in `--muted` (a `data:` image; `tokens.test.ts`
  keeps its colour equal to the token). Headlines are bigger (up to 72px, `text-balance`), section
  headings 24px, sections 64px apart. Shared classes live in `apps/web/src/ui.ts`.

## Alternatives considered
- **An animation library (Motion, formerly Framer Motion):** spring physics and exit animations, but
  ~30 kB for effects CSS does here. Not needed.
- **View transitions between pages:** a cross-fade with no library, but the router would need
  `flushSync`, and the plain CSS fade-in gives almost the same result.
- **A menu button on phones:** one more control in four languages; the footer already holds the links.
- **A header that hides on scrolling down:** saves 64px, but moves under the reader's eyes.

## Consequences
- The motion costs no dependency and no JavaScript beyond a counter that replays the entry.
- A full-page screenshot from headless Chrome can catch rows mid-entry (it redraws the page beyond
  the window); the README screenshots are taken with `prefers-reduced-motion: reduce` emulated.
