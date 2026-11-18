import { describe, expect, it } from "vitest";
import { daysBefore, zurichDay } from "./day.ts";

describe("zurichDay", () => {
  it("is the day in Zurich, not in UTC", () => {
    // 23:30 UTC on 18 Nov is 00:30 on 19 Nov in Zurich (CET, UTC+1).
    expect(zurichDay(new Date("2026-11-18T23:30:00Z"))).toBe("2026-11-19");
    // 21:59 UTC on 28 Jun is 23:59 on 28 Jun in Zurich (CEST, UTC+2).
    expect(zurichDay(new Date("2026-06-28T21:59:00Z"))).toBe("2026-06-28");
  });
});

describe("daysBefore", () => {
  it.each([
    ["2026-11-18", 0, "2026-11-18"],
    ["2026-11-18", 6, "2026-11-12"],
    ["2026-03-01", 1, "2026-02-28"], // 2026 is not a leap year
    ["2028-03-01", 1, "2028-02-29"], // 2028 is
    ["2026-01-01", 1, "2025-12-31"], // across a year
    ["2026-03-30", 2, "2026-03-28"], // across the switch to summer time (29 Mar): still 2 days
  ])("%s minus %i days is %s", (day, days, expected) => {
    expect(daysBefore(day, days)).toBe(expected);
  });
});
