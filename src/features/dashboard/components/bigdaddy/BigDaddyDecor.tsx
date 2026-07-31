// De artwork-onderdelen van de Big Daddy-dashboardkaart (#834).
//
// Tot #834 tekende het dashboard deze titel met vectorornamenten uit het
// register van de 👑-FUT-kaart (heroOrnamentenBigDaddy.tsx). Die keuze was goed
// zolang de kaart een lichte vlakke skin had, maar de referentie
// (docs/dashboard/big_daddy_dashboard.png) toont hetzelfde satijn, dezelfde
// teddy en hetzelfde gevleugelde hartmedaillon als de FUT-kaart — geschilderd,
// niet getekend. Een vector-kroon op verzadigd roze satijn leest dan als een
// icoon dat op de kaart is geplakt.
//
// De onderdelen komen daarom uit hetzelfde onderdelenblad als de FUT-master,
// gesneden door `scripts/bigdaddy-dashboard-onderdelen.mjs`. Dat blad is de
// gedeelde bron: hertint iemand de kaart, dan verschuift het dashboard mee.
//
// Waarom losse onderdelen en niet één master met drie registraties (de
// breakout-architectuur van de FUT-kaarten): die vraagt een doos met een vaste
// verhouding. Deze kaart is vloeiend. Zie
// docs/dashboard/big-daddy-dashboardkaart.md §1.
//
// Twee dingen die de plaatsing bepalen, en die voor élk volgend onderdeel
// gelden:
//
//   - een onderdeel hangt aan één rand of hoek, nooit aan fracties op beide
//     assen, en zijn maat rekent tegen de containerbreedte (`cqw`). De hoogte
//     volgt uit de beeldverhouding van het bestand, dus een opnieuw gesneden
//     asset kan de layout niet uitrekken;
//   - wat weeft (het flanklint) wordt twee keer gerenderd uit dezelfde bron en
//     op hetzelfde anker: één keer in het kaartvlak, waar het op de binnenrand
//     wordt geklipt en dus achter de lijst verdwijnt, en één keer in de
//     voorlaag met een masker dat alleen de buitenpassages doorlaat. Alleen het
//     masker verschilt — dezelfde regel als "één bron, één register" op de
//     FUT-kaart.

import hoekhart from "./assets/bd-hoekhart.webp";
import lintBodem from "./assets/bd-lint-bodem.webp";
import lintFlank from "./assets/bd-lint-flank.webp";
import medaillon from "./assets/bd-medaillon.webp";
import teddy from "./assets/bd-teddy.webp";

/** Eén onderdeel. `decoding="sync"` is geen detail: op de headless
 *  screenshotroute blijft een async gedecodeerde WebP leeg, en dan lijkt een
 *  ontbrekend onderdeel op een z-index-fout. */
function Deel({ bron, plek }: { bron: string; plek: string }) {
  return (
    <img
      className={`hero-bd hero-bd--${plek}`}
      src={bron}
      alt=""
      draggable={false}
      decoding="sync"
      loading="eager"
    />
  );
}

/** Wat ín het kaartvlak hoort: de passage van het flanklint die achter de lijst
 *  door loopt. Het vlak klipt op zijn eigen afgeronde binnenrand, dus dit deel
 *  kan per constructie niet over de lijst schilderen. */
export function BigDaddyDecorAchter() {
  return <Deel bron={lintFlank} plek="flank-achter" />;
}

/** Wat vóór de lijst hoort. De volgorde in de DOM is de stapelvolgorde: lint
 *  onderaan, dan de juwelen, dan de teddy — die moet als enige compleet
 *  leesbaar blijven. */
export function BigDaddyDecorVoor() {
  return (
    <>
      <Deel bron={lintFlank} plek="flank-voor" />
      <Deel bron={lintBodem} plek="bodem-links" />
      <Deel bron={lintBodem} plek="bodem-rechts" />
      <Deel bron={medaillon} plek="medaillon-boven" />
      <Deel bron={medaillon} plek="medaillon-onder" />
      <Deel bron={hoekhart} plek="hoek-rechtsboven" />
      <Deel bron={hoekhart} plek="hoek-rechtsonder" />
      <Deel bron={teddy} plek="teddy" />
    </>
  );
}
