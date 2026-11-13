import type { Messages } from "./en.ts";

/** Italian (Switzerland), formal "Lei" like the German "Sie". */
export const it: Messages = {
  title: "FreuTransfer — Confronto dei costi",
  language: "Lingua",
  intro: "Invia franchi? Scopra quanto arriva davvero e quanto è nascosto nel tasso di cambio.",
  form: {
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
    checked: (date) => `verificato il ${date}`,
    comparedWith: (rate, bank, day) => `vs tasso medio ${rate} (${bank}, ${day})`,
  },
  rateSources: { ecb: "BCE" },
  results: {
    midRate: (p) =>
      `Confrontato con il tasso medio di mercato 1 ${p.from} = ${p.rate} ${p.to} (${p.bank}, ${p.day}); i tassi manuali con quello del giorno in cui sono stati letti.`,
    midRateTooOld: (p) =>
      `Il tasso di riferimento è del ${p.day}, cioè di oltre ${p.days} giorni fa: al momento non arrivano nuovi tassi, quindi questi risultati potrebbero non essere aggiornati.`,
    none: "Ancora nessun dato verificato.",
    staleHeading: (days) => `Non ricontrollati da oltre ${days} giorni`,
    unavailableHeading: "Non disponibile per questo importo",
  },
  unavailable: {
    no_reference_rate: "nessun tasso di riferimento per il giorno in cui è stato letto il tasso",
    amount_not_supported:
      "le commissioni superano questo importo, oppure è fuori dai limiti del fornitore",
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
