import type { PagesText } from "./types.ts";

// German (Swiss spelling: ss, never ß), translated from en.ts, which holds the sources.

export const de: PagesText = {
  methodology: (v) => ({
    title: "So funktioniert der Vergleich",
    intro:
      "Sie geben ein, was Ihr Konto verlässt. Für jeden Anbieter berechnen wir, was ankommt, und wie viel der Differenz eine sichtbare Gebühr ist und wie viel im Wechselkurs versteckt ist.",
    sections: [
      {
        heading: "Was verglichen wird",
        blocks: [
          {
            p: [
              "Zwei Richtungen: Schweizer Franken in Euro und Euro in Schweizer Franken, von einem Konto beim Anbieter auf ein Bankkonto im Euroraum oder in der Schweiz. Anbieter: Wise, Yuh, Revolut und PostFinance in beide Richtungen; Western Union von Franken in Euro.",
            ],
          },
          {
            p: [
              "Aufgenommen werden nur Anbieter, die genaue Preise veröffentlichen, damit sich jede Zahl auf eine Quelle zurückführen lässt. Bei jedem Preis stehen die Quelle und der Tag, an dem er geprüft wurde.",
            ],
          },
        ],
      },
      {
        heading: "Der Referenzkurs",
        blocks: [
          {
            p: [
              "Alle Anbieter werden am selben Kurs gemessen: am Euro-Referenzkurs der ",
              {
                text: "Europäischen Zentralbank",
                href: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
              },
              ". Er wird an jedem Arbeitstag gegen 14:10 Uhr MEZ festgelegt und gegen 16:00 Uhr MEZ veröffentlicht, und er ist ein Mittelkurs: genau zwischen Kauf und Verkauf. Wir holen ihn stündlich über ",
              { text: "Frankfurter", href: "https://frankfurter.dev" },
              " ab, immer mit der EZB als Quelle. Die EZB veröffentlicht ihn nur zur Information; kein Anbieter verspricht, zu diesem Kurs zu wechseln.",
            ],
          },
        ],
      },
      {
        heading: "Die Kosten",
        blocks: [
          {
            p: [
              "Was ankommt, wird zum Referenzkurs zurückgerechnet. Was dann zu Ihrer Zahlung fehlt, sind die Kosten:",
            ],
          },
          {
            formula: [
              "Gesamtkosten      = Zahlung − was ankommt ÷ Referenzkurs",
              "versteckte Kosten = Gesamtkosten − sichtbare Gebühr",
              "Kosten in %       = Gesamtkosten ÷ Zahlung",
            ],
          },
          {
            p: [
              `Beispiel: Sie zahlen ${v.example.paid}. Der Anbieter nimmt eine Gebühr von ${v.example.fee} und wechselt die restlichen ${v.example.converted} zu ${v.example.rate}, während der Referenzkurs bei ${v.example.mid} liegt. Es kommen ${v.example.received} an, zum Referenzkurs ${v.example.worth} wert. Die Gesamtkosten betragen ${v.example.totalCost} (${v.example.percent}), davon sind ${v.example.hidden} im Wechselkurs versteckt.`,
            ],
          },
          {
            p: [
              "Die Beträge werden exakt berechnet und erst am Schluss einmal auf den Rappen bzw. Cent gerundet. Die Rangliste richtet sich nach den Gesamtkosten: Beim günstigsten Anbieter kommt auch am meisten an.",
            ],
          },
        ],
      },
      {
        heading: "Woher die Preise stammen",
        blocks: [
          {
            list: [
              [
                "Regelbasiert: Der Anbieter veröffentlicht seine Gebühr und seinen Aufschlag auf den Referenzkurs (Wise, Yuh, Revolut). Wir wenden sie auf den heutigen Referenzkurs an, für jeden Betrag.",
              ],
              [
                "Manuell: Der Anbieter veröffentlicht einen Kurs, keinen Aufschlag (PostFinance, Western Union). Wir lesen ihn zu einem bekannten Zeitpunkt von Hand ab und merken uns seinen Abstand zum Referenzkurs jenes Tages; auf den heutigen Referenzkurs angewandt, ergibt er eine Schätzung, markiert mit «ungefähr».",
              ],
            ],
          },
          {
            p: [
              `Jeder Preis wird von Hand mit der Seite des Anbieters abgeglichen, mit Link und Datum. Ein Preis, der seit mehr als ${v.recheckDays} Tagen nicht mehr geprüft wurde, wird separat aufgeführt und nicht eingereiht. Ist der neueste Referenzkurs älter als ${v.maxAgeDays} Tage, warnt die Seite, dass die Ergebnisse veraltet sein können.`,
            ],
          },
          {
            p: [
              `Gesamtkosten über ${v.maxCost} oder unter null bedeuten fast immer einen falsch erfassten Preis, keinen echten. Ein solcher Preis wird nicht eingereiht, sondern als «wird geprüft» aufgeführt.`,
            ],
          },
        ],
      },
      {
        heading: "Was nicht enthalten ist",
        blocks: [
          {
            list: [
              [
                "Gebühren, die die Bank der Empfängerin oder des Empfängers für eine eingehende Zahlung verlangen kann.",
              ],
              [
                "Kurse, die sich im Lauf des Tages ändern, und Aufschläge, die manche Anbieter am Wochenende oder ausserhalb der Handelszeiten verlangen.",
              ],
              [
                "Freibeträge, die davon abhängen, was Sie früher gewechselt haben: Bei Revolut wird angenommen, dass der monatliche Freibetrag noch nicht gebraucht ist, und die Seite sagt das.",
              ],
              [
                "Bezahlte Abos und Sonderkonditionen: Die Preise gelten für das Standardangebot des jeweiligen Anbieters.",
              ],
            ],
          },
        ],
      },
      {
        heading: "Warum es keinen Vergleich mit der Weltbank gibt",
        blocks: [
          {
            p: [
              "Die Datenbank ",
              {
                text: "Remittance Prices Worldwide",
                href: "https://datacatalog.worldbank.org/search/dataset/0037898/remittance-prices-worldwide",
              },
              " der Weltbank ist die übliche Referenz für Überweisungskosten, sie erfasst aber Überweisungen in Länder mit niedrigem und mittlerem Einkommen. Ihre Korridore aus der Schweiz führen nach Albanien, Ungarn, Kosovo, Serbien und Sri Lanka; keiner führt in den Euroraum und keiner in die Schweiz. Es gibt nichts, womit sich diese Ergebnisse vergleichen liessen.",
            ],
          },
        ],
      },
      {
        heading: "Offene Methode",
        blocks: [
          {
            p: [
              "Die Berechnung, die Daten und ihre Geschichte sind öffentlich: ",
              { text: "Quellcode auf GitHub", href: v.sourceUrl },
              ". Die Ergebnisse sind Schätzungen zur Information, keine Finanzberatung.",
            ],
          },
          {
            p: [
              "FreuTransfer ist ein privates, nicht kommerzielles Projekt ohne geschäftliche Beziehung zu einem Anbieter: keine Affiliate-Links, keine Provisionen, keine Werbung. Die Namen der Anbieter dienen nur dazu, sie zu bezeichnen.",
            ],
          },
        ],
      },
    ],
  }),

  privacy: (v) => ({
    title: "Datenschutz",
    intro:
      "FreuTransfer hat keine Konten, keine Cookies, keine Analyse, keine Werbung und kein Tracking. Diese Seite nennt alles, was mit Daten geschieht.",
    sections: [
      {
        heading: "Verantwortlich",
        blocks: [
          {
            p: [
              `FreuTransfer ist ein privates, nicht kommerzielles Projekt von ${v.name}. Kontakt: ${v.email}.`,
            ],
          },
        ],
      },
      {
        heading: "In Ihrem Browser",
        blocks: [
          {
            p: [
              "Ihre Sprache und der Anbieter, den Sie unter «Mein Anbieter» gewählt haben, werden im lokalen Speicher Ihres Browsers abgelegt, damit die Seite sie sich merkt. Sie verlassen Ihren Browser nie; Sie können sie mit den Websitedaten Ihres Browsers löschen.",
            ],
          },
          {
            p: [
              "Die Seite lädt nichts von anderen Websites: Schriften und Code kommen von dieser Website.",
            ],
          },
        ],
      },
      {
        heading: "Auf dem Server",
        blocks: [
          {
            p: [
              "Wie jeder Webserver schreibt unserer für jede Anfrage eine Protokollzeile: Ihre IP-Adresse, die Zeit, die angefragte Adresse, die Seite, von der Sie kamen, und den Namen Ihres Browsers. Die Protokolle dienen dem Betrieb der Website und ihrem Schutz vor Missbrauch (jede Besucherin und jeder Besucher darf nur eine begrenzte Zahl Anfragen pro Sekunde stellen). Sie bleiben gespeichert, bis sie überschrieben werden: Jeder Teil der Website behält höchstens 30 MB Protokolle. Nichts davon wird mit anderen Daten verknüpft oder weitergegeben.",
            ],
          },
          {
            p: [
              `Der Server ist ein bei OVHcloud gemieteter virtueller Server (Standort des Rechenzentrums: ${v.hostingCountry}). Die Wechselkurse holt der Server ab; Ihr Browser kontaktiert weder die Europäische Zentralbank noch Frankfurter.`,
            ],
          },
        ],
      },
      {
        heading: "Cloudflare",
        blocks: [
          {
            p: [
              "Anfragen erreichen den Server über Cloudflare, das die verschlüsselte Verbindung und den Schutz vor Angriffen bereitstellt. Cloudflare bearbeitet dazu Ihre IP-Adresse, auch in den USA. Cloudflare, Inc. ist ein US-Unternehmen, das unter dem Swiss-U.S. Data Privacy Framework zertifiziert ist, für das die Schweiz einen angemessenen Datenschutz anerkennt; siehe ",
              {
                text: "die Datenschutzerklärung von Cloudflare",
                href: "https://www.cloudflare.com/privacypolicy/",
              },
              ".",
            ],
          },
        ],
      },
      {
        heading: "Ihre Rechte",
        blocks: [
          {
            p: [
              `Nach dem Schweizer Datenschutzgesetz (und der DSGVO, wenn Sie in der EU sind) können Sie Auskunft verlangen, welche Daten über Sie gespeichert sind, und sie löschen lassen. Schreiben Sie an ${v.email}. Da die Protokolle keine Namen enthalten, geben Sie bitte Ihre IP-Adresse und die Zeit Ihres Besuchs an.`,
            ],
          },
        ],
      },
    ],
  }),
};
