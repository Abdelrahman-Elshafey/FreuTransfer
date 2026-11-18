/**
 * Calendar days as "YYYY-MM-DD" strings, in Zurich: the reference rate's own time zone and the
 * day the site's readers live in. Strings, so there's no time-of-day to drift across time zones.
 */

/** The calendar day an instant falls on in Zurich (the sv-SE locale writes dates as YYYY-MM-DD). */
export function zurichDay(instant: Date): string {
  return instant.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
}

/** The day `days` calendar days before `day`: daysBefore("2026-03-01", 1) = "2026-02-28". */
export function daysBefore(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
