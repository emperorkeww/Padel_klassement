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
          Vanaf nu becommentarieert {COMMENTATOR.naam} je feed. Vers van de Rode Duivels op het WK 2026,
          waar hij de natie verraste met zijn vreemde wissels, zijn obsessieve gekrabbel in een
          notitieboekje en zijn bizarre gedrag langs de lijn. Hij bejubelt je zeges en fileert je chokes
          met dezelfde "briljante" tactische visie. Te veel van het goede? Stel je eigen roast-intensiteit
          in of scherm jezelf helemaal af met een roast-schild — allebei bij je profiel.
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
