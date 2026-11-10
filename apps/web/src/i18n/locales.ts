import { de } from "./de.ts";
import { en, type Messages } from "./en.ts";
import { fr } from "./fr.ts";
import { it } from "./it.ts";

/**
 * The page's languages: the one place to add another (plus its catalog file). docs/adr/0005.
 * - `messages`: the catalog
 * - `name`: the language's own name, for the switcher (never translated)
 * - `format`: the locale numbers and dates are formatted in. Swiss variants for all four: the
 *   site compares Swiss transfers, so amounts look like Swiss bank statements (CHF 1’000.50).
 */
const LOCALES = {
  en: { messages: en, name: "English", format: "en-CH" },
  de: { messages: de, name: "Deutsch", format: "de-CH" },
  fr: { messages: fr, name: "Français", format: "fr-CH" },
  it: { messages: it, name: "Italiano", format: "it-CH" },
} as const satisfies Record<string, { messages: Messages; name: string; format: string }>;

export type Locale = keyof typeof LOCALES;

export const LOCALE_CODES = Object.keys(LOCALES) as Locale[];

export function localeInfo(locale: Locale): (typeof LOCALES)[Locale] {
  return LOCALES[locale];
}

function isLocale(value: string): value is Locale {
  return Object.hasOwn(LOCALES, value);
}

/**
 * The language to show: the reader's earlier choice if still supported, else the first browser
 * language we have ("de-CH" → "de"), else English.
 */
export function pickLocale(saved: string | null, browser: readonly string[]): Locale {
  if (saved !== null && isLocale(saved)) return saved;
  for (const tag of browser) {
    const language = tag.toLowerCase().split("-")[0] ?? "";
    if (isLocale(language)) return language;
  }
  return "en";
}
