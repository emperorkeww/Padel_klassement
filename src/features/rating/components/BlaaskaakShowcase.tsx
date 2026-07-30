// Vaste dev-stage voor de Blaaskaak-divisie. Rendert de echte FutKaart met
// reproduceerbare inhoud (ELO 950 = Blaaskaak II, zoals de referentie).

import { Avatar } from "@/ui/Avatar";
import { tierFor } from "@/features/rating/tiers";
import { FutKaart, FutKaartDefs, FutKaartVoorkant } from "./FutKaart";
import "./BlaaskaakShowcase.css";

const NAAM = "Papapadel";
const ELO = 950;

export function BlaaskaakShowcase() {
  const tier = tierFor(ELO);

  return (
    <div className="blaaskaak-showcase">
      <FutKaartDefs />
      <div className="blaaskaak-showcase__stage" data-blaaskaak-stage>
        <FutKaart
          tier={tier}
          className="blaaskaak-showcase__kaart"
          voor={
            <FutKaartVoorkant
              elo={ELO}
              tier={tier}
              naam={NAAM}
              avatar={<Avatar name={NAAM} size={160} />}
            />
          }
        />
        <h1 className="blaaskaak-showcase__titel">💨 Blaaskaak</h1>
        <p className="blaaskaak-showcase__uitleg">Rating 900–999</p>
      </div>
    </div>
  );
}

export default BlaaskaakShowcase;
