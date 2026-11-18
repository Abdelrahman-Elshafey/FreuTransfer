import type { PagesText } from "./types.ts";

// English, the source text for the long pages; de/fr/it follow it (typed against PagesText).
// Facts checked 2026-11-18: ECB publication (ecb.europa.eu, "around 16:00 CET every working day",
// concertation "around 14:10 CET", "for information purposes only"); Remittance Prices Worldwide
// (World Bank data catalog, dataset Q3 2025: no corridor between Switzerland and the euro area);
// Swiss Data Protection Ordinance, Annex 1 (fedlex, status 1 Dec 2025: the United States only for
// companies certified under the Swiss-US Data Privacy Framework; Singapore not listed); Cloudflare's
// privacy policy (effective 4 Nov 2025, section 7: certified under the Swiss-U.S. DPF).

export const en: PagesText = {
  methodology: (v) => ({
    title: "How the comparison works",
    intro:
      "You enter what leaves your account. For each provider we work out what arrives, and how much of the difference is a visible fee and how much is hidden in the exchange rate.",
    sections: [
      {
        heading: "What is compared",
        blocks: [
          {
            p: [
              "Two directions: Swiss francs to euros, and euros to Swiss francs, from an account at the provider to a bank account in the euro area or in Switzerland. Providers: Wise, Yuh, Revolut and PostFinance in both directions; Western Union from francs to euros.",
            ],
          },
          {
            p: [
              "Only providers that publish exact prices are included, so every number can be traced back to a source. Each price shows its source and the day it was checked.",
            ],
          },
        ],
      },
      {
        heading: "The reference rate",
        blocks: [
          {
            p: [
              "Every provider is measured against the same rate: the euro reference rate of the ",
              {
                text: "European Central Bank",
                href: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
              },
              ". It is set around 14:10 CET and published around 16:00 CET on every working day, and it is a mid-market rate: halfway between buying and selling. We collect it every hour through ",
              { text: "Frankfurter", href: "https://frankfurter.dev" },
              ", always pinned to the ECB. The ECB publishes it for information only; no provider promises to exchange at it.",
            ],
          },
        ],
      },
      {
        heading: "The cost",
        blocks: [
          {
            p: [
              "What arrives is converted back at the reference rate. Whatever is missing from what you paid is the cost:",
            ],
          },
          {
            formula: [
              "total cost  = what you pay − what arrives ÷ reference rate",
              "hidden cost = total cost − visible fee",
              "cost in %   = total cost ÷ what you pay",
            ],
          },
          {
            p: [
              `Example: you pay ${v.example.paid}. The provider takes a fee of ${v.example.fee} and exchanges the remaining ${v.example.converted} at ${v.example.rate}, while the reference rate is ${v.example.mid}. ${v.example.received} arrive, worth ${v.example.worth} at the reference rate. The total cost is ${v.example.totalCost} (${v.example.percent}), of which ${v.example.hidden} is hidden in the exchange rate.`,
            ],
          },
          {
            p: [
              "Amounts are calculated exactly and rounded once, to the cent, at the end. The ranking is by total cost: the cheapest provider is also the one with the most arriving.",
            ],
          },
        ],
      },
      {
        heading: "Where the prices come from",
        blocks: [
          {
            list: [
              [
                "Rule-based: the provider publishes its fee and its margin over the reference rate (Wise, Yuh, Revolut). We apply them to today's reference rate, for any amount.",
              ],
              [
                "Manual: the provider publishes a rate, not a margin (PostFinance, Western Union). We read it by hand at a known time and keep its distance from that day's reference rate; applied to today's reference rate, it gives an estimate, marked “approximate”.",
              ],
            ],
          },
          {
            p: [
              `Every price is checked by hand against the provider's own page, with a link and the date. A price not re-checked for more than ${v.recheckDays} days is listed separately, not ranked. If the newest reference rate is more than ${v.maxAgeDays} days old, the page warns that the results may be out of date.`,
            ],
          },
          {
            p: [
              `A total cost above ${v.maxCost} or below zero almost always means a mistyped price, not a real one. Such a price is not ranked; it is listed as being checked.`,
            ],
          },
        ],
      },
      {
        heading: "What is not included",
        blocks: [
          {
            list: [
              ["Fees the recipient's bank may charge for an incoming payment."],
              [
                "Rates that change during the day, and markups some providers add at weekends or outside market hours.",
              ],
              [
                "Allowances that depend on what you exchanged earlier: Revolut's free monthly amount is assumed unused, and the page says so.",
              ],
              [
                "Paid plans and special conditions: the prices are for each provider's standard offer.",
              ],
            ],
          },
        ],
      },
      {
        heading: "Why there is no World Bank comparison",
        blocks: [
          {
            p: [
              "The World Bank's ",
              {
                text: "Remittance Prices Worldwide",
                href: "https://datacatalog.worldbank.org/search/dataset/0037898/remittance-prices-worldwide",
              },
              " is the usual reference for transfer costs, but it covers transfers to lower- and middle-income countries. Its corridors from Switzerland go to Albania, Hungary, Kosovo, Serbia and Sri Lanka; none goes to the euro area, and none goes to Switzerland. There is nothing to compare these results with.",
            ],
          },
        ],
      },
      {
        heading: "Open method",
        blocks: [
          {
            p: [
              "The calculation, the data and their history are public: ",
              { text: "source code on GitHub", href: v.sourceUrl },
              ". The results are estimates for information only, not financial advice.",
            ],
          },
          {
            p: [
              "FreuTransfer is a private, non-commercial project with no business relationship with any provider: no affiliate links, no commissions, no advertising. Provider names are used only to identify the providers.",
            ],
          },
        ],
      },
    ],
  }),

  privacy: (v) => ({
    title: "Privacy",
    intro:
      "FreuTransfer has no accounts, no cookies, no analytics, no advertising and no tracking. This page lists everything that does happen with data.",
    sections: [
      {
        heading: "Who is responsible",
        blocks: [
          {
            p: [
              `FreuTransfer is a private, non-commercial project run by ${v.name}. Contact: ${v.email}.`,
            ],
          },
        ],
      },
      {
        heading: "In your browser",
        blocks: [
          {
            p: [
              "Your language and the provider you chose under “My provider” are kept in your browser's local storage, so the page remembers them. They never leave your browser; you can delete them with your browser's site data.",
            ],
          },
          {
            p: ["The page loads nothing from other sites: fonts and code come from this site."],
          },
        ],
      },
      {
        heading: "On the server",
        blocks: [
          {
            p: [
              "Like any web server, ours writes a log line for each request: your IP address, the time, the address asked for, the page you came from and your browser's name. The logs serve to run the site and to protect it from abuse (each visitor may make a limited number of requests a second). They are kept until they are overwritten: each part of the site keeps at most 30 MB of logs. Nothing in them is combined with other data or passed on.",
            ],
          },
          {
            p: [
              `The server is a virtual server rented from OVHcloud (data centre location: ${v.hostingCountry}). The exchange rates are fetched by the server; your browser never contacts the European Central Bank or Frankfurter.`,
            ],
          },
        ],
      },
      {
        heading: "Cloudflare",
        blocks: [
          {
            p: [
              "Requests reach the server through Cloudflare, which provides the encrypted connection and protection against attacks. Cloudflare processes your IP address to do this, also in the United States. Cloudflare, Inc. is a US company certified under the Swiss-U.S. Data Privacy Framework, with which Switzerland recognises an adequate level of data protection; see ",
              {
                text: "Cloudflare's privacy policy",
                href: "https://www.cloudflare.com/privacypolicy/",
              },
              ".",
            ],
          },
        ],
      },
      {
        heading: "Your rights",
        blocks: [
          {
            p: [
              `Under the Swiss Federal Act on Data Protection (and the GDPR if you are in the EU), you can ask what data about you is kept, and have it deleted. Write to ${v.email}. As the logs contain no names, please include your IP address and the time of your visit.`,
            ],
          },
        ],
      },
    ],
  }),
};
