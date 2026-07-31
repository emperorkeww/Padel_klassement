// Vaste dev-stage voor de Glazenwasser-divisie (platina). Rendert de échte
// GlazenwasserKaart met reproduceerbare inhoud (ELO 1150 = Glazenwasser II, net
// als de referentie), zodat compositie, schaalverdeling en laagstructuur op
// exact dezelfde viewport met docs/referentie_glazenwasser.png kunnen worden
// vergeleken.

import { Avatar } from "@/ui/Avatar";
import { FutKaart, FutKaartDefs, FutKaartVoorkant } from "./FutKaart";
import { tierFor, tierLegend } from "@/features/rating/tiers";
import {
  GlazenwasserInfo,
  GlazenwasserKaart,
  GlazenwasserKaartDefs,
} from "./glazenwasser/GlazenwasserKaart";
import { glazenwasserStats } from "./glazenwasser/glazenwasserStats";
import "./GlazenwasserShowcase.css";

const NAAM = "Papapadel";
const ELO = 1150;

/** Vaste, realistische cijfers: de stage moet tussen twee runs niet verschuiven,
 *  anders zegt een screenshotvergelijking niets. Dezelfde velden die de
 *  kaart-modal uit een klassementrij haalt. */
const BRON = {
  gespeeld: 42,
  gewonnen: 26,
  gelijk: 4,
  verloren: 12,
  punten: 82,
  saldo: 38,
  rang: 3,
  vorm: ["W", "W", "L", "W", "W"],
} as const;

export function GlazenwasserShowcase() {
  const tier = tierFor(ELO);
  const bereik =
    tierLegend().find((r) => r.key === "platina")?.range ?? "1100–1199";

  return (
    <div className="glazenwasser-showcase">
      <GlazenwasserKaartDefs />
      <div className="glazenwasser-showcase__stage" data-glazenwasser-stage>
        <GlazenwasserKaart
          elo={ELO}
          tier={tier}
          naam={NAAM}
          className="glazenwasser-showcase__kaart"
          avatar={<Avatar name={NAAM} size={160} />}
          stats={glazenwasserStats(BRON)}
        />
        {tier && <GlazenwasserInfo tier={tier} bereik={bereik} />}

        {/* De compacte kaart eronder. Dít is wat spelers in de app zien — de
            ranglijst, de kaart-modal, de opstelling en het profiel renderen
            allemaal FutKaart, niet de brede kaart hierboven. Het artwork komt uit
            glazenwasser-master.webp, dat uit dezelfde ring en dezelfde voorwerpen
            wordt opgebouwd. Zonder deze tweede stage is die masterwissel nergens
            te beoordelen en blijft onzichtbaar of hij klopt. */}
        <FutKaartDefs />
        <div className="glazenwasser-showcase__compact" data-glazenwasser-compact>
          <FutKaart
            tier={tier}
            voor={
                <FutKaartVoorkant
                  elo={ELO}
                  tier={tier}
                  naam={NAAM}
                  avatar={<Avatar name={NAAM} size={64} />}
                />
            }
          />
        </div>
      </div>

    </div>
  );
}

export default GlazenwasserShowcase;
