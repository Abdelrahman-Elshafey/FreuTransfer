import { describe, expect, it } from "vitest";
import { formatterFor, parseAmount } from "./format.ts";

// Expected strings were printed from Node 26.13's ICU (code points checked: U+00A0 is a no-break
// space; Swiss locales group with a plain apostrophe) and are written here as escapes.
const NBSP = " ";

describe("formatterFor", () => {
  const de = formatterFor("de-CH");
  const fr = formatterFor("fr-CH");

  it("formats money exactly as the API sent it, in the locale's style", () => {
    expect(de.money({ amount: "1044.75", currency: "EUR" })).toBe(`EUR${NBSP}1'044.75`);
    expect(fr.money({ amount: "1044.75", currency: "EUR" })).toBe(`1'044.75${NBSP}€`);
  });

  it("never goes through a float: 17 significant digits survive", () => {
    // As a JS number, 12345678901234567.89 would print as 12345678901234568.
    expect(de.money({ amount: "12345678901234567.89", currency: "CHF" })).toBe(
      `CHF${NBSP}12'345'678'901'234'567.89`,
    );
  });

  it("shows exactly the decimals it is given, so the page never rounds money again", () => {
    // A rate keeps all 10 decimals; a whole amount shows none.
    expect(fr.decimal("1.0803802939")).toBe("1,0803802939");
    expect(de.decimal("1000")).toBe("1'000");
  });

  it("formats the API's percent string (\"0.95\" = 0.95%) with the locale's decimal mark", () => {
    // "0.95E-2" = 0.0095 exactly; the percent style multiplies by 100 → 0.95%.
    expect(de.percent("0.95")).toBe("0.95%");
    expect(fr.percent("0.95")).toBe("0,95%");
    expect(de.percent("-0.12")).toBe("-0.12%");
  });

  it("shows an instant as the day in Zurich, not in UTC", () => {
    // 23:30 UTC on 5 Nov is 00:30 on 6 Nov in Zurich (CET = UTC+1).
    expect(de.instant("2026-11-05T23:30:00Z")).toBe("06.11.2026");
  });

  it("shows a calendar day without shifting it", () => {
    expect(de.day("2026-11-05")).toBe("05.11.2026");
  });
});

describe("parseAmount", () => {
  it.each([
    ["1000", "1000"],
    ["1000.50", "1000.50"],
    ["1000,50", "1000.50"],
    ["1'000.50", "1000.50"],
    ["1’000,5", "1000.5"],
    [" 1 000,50 ", "1000.50"],
    [`1${NBSP}000`, "1000"],
    ["0.01", "0.01"],
  ])("reads %j as %j", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each([
    ["", "empty"],
    ["0", "zero"],
    ["0,00", "zero"],
    ["-5", "negative"],
    ["10.123", "three decimals"],
    ["1.000", "ambiguous: 1 or 1,000"],
    ["1,000.50", "two decimal marks"],
    ["12345678", "more than 7 digits"],
    ["1e3", "exponent"],
    ["abc", "not a number"],
  ])("refuses %j (%s)", (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});
