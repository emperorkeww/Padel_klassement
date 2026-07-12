import { Link } from "react-router-dom";
import { CoachAvatar } from "./CoachAvatar";
import { COMMENTATOR } from "../lib/roastTone";
import "./CoachAbout.css";

// Herbruikbare "Wie is Coach Rudy?"-uitleg + vindbare bediening (#212).
// Gebruikt in de ⓘ-popup op de feed-bubble en in de instellingen-sectie.
export function CoachAbout({
  showSettingsLink = false,
  onNavigate,
}: {
  /** Toon een "Coach afstellen"-knop naar de instellingen (feed-popup). */
  showSettingsLink?: boolean;
  /** Aangeroepen als er op een link wordt geklikt (bv. popup sluiten). */
  onNavigate?: () => void;
}) {
  return (
    <div className="coach-about">
      <div className="coach-about__head">
        <CoachAvatar size={44} />
        <p className="coach-about__lead">
          {COMMENTATOR.naam} is de vaste commentator van de app. Hij reageert op
          jouw padel — pias van de week, promoties, monsterzeges — met een knipoog
          en af en toe een prik.
        </p>
      </div>
      <ul className="coach-about__controls">
        <li>
          <strong>🛡️ Roast-schild</strong> — zet 'm aan als je liever niet geroast
          wordt; pias, feed en profiel tonen dan een neutrale variant. Staat bij je{" "}
          <Link to="/profiel" onClick={onNavigate}>
            privacy-instellingen
          </Link>
          .
        </li>
        <li>
          <strong>🎙️ Roast-intensiteit</strong> — de eigenaar van een groep bepaalt
          hoe hard Rudy die groep roast (mild · gemeen · radioactief), via de{" "}
          <Link to="/spelen" onClick={onNavigate}>
            groep-instellingen
          </Link>
          .
        </li>
      </ul>
      {showSettingsLink && (
        <Link className="btn btn--sm" to="/profiel" onClick={onNavigate}>
          Coach afstellen
        </Link>
      )}
    </div>
  );
}

export default CoachAbout;
