import { useState, type ComponentProps } from "react";
import { Sheet } from "@/ui/Sheet";
import { ShareSpeeldag } from "./ShareSpeeldag";

// De speeldag mee naar buiten nemen (#1141): tekst voor de groepschat, de
// poster met de FUT-kaarten, of het ding in je eigen agenda.
//
// Dat stond alles open in de kaart: twee knoppen, twee vinkjes en een
// agenda-knop, samen vijf regels waarvan de vinkjes het meeste gewicht droegen.
// In een kaart die dichtklapt zodra de baan geboekt is, is dat precies het
// soort blok dat de twee acties eromheen verdrukt. Achter één knop krijgen de
// keuzes juist meer ruimte om uit te leggen wat ze doen — en ze zitten in beide
// standen van de kaart op dezelfde plek.

export function DeelSpeeldag({
  onAgenda,
  ...share
}: ComponentProps<typeof ShareSpeeldag> & {
  /** Downloadt de .ics van deze speeldag. */
  onAgenda: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="btn btn--sm" onClick={() => setOpen(true)}>
        🖼 Delen
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Delen & agenda"
        compact
      >
        {/* Twee expliciete keuzes (#675), zoals ShareAvailability: de
            tekstregels voor de groepschat, of de opstelling als poster met de
            FUT-kaarten van de deelnemers. De opt-ins voor de toegangscode
            (#675) en de QR (#886) horen daarbij: een poster wordt doorgestuurd
            en blijft in fotorollen staan. */}
        <ShareSpeeldag {...share} />

        {/* Een .ics is een persoonlijke download, geen deelbare poster — maar
            het is wel dezelfde handeling: de speeldag ergens anders naartoe
            nemen. Vandaar dat hij hier staat en niet los in de kaart. */}
        <div className="winner-card__actions">
          <button className="btn btn--sm" onClick={onAgenda}>
            📅 Zet in agenda
          </button>
        </div>
      </Sheet>
    </>
  );
}

export default DeelSpeeldag;
