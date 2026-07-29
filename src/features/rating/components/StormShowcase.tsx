// Dev-stage voor het In-Form stormeffect (#834): één award-weergave (kaart +
// titel + uitleg, zoals de referentie) op vaste maat, zodat het
// screenshotscript (scripts/storm-screenshot.sh) altijd exact dezelfde stage
// fotografeert. Alleen in development geregistreerd (/dev/storm); met
// ?debugStorm=1 tekenen de stormlagen hun bounding boxes en labels.

import { Avatar } from "@/ui/Avatar";
import { tierFor } from "@/features/rating/tiers";
import { FutKaart, FutKaartDefs, FutKaartVoorkant } from "./FutKaart";
import "./StormShowcase.css";

const NAAM = "Alice Anders";
const ELO = 1050;

export function StormShowcase() {
  const tier = tierFor(ELO);
  return (
    <div className="storm-showcase">
      <FutKaartDefs />
      <div className="storm-showcase__stage" data-storm-stage>
        <FutKaart
          tier={tier}
          editie="inform"
          className="storm-showcase__kaart"
          voor={
            <FutKaartVoorkant
              elo={ELO}
              tier={tier}
              naam={NAAM}
              avatar={<Avatar name={NAAM} size={160} />}
              editie="⚡ In-Form · +48"
            />
          }
        />
        <h1 className="storm-showcase__titel">⚡ In-Form</h1>
        <p className="storm-showcase__uitleg">
          Speler van de week: de grootste ratingwinst van de afgelopen zeven
          dagen.
        </p>
      </div>
    </div>
  );
}

export default StormShowcase;
