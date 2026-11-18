import type { CurrencyCode } from "./currency.ts";
import { daysBefore, zurichDay } from "./day.ts";
import type { MidRateObservation } from "./offer.ts";
import type { MidRateHistory } from "./ports.ts";

/** The longest history one request may ask for: a year, leap day included. */
export const HISTORY_MAX_DAYS = 366;

/**
 * Use case: the reference rates of the last `days` calendar days in Zurich, today included,
 * oldest first. Days without a publication (weekends, holidays) simply have no rate.
 */
export async function rateHistory(
  ports: { readonly history: MidRateHistory },
  request: {
    readonly base: CurrencyCode;
    readonly quote: CurrencyCode;
    readonly days: number;
    readonly now: Date;
  },
): Promise<{
  readonly fromDay: string;
  readonly toDay: string;
  readonly rates: readonly MidRateObservation[];
}> {
  const toDay = zurichDay(request.now);
  const fromDay = daysBefore(toDay, request.days - 1);
  const rates = await ports.history.between(request.base, request.quote, fromDay, toDay);
  return { fromDay, toDay, rates };
}
