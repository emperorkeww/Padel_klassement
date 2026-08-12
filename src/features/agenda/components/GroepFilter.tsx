import { useRef } from "react";
import { useScrollSchaduw } from "@/lib/hooks/useScrollSchaduw";
import type { GroupSummary } from "@/features/groups/api";

/* ------------------------------------------------------------------ */
/* Filterchips boven het raster (#1121).                               */
/*                                                                     */
/* De agenda werd de enige plek waar speeldagen samenkomen; met drie    */
/* groepen in een drukke maand draagt een dag al snel drie stippen die  */
/* over verschillende clubs gaan. Met de chips kijk je naar één groep   */
/* zonder de andere te hoeven wegdenken.                                */
/*                                                                     */
/* Eén groep = geen keuze, dus dan staat er niets. De chips zijn        */
/* schakelaars (aria-pressed), geen tabs: je kunt er meerdere aanzetten */
/* en "Alle" is simpelweg niets aangezet.                               */
/* ------------------------------------------------------------------ */

export function GroepFilter({
  groepen,
  gekozen,
  onWissel,
}: {
  groepen: GroupSummary[];
  /** Gekozen groep-ids; leeg = alle groepen. */
  gekozen: string[];
  /** De nieuwe keuze; leeg betekent weer alles. */
  onWissel: (ids: string[]) => void;
}) {
  // Eén groep is geen keuze. De rij zit in een eigen component omdat de hook
  // hieronder zich bij zijn eerste effect aan het element hecht: stond de
  // vroege return in hetzelfde component, dan draaide dat effect op de render
  // waarin er nog niets stond (de groepen komen async binnen), en werd de
  // scroll-listener nooit meer gekoppeld. De fade stond dan wel goed bij het
  // eerste meten, maar wisselde nooit meer van kant.
  if (groepen.length < 2) return null;
  return <FilterRij groepen={groepen} gekozen={gekozen} onWissel={onWissel} />;
}

function FilterRij({
  groepen,
  gekozen,
  onWissel,
}: {
  groepen: GroupSummary[];
  gekozen: string[];
  onWissel: (ids: string[]) => void;
}) {
  // De rij schuift horizontaal en heeft geen scrollbar; zonder teken aan de
  // rand zie je niet dat er nog een groep buiten beeld staat (#1195). Zelfde
  // hook en hetzelfde data-attribuut als de feed-filters en de tabbalk (#912).
  const rijRef = useRef<HTMLDivElement>(null);
  const schaduw = useScrollSchaduw(rijRef);

  const alles = gekozen.length === 0;

  function schakel(id: string) {
    onWissel(
      gekozen.includes(id)
        ? gekozen.filter((x) => x !== id)
        : [...gekozen, id],
    );
  }

  return (
    <div
      ref={rijRef}
      className="agenda-filter"
      data-schaduw={schaduw}
      role="group"
      aria-label="Filter op groep"
    >
      <button
        type="button"
        className="agenda-filter__chip"
        aria-pressed={alles}
        onClick={() => onWissel([])}
      >
        Alle groepen
      </button>
      {groepen.map((g) => (
        <button
          key={g.id}
          type="button"
          className="agenda-filter__chip"
          aria-pressed={gekozen.includes(g.id)}
          onClick={() => schakel(g.id)}
        >
          {g.name}
        </button>
      ))}
    </div>
  );
}

export default GroepFilter;
