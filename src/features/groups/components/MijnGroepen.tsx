import { useRef, useState } from "react";
import { useScrollSchaduw } from "@/lib/hooks/useScrollSchaduw";
import { GroupCardSkeleton } from "@/ui/Skeleton";
import { Sheet } from "@/ui/Sheet";
import type { AvatarSource } from "@/ui/Avatar";
import { GroepKaart } from "./GroepKaart";
import type { Journey } from "../journey";
import type { GroupSummary } from "../api";

/**
 * De groepen bovenaan de Spelen-hub (#1134).
 *
 * Op telefoonbreedte een horizontale rij die per kaart snapt, met de volgende
 * kaart half in beeld: dan zie je meteen dát er meer groepen zijn, zonder dat
 * vijf kaarten de matchhistorie van het scherm duwen. Vanaf tabletbreedte is er
 * ruimte voor een raster en vervalt zowel het scrollen als het snappen.
 *
 * De fade aan de rand komt van `useScrollSchaduw` (#912), net als bij de
 * filterchips van het clubblad en de paginatabs: een fade die er altijd staat
 * liegt zodra je aan het einde bent.
 */

/** Vanaf hoeveel groepen "Alles bekijken" verschijnt. Tot en met vier kaarten
 *  veeg je in één beweging door de rij; daarboven is de rij lang genoeg dat een
 *  volledig overzicht sneller is dan zoeken. */
export const ALLES_DREMPEL = 4;

export function MijnGroepen({
  groepen,
  myId,
  profiles,
  journeys,
  laadt = false,
}: {
  groepen: GroupSummary[];
  myId: string;
  profiles: Record<string, AvatarSource | undefined>;
  /** Reisstatus per groep-id; ontbreekt zolang die query nog loopt. */
  journeys?: Record<string, Journey>;
  laadt?: boolean;
}) {
  const rijRef = useRef<HTMLDivElement>(null);
  const schaduw = useScrollSchaduw(rijRef);
  const [allesOpen, setAllesOpen] = useState(false);

  const kaart = (g: GroupSummary) => (
    <GroepKaart
      key={g.id}
      groep={g}
      eigenaar={g.created_by === myId}
      profiles={profiles}
      journey={journeys?.[g.id]}
    />
  );

  return (
    <section className="mijn-groepen" aria-labelledby="mijn-groepen-titel">
      <div className="mijn-groepen__kop">
        <h2 className="mijn-groepen__titel" id="mijn-groepen-titel">
          Mijn groepen
        </h2>
        {/* Bewust een sheet en geen eigen route: /groepen is al een redirect
            naar deze pagina, en een tweede scherm met dezelfde kaarten is een
            tweede plek om te onderhouden. Het aantal staat ín het label, zodat
            de toegankelijke naam de zichtbare tekst blijft bevatten (WCAG
            2.5.3). */}
        {!laadt && groepen.length > ALLES_DREMPEL && (
          <button
            type="button"
            className="btn btn--sm mijn-groepen__alles"
            onClick={() => setAllesOpen(true)}
          >
            Alles bekijken ({groepen.length})
          </button>
        )}
      </div>

      <div ref={rijRef} className="mijn-groepen__rij" data-schaduw={schaduw}>
        {laadt ? (
          // Skeletons in de vorm en de maat van de echte kaart, zodat de
          // filterrij eronder niet opschuift zodra de groepen binnenvallen.
          <>
            <GroupCardSkeleton />
            <GroupCardSkeleton />
          </>
        ) : (
          groepen.map(kaart)
        )}
      </div>

      {/* Dezelfde kaarten, onder elkaar. Geen tweede voorstelling van een groep
          die uit de pas kan gaan lopen met de eerste. */}
      <Sheet
        open={allesOpen}
        onClose={() => setAllesOpen(false)}
        title="Mijn groepen"
      >
        <div className="mijn-groepen__lijst">{groepen.map(kaart)}</div>
      </Sheet>
    </section>
  );
}

export default MijnGroepen;
