import { describe, expect, it } from "vitest";
import { LOCALE_CODES } from "../locales.ts";
import { PAGES } from "./index.ts";
import type { LegalValues, MethodologyValues, PageText } from "./types.ts";

// TypeScript checks that every language has every page; these catch what types can't.

const methodology: MethodologyValues = {
  recheckDays: 31,
  maxAgeDays: 6,
  maxCost: "<maxCost>",
  sourceUrl: "https://example.org/source",
  example: {
    paid: "<paid>",
    fee: "<fee>",
    converted: "<converted>",
    rate: "<rate>",
    mid: "<mid>",
    received: "<received>",
    worth: "<worth>",
    totalCost: "<totalCost>",
    hidden: "<hidden>",
    percent: "<percent>",
  },
};
const legal: LegalValues = { name: "<name>", email: "<email>", hostingCountry: "<country>" };

const render = (code: (typeof LOCALE_CODES)[number]): PageText[] => [
  PAGES[code].methodology(methodology),
  PAGES[code].privacy(legal),
];

/** Every block's kind and size: a paragraph, a list of n items, a formula of n lines. */
const shape = (page: PageText) =>
  page.sections.map((s) =>
    s.blocks.map((b) =>
      "p" in b ? "p" : "list" in b ? `list${b.list.length}` : `f${b.formula.length}`,
    ),
  );

const allText = (page: PageText) => JSON.stringify(page);

describe("long pages", () => {
  it.each(LOCALE_CODES)("%s has the English pages' sections and blocks", (code) => {
    expect(render(code).map(shape)).toEqual(render("en").map(shape));
  });

  it.each(LOCALE_CODES)("%s uses every value it is given", (code) => {
    const [m, p] = render(code).map(allText);
    for (const value of [
      ...Object.values(methodology.example),
      "31 ",
      "6 ",
      "<maxCost>",
      methodology.sourceUrl,
    ])
      expect(m).toContain(value);
    for (const value of Object.values(legal)) expect(p).toContain(value);
  });

  it.each(LOCALE_CODES)("%s has no empty text", (code) => {
    expect(render(code).map(allText).join()).not.toContain('""');
  });

  it("German uses Swiss spelling (ss, never ß)", () => {
    expect(render("de").map(allText).join()).not.toContain("ß");
  });
});
