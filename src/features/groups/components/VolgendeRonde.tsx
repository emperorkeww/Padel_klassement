import { useState, type ComponentProps } from "react";
import { Sheet } from "@/ui/Sheet";
import { MakeTeams } from "./MakeTeams";
import "./VolgendeRonde.css";

// Wedstrijden klaarzetten, als knop met de teamgenerator in een sheet (#839).
// Stond inline in VandaagTab; sinds #1133 ook op de speeldagpagina, waar je een
// ronde toevoegt aan een dag die nog moet komen of al geweest is. Eén component
// zodat de twee plekken niet uit elkaar lopen.
//
// Sinds #1141 is dit de énige weg naar nieuwe wedstrijden: de speeldagkaart had
// een eigen Elo-generator zonder spelerselectie en zonder vormkeuze. Dezelfde
// knop dient nu twee momenten — de eerste ronde ("Wedstrijden klaarzetten",
// in de kaart) en de volgende ("+ Volgende ronde", onder de rondes) — vandaar
// dat het label en de omlijsting van buiten komen.
//
// De sheet houdt de generator uit de lijst: eronder zetten zou de rondes waar
// het om gaat elke keer een half scherm omlaag duwen.

export function VolgendeRonde({
  label = "+ Volgende ronde",
  kaal = false,
  ...props
}: ComponentProps<typeof MakeTeams> & {
  label?: string;
  /** Zonder de eigen actiebalk eromheen — voor een knop die al in een rij
   *  staat, zoals in de speeldagkaart. */
  kaal?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Een kernactie, geen instelling: hij zat achter een <details> "Nog een ronde
  // maken" — dezelfde low-key behandeling als een lade, terwijl de rest van de
  // pagina alles direct zichtbaar houdt.
  const knop = (
    <button className="btn btn--primary" onClick={() => setOpen(true)}>
      {label}
    </button>
  );

  return (
    <>
      {kaal ? knop : <div className="rondes__acties">{knop}</div>}

      <Sheet open={open} onClose={() => setOpen(false)} title="Wedstrijden klaarzetten">
        {/* De routes naar wedstrijden (deze generator en sinds #827 de cron)
            deelden niet dezelfde vorm zonder dat de UI dat ergens zei. */}
        <p className="card__subtitle">
          De automaat deelt 's ochtends Americano; hier kies je zelf de vorm.
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
