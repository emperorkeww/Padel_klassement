// Vaste dev-stage voor de Zwarte Piet-editie. Rendert de echte FutKaart met
// reproduceerbare inhoud, zodat artworkregistratie en responsive gedrag op
// exact dezelfde viewport met de referentie kunnen worden vergeleken.

import { Avatar } from "@/ui/Avatar";
import { tierFor } from "@/features/rating/tiers";
import { FutKaart, FutKaartDefs, FutKaartVoorkant } from "./FutKaart";
import "./PietShowcase.css";

const NAAM = "Alice Anders";
const ELO = 1050;

export function PietShowcase() {
  const tier = tierFor(ELO);
  // ?kaart=1 zet de stage in exportmodus: alleen de kaart met zijn breakout,
  // zonder titel en uitleg. Die twee horen bij de dev-stage, niet bij de
  // kaartcompositie, en ze maakten een screenshotvergelijking met de referentie
  // troebel — de uitsnede moest ze anders uit de pixels zien te raden.
  const alleenKaart =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("kaart");

  return (
    <div
      className={`piet-showcase${alleenKaart ? " piet-showcase--export" : ""}`}
    >
      <FutKaartDefs />
      <div className="piet-showcase__stage" data-piet-stage>
        <FutKaart
          tier={tier}
          editie="piet"
          className="piet-showcase__kaart"
          voor={
            <FutKaartVoorkant
              elo={ELO}
              tier={tier}
              naam={NAAM}
              avatar={<Avatar name={NAAM} size={160} />}
              editie="🃏 Piet · 28/6"
            />
          }
        />
        {!alleenKaart && (
          <>
            <h1 className="piet-showcase__titel">♣ Zwarte Piet</h1>
            <p className="piet-showcase__uitleg">
              De drager van de Zwarte Piet.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default PietShowcase;
