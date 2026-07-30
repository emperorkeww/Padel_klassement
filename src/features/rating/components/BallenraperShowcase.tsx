// Vaste dev-stage voor de Ballenraper-divisie. Alle kaartgegevens blijven
// live DOM-inhoud; alleen het materiaal en de decoraties komen uit artwork.

import { Avatar } from "@/ui/Avatar";
import { tierFor } from "@/features/rating/tiers";
import { FutKaart, FutKaartDefs, FutKaartVoorkant } from "./FutKaart";
import "./BallenraperShowcase.css";

const NAAM = "Alice Anders";
const ELO = 750;

export function BallenraperShowcase() {
  const tier = tierFor(ELO);

  return (
    <div className="ballenraper-showcase">
      <FutKaartDefs />
      <div className="ballenraper-showcase__stage" data-ballenraper-stage>
        <FutKaart
          tier={tier}
          className="ballenraper-showcase__kaart"
          voor={
            <FutKaartVoorkant
              elo={ELO}
              tier={tier}
              naam={NAAM}
              avatar={<Avatar name={NAAM} size={160} />}
              statBron={{
                gespeeld: 24,
                gewonnen: 9,
                gelijk: 4,
                verloren: 11,
                punten: 31,
                doelsaldo: -3,
                vorm: ["L", "W", "D", "L", "W"],
              }}
            />
          }
        />
        <h1 className="ballenraper-showcase__titel">🎾 Ballenraper</h1>
        <p className="ballenraper-showcase__uitleg">Rating 700–799</p>
      </div>
    </div>
  );
}

export default BallenraperShowcase;
