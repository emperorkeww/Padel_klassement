import { useState, type ComponentProps } from "react";
import { Sheet } from "@/ui/Sheet";
import { MakeTeams } from "./MakeTeams";
import "./VolgendeRonde.css";

// De volgende ronde starten, als knop met de teamgenerator in een sheet (#839).
// Stond inline in VandaagTab; sinds #1133 ook op de speeldagpagina, waar je een
// ronde toevoegt aan een dag die nog moet komen of al geweest is. Eén component
// zodat de twee plekken niet uit elkaar lopen.
//
// De sheet houdt de generator uit de lijst: eronder zetten zou de rondes waar
// het om gaat elke keer een half scherm omlaag duwen.

export function VolgendeRonde(props: ComponentProps<typeof MakeTeams>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Een kernactie, geen instelling: hij zat achter een <details> "Nog een
          ronde maken" — dezelfde low-key behandeling als een lade, terwijl de
          rest van de pagina alles direct zichtbaar houdt. */}
      <div className="rondes__acties">
        <button className="btn btn--primary" onClick={() => setOpen(true)}>
          + Volgende ronde
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Volgende ronde">
        {/* De routes naar een volgende ronde (deze generator, de winner-card
            op de speeldag en sinds #827 de cron) deelden niet dezelfde vorm
            zonder dat de UI dat ergens zei. */}
        <p className="card__subtitle">
          De automaat deelt 's ochtends Americano; hier kies je zelf de vorm
          voor deze ronde.
        </p>
        {/* De sheet blijft na het genereren staan, zoals hij dat op de
            Spelen-tab altijd deed: de toast bevestigt, en zo kun je meteen nog
            een ronde maken zonder de knop opnieuw te zoeken. */}
        <MakeTeams {...props} />
      </Sheet>
    </>
  );
}

export default VolgendeRonde;
