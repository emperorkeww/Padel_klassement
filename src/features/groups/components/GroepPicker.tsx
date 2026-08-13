import { useState } from "react";
import { ledenLabel } from "@/features/groups/groepHelpers";
import type { GroupSummary } from "@/features/groups/api";
import "@/features/availability/components/ClubPicker.css";
import "./GroepPicker.css";

/**
 * Voor welke groep plan je? (#1308)
 *
 * Deze vraag had een eigen scherm — het plan-sheet vóór de wizard — met precies
 * één keuze erop, een knop die bij openen uitgegrijsd stond zolang je niets
 * aanwees, en een "Terug" die de hele keten sloot. Bij één groep viel het scherm
 * helemaal weg en bleef er een tussenstap over die alleen bestond om
 * doorgeklikt te worden.
 *
 * Nu een regel in de kop van de wizard, naast de club: dezelfde behandeling die
 * de clubkeuze in #1271 kreeg, en om dezelfde reden — het is context, geen werk.
 * Er is altijd een geldige keuze (de laatst gebruikte, anders je enige), dus de
 * hoofdknop kan niet meer dood in beeld staan. Bij één groep is het een rij die
 * zegt voor wie je plant, zonder iets te vragen.
 *
 * Leunt bewust op de stijl van de ClubPicker ernaast: twee knoppen naast elkaar
 * die hetzelfde soort keuze openen, horen er hetzelfde uit te zien.
 */
export function GroepPicker({
  groepen,
  groupId,
  onGroep,
}: {
  groepen: GroupSummary[];
  groupId: string;
  onGroep: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const actief = groepen.find((g) => g.id === groupId) ?? groepen[0];
  if (!actief) return null;
  const label = `${actief.name} · ${ledenLabel(actief.member_ids.length)}`;

  // Eén groep: dan valt er niets te kiezen, en een knop die een paneel met één
  // optie opent is een omweg naar hetzelfde antwoord.
  if (groepen.length === 1) {
    return (
      <p className="groep-picker groep-picker--vast">
        <span aria-hidden="true">👥</span> {label}
      </p>
    );
  }

  return (
    <div className="club-picker groep-picker">
      <button
        type="button"
        className="btn btn--sm club-picker__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">👥</span>
        <span className="club-picker__label">{label}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <>
          <div
            className="avail-popover-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="club-picker__panel"
            role="dialog"
            aria-label="Kies een groep"
          >
            <ul className="club-picker__list">
              {groepen.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    className="club-picker__option"
                    aria-current={g.id === actief.id ? "true" : undefined}
                    onClick={() => {
                      onGroep(g.id);
                      setOpen(false);
                    }}
                  >
                    <span className="club-picker__name">{g.name}</span>
                    <span className="club-picker__city">
                      {ledenLabel(g.member_ids.length)}
                      {g.id === actief.id ? " · nu gekozen" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export default GroepPicker;
