# ADR 0016: Motion, a sticky header and a small footer

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
- **Scroll reveal** (owner, 2026-11-21: "things should appear as you go down"): result rows and
  cards, the "my provider" card, the charts and the text pages' sections wait faded out until they
  scroll into view, then play the entry (`reveal.ts`, one IntersectionObserver per element, shown
  once). Its watched area reaches far above the window, so an element the reader jumped past (End
  key, a fast fling) is shown too; without IntersectionObserver everything shows at once.
- **Less motion when asked:** under `prefers-reduced-motion: reduce` the entry animation is `none`
  (the `--animate-enter` variable), and movements on hover and the spinner are `motion-safe:` only.
  Colour fades stay: they move nothing.
- **Hover:** table rows tint (a new token `--hover`, checked for contrast in both themes by
  `tokens.test.ts`), links fade their underline in, fields darken their border, the button's arrow
  moves right, the logo's arrows turn once.
- **For customers, not developers** (owner, 2026-11-21): the site should read like a calm consumer
  finance site. No source-code or API links on the pages; the API page stays at its address for
  developers and is linked from the README only. The methodology page's "open method" section
  became "Independent" (no commissions, no advertising), without the GitHub link.
- **Header:** sticky, translucent with a blur behind it, a hairline border; logo, two links in one pill
  group, "Comparison" and "How it works" (the methodology page; the current page filled,
  `aria-current="page"`). The language is our own menu (`LanguageMenu.tsx`), not a native select:
  a pill button opens a small frosted panel (translucent, blurred) that fades and scales in, the
  current language checked. A disclosure: arrow keys move through the languages, Escape, Tab or a
  click outside closes it. The links show from 768px up;
  on phones the logo leads home and "How it works" is in the footer. `scroll-padding-top` keeps
  anchor jumps below the header.
- **Footer:** small: the logo and "How it works · Privacy" on one line, then one line of fine print
  (the disclaimer and the reference rate's source).
- **Width and hero** (owner, 2026-11-21: everything centred in a narrow column looked unnatural):
  the frame is up to 1280px wide (it was 1024px), so the logo (now bigger) sits at the page's left
  edge. From 1024px up the home page opens in two columns, the way transfer services do: the
  headline (up to 88px) and intro on the left, the calculator on the right, with a soft lime glow
  behind it (decoration; the card is opaque, so no text sits on the glow).
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
