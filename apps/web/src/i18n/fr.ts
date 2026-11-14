import type { Messages } from "./en.ts";

/** French (Switzerland). */
export const fr: Messages = {
  title: "FreuTransfer — Comparateur de coûts",
  language: "Langue",
  headline: "Qu’est-ce qui arrive vraiment ?",
  intro:
    "Vous envoyez de l’argent entre la Suisse et la zone euro ? Découvrez ce qui arrive vraiment, et combien est caché dans le taux de change.",
  form: {
    direction: "Sens",
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
    checked: (date, ago) => `vérifié le ${date} · ${ago}`,
    measuredAgainst: (rate, bank, day) =>
      `estimé d’après l’écart au taux moyen ${rate} (${bank}, ${day}) lors du relevé`,
  },
  rateSources: { ecb: "BCE" },
  results: {
    cheapest: "Le moins cher",
    midRate: (p) =>
      `Comparé au taux moyen du marché 1 ${p.from} = ${p.rate} ${p.to} (${p.bank}, ${p.day}) ; les taux manuels gardent leur écart au taux du jour où ils ont été relevés.`,
    midRateTooOld: (p) =>
      `Le taux de référence date du ${p.day}, il y a plus de ${p.days} jours : les nouveaux taux n'arrivent pas en ce moment, ces résultats peuvent donc être dépassés.`,
    none: "Pas encore de données vérifiées.",
    staleHeading: (days) => `Pas revérifié depuis plus de ${days} jours`,
    unavailableHeading: "Absents de cette comparaison",
    notIncluded:
      "Non inclus : les éventuels frais de la banque du bénéficiaire pour un paiement entrant.",
  },
  unavailable: {
    no_reference_rate: "pas de taux de référence pour le jour où le taux a été relevé",
    amount_not_supported:
      "les frais dépassent ce montant, ou il est hors des limites du prestataire",
    implausible_cost: "ses données de prix semblent erronées et sont en cours de vérification",
  },
  myProvider: {
    label: "Mon prestataire",
    choose: "Choisir…",
    cheapest: (mine) => `${mine} est le moins cher pour ce montant.`,
    difference: (p) =>
      `Avec ${p.mine}, vous payez ${p.extraCost} de plus qu’avec ${p.best} (${p.lessReceived} de moins à l’arrivée) : ${p.perYear} par an si vous envoyez ce montant chaque mois.`,
  },
  caveats: {
    monthly_allowance: (amount) =>
      `Aucune majoration sur les premiers ${amount} changés par mois ; les changes effectués plus tôt dans le mois en sont déduits.`,
    amount_limit: (amount) => `Au maximum ${amount} par virement.`,
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
