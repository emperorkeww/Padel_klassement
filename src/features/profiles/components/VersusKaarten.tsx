// Head-to-Head versus-kaarten (#499): "Jij vs [Speler]" als twee FUT-kaarten
// tegenover elkaar (FIFA-laadscherm-stijl), i.p.v. een kale titel. Statisch
// (geen flip) — dit is een duel-overzicht, geen spelersdetail zoals de hero.
// Dictator-/editie-bewust via vsKaartVoor() (compare.ts), zodat een speler
// hier dezelfde kaart draagt als op klassement, profiel en matchdetail
// (#621/#624).

import { Avatar } from "@/components/ui/Avatar";
import { FutKaart, FutKaartVoorkant } from "@/features/rating/components/FutKaart";
import type { VsKaart } from "@/features/profiles/compare";
import "./VersusKaarten.css";

export function VersusKaarten({ mij, hen }: { mij: VsKaart; hen: VsKaart }) {
  return (
    <div className="vs-kaarten">
      <VersusKaart kaart={mij} className="vs-kaarten__kaart--mij" />
      <span className="vs-kaarten__medaillon" aria-hidden="true">
        VS
      </span>
      <VersusKaart kaart={hen} className="vs-kaarten__kaart--hen" />
    </div>
  );
}

function VersusKaart({ kaart, className }: { kaart: VsKaart; className: string }) {
  return (
    <div className={`vs-kaarten__kaart ${className}`}>
      <FutKaart
        tier={kaart.tier}
        editie={kaart.editie}
        voor={
          <FutKaartVoorkant
            elo={kaart.rating}
            tier={kaart.tier}
            naam={kaart.naam}
            avatar={
              <Avatar
                profile={{ avatar_url: kaart.avatarUrl }}
                name={kaart.naam}
                size={64}
              />
            }
            editie={kaart.editieTekst}
            playstyles={kaart.playstyles}
          />
        }
      />
    </div>
  );
}

export default VersusKaarten;
