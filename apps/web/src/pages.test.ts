import { describe, expect, it } from "vitest";
import { LOCALE_CODES } from "./i18n/locales.ts";
import { PAGE_IDS as PAGES, pageFromPath, pagePath } from "./pages.ts";

describe("pages", () => {
  it.each([
    ["/de/", "home"],
    ["/de", "home"],
    ["/de/methodik", "methodology"],
    ["/de/methodik/", "methodology"],
    ["/fr/confidentialite", "privacy"],
    ["/de/impressum", null], // no imprint page (owner, 2026-11-18)
    ["/it/privacy", "privacy"],
    ["/fr/api", "api"],
    ["/de/api/", "api"],
    ["/de/methodology", null], // the English slug in a German address: not a page
    ["/de/xyz", null],
    ["/", null],
  ])("%s shows %j", (path, page) => {
    expect(pageFromPath(path)).toBe(page);
  });

  it("finds every page at its own address, in every language", () => {
    for (const locale of LOCALE_CODES) {
      for (const page of PAGES) expect(pageFromPath(pagePath(locale, page))).toBe(page);
    }
  });

  it("gives every page a different address within a language", () => {
    for (const locale of LOCALE_CODES) {
      const paths = PAGES.map((page) => pagePath(locale, page));
      expect(new Set(paths).size).toBe(PAGES.length);
    }
  });

  it("writes addresses in lower case ASCII, without accents (they are typed and shared)", () => {
    for (const locale of LOCALE_CODES) {
      for (const page of PAGES) expect(pagePath(locale, page)).toMatch(/^\/[a-z]{2}\/[a-z-]*$/);
    }
  });
});
