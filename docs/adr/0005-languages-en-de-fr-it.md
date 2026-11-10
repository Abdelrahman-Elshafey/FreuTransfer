# ADR 0005: Four languages (English, German, French, Italian)

- **Status:** accepted
- **Date:** 2026-11-09

## Context
The owner wants the site in English, German, French and Italian. The users are in Switzerland and its
neighbours (commuters from France, Italy and Germany; residents in every language region), so this is
part of v1, not a later extra. Adding languages late is expensive: every sentence built in code,
every English error message in an API response, and every `toFixed()` number in the page would have
to be found and redone. The page is still small (stage 3), so the rules are cheapest to set now.

## Decision
**Language lives only in the page (`apps/web`).** `core`, `db` and the API stay language-neutral:

- The API sends **codes, money and dates, never sentences** for the reader: unavailable reasons are
  codes (`amount_not_supported`, `no_reference_rate`), errors are RFC 9457 problem **types**. Its
  English `title`/`errors[].message` are for developers only. No `?lang=` parameter, no
  `Accept-Language` handling on the server.
- The response shape lives in one file, `apps/api/src/contract.ts`, typed on the server and imported
  by the page (`@freu-transfer/api/contract`), so a new code can't reach the page untranslated: the
  catalogs use `satisfies Record<UnavailableReason, string>`.
- The data files' research `note` is English evidence for the owner and reviewers; it stays in
  `data/manual` and the database but is no longer sent to the page. Caveats the reader should see
  (weekend markups, intermediary bank fees) become codes with translated text in stage 6.

**No i18n library.** For four languages and one page, plain TypeScript does the job with no
dependency, no build plugin and no runtime cost:

- `apps/web/src/i18n/en.ts` is the source catalog; `Messages = typeof en`. `de.ts`, `fr.ts` and
  `it.ts` are typed `Messages`, so **a missing or extra text, or a wrong parameter, fails
  `pnpm typecheck`**. Text with values is a function, so each language builds its own word order.
- `locales.ts` is the one list of languages (catalog, own name for the switcher, formatting locale).
  Adding a language = one catalog file + one line there.
- Formatting uses the browser's built-in `Intl`. Money and percentages stay **strings**:
  `Intl.NumberFormat` formats a decimal string exactly (no float), and the page shows exactly the
  decimals the API sent, so it never rounds money again. Dates show the calendar day in Zurich.
- All four languages format the **Swiss way** (`de-CH`, `fr-CH`, `it-CH`, `en-CH`: CHF 1'000.50),
  because the site compares Swiss transfers. German uses Swiss spelling (`ss`, never `ß`; a test
  checks it).
- Amount input accepts what people type in all four regions: `1000,50`, `1'000.50`, `1 000,50`.
  `1.000` is refused rather than guessed.
- The language is the reader's earlier choice (localStorage, if allowed), else the first matching
  browser language, else English. `<html lang>` and the page title follow it.

## Alternatives considered
- **react-i18next / FormatJS (react-intl):** mature, but a runtime dependency for features we don't
  need yet (ICU message syntax, lazy namespaces, plural engines), and string keys
  (`t("table.fee")`) that TypeScript checks less directly than property access (`t.table.fee`).
- **Paraglide / Lingui:** compile-time and type-safe, but add a code generator or Babel/SWC macro
  to the build. Worth it with many pages or translators using a translation platform; not now.
- **Language-specific URLs (`/de/…`):** better for search engines, but need server routing and
  hreflang tags. Decided at stage 7 together with SEO; the catalogs don't change either way.

## Consequences
- Every visible word in `apps/web` comes from a catalog, in all four languages, in the same change
  (CLAUDE.md). Reviewers can check one folder.
- Translations are drafts by Claude until a native speaker checks them (owner's list in
  `docs/progress.md`).
- All catalogs ship in one bundle (a few KB). If they grow past ~20 KB, load them per language.
- Legal texts (disclaimer, privacy policy, methodology) need all four languages before launch.
