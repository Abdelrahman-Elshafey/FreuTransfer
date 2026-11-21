/**
 * Who runs the site: named on the privacy page in every language (the Swiss FADP, Art. 19, asks
 * for the identity and contact of whoever processes the visitors' data; there is no imprint page,
 * owner, 2026-11-18). One place, so the four languages can't disagree. Public, also in git history:
 * no postal address.
 */
export const OPERATOR = {
  name: "Abdelrahman Elshafey",
  email: "bodynody1@gmail.com",
} as const;

/**
 * Where the server runs, as an ISO 3166 code: the OVHcloud data centre in Singapore (owner,
 * 2026-11-18). The page names it in the reader's language (Formatter.region).
 */
export const HOSTING_REGION = "SG";

/** Where the reference rates come from (the collector reads its API; docs/adr/0003). */
export const RATES_URL = "https://frankfurter.dev";
