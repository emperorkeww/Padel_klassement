import { belLabel, tellerTekst } from "../bel";
import { IconBel } from "./IconBel";
import "./BelKnop.css";

/**
 * De bel in de mobiele topbalk (#1090).
 *
 * De onderbalk was geen optie: die heeft vijf slots, symmetrisch rond de bal in
 * het midden, en dat is een bewuste keuze uit #106/#274. Op desktop is deze
 * balk verborgen en staat dezelfde ingang in de zijbalk — zelfde patroon als de
 * ?-knop uit #989.
 *
 * Vorm en tapvlak volgen HelpKnop.css, zodat de knoppen in de balk één rij
 * blijven in plaats van drie rondjes van verschillende grootte.
 */
export function BelKnop({
  ongelezen,
  verzoeken = 0,
  onOpen,
  className = "",
}: {
  /** Null zolang het aantal nog niet bekend is: dan geen badge, in plaats van
   *  een 0 die een tel later naar 3 springt. */
  ongelezen: number | null;
  /** Openstaande vriendschapsverzoeken (#1232): een tweede, toestand-gebaseerd
   *  signaal naast de gelezen-teller. */
  verzoeken?: number;
  onOpen: () => void;
  className?: string;
}) {
  const label = belLabel(ongelezen, verzoeken);
  // Eén markering op een knop van 32px, niet twee: staat de teller er al, dan
  // trekt die de aandacht al en zou een stip ernaast alleen ruis zijn. Wat het
  // verzoek onderscheidt van een ongelezen melding staat in de naam hierboven
  // en in de regel bovenaan het paneel — dáár kun je er ook iets mee.
  const stip = verzoeken > 0 && !ongelezen;

  return (
    <button
      type="button"
      className={`bel-knop ${className}`.trim()}
      onClick={onOpen}
      aria-label={label}
      title={label}
    >
      <IconBel />
      {!!ongelezen && (
        <span className="bel-knop__teller" aria-hidden="true">
          {tellerTekst(ongelezen)}
        </span>
      )}
      {stip && <span className="bel-knop__stip" aria-hidden="true" />}
    </button>
  );
}

export default BelKnop;
