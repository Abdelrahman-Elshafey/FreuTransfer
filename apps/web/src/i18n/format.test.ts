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

describe("ago", () => {
  // Expected texts printed from Node 26.13's ICU (Intl.RelativeTimeFormat, numeric "auto").
  const now = new Date("2026-11-14T10:00:00Z"); // 11:00 in Zurich (CET, UTC+1)

  it.each([
    // [checked at (UTC), Zurich calendar days before 14 Nov, en-CH]
    ["2026-11-14T08:00:00Z", "today"], // 09:00 Zurich, 14 Nov
    ["2026-11-13T23:30:00Z", "today"], // 00:30 Zurich, 14 Nov: still the 13th in UTC
    ["2026-11-13T22:59:00Z", "yesterday"], // 23:59 Zurich, 13 Nov: under 12 hours ago
    ["2026-11-12T12:00:00Z", "2 days ago"],
    ["2026-11-06T07:38:00Z", "8 days ago"],
  ])("checked %s is %j on 14 Nov 11:00 in Zurich", (checked, expected) => {
    expect(formatterFor("en-CH").ago(checked, now)).toBe(expected);
  });

  it("is in the reader's language", () => {
    const eightDays = "2026-11-06T07:38:00Z";
    expect(formatterFor("de-CH").ago(eightDays, now)).toBe("vor 8 Tagen");
    expect(formatterFor("fr-CH").ago(eightDays, now)).toBe("il y a 8 jours");
    expect(formatterFor("it-CH").ago(eightDays, now)).toBe("8 giorni fa");
    expect(formatterFor("de-CH").ago("2026-11-12T12:00:00Z", now)).toBe("vorgestern");
  });

  it("counts calendar days across the switch to summer time (29 Mar 2026, a 23-hour day)", () => {
    // 28 Mar 12:00 Zurich (CET) to 30 Mar 12:00 Zurich (CEST): 47 hours, 2 calendar days.
    const after = new Date("2026-03-30T10:00:00Z");
    expect(formatterFor("en-CH").ago("2026-03-28T11:00:00Z", after)).toBe("2 days ago");
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
