// Vaste dev-stage voor de laagste tier ("Sletje van de baan"). Rendert de echte
// FutKaart met reproduceerbare inhoud (ELO 350, net als de referentie), zodat
// de compositie op exact dezelfde viewport met
// docs/referentie_sletje_van_de_baan.png kan worden vergeleken.
//
// De stage staat bewust dicht op de kaart: de referentie is een mobiel beeld
// waarin de kaart bijna de volledige breedte pakt en het informatieblok er
// direct onder hangt.

import { Avatar } from "@/ui/Avatar";
// Sta-in-foto voor de dev-stage. De portretzone is de enige plek op deze kaart
// waar een echte foto anders uitpakt dan de initialen-fallback, dus zonder foto
// is de uitsnede hier niet te controleren. Het bestand staat al in de repo.
import stand from "@/features/coach/components/rudi_avatars/rudi-gemeen-3.webp";
import { bandRangeLabel, TIER_BANDEN, tierFor } from "@/features/rating/tiers";
import { FutKaart, FutKaartDefs, FutKaartVoorkant } from "./FutKaart";
import "./SlofShowcase.css";

const NAAM = "Alice Anders";
const ELO = 350;
// Vaste, reproduceerbare cijfers voor het statblok: dezelfde vorm als een rij
// uit het klassement, zodat de dev-stage precies rekent zoals de echte kaart.
// De waarden op de kaart worden hieruit afgeleid (zie SLOF_STATS) en staan dus
// nergens als getal in de code.
const STAT_BRON = {
  gespeeld: 20,
  gewonnen: 2,
  gelijk: 3,
  verloren: 15,
  punten: 9,
  doelsaldo: -48,
  vorm: ["L", "L", "W", "L", "L", "L"] as const,
};

export function SlofShowcase() {
  const tier = tierFor(ELO);
  // Naam, emoji, bereik en omschrijving komen uit TIER_BANDEN — dezelfde bron
  // als de legenda. Niets hiervan staat als tekst in deze component.
  const band = TIER_BANDEN[0];

  return (
    <div className="slof-showcase">
      <FutKaartDefs />
      <div className="slof-showcase__stage" data-slof-stage>
        <FutKaart
          tier={tier}
          className="slof-showcase__kaart"
          voor={
            <FutKaartVoorkant
              elo={ELO}
              tier={tier}
              naam={NAAM}
              avatar={
                <Avatar
                  name={NAAM}
                  profile={{ avatar_url: stand }}
                  size={160}
                />
              }
              statBron={STAT_BRON}
            />
          }
        />
        <div className="slof-showcase__info">
          <p className="slof-showcase__kop">
            <span aria-hidden="true">{band.emoji}</span>
            <span>{band.naam}</span>
          </p>
          <p className="slof-showcase__bereik">
            Rating {bandRangeLabel(band)}
          </p>
          <p className="slof-showcase__flavor">{band.flavor}</p>
        </div>
      </div>
    </div>
  );
}

export default SlofShowcase;
