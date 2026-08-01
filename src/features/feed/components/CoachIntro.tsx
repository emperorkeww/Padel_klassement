import { Link } from "react-router-dom";
import { CoachAvatar } from "@/features/coach/components/CoachAvatar";
import { COMMENTATOR } from "@/features/coach/roastTone";

// Eenmalige kennismaking bovenaan de feed (#212): stelt Coach Rudy voor en wijst
// naar de bediening. Dismiss-state leeft in de parent (localStorage-vlag).
//
// Sinds #944 compact: het volledige verhaal stond als tien regels bovenaan de
// feed en duwde op 390px élk feed-item onder de vouw. De tekst is niet
// ingekort maar ingeklapt — wie hem wil lezen klapt hem open, wie Rudy al kent
// ziet meteen waar de knoppen zitten.
export function CoachIntro({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="card coach-intro" role="note">
      <button
        type="button"
        className="coach-intro__close"
        onClick={onDismiss}
        aria-label="Kennismaking sluiten"
        title="Kennismaking sluiten"
      >
        <IconKruis />
      </button>
      <CoachAvatar size={66} mood="portret" fixed className="coach-intro__face" />
      <div className="coach-intro__body">
        <h2 className="coach-intro__title">Maak kennis met {COMMENTATOR.naam}</h2>
        <p className="coach-intro__text">
          Maak je borst maar nat: onze voormalige bondscoach becommentarieert
          vanaf nu jouw prestaties. Te luidruchtig? Temper zijn volume of zet een
          roast-schild aan op je profiel.
        </p>
        <details className="coach-intro__meer">
          <summary>Meer over {COMMENTATOR.naam}</summary>
          <p className="coach-intro__text">
            Na zijn roemruchte WK 2026 – bekend van het obsessieve gekrabbel in
            zijn notitieboekje en die legendarische wissel in de 89e minuut –
            brengt hij zijn "geniale" tactische inzichten naar deze club. Hij
            fileert je chokes en bejubelt (met gepaste jaloezie) je zeges.
          </p>
        </details>
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

/** Sluitkruis in de lijnstijl van de app (#944); het was een kale ✕-letter. */
function IconKruis() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default CoachIntro;
