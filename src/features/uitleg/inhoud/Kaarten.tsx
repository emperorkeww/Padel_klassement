import { KaartLegenda } from "@/features/standings/components/KaartLegenda";
import type { SectieProps } from ".";

/** Sectie 8: de spelerskaarten (#989). De varianten komen uit `KaartLegenda`
 *  (#763), die op zijn beurt tierLegend() en EDITIE_PRIORITEIT leest — de
 *  voorbeeldkaarten dragen je eigen naam en avatar. */
export function Kaarten({ naam, profile }: SectieProps) {
  return (
    <>
      <p>
        Iedereen heeft een <strong>spelerskaart</strong>: je divisie bepaalt hoe
        hij eruitziet, en bijzondere prestaties leveren een speciale editie op —
        van de kroon voor de nummer één tot de kaarten die je liever niet
        verdient. Je vindt de kaarten op de Kaarten-tab van het klassement en op
        je eigen profiel.
      </p>
      <KaartLegenda naam={naam} profile={profile} />
    </>
  );
}

export default Kaarten;
