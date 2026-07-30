// Vaste dev-stage voor de Wannabe-divisie (goud). Rendert de echte FutKaart
// met reproduceerbare inhoud (ELO 1050 = Wannabe II, net als de referentie),
// zodat artworkregistratie en responsive gedrag op exact dezelfde viewport met
// docs/referentie_wannabe.png kunnen worden vergeleken.

import { Avatar } from "@/ui/Avatar";
import { tierFor } from "@/features/rating/tiers";
import { FutKaart, FutKaartDefs, FutKaartVoorkant } from "./FutKaart";
import "./WannabeShowcase.css";

const NAAM = "Papapadel";
const ELO = 1050;

export function WannabeShowcase() {
  const tier = tierFor(ELO);

  return (
    <div className="wannabe-showcase">
      <FutKaartDefs />
      <div className="wannabe-showcase__stage" data-wannabe-stage>
        <FutKaart
          tier={tier}
          className="wannabe-showcase__kaart"
          voor={
            <FutKaartVoorkant
              elo={ELO}
              tier={tier}
              naam={NAAM}
              avatar={<Avatar name={NAAM} size={160} />}
            />
          }
        />
        <h1 className="wannabe-showcase__titel">😤 Wannabe</h1>
        <p className="wannabe-showcase__uitleg">Rating 1000–1099</p>
      </div>
    </div>
  );
}

export default WannabeShowcase;
