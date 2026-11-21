import type { Messages } from "./en.ts";

/** German, Swiss spelling: "ss", never "ß" (docs/adr/0005). */
export const de: Messages = {
  title: "FreuTransfer — Kostenvergleich",
  language: "Sprache",
  headline: "Was kommt wirklich an?",
  intro:
    "Sie senden Geld zwischen der Schweiz und dem Euroraum? Finden Sie heraus, was wirklich ankommt und wie viel im Wechselkurs versteckt ist.",
  form: {
    direction: "Richtung",
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
    checked: (date, ago) => `geprüft am ${date} · ${ago}`,
    measuredAgainst: (rate, bank, day) =>
      `geschätzt aus dem Abstand zum Mittelkurs ${rate} (${bank}, ${day}) beim Ablesen`,
  },
  rateSources: { ecb: "EZB" },
  results: {
    cheapest: "Am günstigsten",
    midRate: (p) =>
      `Verglichen mit dem Mittelkurs 1 ${p.from} = ${p.rate} ${p.to} (${p.bank}, ${p.day}); manuelle Kurse behalten ihren Abstand zum Kurs des Tages, an dem sie abgelesen wurden.`,
    midRateTooOld: (p) =>
      `Der Referenzkurs ist vom ${p.day}, also über ${p.days} Tage alt: Zurzeit kommen keine neuen Kurse an, die Ergebnisse können deshalb veraltet sein.`,
    none: "Noch keine geprüften Anbieterdaten.",
    staleHeading: (days) => `Seit über ${days} Tagen nicht mehr überprüft`,
    unavailableHeading: "Nicht in diesem Vergleich",
    notIncluded:
      "Nicht enthalten: allfällige Gebühren der Empfängerbank für eine eingehende Zahlung.",
  },
  unavailable: {
    no_reference_rate: "kein Referenzkurs für den Tag, an dem der Kurs abgelesen wurde",
    amount_not_supported:
      "die Gebühren sind höher als dieser Betrag, oder er liegt ausserhalb der Limiten des Anbieters",
    implausible_cost: "seine Preisdaten sehen fehlerhaft aus und werden überprüft",
  },
  myProvider: {
    label: "Mein Anbieter",
    choose: "Auswählen…",
    cheapest: (mine) => `${mine} ist für diesen Betrag am günstigsten.`,
    difference: (p) =>
      `Mit ${p.mine} zahlen Sie ${p.extraCost} mehr als mit ${p.best} (es kommen ${p.lessReceived} weniger an): ${p.perYear} pro Jahr, wenn Sie diesen Betrag jeden Monat senden.`,
  },
  chart: {
    costTitle: "Kosten nach Betrag",
    costSubtitle: (from, to) =>
      `Gesamtkosten im Verhältnis zum bezahlten Betrag, von ${from} bis ${to}. Eine Lücke: für diesen Betrag nicht verfügbar.`,
    amount: "Betrag",
    notAvailable: "nicht verfügbar",
    showTable: "Als Tabelle anzeigen",
    unavailable: "Die Grafik «Kosten nach Betrag» kann gerade nicht angezeigt werden.",
  },
  rateChart: {
    title: (from, to) => `Referenzkurs: 1 ${from} in ${to}`,
    subtitle: (bank, first, last) =>
      `Mittelkurs der ${bank} an Arbeitstagen, vom ${first} bis ${last}.`,
    none: "Für diesen Zeitraum sind noch keine Referenzkurse gespeichert.",
    day: "Tag",
    rate: "Kurs",
    keyboard: "Referenzkurs nach Tag: mit den Pfeiltasten links und rechts",
    unavailable: "Die Grafik zum Referenzkurs kann gerade nicht angezeigt werden.",
  },
  nav: { home: "Vergleich", methodology: "So funktioniert es", privacy: "Datenschutz" },
  site: {
    rates: (bank) => `Referenzkurs: ${bank} über Frankfurter`,
  },
  notFound: {
    title: "Seite nicht gefunden",
    text: "Diese Adresse gibt es nicht (mehr).",
    home: "Zum Vergleich",
  },
  apiPage: {
    title: "API",
    intro:
      "Der Vergleich läuft über eine HTTP-API. Diese Seite entsteht aus ihrer OpenAPI-Beschreibung:",
    english: "Die Beschreibungen der API selbst sind auf Englisch.",
    endpoints: "Endpunkte",
    parameters: "Parameter",
    answers: "Antworten",
    dataTypes: "Datentypen",
    field: "Feld",
    type: "Typ",
    required: "Pflicht",
    optional: "optional",
    description: "Beschreibung",
    status: "Status",
    oneOf: "Eine dieser Formen:",
    loading: "Die API-Beschreibung wird geladen …",
    unavailable:
      "Die API-Beschreibung kann gerade nicht geladen werden. Bitte versuchen Sie es später noch einmal.",
  },
  caveats: {
    monthly_allowance: (amount) =>
      `Kein Aufschlag auf die ersten ${amount}, die Sie pro Monat wechseln; frühere Wechsel in diesem Monat zählen mit.`,
    amount_limit: (amount) => `Höchstens ${amount} pro Überweisung.`,
  },
  errors: {
    unreachable: "Der Dienst ist im Moment nicht erreichbar. Bitte versuchen Sie es später erneut.",
    notJson: (status) =>
      `Der Dienst hat unerwartet geantwortet (HTTP ${status}). Bitte versuchen Sie es später erneut.`,
    http: (status) =>
      `Der Dienst hat im Moment ein Problem (HTTP ${status}). Bitte versuchen Sie es später erneut.`,
    invalidQuery: "Die Anfrage wurde abgelehnt. Bitte prüfen Sie den Betrag.",
    corridorNotAvailable: "Für diese Währungen gibt es noch keinen Referenzkurs.",
  },
  disclaimer: "Nur Schätzungen zur Information, keine Finanzberatung.",
};
