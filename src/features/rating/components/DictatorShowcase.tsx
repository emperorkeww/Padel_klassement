// Vaste dev-stage voor El Padelissimo. De stage rendert de echte FutKaart met
// dictator-tier en reproduceerbare inhoud, zodat compositie en responsive
// gedrag op dezelfde viewport kunnen worden vergeleken met de referentie.

import dictatorPortret from "@/features/dictator/components/dictator-portret-groen-uniform.webp";
import { Avatar } from "@/ui/Avatar";
import { tierFor } from "@/features/rating/tiers";
import { FutKaart, FutKaartDefs, FutKaartVoorkant } from "./FutKaart";
import "./DictatorShowcase.css";

const NAAM = "Alice Anders";
const ELO = 1650;

export function DictatorShowcase() {
  const tier = tierFor(ELO);
  return (
    <div className="dictator-showcase">
      <FutKaartDefs />
      <div className="dictator-showcase__stage" data-dictator-stage>
        <FutKaart
          tier={tier}
          className="dictator-showcase__kaart"
          voor={
            <FutKaartVoorkant
              elo={ELO}
              tier={tier}
              naam={NAAM}
              avatar={
                <Avatar
                  name={NAAM}
                  size={160}
                  profile={{ avatar_url: dictatorPortret }}
                />
              }
            />
          }
        />
        <h1 className="dictator-showcase__titel">★ El Padelissimo</h1>
        <p className="dictator-showcase__uitleg">
          De zittende dictator van het klassement.
        </p>
      </div>
    </div>
  );
}

export default DictatorShowcase;
