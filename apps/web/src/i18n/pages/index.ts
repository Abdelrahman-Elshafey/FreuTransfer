import type { Locale } from "../locales.ts";
import { de } from "./de.ts";
import { en } from "./en.ts";
import { fr } from "./fr.ts";
import { it } from "./it.ts";
import type { PagesText } from "./types.ts";

/** The long pages' texts per language (docs/adr/0005). */
export const PAGES: Readonly<Record<Locale, PagesText>> = { en, de, fr, it };
