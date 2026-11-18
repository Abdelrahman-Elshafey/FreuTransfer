// The format of the long texts (methodology, privacy): structured, so each language
// writes only words and the page decides how they look. Values (numbers, amounts, the operator's
// name) are passed in already formatted, like everywhere else in the catalogs.

/** Text, or a link inside it. */
export type Inline = string | { readonly text: string; readonly href: string };

export type Block =
  | { readonly p: readonly Inline[] }
  | { readonly list: readonly (readonly Inline[])[] }
  /** Lines shown as a formula, in the monospace font. */
  | { readonly formula: readonly string[] };

type Section = { readonly heading: string; readonly blocks: readonly Block[] };

export type PageText = {
  readonly title: string;
  readonly intro: string;
  readonly sections: readonly Section[];
};

/** The values the methodology quotes (methodology-values.ts, checked against core by its test). */
export type MethodologyValues = {
  readonly recheckDays: number;
  readonly maxAgeDays: number;
  /** The sanity limit, formatted ("10%"). */
  readonly maxCost: string;
  readonly sourceUrl: string;
  /** The worked example, every amount formatted for the locale. */
  readonly example: {
    readonly paid: string;
    readonly fee: string;
    readonly converted: string;
    readonly rate: string;
    readonly mid: string;
    readonly received: string;
    readonly worth: string;
    readonly totalCost: string;
    readonly hidden: string;
    readonly percent: string;
  };
};

export type LegalValues = {
  readonly name: string;
  readonly email: string;
  readonly hostingCountry: string;
};

export type PagesText = {
  readonly methodology: (v: MethodologyValues) => PageText;
  readonly privacy: (v: LegalValues) => PageText;
};
