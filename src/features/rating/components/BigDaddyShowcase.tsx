// Vaste dev-stage voor Big Daddy. Rendert de echte FutKaart met de icon-editie
// en reproduceerbare inhoud, zodat artworkregistratie en responsive gedrag op
// exact dezelfde viewport met de referentie kunnen worden vergeleken.

import { Avatar } from "@/ui/Avatar";
import { tierFor } from "@/features/rating/tiers";
import { FutKaart, FutKaartDefs, FutKaartVoorkant } from "./FutKaart";
import "./BigDaddyShowcase.css";

const NAAM = "Alice Anders";
const ELO = 1050;

export function BigDaddyShowcase() {
  const tier = tierFor(ELO);

  return (
    <div className="bigdaddy-showcase">
      <FutKaartDefs />
      <div className="bigdaddy-showcase__stage" data-bigdaddy-stage>
        <FutKaart
          tier={tier}
          editie="icon"
          className="bigdaddy-showcase__kaart"
          voor={
            <FutKaartVoorkant
              elo={ELO}
              tier={tier}
              naam={NAAM}
              avatar={<Avatar name={NAAM} size={160} />}
              editie="👑 Big Daddy"
            />
          }
        />
        <h1 className="bigdaddy-showcase__titel">👑 Big Daddy</h1>
        <p className="bigdaddy-showcase__uitleg">
          De meest feestelijke kaart van het klassement.
        </p>
      </div>
    </div>
  );
}

export default BigDaddyShowcase;
