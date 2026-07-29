// Dev-stage voor de On Fire-kaart: dezelfde echte FutKaart als in de app,
// maar met vaste inhoud en maat zodat visuele iteraties vergelijkbaar blijven.
// Alleen in development geregistreerd op /dev/onfire.

import { Avatar } from "@/ui/Avatar";
import { tierFor } from "@/features/rating/tiers";
import { FutKaart, FutKaartDefs, FutKaartVoorkant } from "./FutKaart";
import "./OnfireShowcase.css";

const NAAM = "Alice Anders";
const ELO = 1050;

export function OnfireShowcase() {
  const tier = tierFor(ELO);
  return (
    <div className="onfire-showcase">
      <FutKaartDefs />
      <div className="onfire-showcase__stage" data-onfire-stage>
        <FutKaart
          tier={tier}
          editie="onfire"
          className="onfire-showcase__kaart"
          voor={
            <FutKaartVoorkant
              elo={ELO}
              tier={tier}
              naam={NAAM}
              avatar={<Avatar name={NAAM} size={160} />}
              editie="🔥 On Fire · 6 op rij"
            />
          }
        />
        <h1 className="onfire-showcase__titel">🔥 On Fire</h1>
        <p className="onfire-showcase__uitleg">
          Een lopende winstreak. De enige editie die meerdere dragers tegelijk
          kan hebben.
        </p>
      </div>
    </div>
  );
}

export default OnfireShowcase;
