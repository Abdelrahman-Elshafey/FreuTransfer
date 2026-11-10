import { describe, expect, it } from "vitest";
import type { Messages } from "./en.ts";
import { LOCALE_CODES, localeInfo, pickLocale } from "./locales.ts";

describe("pickLocale", () => {
  it("keeps the reader's earlier choice", () => {
    expect(pickLocale("it", ["de-CH"])).toBe("it");
  });

  it("ignores a saved value that is no longer supported", () => {
    expect(pickLocale("rm", ["fr-CH", "en"])).toBe("fr");
  });

  it("takes the first browser language we have, by its language part", () => {
    expect(pickLocale(null, ["rm-CH", "de-CH", "fr"])).toBe("de");
    expect(pickLocale(null, ["FR-ch"])).toBe("fr");
  });

  it("falls back to English", () => {
    expect(pickLocale(null, ["es-ES"])).toBe("en");
    expect(pickLocale(null, [])).toBe("en");
  });
});

/** Every text in a catalog, with sample values for the functions, keyed by its path. */
function texts(messages: unknown, path = ""): [string, string][] {
  if (typeof messages === "string") return [[path, messages]];
  if (typeof messages === "function") {
    const sample = { from: "CHF", to: "EUR", rate: "1.0893", bank: "ECB", day: "5 Nov 2026" };
    return [[path, String(messages(sample, "x", "y"))]];
  }
  return Object.entries(messages as Record<string, unknown>).flatMap(([key, value]) =>
    texts(value, path ? `${path}.${key}` : key),
  );
}

describe("catalogs", () => {
  // TypeScript already checks that every language has every key; these catch what types can't.
  it.each(LOCALE_CODES)("%s has no empty text", (code) => {
    const empty = texts(localeInfo(code).messages).filter(([, text]) => text.trim() === "");
    expect(empty).toEqual([]);
  });

  it("German uses Swiss spelling (ss, never ß)", () => {
    const withEszett = texts(localeInfo("de").messages as Messages).filter(([, text]) =>
      text.includes("ß"),
    );
    expect(withEszett).toEqual([]);
  });

  it("every language formats numbers and dates the Swiss way (ADR 0005)", () => {
    for (const code of LOCALE_CODES) {
      expect(localeInfo(code).format).toBe(`${code}-CH`);
    }
  });
});
