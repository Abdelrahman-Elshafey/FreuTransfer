import type { PagesText } from "./types.ts";

// French, translated from en.ts, which holds the sources.

export const fr: PagesText = {
  methodology: (v) => ({
    title: "Comment fonctionne la comparaison",
    intro:
      "Vous indiquez ce qui quitte votre compte. Pour chaque prestataire, nous calculons ce qui arrive, et quelle part de la différence est un frais visible et quelle part est cachée dans le taux de change.",
    sections: [
      {
        heading: "Ce qui est comparé",
        blocks: [
          {
            p: [
              "Deux sens : francs suisses en euros, et euros en francs suisses, d’un compte chez le prestataire vers un compte bancaire dans la zone euro ou en Suisse. Prestataires : Wise, Yuh, Revolut et PostFinance dans les deux sens ; Western Union des francs vers les euros.",
            ],
          },
          {
            p: [
              "Seuls les prestataires qui publient des prix exacts sont inclus, pour que chaque chiffre puisse être rattaché à une source. Chaque prix indique sa source et le jour où il a été vérifié.",
            ],
          },
        ],
      },
      {
        heading: "Le taux de référence",
        blocks: [
          {
            p: [
              "Tous les prestataires sont mesurés au même taux : le taux de référence de l’euro de la ",
              {
                text: "Banque centrale européenne",
                href: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
              },
              ". Il est fixé vers 14 h 10 HEC et publié vers 16 h 00 HEC chaque jour ouvrable, et c’est un taux moyen : à mi-chemin entre l’achat et la vente. Nous le récupérons toutes les heures via ",
              { text: "Frankfurter", href: "https://frankfurter.dev" },
              ", toujours avec la BCE comme source. La BCE le publie à titre d’information seulement ; aucun prestataire ne promet de changer à ce taux.",
            ],
          },
        ],
      },
      {
        heading: "Le coût",
        blocks: [
          {
            p: [
              "Ce qui arrive est reconverti au taux de référence. Ce qui manque alors par rapport à votre paiement est le coût :",
            ],
          },
          {
            formula: [
              "coût total  = paiement − ce qui arrive ÷ taux de référence",
              "coût caché  = coût total − frais visibles",
              "coût en %   = coût total ÷ paiement",
            ],
          },
          {
            p: [
              `Exemple : vous payez ${v.example.paid}. Le prestataire prend des frais de ${v.example.fee} et change les ${v.example.converted} restants à ${v.example.rate}, alors que le taux de référence est de ${v.example.mid}. ${v.example.received} arrivent, soit ${v.example.worth} au taux de référence. Le coût total est de ${v.example.totalCost} (${v.example.percent}), dont ${v.example.hidden} cachés dans le taux de change.`,
            ],
          },
          {
            p: [
              "Les montants sont calculés exactement et arrondis une seule fois, au centime, à la fin. Le classement suit le coût total : le prestataire le moins cher est aussi celui avec lequel il arrive le plus.",
            ],
          },
        ],
      },
      {
        heading: "D’où viennent les prix",
        blocks: [
          {
            list: [
              [
                "Selon les tarifs publiés : le prestataire publie ses frais et sa marge sur le taux de référence (Wise, Yuh, Revolut). Nous les appliquons au taux de référence du jour, pour tout montant.",
              ],
              [
                "Manuel : le prestataire publie un taux, pas une marge (PostFinance, Western Union). Nous le relevons à la main à un moment connu et retenons son écart avec le taux de référence de ce jour-là ; appliqué au taux de référence du jour, il donne une estimation, marquée « approximatif ».",
              ],
            ],
          },
          {
            p: [
              `Chaque prix est vérifié à la main sur la page du prestataire, avec un lien et la date. Un prix qui n’a pas été revérifié depuis plus de ${v.recheckDays} jours est listé à part, sans être classé. Si le taux de référence le plus récent a plus de ${v.maxAgeDays} jours, la page avertit que les résultats peuvent être dépassés.`,
            ],
          },
          {
            p: [
              `Un coût total supérieur à ${v.maxCost} ou inférieur à zéro signifie presque toujours un prix mal saisi, pas un prix réel. Un tel prix n’est pas classé ; il est listé comme « en cours de vérification ».`,
            ],
          },
        ],
      },
      {
        heading: "Ce qui n’est pas inclus",
        blocks: [
          {
            list: [
              ["Les frais que la banque du bénéficiaire peut facturer pour un paiement entrant."],
              [
                "Les taux qui changent au cours de la journée, et les majorations que certains prestataires appliquent le week-end ou en dehors des heures de marché.",
              ],
              [
                "Les franchises qui dépendent de ce que vous avez changé auparavant : la franchise mensuelle de Revolut est supposée inutilisée, et la page le précise.",
              ],
              [
                "Les abonnements payants et les conditions particulières : les prix sont ceux de l’offre standard de chaque prestataire.",
              ],
            ],
          },
        ],
      },
      {
        heading: "Pourquoi il n’y a pas de comparaison avec la Banque mondiale",
        blocks: [
          {
            p: [
              "La base ",
              {
                text: "Remittance Prices Worldwide",
                href: "https://datacatalog.worldbank.org/search/dataset/0037898/remittance-prices-worldwide",
              },
              " de la Banque mondiale est la référence habituelle pour le coût des transferts, mais elle couvre les transferts vers les pays à revenu faible et intermédiaire. Ses corridors depuis la Suisse vont vers l’Albanie, la Hongrie, le Kosovo, la Serbie et le Sri Lanka ; aucun ne va vers la zone euro, et aucun vers la Suisse. Il n’y a rien à quoi comparer ces résultats.",
            ],
          },
        ],
      },
      {
        heading: "Une méthode ouverte",
        blocks: [
          {
            p: [
              "Le calcul, les données et leur historique sont publics : ",
              { text: "code source sur GitHub", href: v.sourceUrl },
              ". Les résultats sont des estimations à titre indicatif, pas un conseil financier.",
            ],
          },
          {
            p: [
              "FreuTransfer est un projet privé et non commercial, sans relation d’affaires avec aucun prestataire : pas de liens d’affiliation, pas de commissions, pas de publicité. Les noms des prestataires servent uniquement à les désigner.",
            ],
          },
        ],
      },
    ],
  }),

  privacy: (v) => ({
    title: "Confidentialité",
    intro:
      "FreuTransfer n’a ni comptes, ni cookies, ni outils d’analyse, ni publicité, ni pistage. Cette page indique tout ce qui se passe avec des données.",
    sections: [
      {
        heading: "Responsable",
        blocks: [
          {
            p: [
              `FreuTransfer est un projet privé et non commercial géré par ${v.name}. Contact : ${v.email}.`,
            ],
          },
        ],
      },
      {
        heading: "Dans votre navigateur",
        blocks: [
          {
            p: [
              "Votre langue et le prestataire choisi sous « Mon prestataire » sont conservés dans le stockage local de votre navigateur, pour que la page s’en souvienne. Ils ne quittent jamais votre navigateur ; vous pouvez les effacer avec les données de site de votre navigateur.",
            ],
          },
          {
            p: [
              "La page ne charge rien depuis d’autres sites : les polices et le code viennent de ce site.",
            ],
          },
        ],
      },
      {
        heading: "Sur le serveur",
        blocks: [
          {
            p: [
              "Comme tout serveur web, le nôtre écrit une ligne de journal pour chaque requête : votre adresse IP raccourcie (sans sa dernière partie, de sorte qu’elle ne désigne plus une connexion), l’heure, l’adresse demandée, la page d’où vous venez et le nom de votre navigateur. Les journaux servent à faire fonctionner le site et à le protéger contre les abus (chaque visiteur ne peut faire qu’un nombre limité de requêtes par seconde ; pour cela, l’adresse complète n’est gardée qu’en mémoire, jamais écrite). Ils sont conservés jusqu’à ce qu’ils soient écrasés : chaque partie du site garde au plus 30 Mo de journaux. Rien n’y est combiné avec d’autres données ni transmis.",
            ],
          },
          {
            p: [
              `Le serveur est un serveur virtuel loué chez OVHcloud (emplacement du centre de données : ${v.hostingCountry}). Les taux de change sont récupérés par le serveur ; votre navigateur ne contacte jamais la Banque centrale européenne ni Frankfurter.`,
            ],
          },
        ],
      },
      {
        heading: "Cloudflare",
        blocks: [
          {
            p: [
              "Les requêtes atteignent le serveur via Cloudflare, qui fournit la connexion chiffrée et la protection contre les attaques. Pour cela, Cloudflare traite votre adresse IP, y compris aux États-Unis. Cloudflare, Inc. est une entreprise américaine certifiée selon le Swiss-U.S. Data Privacy Framework, pour lequel la Suisse reconnaît un niveau de protection des données adéquat ; voir ",
              {
                text: "la politique de confidentialité de Cloudflare",
                href: "https://www.cloudflare.com/privacypolicy/",
              },
              ".",
            ],
          },
        ],
      },
      {
        heading: "Vos droits",
        blocks: [
          {
            p: [
              `Selon la loi fédérale suisse sur la protection des données (et le RGPD si vous êtes dans l’UE), vous pouvez demander quelles données vous concernant sont conservées, et les faire effacer. Écrivez à ${v.email}. Comme les journaux ne contiennent aucun nom, veuillez indiquer votre adresse IP et l’heure de votre visite.`,
            ],
          },
        ],
      },
    ],
  }),
};
