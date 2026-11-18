import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { pageFromPath, pagePath } from "../pages.ts";
import { usePathname } from "../router.tsx";
import { readSaved, save } from "../storage.ts";
import type { Messages } from "./en.ts";
import { type Formatter, formatterFor } from "./format.ts";
import {
  isLocale,
  type Locale,
  localeFromPath,
  localeInfo,
  pathIn,
  pickLocale,
} from "./locales.ts";

type I18n = {
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
  /** The current language's messages: `t.form.compare`, `t.source.checked(date)`. */
  readonly t: Messages;
  /** Numbers and dates in the current locale. */
  readonly f: Formatter;
};

const I18nContext = createContext<I18n | null>(null);
const STORAGE_KEY = "freu-transfer.locale";

/**
 * `path` in `locale`: a page keeps being that page (/de/methodik → /fr/methodologie); an address
 * that names no page keeps its rest (/de/xyz → /fr/xyz), so it stays "not found".
 */
function pathInLocale(locale: Locale, path: string): string {
  const page = pageFromPath(path);
  return page === null ? pathIn(locale, path) : pagePath(locale, page);
}

/** The current address in `locale`, query and hash kept. */
const addressIn = (locale: Locale) =>
  pathInLocale(locale, location.pathname) + location.search + location.hash;

/**
 * The language comes from the address (docs/adr/0005): a shared /de/ link opens in German. An
 * address without one (/) gets the reader's saved choice, else the browser's language, else
 * English, and is replaced (not pushed), so "back" doesn't return to it.
 */
function initialLocale(): Locale {
  const fromPath = localeFromPath(location.pathname);
  if (fromPath) return fromPath;
  const picked = pickLocale(readSaved(STORAGE_KEY), navigator.languages);
  history.replaceState(null, "", addressIn(picked));
  return picked;
}

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocale] = useState(initialLocale);

  // Back and forward move between languages the reader switched to: follow the address.
  useEffect(() => {
    const follow = () => {
      const fromPath = localeFromPath(location.pathname);
      if (fromPath) setLocale(fromPath);
    };
    addEventListener("popstate", follow);
    return () => removeEventListener("popstate", follow);
  }, []);

  const value = useMemo<I18n>(() => {
    const info = localeInfo(locale);
    return {
      locale,
      t: info.messages,
      f: formatterFor(info.format),
      setLocale: (next) => {
        save(STORAGE_KEY, next);
        if (next !== locale) history.pushState(null, "", addressIn(next));
        setLocale(next);
      },
    };
  }, [locale]);

  const path = usePathname();
  useEffect(() => {
    // Screen readers, hyphenation and search engines read the page's language from here.
    document.documentElement.lang = localeInfo(locale).format;
    // The page's own address in this language.
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = new URL(pathInLocale(locale, path), location.origin).href;
    // index.html names each language's home page (for crawlers that don't run JavaScript); on
    // another page they name that page in each language, at the site address written there.
    for (const link of document.querySelectorAll<HTMLLinkElement>(
      "link[rel=alternate][hreflang]",
    )) {
      const code = link.hreflang;
      if (isLocale(code)) link.href = new URL(pathInLocale(code, path), link.href).href;
    }
  }, [locale, path]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18n {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error("useI18n() must be used inside <I18nProvider>");
  return i18n;
}
