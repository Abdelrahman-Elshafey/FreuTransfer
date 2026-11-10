import type { Messages } from "./en.ts";

/** German, Swiss spelling: "ss", never "ß" (docs/adr/0005). */
export const de: Messages = {
  title: "FreuTransfer — Kostenvergleich",
  language: "Sprache",
  intro:
    "Sie senden Franken. Finden Sie heraus, was wirklich ankommt und wie viel im Wechselkurs versteckt ist.",
  form: {
    iPay: "Ich zahle",
    amountLabel: (currency) => `Betrag in ${currency}`,
    compare: "Vergleichen",
    comparing: "Wird verglichen…",
    invalidAmount: (example) => `Geben Sie einen Betrag über 0 ein, zum Beispiel ${example}.`,
  },
  table: {
    rank: "#",
    provider: "Anbieter",
    arrives: "Kommt an",
    fee: "Gebühr",
    hidden: "Im Kurs versteckt",
    totalCost: "Gesamtkosten",
    source: "Quelle",
  },
  source: {
    ruleBased: "Regelbasiert",
    manual: "Manuell",
    manualApproximate: "Manuell · ungefähr",
    checked: (date) => `geprüft am ${date}`,
    comparedWith: (rate, bank, day) => `vs. Mittelkurs ${rate} (${bank}, ${day})`,
  },
  rateSources: { ecb: "EZB", cbe: "Zentralbank Ägyptens", nbs: "Nationalbank Serbiens" },
  results: {
    midRate: (p) =>
      `Verglichen mit dem Mittelkurs 1 ${p.from} = ${p.rate} ${p.to} (${p.bank}, ${p.day}); manuelle Kurse mit dem Kurs des Tages, an dem sie abgelesen wurden.`,
    none: "Noch keine geprüften Anbieterdaten.",
    staleHeading: (days) => `Seit über ${days} Tagen nicht mehr überprüft`,
    unavailableHeading: "Für diesen Betrag nicht verfügbar",
  },
  unavailable: {
    no_reference_rate: "kein Referenzkurs für den Tag, an dem der Kurs abgelesen wurde",
    amount_not_supported:
      "die Gebühren sind höher als dieser Betrag, oder er liegt ausserhalb der Limiten des Anbieters",
  },
  errors: {
    unreachable: "Die API ist nicht erreichbar. Läuft sie?",
    notJson: (status) => `Die API hat etwas geantwortet, das kein JSON ist (HTTP ${status}).`,
    http: (status) => `Die API hat mit HTTP ${status} geantwortet.`,
    invalidQuery: "Die Anfrage wurde abgelehnt. Bitte prüfen Sie den Betrag.",
    corridorNotAvailable: "Für diese Währungen gibt es noch keinen Referenzkurs.",
  },
  disclaimer: "Nur Schätzungen zur Information, keine Finanzberatung.",
};
