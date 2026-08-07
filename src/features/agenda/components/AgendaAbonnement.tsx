import { useId, useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import {
  feedUrl,
  getMyFeedToken,
  googleCalendarUrl,
  rotateFeedToken,
  webcalUrl,
} from "../feedApi";

/* ------------------------------------------------------------------ */
/* Agenda-abonnement (#1099).                                          */
/*                                                                     */
/* De knop in het dagdetail zet één speeldag in je agenda, één keer.    */
/* Dit zet er een lijn tussen: je stelt de URL één keer in, en vanaf    */
/* dan haalt je agenda-app zelf op wat er verandert.                    */
/*                                                                     */
/* Twee dingen moeten hier in gewone taal staan, want ze verrassen      */
/* mensen anders: dat de agenda-app zelf bepaalt hoe vaak hij ophaalt   */
/* (bij Google uren), en dat de link zelf het wachtwoord is.            */
/*                                                                     */
/* Elk platform heeft een eigen weg naar binnen (#1117): één generieke  */
/* knop kán dit niet, want `webcal:` doet op Android niets. Daarom drie */
/* expliciete acties, en géén platformdetectie — user-agent-sniffing    */
/* faalt stil op precies de randgevallen (iPad met desktop-UA,          */
/* in-app-browsers) waar iemand die knop het hardst nodig heeft.        */
/* ------------------------------------------------------------------ */

export function AgendaAbonnement() {
  const toast = useToast();
  const feed = useAsync(getMyFeedToken, []);
  // De net uitgegeven link wint van wat de query ophaalde: opnieuw laden zou
  // de knop even terug laten springen naar "geen link".
  const [verse, setVerse] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);
  // Bevestigen in de knop zelf, zoals bij het annuleren van een speeldag:
  // een nieuwe link maken breekt elk lopend abonnement.
  const [bevestig, setBevestig] = useState(false);
  const veldId = useId();
  const hintId = `${veldId}-hint`;

  const token = verse ?? feed.data ?? null;
  const url = token ? feedUrl(token) : null;

  async function nieuweLink() {
    setBezig(true);
    try {
      const nieuw = await rotateFeedToken();
      setVerse(nieuw);
      setBevestig(false);
      toast.success(
        token ? "Nieuwe link klaar; de oude werkt niet meer." : "Je agenda-link staat klaar.",
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBezig(false);
    }
  }

  async function kopieer() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      // Geen toast: het veld erboven staat er nog, en "selecteer en kopieer"
      // is dan de weg.
    }
  }

  return (
    <section className="agenda-abo">
      <h2 className="agenda-abo__titel">Zet je speeldagen in je eigen agenda</h2>
      <p className="agenda-abo__tekst">
        Eén keer instellen in Google Agenda, Apple Agenda of Outlook, en daarna
        volgt het vanzelf: een nieuwe speeldag komt erbij, een verzet moment
        schuift mee en een afgelaste verdwijnt.
      </p>

      {token == null || url == null ? (
        <button
          type="button"
          className="btn btn--primary agenda-abo__knop"
          disabled={bezig || feed.loading}
          onClick={nieuweLink}
        >
          {bezig ? "Bezig…" : "Maak mijn agenda-link"}
        </button>
      ) : (
        <>
          <label className="agenda-abo__label" htmlFor={veldId}>
            Jouw persoonlijke link
          </label>
          <div className="agenda-abo__rij">
            <input
              id={veldId}
              className="input agenda-abo__waarde"
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              aria-describedby={hintId}
            />
          </div>
          <p className="agenda-abo__hint" id={hintId}>
            Wie deze link heeft, ziet wanneer je speelt. Deel hem niet — hij is
            je wachtwoord.
          </p>

          <div className="agenda-abo__apps">
            {/* Google claimt webcal:// niet, maar vangt deze https-link wél af;
                zonder deze knop gebeurt er op Android niets (#1117). Nieuw
                tabblad, want dit is een website — geen app-overdracht. */}
            <a
              className="btn btn--primary agenda-abo__actie"
              href={googleCalendarUrl(token)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Agenda
            </a>
            {/* webcal:// draagt over aan Apple Agenda, met de abonneervraag er
                al in; https zou het bestand downloaden en dan is het weer één
                momentopname. Bewust géén target: dit verlaat de browser. */}
            <a className="btn agenda-abo__actie" href={webcalUrl(token)}>
              Apple / iPhone
            </a>
            <button type="button" className="btn agenda-abo__actie" onClick={kopieer}>
              {gekopieerd ? "Gekopieerd" : "Kopieer link"}
            </button>
          </div>
          <p className="agenda-abo__hint">
            Andere agenda — Outlook, Samsung, Thunderbird? Kopieer de link en
            plak hem daar bij "Agenda via URL toevoegen".
          </p>

          <div className="agenda-abo__acties">
            <button
              type="button"
              className={`btn btn--sm agenda-abo__nieuw${bevestig ? " is-confirm" : ""}`}
              disabled={bezig}
              onClick={() => {
                if (!bevestig) {
                  setBevestig(true);
                  return;
                }
                nieuweLink();
              }}
              onBlur={() => setBevestig(false)}
            >
              {bevestig ? "Zeker? Tik nogmaals" : "Nieuwe link maken"}
            </button>
          </div>
          {bevestig && (
            <p className="agenda-abo__waarschuwing" role="status">
              Met een nieuwe link stopt elk abonnement dat nu loopt — ook op je
              andere toestellen. Je moet 'm dan overal opnieuw instellen.
            </p>
          )}
        </>
      )}

      <p className="agenda-abo__traag">
        Je agenda-app bepaalt zelf hoe vaak hij ophaalt. Apple doet dat vaak
        binnen het uur, Google soms pas na een halve dag. Voor een speeldag over
        drie weken prima; verandert er iets op het laatste moment, dan gaat dat
        via een melding.
      </p>
    </section>
  );
}

export default AgendaAbonnement;
