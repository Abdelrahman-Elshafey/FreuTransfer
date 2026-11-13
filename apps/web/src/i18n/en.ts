import type { ComparisonDto } from "@freu-transfer/api/contract";

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
  intro:
    "You send francs. Find out what really arrives, and how much is hidden in the exchange rate.",
  form: {
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
    checked: (date: string) => `checked ${date}`,
    comparedWith: (rate: string, bank: string, day: string) => `vs mid ${rate} (${bank}, ${day})`,
  },
  /** Who publishes a reference rate (the API's `midRate.source`). */
  rateSources: { ecb: "ECB", cbe: "Central Bank of Egypt", nbs: "National Bank of Serbia" },
  results: {
    midRate: (p: { from: string; to: string; rate: string; bank: string; day: string }) =>
      `Compared with the mid-market rate 1 ${p.from} = ${p.rate} ${p.to} (${p.bank}, ${p.day}); manual rates with the rate of the day they were read.`,
    midRateTooOld: (p: { day: string; days: number }) =>
      `The reference rate is from ${p.day}, more than ${p.days} days ago: new rates are not arriving right now, so these results may be out of date.`,
    none: "No verified provider data yet.",
    staleHeading: (days: number) => `Not re-checked for over ${days} days`,
    unavailableHeading: "Not available for this amount",
  },
  unavailable: {
    no_reference_rate: "no reference rate for the day its rate was read",
    amount_not_supported:
      "the fees are higher than this amount, or it is outside the provider's limits",
  } satisfies Record<UnavailableReason, string>,
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
