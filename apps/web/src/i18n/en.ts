import type { CaveatDto, ComparisonDto } from "@freu-transfer/api/contract";

type UnavailableReason = ComparisonDto["unavailable"][number]["reason"];

/**
 * English, the source catalog. `Messages` is derived from it, so the other languages must have
 * exactly these keys with the same parameters (TypeScript checks it; docs/adr/0005).
 * Text with values is a function: each language builds its own sentence and word order.
 * Values arrive already formatted for the locale (see format.ts).
 */
export const en = {
  title: "FreuTransfer — Cost Comparer",
  language: "Language",
  headline: "What really arrives?",
  intro:
    "Sending money between Switzerland and the euro area? Find out what really arrives, and how much is hidden in the exchange rate.",
  form: {
    direction: "Direction",
    iPay: "I pay",
    amountLabel: (currency: string) => `Amount in ${currency}`,
    compare: "Compare",
    comparing: "Comparing…",
    invalidAmount: (example: string) => `Enter an amount greater than 0, like ${example}.`,
  },
  table: {
    rank: "#",
    provider: "Provider",
    arrives: "Arrives",
    fee: "Fee",
    hidden: "Hidden in rate",
    totalCost: "Total cost",
    source: "Source",
  },
  source: {
    ruleBased: "Rule-based",
    manual: "Manual",
    manualApproximate: "Manual · approximate",
    checked: (date: string, ago: string) => `checked ${date} · ${ago}`,
    measuredAgainst: (rate: string, bank: string, day: string) =>
      `estimated from its gap to mid ${rate} (${bank}, ${day}) when read`,
  },
  /** Who publishes a reference rate (the API's `midRate.source`). */
  rateSources: { ecb: "ECB" },
  results: {
    cheapest: "Cheapest",
    midRate: (p: { from: string; to: string; rate: string; bank: string; day: string }) =>
      `Compared with the mid-market rate 1 ${p.from} = ${p.rate} ${p.to} (${p.bank}, ${p.day}); manual rates keep their gap to the rate of the day they were read.`,
    midRateTooOld: (p: { day: string; days: number }) =>
      `The reference rate is from ${p.day}, more than ${p.days} days ago: new rates are not arriving right now, so these results may be out of date.`,
    none: "No verified provider data yet.",
    staleHeading: (days: number) => `Not re-checked for over ${days} days`,
    unavailableHeading: "Not in this comparison",
    notIncluded: "Not included: any fee the recipient's bank charges for an incoming payment.",
  },
  unavailable: {
    no_reference_rate: "no reference rate for the day its rate was read",
    amount_not_supported:
      "the fees are higher than this amount, or it is outside the provider's limits",
    implausible_cost: "its price data looks wrong and is being checked",
  } satisfies Record<UnavailableReason, string>,
  /** The API's caveat codes (`CaveatDto`); `amount` arrives formatted, e.g. "CHF 1'250.00". */
  myProvider: {
    label: "My provider",
    choose: "Choose…",
    cheapest: (mine: string) => `${mine} is the cheapest for this amount.`,
    difference: (p: {
      mine: string;
      best: string;
      extraCost: string;
      lessReceived: string;
      perYear: string;
    }) =>
      `With ${p.mine} you pay ${p.extraCost} more than with ${p.best} (${p.lessReceived} less arrives): ${p.perYear} a year if you send this amount every month.`,
  },
  caveats: {
    monthly_allowance: (amount: string) =>
      `No markup on the first ${amount} you exchange each month; exchanges earlier this month use it up.`,
    amount_limit: (amount: string) => `At most ${amount} per transfer.`,
  } satisfies Record<CaveatDto["code"], (amount: string) => string>,
  errors: {
    unreachable: "The service can't be reached right now. Please try again later.",
    notJson: (status: number) =>
      `The service sent an unexpected answer (HTTP ${status}). Please try again later.`,
    http: (status: number) =>
      `The service has a problem right now (HTTP ${status}). Please try again later.`,
    invalidQuery: "The request was rejected. Please check the amount.",
    corridorNotAvailable: "There is no reference rate for these currencies yet.",
  },
  disclaimer: "Estimates for information only, not financial advice.",
};

export type Messages = typeof en;
