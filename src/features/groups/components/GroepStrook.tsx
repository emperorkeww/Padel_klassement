import { useEffect, useRef } from "react";
import { useScrollSchaduw } from "@/lib/hooks/useScrollSchaduw";
import { StatusGlyph } from "@/ui/StatusGlyph";
import type { Journey } from "../journey";
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
 * FeedFilters, #912).
 *
 * De "+"-knop achteraan is met #1134 vertrokken naar de paginakop: een groep
 * maken is de hoofdactie van de pagina en niet iets dat als naamloos plusje
 * achter een filterrij hoort te hangen. Deze strook zelf verdwijnt in het
 * vervolg van #1134 ten gunste van groepskaarten; het filteren neemt het
 * `<select>` in `MatchFilters` dan over.
 */
export function GroepStrook({
  groepen,
  gekozen,
  onKies,
  journeys,
}: {
  groepen: GroupSummary[];
  /** "" = alle groepen. */
  gekozen: string;
  onKies: (id: string) => void;
  /** Reisstatus per groep-id; ontbreekt zolang die query nog loopt. */
  journeys?: Record<string, Journey>;
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

      {groepen.map((g) => {
        const journey = journeys?.[g.id] ?? null;
        return (
          <button
            key={g.id}
            type="button"
            className={`tab ${gekozen === g.id ? "is-active" : ""}`}
            aria-pressed={gekozen === g.id}
            onClick={() => onKies(g.id)}
          >
            {/* De stip draagt de status in vórm (WCAG 1.4.1) en is decoratief;
                de status zelf staat als tekst in de naam van de knop. De lege
                huls houdt de breedte vast zolang de journeys nog laden — anders
                verspringen de chips horizontaal zodra ze binnenvallen. */}
            <span className="groep-strook__stip">
              {journey?.status && <StatusGlyph status={journey.status} />}
            </span>
            {g.name}
            {journey && <span className="sr-only">, {journey.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default GroepStrook;
