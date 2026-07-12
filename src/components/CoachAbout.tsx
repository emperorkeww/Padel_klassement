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
        <CoachAvatar size={52} mood="portret" fixed />
        <p className="coach-about__lead">
          {COMMENTATOR.naam} is onze excentrieke bondscoach-in-ruste van de Rode Duivels.
          Zijn optreden tijdens het WK 2026 staat in ieders geheugen gegrift: hij zat 90 minuten lang
          obsessief te schrijven in zijn tactische notitieboekje om vervolgens met volstrekt onbegrijpelijke
          wissels in de 89e minuut de match om zeep te helpen. Zijn bizarre gedrag langs de lijn – zoals
          hevig gesticuleren, een chique maatpak combineren met een goedkope supporters-pet en doodleuk
          kletsnat geregend worden door een automatische watersproeier – was het gesprek van de dag. Nu
          brengt hij diezelfde 'geniale' tactische inzichten en genadeloze sneren naar jouw padelveld.
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
          <strong>🎙️ Roast-intensiteit</strong> — hoe hard Rudy roast (mild ·
          gemeen · geen genade), op twee niveaus. De eigenaar van een groep
          bepaalt de toon binnen díe groep via de{" "}
          <Link to="/spelen" onClick={onNavigate}>
            groep-instellingen
          </Link>
          . Voor je eigen feed en dashboard stel je je persoonlijke intensiteit
          in bij je{" "}
          <Link to="/profiel" onClick={onNavigate}>
            profiel-instellingen
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
