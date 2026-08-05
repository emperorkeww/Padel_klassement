import { useRef } from "react";
import { useScrollSchaduw } from "@/lib/hooks/useScrollSchaduw";
import { ADMIN_FILTERS, type AdminFilterId } from "../adminFilters";

// Filterchips op de gebruikerslijst (#1036 deel 3).
//
// Ze beantwoorden de vragen die je écht hebt: wie is er nooit binnengekomen,
// wie zit nergens in, wie speelt niet mee. Zelfde patroon als de feedfilters
// (#912): schakelknoppen met `aria-pressed` in een `role="group"`, en een fade
// aan de kant waar nog chips buiten beeld staan.
//
// Anders dan bij de feed stapelen deze chips wél: "geen groep" plus "geen
// match" is de vraag "wie is aangemeld en verder nooit iets gaan doen", en dat
// is een kleinere — en interessantere — verzameling dan de twee los. De
// predicaten staan in ../adminFilters.ts en zijn daar apart getest; deze
// component bevat geen logica.

export function AdminFilters({
  actief,
  onWissel,
  telFilter,
}: {
  actief: readonly AdminFilterId[];
  onWissel: (id: AdminFilterId) => void;
  /** Hoeveel accounts dit filter zou overhouden, los van de andere chips. */
  telFilter: (id: AdminFilterId) => number;
}) {
  const rijRef = useRef<HTMLDivElement>(null);
  const schaduw = useScrollSchaduw(rijRef);

  return (
    <div
      ref={rijRef}
      className="tabs admin__filters"
      data-schaduw={schaduw}
      role="group"
      aria-label="Accounts filteren"
    >
      {ADMIN_FILTERS.map((f) => {
        const aan = actief.includes(f.id);
        return (
          <button
            key={f.id}
            type="button"
            className={`tab ${aan ? "is-active" : ""}`}
            aria-pressed={aan}
            onClick={() => onWissel(f.id)}
          >
            {f.label}
            {/* Zelfde afweging als bij de feedfilters: de toegankelijke naam
                van een chip is exact het filterlabel; het aantal is context. */}
            <span className="tab__count" aria-hidden="true">
              {telFilter(f.id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
