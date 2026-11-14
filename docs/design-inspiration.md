# Design Inspiration: bejamas.com

Notes on the style of bejamas.com (a European web agency; the site is built with Astro and Tailwind CSS v4)
and how to borrow it for FreuTransfer. **Borrow the principles, not the look:** no copying of their logo,
artwork, videos, wording or exact layout.

> **Verified 2026-11-05** against the live page HTML and its stylesheet (`/_astro/BaseLayout.*.css`).
> Everything below marked ✅ was checked in the source. The first version of this file (from a Claude
> desktop analysis) was accurate; it only lacked the CSS values, which are now filled in.

## 1. Overall feel
- Calm, confident, editorial. Lots of white space, few elements per screen.
- Feels like a magazine or a design studio, not a typical startup template.
- Speaks plainly: short sentences, clear promises, no buzzword clutter.
- Trust is built through facts: client logos, measured results ("+127% Faster Page Loading" ✅), an ISO certificate ✅.

## 2. Colour ✅
Near-monochrome, with **one bright accent**. Colours are defined as CSS variables in OKLCH; hex values
are converted approximations.

| Role | Value | ≈ Hex | Use |
|---|---|---|---|
| Background | `oklch(96.44% .0013 286.38)` | `#f3f3f4` (theme colour `#f4f4f4`) | Page background, soft grey, not white |
| Card | `oklch(100% 0 0)` | `#ffffff` | Cards and popovers sit white on the grey |
| Foreground / primary | `oklch(18.72% .002 286.2)` | `#131314` | Text and primary (dark) buttons |
| Muted | `oklch(94.31% 0 0)` | `#ececec` | Secondary surfaces |
| Muted text | `oklch(50.81% .0143 296.07)` | `#66646d` | Labels, captions |
| Border | `oklch(91.36% .006 239.83)` | `#dfe3e6` | Thin dividers |
| **Accent** | `oklch(91.98% .1905 128.5)` | **`#befc65`** (lime) | Used sparingly: main call-to-action button |
| Destructive | `#ef4444` | | Errors |

**Contrast:** the lime accent is very light. It only works as a **background with dark text**
(`accent-foreground` = the near-black), never as text colour on the grey background.

No dark theme was found in the stylesheet.

## 3. Typography ✅
- **Font:** *PP Neue Montreal* (variable font, weights 1–999, by Pangram Pangram) for everything;
  *SFMono-Regular* (monospace) for small technical labels, tags and code-like details.
- **Hero headline:** 3rem on phones up to **4.5rem (72px)** on desktop, **normal weight (400)**, tight
  letter spacing (−0.035em), line height 1.05–1.2. Big but not bold: the size carries it.
- **Section headings (h2):** about 1.875–2rem, medium weight (500), letter spacing −0.02em.
- **Labels:** 0.75rem (12px), muted colour, often in parentheses: "(Platforms)", "(Services)" ✅.
- Body text short, one idea per paragraph. Tailwind's default scale (12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 px).
- Headlines split into two short sentences, a problem and then a contrast:
  "The site got big. The platform didn't keep up." ✅

⚠ **Licence:** Neue Montreal is a commercial font (free trial for personal use only). For FreuTransfer,
use a free, open-licence font with a similar clean grotesque look, e.g. **Inter** or **Geist**
(both SIL Open Font License), plus a free monospace (e.g. **Geist Mono** or **JetBrains Mono**).

## 4. Shapes, spacing and motion ✅
- **Buttons:** pill-shaped (`rounded-full`), tall (56px, or 80px for the hero), medium weight, 16px text.
  Primary CTA = lime background + dark text; secondary = dark or white. Presses shrink slightly (`scale 0.98`).
- **Cards:** large radius (`rounded-3xl`, 24px) for project cards; base radius 8px for smaller elements.
- **Spacing:** Tailwind's 4px grid; generous gaps between sections (e.g. 80px).
- **Widths:** content containers up to about 80rem (1280px); text blocks narrower (~34rem).
- **Motion:** short transitions (150ms); hover videos on project cards; smooth scrolling; accordion animations.

## 5. Signature details ✅
These make the site recognisable. Borrow the ideas, not the exact look.
- **Labels in parentheses** above groups: "(Platforms)", "(Industries)", "(Featured case study)".
- **Decimal section numbers** in the footer: "(1.0)", "(2.0)".
- **Numbered steps** for services: Audit, Design, Migrate, Run.
- **Tech tags** on cards: "Contentful · Next.js".
- **Metrics on cards:** results sit right on the project card.
- **Minimal header:** five links and one "Talk to us" button; the menu opens into grouped columns.
- **Video** in the hero and on card hover; an abstract artwork closes the page.

## 6. Page structure (home page)
1. Header: minimal logo, five nav links, one "Talk to us" button.
2. Hero: video plus one big headline ("Migrate to a website your team can run.").
3. Logo strip: "Trusted by teams at…".
4. Short intro plus two buttons (primary, secondary).
5. Problem section: "Why teams come to us", headline plus pain points.
6. Services: numbered steps.
7. Featured projects: cards with tags, metrics and a title.
8. Testimonial: one quote with name and role, plus two big stats.
9. Closing call to action: a short headline and one button.
10. Footer: numbered columns, social links, certificate badge, artwork.

## 7. How to use this in FreuTransfer (stage 6)
- **Palette:** grey background `#f3f3f4`, white result cards, near-black text. **One accent** for
  "best option". Lime works only as a badge background with dark text; a green with better contrast
  is fine too. Use red only for errors, not for "expensive" (we show costs, not alarms).
- **Numbers as heroes:** the **amount received** is the biggest text on each result card, the way they
  put metrics on project cards. Use tabular (monospaced) digits so amounts line up in columns.
- **Bracket labels** (small, muted, monospace): "(Fee)", "(Hidden cost)", "(Mid rate · ECB 14:10)",
  "(Checked 3 Nov)", "(Manual)". This also serves our rule that every number shows its source.
- **Provider tags:** "(Bank)", "(Fintech)", "Rule-based · Manual".
- **Numbered "How it works":** 1 Enter amount · 2 Compare · 3 See the true cost.
- **Problem section:** three short pain points: "Zero fees isn't zero." / "The rate hides the cost." /
  "Banks don't show their margin."
- **Trust strip:** instead of client logos, show data sources (ECB via Frankfurter, bank price lists)
  and "last updated" times.
- **Headlines:** short two-part statements: "You sent 1,000 francs. Find out what really arrived."
- **Shapes:** pill buttons, 24px-radius result cards, 8px for inputs and small elements.
- **Tailwind v4** gives the same token approach (CSS variables, 4px spacing grid); choose it in stage 6
  after checking the current version.
- **Restraint:** no video or artwork needed. Our "content" is the comparison table.

## 8. Decided (stage 6a, ADR 0011)
- Tailwind CSS v4; Inter (self-hosted) + JetBrains Mono for bracket labels; lime `#befc65` only as
  the "best" badge background with dark text; dark mode follows the system setting, checked for
  WCAG AA contrast by `apps/web/src/tokens.test.ts`.
- Mobile layout: one card per provider on phones, a table from 768px up.
