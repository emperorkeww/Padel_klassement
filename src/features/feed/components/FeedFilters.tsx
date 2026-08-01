import { useEffect, useRef } from "react";
import { useScrollSchaduw } from "@/lib/hooks/useScrollSchaduw";
import { FILTER_CAT, FILTER_LABELS, type FilterLabel } from "../feedHelpers";

/**
 * De filterrij van de feed (#912).
 *
 * Was een kale `<div className="tabs">` met losse buttons: geen rolinformatie
 * (het zijn filters, geen tabbladen — daarom bleef dit bewust liggen in #910),
 * de teller zat achter `aria-hidden`, en de rij liep op telefoonbreedte gewoon
 * van het scherm af zonder dat iets verried dat er rechts meer stond.
 *
 * Nu: een groep schakelknoppen met `aria-pressed`, een fade aan de kant waar
 * nog chips staan, de actieve chip die zichzelf in beeld scrollt, en één tik om
 * het filter te wissen.
 *
 * De teller blijft bewust `aria-hidden`: de toegankelijke naam van een chip is
 * exact het filterlabel, een keuze uit #232 die door een eigen test bewaakt
 * wordt. Dat is een andere afweging dan bij PageTabs, waar de teller wél in de
 * naam zit — daar hoort hij bij een tabblad dat je kiest, hier bij een filter
 * waarvan het aantal per seconde kan wisselen.
 */
export function FeedFilters({
  active,
  onSelect,
  countFor,
}: {
  active: FilterLabel;
  onSelect: (label: FilterLabel) => void;
  countFor: (label: FilterLabel) => number;
}) {
  const rijRef = useRef<HTMLDivElement>(null);
  const schaduw = useScrollSchaduw(rijRef);

  // Land je via ?filter=roast op een chip die buiten beeld valt, dan zie je
  // anders een lege rij zonder actieve chip. Zelfde patroon als PageTabs.
  useEffect(() => {
    const el = rijRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    // jsdom kent scrollIntoView niet.
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [active]);

  return (
    <div className="feed__filterbar">
      <div
        ref={rijRef}
        className="tabs feed__filters"
        data-schaduw={schaduw}
        role="group"
        aria-label="Feed filteren"
      >
        {FILTER_LABELS.map((label) => {
          const cat = FILTER_CAT[label];
          const aantal = label === "Alles" ? null : countFor(label);
          return (
            <button
              key={label}
              type="button"
              className={`tab ${active === label ? "is-active" : ""}`}
              aria-pressed={active === label}
              onClick={() => onSelect(label)}
            >
              {cat && (
                <span className="tab__dot" data-cat={cat} aria-hidden="true" />
              )}
              {label}
              {aantal !== null && (
                <span className="tab__count" aria-hidden="true">
                  {aantal}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Nogmaals op de actieve chip tikken wist het filter ook, maar niets
          verraadt dat — deze knop is de vindbare weg terug. */}
      {active !== "Alles" && (
        <button
          type="button"
          className="btn btn--sm feed__filters-wis"
          onClick={() => onSelect("Alles")}
        >
          <span aria-hidden="true">✕</span> Wis filter
        </button>
      )}
    </div>
  );
}

export default FeedFilters;
