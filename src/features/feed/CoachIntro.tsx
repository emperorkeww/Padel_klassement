import { Link } from "react-router-dom";
import { CoachAvatar } from "../../components/CoachAvatar";
import { COMMENTATOR } from "../../lib/roastTone";

// Eenmalige kennismaking bovenaan de feed (#212): stelt Coach Rudy voor en wijst
// naar de bediening. Dismiss-state leeft in de parent (localStorage-vlag).
export function CoachIntro({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="card coach-intro" role="note">
      <button
        type="button"
        className="coach-intro__close"
        onClick={onDismiss}
        aria-label="Sluiten"
      >
        ✕
      </button>
      <CoachAvatar size={66} mood="portret" fixed className="coach-intro__face" />
      <div className="coach-intro__body">
        <h2 className="coach-intro__title">Maak kennis met {COMMENTATOR.naam}</h2>
        <p className="coach-intro__text">
          Maak je borst maar nat. {COMMENTATOR.naam}, onze voormalige bondscoach van de Rode Duivels,
          becommentarieert vanaf nu jouw prestaties. Na zijn roemruchte WK 2026 – bekend van het obsessieve
          gekrabbel in zijn notitieboekje en die legendarische wissel in de 89e minuut – brengt hij zijn
          "geniale" tactische inzichten naar deze club. Hij fileert je chokes en bejubelt (met gepaste jaloezie)
          je zeges. Vind je hem te luidruchtig? Je kunt zijn volume temperen of een roast-schild activeren op je profiel.
        </p>
        <div className="coach-intro__actions">
          <Link className="btn btn--sm" to="/profiel">
            Coach afstellen
          </Link>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={onDismiss}
          >
            Begrepen
          </button>
        </div>
      </div>
    </div>
  );
}

export default CoachIntro;
