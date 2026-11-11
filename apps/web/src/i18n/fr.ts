import type { Messages } from "./en.ts";

/** French (Switzerland). */
export const fr: Messages = {
  title: "FreuTransfer — Comparateur de coûts",
  language: "Langue",
  intro:
    "Vous envoyez des francs. Découvrez ce qui arrive vraiment, et combien est caché dans le taux de change.",
  form: {
    iPay: "Je paie",
    amountLabel: (currency) => `Montant en ${currency}`,
    compare: "Comparer",
    comparing: "Comparaison…",
    invalidAmount: (example) => `Saisissez un montant supérieur à 0, par exemple ${example}.`,
  },
  table: {
    rank: "#",
    provider: "Prestataire",
    arrives: "Montant reçu",
    fee: "Frais",
    hidden: "Caché dans le taux",
    totalCost: "Coût total",
    source: "Source",
  },
  source: {
    ruleBased: "Selon les tarifs publiés",
    manual: "Manuel",
    manualApproximate: "Manuel · approximatif",
    checked: (date) => `vérifié le ${date}`,
    comparedWith: (rate, bank, day) => `vs taux moyen ${rate} (${bank}, ${day})`,
  },
  rateSources: {
    ecb: "BCE",
    cbe: "Banque centrale d’Égypte",
    nbs: "Banque nationale de Serbie",
  },
  results: {
    midRate: (p) =>
      `Comparé au taux moyen du marché 1 ${p.from} = ${p.rate} ${p.to} (${p.bank}, ${p.day}) ; les taux manuels avec le taux du jour où ils ont été relevés.`,
    none: "Pas encore de données vérifiées.",
    staleHeading: (days) => `Pas revérifié depuis plus de ${days} jours`,
    unavailableHeading: "Indisponible pour ce montant",
  },
  unavailable: {
    no_reference_rate: "pas de taux de référence pour le jour où le taux a été relevé",
    amount_not_supported:
      "les frais dépassent ce montant, ou il est hors des limites du prestataire",
  },
  errors: {
    unreachable: "Le service est injoignable pour le moment. Veuillez réessayer plus tard.",
    notJson: (status) =>
      `Le service a donné une réponse inattendue (HTTP ${status}). Veuillez réessayer plus tard.`,
    http: (status) =>
      `Le service rencontre un problème (HTTP ${status}). Veuillez réessayer plus tard.`,
    invalidQuery: "La demande a été refusée. Vérifiez le montant.",
    corridorNotAvailable: "Il n’y a pas encore de taux de référence pour ces devises.",
  },
  disclaimer: "Estimations à titre indicatif, pas un conseil financier.",
};
