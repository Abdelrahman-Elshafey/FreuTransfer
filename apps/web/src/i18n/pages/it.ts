import { RATES_URL } from "../../site.ts";
import type { PagesText } from "./types.ts";

// Italian, translated from en.ts, which holds the sources.

export const it: PagesText = {
  methodology: (v) => ({
    title: "Come funziona il confronto",
    intro:
      "Lei indica ciò che lascia il Suo conto. Per ogni fornitore calcoliamo ciò che arriva, e quanta parte della differenza è una commissione visibile e quanta è nascosta nel tasso di cambio.",
    sections: [
      {
        heading: "Che cosa viene confrontato",
        blocks: [
          {
            p: [
              "Due direzioni: franchi svizzeri in euro ed euro in franchi svizzeri, da un conto presso il fornitore a un conto bancario nella zona euro o in Svizzera. Fornitori: Wise, Yuh, Revolut e PostFinance in entrambe le direzioni; Western Union da franchi a euro.",
            ],
          },
          {
            p: [
              "Sono inclusi solo i fornitori che pubblicano prezzi esatti, così che ogni cifra possa essere ricondotta a una fonte. Ogni prezzo indica la sua fonte e il giorno in cui è stato verificato.",
            ],
          },
        ],
      },
      {
        heading: "Il tasso di riferimento",
        blocks: [
          {
            p: [
              "Tutti i fornitori sono misurati sullo stesso tasso: il tasso di riferimento dell’euro della ",
              {
                text: "Banca centrale europea",
                href: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
              },
              ". Viene fissato verso le 14:10 CET e pubblicato verso le 16:00 CET ogni giorno lavorativo, ed è un tasso medio: a metà strada tra acquisto e vendita. Lo raccogliamo ogni ora tramite ",
              { text: "Frankfurter", href: RATES_URL },
              ", sempre con la BCE come fonte. La BCE lo pubblica solo a titolo informativo; nessun fornitore promette di cambiare a questo tasso.",
            ],
          },
        ],
      },
      {
        heading: "Il costo",
        blocks: [
          {
            p: [
              "Ciò che arriva viene riconvertito al tasso di riferimento. Ciò che manca rispetto al Suo pagamento è il costo:",
            ],
          },
          {
            formula: [
              "costo totale   = pagamento − ciò che arriva ÷ tasso di riferimento",
              "costo nascosto = costo totale − commissione visibile",
              "costo in %     = costo totale ÷ pagamento",
            ],
          },
          {
            p: [
              `Esempio: Lei paga ${v.example.paid}. Il fornitore trattiene una commissione di ${v.example.fee} e cambia i restanti ${v.example.converted} a ${v.example.rate}, mentre il tasso di riferimento è ${v.example.mid}. Arrivano ${v.example.received}, pari a ${v.example.worth} al tasso di riferimento. Il costo totale è di ${v.example.totalCost} (${v.example.percent}), di cui ${v.example.hidden} nascosti nel tasso di cambio.`,
            ],
          },
          {
            p: [
              "Gli importi sono calcolati in modo esatto e arrotondati una sola volta, al centesimo, alla fine. La classifica segue il costo totale: con il fornitore più conveniente arriva anche di più.",
            ],
          },
        ],
      },
      {
        heading: "Da dove vengono i prezzi",
        blocks: [
          {
            list: [
              [
                "Secondo le tariffe pubblicate: il fornitore pubblica la sua commissione e il suo margine sul tasso di riferimento (Wise, Yuh, Revolut). Li applichiamo al tasso di riferimento di oggi, per qualsiasi importo.",
              ],
              [
                "Manuale: il fornitore pubblica un tasso, non un margine (PostFinance, Western Union). Lo leggiamo a mano in un momento noto e ne teniamo la distanza dal tasso di riferimento di quel giorno; applicata al tasso di riferimento di oggi, dà una stima, contrassegnata con «approssimativo».",
              ],
            ],
          },
          {
            p: [
              `Ogni prezzo è verificato a mano sulla pagina del fornitore, con un link e la data. Un prezzo non riverificato da più di ${v.recheckDays} giorni è elencato a parte, senza essere classificato. Se il tasso di riferimento più recente ha più di ${v.maxAgeDays} giorni, la pagina avverte che i risultati potrebbero non essere aggiornati.`,
            ],
          },
          {
            p: [
              `Un costo totale superiore a ${v.maxCost} o inferiore a zero indica quasi sempre un prezzo inserito male, non un prezzo reale. Un tale prezzo non viene classificato; è elencato come «in verifica».`,
            ],
          },
        ],
      },
      {
        heading: "Che cosa non è incluso",
        blocks: [
          {
            list: [
              [
                "Le commissioni che la banca del destinatario può addebitare per un pagamento in entrata.",
              ],
              [
                "I tassi che cambiano durante la giornata, e le maggiorazioni che alcuni fornitori applicano nel fine settimana o fuori dagli orari di mercato.",
              ],
              [
                "Le franchigie che dipendono da ciò che ha cambiato in precedenza: la franchigia mensile di Revolut è considerata non utilizzata, e la pagina lo indica.",
              ],
              [
                "Abbonamenti a pagamento e condizioni particolari: i prezzi sono quelli dell’offerta standard di ciascun fornitore.",
              ],
            ],
          },
        ],
      },
      {
        heading: "Perché non c’è un confronto con la Banca mondiale",
        blocks: [
          {
            p: [
              "La banca dati ",
              {
                text: "Remittance Prices Worldwide",
                href: "https://datacatalog.worldbank.org/search/dataset/0037898/remittance-prices-worldwide",
              },
              " della Banca mondiale è il riferimento abituale per i costi dei trasferimenti, ma copre i trasferimenti verso paesi a reddito basso e medio. I suoi corridoi dalla Svizzera vanno verso Albania, Ungheria, Kosovo, Serbia e Sri Lanka; nessuno va verso la zona euro, e nessuno verso la Svizzera. Non c’è nulla con cui confrontare questi risultati.",
            ],
          },
        ],
      },
      {
        heading: "Un metodo aperto",
        blocks: [
          {
            p: [
              "Il calcolo, i dati e la loro storia sono pubblici: ",
              { text: "codice sorgente su GitHub", href: v.sourceUrl },
              ". I risultati sono stime a solo scopo informativo, non consulenza finanziaria.",
            ],
          },
          {
            p: [
              "FreuTransfer è un progetto privato e non commerciale, senza rapporti d’affari con alcun fornitore: nessun link di affiliazione, nessuna provvigione, nessuna pubblicità. I nomi dei fornitori servono solo a identificarli.",
            ],
          },
        ],
      },
    ],
  }),

  privacy: (v) => ({
    title: "Privacy",
    intro:
      "FreuTransfer non ha account, cookie, strumenti di analisi, pubblicità né tracciamento. Questa pagina elenca tutto ciò che avviene con i dati.",
    sections: [
      {
        heading: "Responsabile",
        blocks: [
          {
            p: [
              `FreuTransfer è un progetto privato e non commerciale gestito da ${v.name}. Contatto: ${v.email}.`,
            ],
          },
        ],
      },
      {
        heading: "Nel Suo browser",
        blocks: [
          {
            p: [
              "La Sua lingua e il fornitore scelto sotto «Il mio fornitore» sono conservati nella memoria locale del Suo browser, così che la pagina li ricordi. Non lasciano mai il Suo browser; può cancellarli con i dati dei siti del Suo browser.",
            ],
          },
          {
            p: [
              "La pagina non carica nulla da altri siti: caratteri e codice provengono da questo sito.",
            ],
          },
        ],
      },
      {
        heading: "Sul server",
        blocks: [
          {
            p: [
              "Come ogni server web, il nostro scrive una riga di registro per ogni richiesta: il Suo indirizzo IP abbreviato (senza la sua ultima parte, così che non indichi più una connessione), l’ora, l’indirizzo richiesto, la pagina da cui proviene e il nome del Suo browser. I registri servono a far funzionare il sito e a proteggerlo dagli abusi (ogni visitatore può fare solo un numero limitato di richieste al secondo; per questo l’indirizzo completo è tenuto solo in memoria, mai scritto). Sono conservati finché non vengono sovrascritti: ogni parte del sito tiene al massimo 30 MB di registri. Nulla di essi viene combinato con altri dati o trasmesso.",
            ],
          },
          {
            p: [
              `Il server è un server virtuale noleggiato da OVHcloud (sede del centro dati: ${v.hostingCountry}). I tassi di cambio vengono recuperati dal server; il Suo browser non contatta mai la Banca centrale europea né Frankfurter.`,
            ],
          },
        ],
      },
      {
        heading: "Cloudflare",
        blocks: [
          {
            p: [
              "Le richieste raggiungono il server tramite Cloudflare, che fornisce la connessione cifrata e la protezione dagli attacchi. Per farlo Cloudflare tratta il Suo indirizzo IP, anche negli Stati Uniti. Cloudflare, Inc. è un’azienda statunitense certificata secondo lo Swiss-U.S. Data Privacy Framework, per il quale la Svizzera riconosce un livello adeguato di protezione dei dati; si veda ",
              {
                text: "l’informativa sulla privacy di Cloudflare",
                href: "https://www.cloudflare.com/privacypolicy/",
              },
              ".",
            ],
          },
        ],
      },
      {
        heading: "I Suoi diritti",
        blocks: [
          {
            p: [
              `Secondo la legge federale svizzera sulla protezione dei dati (e il GDPR se si trova nell’UE), può chiedere quali dati che La riguardano sono conservati, e farli cancellare. Scriva a ${v.email}. Poiché i registri non contengono nomi, indichi per favore il Suo indirizzo IP e l’ora della Sua visita.`,
            ],
          },
        ],
      },
    ],
  }),
};
