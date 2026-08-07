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
  onOpen,
  className = "",
}: {
  /** Null zolang het aantal nog niet bekend is: dan geen badge, in plaats van
   *  een 0 die een tel later naar 3 springt. */
  ongelezen: number | null;
  onOpen: () => void;
  className?: string;
}) {
  const label = belLabel(ongelezen);

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
    </button>
  );
}

export default BelKnop;
