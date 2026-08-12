import { useState } from "react";
import { Link } from "react-router-dom";
import { Sheet } from "@/ui/Sheet";
import { EmptyState } from "@/ui/EmptyState";
import { Skeleton } from "@/ui/Skeleton";
import { aantalTekst } from "@/lib/utils/format";
import { markeerAllesGelezen, type Melding } from "../api";
import { MeldingenLijst } from "./MeldingenLijst";
import "./MeldingenPaneel.css";

/**
 * Het meldingenpaneel (#1090). Eén component, twee ingangen: de bel in de
 * mobiele topbalk en de zijbalkregel op desktop. Sheet is vanaf 640px al een
 * gecentreerd paneel in plaats van een bottom-sheet, dus er is geen tweede
 * vorm nodig — en hij draagt het glasmateriaal (#1062/#1083) al.
 *
 * Het paneel openen markeert bewust niets als gelezen: anders is één keer
 * kijken genoeg om alles kwijt te zijn, en verdwijnt juist de melding die je
 * wilde onthouden. De rijen zelf staan in MeldingenLijst, gedeeld met de route
 * /meldingen.
 */
export function MeldingenPaneel({
  open,
  onClose,
  meldingen,
  laadt,
  limiet,
  verzoeken = 0,
  onVeranderd,
}: {
  open: boolean;
  onClose: () => void;
  meldingen: Melding[];
  laadt: boolean;
  /** Hoeveel er hoogstens in dit paneel passen; bepaalt of de voet naar de
   *  volledige lijst wijst. */
  limiet: number;
  /** Openstaande vriendschapsverzoeken (#1232). */
  verzoeken?: number;
  /** Na een leesmarkering: de teller in de balk moet meteen meebewegen. */
  onVeranderd: () => void;
}) {
  const [bezig, setBezig] = useState(false);
  const ongelezen = meldingen.filter((m) => !m.read_at).length;

  async function allesGelezen() {
    setBezig(true);
    try {
      await markeerAllesGelezen();
      onVeranderd();
    } finally {
      setBezig(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Meldingen" className="meldingen-sheet">
      {/* Wat nog op een antwoord wacht, bovenaan en apart van de lijst (#1232).
          De meldingsrij die send-push bij een verzoek schrijft verdwijnt zodra
          je hem gelezen hebt; dit leest de toestand zelf, dus hij blijft staan
          tot je het verzoek accepteert of weigert. Sinds het overzicht zijn
          pillenstrook kwijt is, is dit op mobiel bovendien de ingang naar de
          vriendenpagina — die staat alleen in de zijbalk op desktop. */}
      {verzoeken > 0 && (
        <p className="meldingen__wacht">
          <Link
            className="meldingen__wacht-link"
            to="/vrienden"
            onClick={onClose}
          >
            <span className="meldingen__wacht-icoon" aria-hidden="true">
              👋
            </span>
            <span>
              {aantalTekst(
                verzoeken,
                "vriendschapsverzoek",
                "vriendschapsverzoeken",
              )}{" "}
              {verzoeken === 1 ? "wacht" : "wachten"} op jou
            </span>
            <span className="meldingen__wacht-pijl" aria-hidden="true">
              →
            </span>
          </Link>
        </p>
      )}

      {ongelezen > 0 && (
        <div className="meldingen__acties">
          <button
            type="button"
            className="btn btn--sm"
            onClick={allesGelezen}
            disabled={bezig}
          >
            {bezig ? "Bezig…" : "Alles gelezen"}
          </button>
        </div>
      )}

      {laadt && meldingen.length === 0 ? (
        <Skeleton rows={4} />
      ) : meldingen.length === 0 ? (
        // "Nog niets te melden" zou de regel hierboven tegenspreken: er wacht
        // dan juist wél iets. Met een openstaand verzoek is die regel de inhoud.
        verzoeken === 0 && (
          <EmptyState icon="🔔" title="Nog niets te melden">
            Zodra er een ronde klaarstaat, een uitslag binnenkomt of iemand je
            een verzoek stuurt, staat het hier.
          </EmptyState>
        )
      ) : (
        <MeldingenLijst
          meldingen={meldingen}
          onGeopend={onClose}
          onVeranderd={onVeranderd}
        />
      )}

      {/* De voet met de wegwijzers. "Alles bekijken" alleen als er méér is dan
          hier past — anders belooft de knop een langere lijst die niet bestaat.

          De voorkeuren staan er altijd bij (#1217): het moment waarop je denkt
          "hier wil ik minder van" is precies het moment waarop je naar je
          meldingen kijkt, en tot nu toe moest je dat onthouden tot je bij je
          instellingen kwam. Bewust een link en géén schakelaars hier: de
          voorkeuren zijn een verzameling en horen bij de instellingen te blijven
          wonen. */}
      <p className="meldingen__voet">
        {meldingen.length >= limiet && (
          <Link className="btn btn--sm" to="/meldingen" onClick={onClose}>
            Alles bekijken →
          </Link>
        )}
        <Link
          className="btn btn--sm"
          to="/profiel?tab=privacy"
          onClick={onClose}
        >
          <span aria-hidden="true">⚙️</span> Meldingsvoorkeuren
        </Link>
      </p>
    </Sheet>
  );
}

export default MeldingenPaneel;
