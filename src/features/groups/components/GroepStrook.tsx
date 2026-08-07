import { useEffect, useRef, type RefObject } from "react";
import { useScrollSchaduw } from "@/lib/hooks/useScrollSchaduw";
import type { GroupSummary } from "../api";

/**
 * De groepskeuze bovenaan de Spelen-hub (#1123).
 *
 * Was een verticale stapel groepskaarten die alleen kón navigeren; nu een
 * strook chips die de matchlijst eronder scoopt. "Alle" staat vooraan en is de
 * standaard — de afwezigheid van een keuze, niet een keuze op zich.
 *
 * Bewust `role="group"` met `aria-pressed`-knoppen en geen `tablist`: dit zijn
 * filters over de inhoud eronder, geen tabbladen (dezelfde afweging als in
 * FeedFilters, #912). Een `radiogroup` viel af omdat de "+"-knop daarin geen
 * geldig kind zou zijn — en die hoort juist in de rij, naast de groepen die hij
 * aanvult.
 */
export function GroepStrook({
  groepen,
  gekozen,
  onKies,
  onNieuw,
  nieuwRef,
}: {
  groepen: GroupSummary[];
  /** "" = alle groepen. */
  gekozen: string;
  onKies: (id: string) => void;
  onNieuw: () => void;
  /** Voor de focusteruggave als het aanmaakformulier sluit (#916). */
  nieuwRef?: RefObject<HTMLButtonElement | null>;
}) {
  const rijRef = useRef<HTMLDivElement>(null);
  const schaduw = useScrollSchaduw(rijRef);

  // Land je via ?groep=… op een chip die buiten beeld valt, dan zie je anders
  // een rij zonder zichtbare keuze. Zelfde patroon als FeedFilters/PageTabs.
  useEffect(() => {
    const el = rijRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    // jsdom kent scrollIntoView niet.
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [gekozen]);

  return (
    <div
      ref={rijRef}
      className="tabs tabs--page groep-strook"
      data-schaduw={schaduw}
      role="group"
      aria-label="Groep kiezen"
    >
      <button
        type="button"
        className={`tab ${gekozen === "" ? "is-active" : ""}`}
        aria-pressed={gekozen === ""}
        onClick={() => onKies("")}
      >
        Alle
      </button>

      {groepen.map((g) => (
        <button
          key={g.id}
          type="button"
          className={`tab ${gekozen === g.id ? "is-active" : ""}`}
          aria-pressed={gekozen === g.id}
          onClick={() => onKies(g.id)}
        >
          {g.name}
        </button>
      ))}

      {/* Geen filter, dus geen aria-pressed: dit is een actie in dezelfde rij.
          Het label blijft voluit "Nieuwe groep" — de "+" alleen zou een knop
          zonder naam zijn voor wie hem niet ziet. */}
      <button
        type="button"
        ref={nieuwRef}
        className="tab groep-strook__nieuw"
        aria-label="Nieuwe groep"
        onClick={onNieuw}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

export default GroepStrook;
