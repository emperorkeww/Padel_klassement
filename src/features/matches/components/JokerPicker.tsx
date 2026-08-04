import { JOKERS, type JokerId } from "@/features/matches/jokers";
import "./JokerPicker.css";

/**
 * Joker kiezen bij het plannen (#1003): de kaart van je maand meteen op tafel
 * leggen in plaats van hem straks op de matchkaart te spelen.
 *
 * Een chip-rij van drie zoals de CourtPicker en geen zoekveld zoals de
 * DrankPicker: het zijn er drie en ze blijven met drie. De prijs staat onder
 * elke kaart — een schild dat ook je winst afneemt moet je weten vóór je hem
 * kiest, niet erna.
 *
 * De picker weet niets van tegoeden of drempels: hij verschijnt alleen als er
 * überhaupt een kaart te spelen valt (groep, starttijd, jij speelt mee) en de
 * guard beslist de rest. Kan de kaart niet, dan komt de match er gewoon en zegt
 * de wizard waarom de joker niet gelegd is.
 */
export function JokerPicker({
  value,
  onChange,
  disabled = false,
}: {
  /** Gekozen kaart, of null = geen joker op deze match. */
  value: JokerId | null;
  onChange: (joker: JokerId | null) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="joker-picker" disabled={disabled}>
      <legend className="joker-picker__legend">Joker (optioneel)</legend>
      <p className="joker-picker__intro">
        Eén kaart per kalendermaand. Je kunt hem tot de aftrap nog wisselen of
        intrekken op de wedstrijdkaart.
      </p>
      <ul className="joker-picker__lijst">
        {JOKERS.map((kaart) => {
          const gekozen = value === kaart.id;
          return (
            <li key={kaart.id}>
              <button
                type="button"
                className={`joker-picker__kaart ${
                  gekozen ? "joker-picker__kaart--on" : ""
                }`}
                aria-pressed={gekozen}
                // Nog eens aantikken = geen joker. Zonder die uitweg zou je de
                // sheet moeten sluiten om je keuze terug te nemen.
                onClick={() => onChange(gekozen ? null : kaart.id)}
              >
                <span className="joker-picker__icoon" aria-hidden="true">
                  {kaart.icoon}
                </span>
                <span className="joker-picker__tekst">
                  <strong>{kaart.label}</strong>
                  <span className="joker-picker__effect">{kaart.effect}</span>
                  <span className="joker-picker__prijs">{kaart.prijs}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export default JokerPicker;
