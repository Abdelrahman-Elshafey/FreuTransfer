/**
 * The numbers the methodology quotes. The page can't import core (it would ship the cost engine
 * to every visitor), so they are written here, and methodology-values.test.ts checks each against
 * core: the limits against its constants, the example against core's Money and Rate.
 */
export const METHODOLOGY = {
  /** core RECHECK_DAYS */
  recheckDays: 30,
  /** core MID_RATE_MAX_AGE_DAYS */
  maxAgeDays: 5,
  /** core MAX_PLAUSIBLE_COST, as the API's percent string ("10" = 10%) */
  maxCostPercent: "10",
  /** Project Plan §3: pay 1,000 CHF, fee 5 CHF deducted, rate 1.05 while the reference is 1.07. */
  example: {
    from: "CHF",
    to: "EUR",
    paid: "1000.00",
    fee: "5.00",
    converted: "995.00",
    rate: "1.05",
    mid: "1.07",
    received: "1044.75",
    worth: "976.40",
    totalCost: "23.60",
    hidden: "18.60",
    percent: "2.36",
  },
} as const;
