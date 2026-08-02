import { Link } from "react-router-dom";
import { sectieHref } from "../secties";
import { TIER_BANDEN } from "@/features/rating/tiers";
import { DEFAULT_DICTATOR } from "@/features/dashboard/dictator";
import {
  AFDROGING_DREMPEL,
  FAVORIET_DREMPEL,
  ZWARTE_REEKS_DREMPEL,
} from "@/features/groups/maandpias";

/** Sectie 7: de bovenkant en de onderkant van de club (#989).
 *
 *  Drempels en namen komen uit de modules die ze afdwingen (tiers.ts,
 *  dictator.ts, maandpias.ts) in plaats van uit deze tekst — een verschoven
 *  drempel hoort de uitleg mee te verschuiven, niet stil te laten liegen. */
export function Troon() {
  const dictator = TIER_BANDEN[TIER_BANDEN.length - 1];
  return (
    <>
      <h3 className="uitleg__kop">👑 De Troon</h3>
      <p>
        Haal je een rating van <strong>{dictator.min}</strong> of hoger én sta je
        op nummer één, dan word je <strong>{dictator.naam}</strong> — de dictator
        van de club. Je wordt dan van het klassement losgekoppeld en op een eigen
        troon gezet, met eigen propaganda erbij. Een dictator deelt geen podium.
      </p>
      <p>
        Zit er niemand op de troon, dan blijft hij niet leeg: dan regeert{" "}
        <strong>{DEFAULT_DICTATOR.name}</strong> bij verstek, tot een echt clublid
        zich kwalificeert. Wie daar niet op zit te wachten, zet de waarnemend
        dictator uit bij zijn <Link to="/profiel">instellingen</Link>.
      </p>

      <h3 className="uitleg__kop">🤡 De Schandpaal</h3>
      <p>
        Aan de andere kant is er de <strong>pias</strong>: per week en per maand
        wijst de app de speler aan die het hardst afging. Vier manieren om jezelf
        te kwalificeren:
      </p>
      <ul className="uitleg__lijst-kaal">
        <li>
          <strong>Bagel</strong> — een set verliezen zonder een game te pakken.
        </li>
        <li>
          <strong>Afdroging</strong> — verliezen met {AFDROGING_DREMPEL} games
          verschil of meer.
        </li>
        <li>
          <strong>Zwarte reeks</strong> — {ZWARTE_REEKS_DREMPEL} nederlagen op
          rij of meer.
        </li>
        <li>
          <strong>Choke</strong> — verliezen terwijl je volgens de ratings meer
          dan {Math.round(FAVORIET_DREMPEL * 100)}% kans had om te winnen.
        </li>
      </ul>
      <p>
        Daarnaast gaat er per groep één <strong>Zwarte Piet</strong> rond: een
        schande-token dat altijd bij de laatste sukkel ligt. Elke nieuwe afgang
        pakt hem af van de vorige drager. Draag je hem, dan raak je hem kwijt door
        gewoon een keer te winnen.
      </p>
      <p className="uitleg__noot">
        De dictator en de pias krijgen een AI-portret op hun kaart. Zit je daar
        niet op te wachten, dan zet je dat per portret uit bij je{" "}
        <Link to="/profiel">instellingen</Link> — net als het roast-schild, dat
        Coach Rudy over jou laat zwijgen (zie{" "}
        <Link to={sectieHref("rudy")}>Coach Rudy</Link>).
      </p>
    </>
  );
}

export default Troon;
