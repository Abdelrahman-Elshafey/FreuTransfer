import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { Messages } from "./en.ts";
import { type Formatter, formatterFor } from "./format.ts";
import { type Locale, localeInfo, pickLocale } from "./locales.ts";

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
 * The reader's language choice is a convenience: storage can be blocked (private mode, site data
 * settings), and then the browser's language is used again. Only that DOMException is caught.
 */
function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    return null;
  }
}

function save(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
  }
}

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocale] = useState(() => pickLocale(readSaved(), navigator.languages));

  const value = useMemo<I18n>(() => {
    const info = localeInfo(locale);
    return {
      locale,
      t: info.messages,
      f: formatterFor(info.format),
      setLocale: (next) => {
        save(next);
        setLocale(next);
      },
    };
  }, [locale]);

  useEffect(() => {
    // Screen readers, hyphenation and search engines read the page's language from here.
    document.documentElement.lang = localeInfo(locale).format;
    document.title = value.t.title;
  }, [locale, value.t]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18n {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error("useI18n() must be used inside <I18nProvider>");
  return i18n;
}
