import type { Messages } from "./en.ts";

/** The publisher's name in the reader's language; an unknown source shows as its code. */
export function bankName(t: Messages, source: string): string {
  return Object.hasOwn(t.rateSources, source)
    ? t.rateSources[source as keyof Messages["rateSources"]]
    : source.toUpperCase();
}
