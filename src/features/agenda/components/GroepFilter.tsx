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
  if (groepen.length < 2) return null;

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
      className="agenda-filter"
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
