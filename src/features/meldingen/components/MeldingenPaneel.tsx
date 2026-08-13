import { Link } from "react-router-dom";
import { Sheet } from "@/ui/Sheet";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { Skeleton } from "@/ui/Skeleton";
import { aantalTekst } from "@/lib/utils/format";
import { type Melding } from "../api";
import { MeldingenActies } from "./MeldingenActies";
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
  fout,
  verzoeken = 0,
  onVeranderd,
}: {
  open: boolean;
  onClose: () => void;
  meldingen: Melding[];
  laadt: boolean;
  /** Een mislukte query (#1273). Zonder dit meldde het paneel bij een
   *  netwerk- of RLS-fout vol overtuiging dat er niets was. */
  fout?: string | null;
  /** Openstaande vriendschapsverzoeken (#1232). */
  verzoeken?: number;
  /** Na een leesmarkering: de teller in de balk moet meteen meebewegen. */
  onVeranderd: () => void;
}) {
  const ongelezen = meldingen.filter((m) => !m.read_at).length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Meldingen"
      className="sheet--dekkend meldingen-sheet"
    >
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

      {meldingen.length > 0 && (
        <MeldingenActies ongelezen={ongelezen} onVeranderd={onVeranderd} />
      )}

      {fout ? (
        // De route deed dit al goed en het paneel niet, terwijl dit de plek is
        // waar vrijwel iedereen kijkt (#1273). "Nog niets te melden" bij een
        // mislukte query is niet leeg — het is een leugen.
        <ErrorRetry melding={fout} onRetry={onVeranderd} />
      ) : laadt && meldingen.length === 0 ? (
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

      {/* De voet met de wegwijzers, plakkend onderaan (#1273).

          "Alles bekijken" hing tot nu toe aan een vol paneel: onder de twintig
          meldingen was er geen enkele route-link naar /meldingen op het hele
          dashboard, en bleef alleen een hyperlink midden in een zin op de
          voorkeurenpagina over. De drempel was ook de verkeerde vraag — of de
          volledige lijst de moeite waard is hangt af van hoeveel meldingen je
          hébt, niet van of dit paneel toevallig vol staat. Bij nul is er niets
          te bekijken; vanaf één wel.

          De voorkeuren staan er altijd bij (#1217): het moment waarop je denkt
          "hier wil ik minder van" is precies het moment waarop je naar je
          meldingen kijkt, en tot nu toe moest je dat onthouden tot je bij je
          instellingen kwam. Bewust een link en géén schakelaars hier: de
          voorkeuren zijn een verzameling en horen bij de instellingen te blijven
          wonen. */}
      <p className="meldingen__voet">
        {meldingen.length > 0 && (
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
