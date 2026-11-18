import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { readSaved, save } from "../storage.ts";
import type { Messages } from "./en.ts";
import { type Formatter, formatterFor } from "./format.ts";
import { type Locale, localeFromPath, localeInfo, pathIn, pickLocale } from "./locales.ts";

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

/** The current address with its path moved to `locale` (query and hash kept). */
const addressIn = (locale: Locale) =>
  pathIn(locale, location.pathname) + location.search + location.hash;

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

  useEffect(() => {
    // Screen readers, hyphenation and search engines read the page's language from here.
    document.documentElement.lang = localeInfo(locale).format;
    document.title = value.t.title;
    // The page's own address in this language (index.html lists all four as hreflang links).
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = new URL(pathIn(locale, location.pathname), location.origin).href;
  }, [locale, value.t]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18n {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error("useI18n() must be used inside <I18nProvider>");
  return i18n;
}
