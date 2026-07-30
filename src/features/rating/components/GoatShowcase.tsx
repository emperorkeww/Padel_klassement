// Vaste dev-stage voor de GOAT-tier. Rendert de echte FutKaart met
// reproduceerbare inhoud (ELO 1450 = GOAT III, net als de referentie), zodat
// artworkregistratie en responsive gedrag op exact dezelfde viewport met
// docs/referentie_goat.png kunnen worden vergeleken.

import { Avatar } from "@/ui/Avatar";
import { tierFor } from "@/features/rating/tiers";
import { FutKaart, FutKaartDefs, FutKaartVoorkant } from "./FutKaart";
import "./GoatShowcase.css";

const NAAM = "Alice Anders";
const ELO = 1450;

export function GoatShowcase() {
  const tier = tierFor(ELO);

  return (
    <div className="goat-showcase">
      <FutKaartDefs />
      <div className="goat-showcase__stage" data-goat-stage>
        <FutKaart
          tier={tier}
          className="goat-showcase__kaart"
          voor={
            <FutKaartVoorkant
              elo={ELO}
              tier={tier}
              naam={NAAM}
              avatar={<Avatar name={NAAM} size={160} />}
            />
          }
        />
        <h1 className="goat-showcase__titel">🐐 GOAT</h1>
        <p className="goat-showcase__uitleg">Rating 1400–1599</p>
      </div>
    </div>
  );
}

export default GoatShowcase;
