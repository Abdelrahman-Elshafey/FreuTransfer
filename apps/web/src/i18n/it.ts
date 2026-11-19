import type { Messages } from "./en.ts";

/** Italian (Switzerland), formal "Lei" like the German "Sie". */
export const it: Messages = {
  title: "FreuTransfer — Confronto dei costi",
  language: "Lingua",
  headline: "Che cosa arriva davvero?",
  intro:
    "Invia denaro tra la Svizzera e l’area dell’euro? Scopra quanto arriva davvero e quanto è nascosto nel tasso di cambio.",
  form: {
    direction: "Direzione",
    iPay: "Pago",
    amountLabel: (currency) => `Importo in ${currency}`,
    compare: "Confronta",
    comparing: "Confronto in corso…",
    invalidAmount: (example) => `Inserisca un importo maggiore di 0, ad esempio ${example}.`,
  },
  table: {
    rank: "#",
    provider: "Fornitore",
    arrives: "Arriva",
    fee: "Commissione",
    hidden: "Nascosto nel tasso",
    totalCost: "Costo totale",
    source: "Fonte",
  },
  source: {
    ruleBased: "Secondo le tariffe pubblicate",
    manual: "Manuale",
    manualApproximate: "Manuale · approssimativo",
    checked: (date, ago) => `verificato il ${date} · ${ago}`,
    measuredAgainst: (rate, bank, day) =>
      `stimato dallo scarto rispetto al tasso medio ${rate} (${bank}, ${day}) al momento della lettura`,
  },
  rateSources: { ecb: "BCE" },
  results: {
    cheapest: "Il più conveniente",
    midRate: (p) =>
      `Confrontato con il tasso medio di mercato 1 ${p.from} = ${p.rate} ${p.to} (${p.bank}, ${p.day}); i tassi manuali mantengono il loro scarto rispetto al tasso del giorno in cui sono stati letti.`,
    midRateTooOld: (p) =>
      `Il tasso di riferimento è del ${p.day}, cioè di oltre ${p.days} giorni fa: al momento non arrivano nuovi tassi, quindi questi risultati potrebbero non essere aggiornati.`,
    none: "Ancora nessun dato verificato.",
    staleHeading: (days) => `Non ricontrollati da oltre ${days} giorni`,
    unavailableHeading: "Non in questo confronto",
    notIncluded:
      "Non inclusi: eventuali costi della banca del beneficiario per un pagamento in entrata.",
  },
  unavailable: {
    no_reference_rate: "nessun tasso di riferimento per il giorno in cui è stato letto il tasso",
    amount_not_supported:
      "le commissioni superano questo importo, oppure è fuori dai limiti del fornitore",
    implausible_cost: "i suoi dati di prezzo sembrano errati e sono in verifica",
  },
  myProvider: {
    label: "Il mio fornitore",
    choose: "Scegliere…",
    cheapest: (mine) => `${mine} è il più conveniente per questo importo.`,
    difference: (p) =>
      `Con ${p.mine} paga ${p.extraCost} in più che con ${p.best} (arrivano ${p.lessReceived} in meno): ${p.perYear} all’anno se invia questo importo ogni mese.`,
  },
  chart: {
    costTitle: "Costo secondo l’importo",
    costSubtitle: (from, to) =>
      `Costo totale rispetto all’importo pagato, da ${from} a ${to}. Un’interruzione: non disponibile per quell’importo.`,
    amount: "Importo",
    notAvailable: "non disponibile",
    showTable: "Mostra come tabella",
    unavailable: "Il grafico «Costo secondo l’importo» non può essere mostrato al momento.",
  },
  rateChart: {
    title: (from, to) => `Tasso di riferimento: 1 ${from} in ${to}`,
    subtitle: (bank, first, last) =>
      `Tasso medio pubblicato dalla ${bank} nei giorni lavorativi, dal ${first} al ${last}.`,
    none: "Per questo periodo non sono ancora salvati tassi di riferimento.",
    day: "Giorno",
    rate: "Tasso",
    keyboard: "Tasso di riferimento per giorno: frecce sinistra e destra",
    unavailable: "Il grafico del tasso di riferimento non può essere mostrato al momento.",
  },
  nav: { methodology: "Metodologia", privacy: "Privacy", api: "API" },
  notFound: {
    title: "Pagina non trovata",
    text: "Questo indirizzo non esiste (più).",
    home: "Al confronto",
  },
  apiPage: {
    title: "API",
    intro:
      "Il confronto si basa su un’API HTTP. Questa pagina è costruita dalla sua descrizione OpenAPI:",
    english: "Le descrizioni proprie dell’API sono in inglese.",
    endpoints: "Endpoint",
    parameters: "Parametri",
    answers: "Risposte",
    dataTypes: "Tipi di dati",
    field: "Campo",
    type: "Tipo",
    required: "obbligatorio",
    optional: "facoltativo",
    description: "Descrizione",
    status: "Stato",
    oneOf: "Una di queste forme:",
    loading: "Caricamento della descrizione dell’API…",
    unavailable: "La descrizione dell’API non può essere caricata al momento. Riprovi più tardi.",
  },
  caveats: {
    monthly_allowance: (amount) =>
      `Nessuna maggiorazione sui primi ${amount} cambiati ogni mese; i cambi effettuati prima nel mese ne vengono detratti.`,
    amount_limit: (amount) => `Al massimo ${amount} per bonifico.`,
  },
  errors: {
    unreachable: "Il servizio non è raggiungibile al momento. Riprovi più tardi.",
    notJson: (status) =>
      `Il servizio ha dato una risposta inattesa (HTTP ${status}). Riprovi più tardi.`,
    http: (status) => `Il servizio ha un problema al momento (HTTP ${status}). Riprovi più tardi.`,
    invalidQuery: "La richiesta è stata rifiutata. Controlli l’importo.",
    corridorNotAvailable: "Non c’è ancora un tasso di riferimento per queste valute.",
  },
  disclaimer: "Stime a solo scopo informativo, non consulenza finanziaria.",
};
