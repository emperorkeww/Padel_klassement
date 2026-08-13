import { soortInfo, type SoortPresentatie } from "../soorten";
import { FILTER_ALLES, FILTER_ONGELEZEN } from "../filteren";
import type { Melding } from "../api";

/**
 * De filterrij van /meldingen (#1273).
 *
 * Kan pas sinds de soort in de UI bestaat. Eén rij en één keuze tegelijk:
 * "Ongelezen" en een soort combineren klinkt handig, maar dit is een lijst van
 * hooguit een paar honderd rijen waarin je iets terugzoekt — twee assen naast
 * elkaar maken de rij breder dan het antwoord waard is.
 *
 * Alleen soorten die in het geladen venster voorkomen krijgen een chip: een
 * lege "VAR"-chip die nul oplevert is een dood spoor. De vorm volgt de
 * feedfilters (#912): schakelknoppen met aria-pressed, geen tabrollen — dit
 * zijn filters en geen tabbladen.
 */
export function MeldingenFilter({
  meldingen,
  actief,
  onKies,
}: {
  meldingen: Melding[];
  actief: string;
  onKies: (waarde: string) => void;
}) {
  const ongelezen = meldingen.filter((m) => !m.read_at).length;
  const perSoort = new Map<string, { info: SoortPresentatie; aantal: number }>();
  for (const m of meldingen) {
    const bestaand = perSoort.get(m.soort);
    if (bestaand) bestaand.aantal += 1;
    else perSoort.set(m.soort, { info: soortInfo(m.soort), aantal: 1 });
  }

  const chips = [
    { waarde: FILTER_ALLES, label: "Alles", aantal: null as number | null },
    ...(ongelezen > 0
      ? [{ waarde: FILTER_ONGELEZEN, label: "Ongelezen", aantal: ongelezen }]
      : []),
    ...[...perSoort].map(([soort, { info, aantal }]) => ({
      waarde: soort,
      label: info.label,
      aantal,
    })),
  ];

  // Eén soort in de hele lijst betekent dat de chips niets te kiezen geven.
  if (chips.length < 3) return null;

  return (
    <div className="tabs meldingen__filters" role="group" aria-label="Meldingen filteren">
      {chips.map((chip) => (
        <button
          key={chip.waarde}
          type="button"
          className={`tab ${actief === chip.waarde ? "is-active" : ""}`}
          aria-pressed={actief === chip.waarde}
          onClick={() => onKies(chip.waarde)}
        >
          {chip.label}
          {chip.aantal !== null && (
            <span className="tab__count" aria-hidden="true">
              {chip.aantal}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default MeldingenFilter;
