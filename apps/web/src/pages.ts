import { type Locale, localeFromPath } from "./i18n/locales.ts";

/**
 * The site's pages and their address in each language (docs/adr/0005): /de/methodik is the
 * methodology in German. The home page is the language's root (/de/); the API page is /<code>/api
 * in every language ("API" is the same word in all four).
 */

/** Every page; after the home page, in the footer's order. */
export const PAGE_IDS = ["home", "methodology", "privacy", "api"] as const;
export type PageId = (typeof PAGE_IDS)[number];

const SLUGS: Readonly<Record<Locale, Readonly<Record<Exclude<PageId, "home">, string>>>> = {
  en: { methodology: "methodology", privacy: "privacy", api: "api" },
  de: { methodology: "methodik", privacy: "datenschutz", api: "api" },
  fr: { methodology: "methodologie", privacy: "confidentialite", api: "api" },
  it: { methodology: "metodologia", privacy: "privacy", api: "api" },
};

/** The page an address shows: null for an address of ours that names no page (/de/xyz). */
export function pageFromPath(path: string): PageId | null {
  const locale = localeFromPath(path);
  if (locale === null) return null;
  const rest = path.slice(1 + locale.length).replace(/^\/|\/$/g, "");
  if (rest === "") return "home";
  const slugs = SLUGS[locale];
  const found = (Object.keys(slugs) as (keyof typeof slugs)[]).find((page) => slugs[page] === rest);
  return found ?? null;
}

/** The address of `page` in `locale`: ("fr", "methodology") → "/fr/methodologie". */
export function pagePath(locale: Locale, page: PageId): string {
  return page === "home" ? `/${locale}/` : `/${locale}/${SLUGS[locale][page]}`;
}
