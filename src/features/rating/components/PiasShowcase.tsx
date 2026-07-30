// Vaste dev-stage voor de pias-editie. Rendert de echte FutKaart met
// reproduceerbare inhoud, zodat artworkregistratie en responsive gedrag op
// exact dezelfde viewport met docs/referentie_pias.png kunnen worden
// vergeleken.

import { Avatar } from "@/ui/Avatar";
import { tierFor } from "@/features/rating/tiers";
import { FutKaart, FutKaartDefs, FutKaartVoorkant } from "./FutKaart";
import "./PiasShowcase.css";

const NAAM = "Alice Anders";
const ELO = 1050;

export function PiasShowcase() {
  const tier = tierFor(ELO);

  return (
    <div className="pias-showcase">
      <FutKaartDefs />
      <div className="pias-showcase__stage" data-pias-stage>
        <FutKaart
          tier={tier}
          editie="pias"
          className="pias-showcase__kaart"
          voor={
            <FutKaartVoorkant
              elo={ELO}
              tier={tier}
              naam={NAAM}
              avatar={<Avatar name={NAAM} size={160} />}
              editie="🤡 Pias · 12 partijen"
            />
          }
        />
        <h1 className="pias-showcase__titel">🤡 Pias</h1>
        <p className="pias-showcase__uitleg">
          De anti-MVP van de week.
        </p>
      </div>
    </div>
  );
}

export default PiasShowcase;
