import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { readSaved, save } from "../storage.ts";
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

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocale] = useState(() =>
    pickLocale(readSaved(STORAGE_KEY), navigator.languages),
  );

  const value = useMemo<I18n>(() => {
    const info = localeInfo(locale);
    return {
      locale,
      t: info.messages,
      f: formatterFor(info.format),
      setLocale: (next) => {
        save(STORAGE_KEY, next);
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
