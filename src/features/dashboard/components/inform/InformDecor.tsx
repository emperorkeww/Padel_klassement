// De artwork-onderdelen van de In-Form-dashboardkaart (#834).
//
// Twee onderdelen, allebei uit `docs/dashboard/in_form_dashboard.png` gesneden
// door `scripts/inform-dashboard-onderdelen.py`: de stormkolom van de
// rechterflank en de vonkensleep in de linkeronderhoek.
//
// Anders dan bij Big Daddy komt de bron níét uit het onderdelenblad van de
// bijbehorende FUT-kaart. `storm-master.webp` heeft het juiste silhouet maar de
// verkeerde temperatuur — blauwgrijs met één gouden ontlading, waar de
// referentie goud-dominant is met een dicht vertakt web. Zie
// docs/dashboard/in-form-dashboardkaart.md §6.
//
// Waarom losse onderdelen en niet één master met drie registraties (de
// breakout-architectuur van de FUT-kaarten): die vraagt een doos met een vaste
// verhouding, en deze kaart is vloeiend. Er is hier bovendien niets dat vóór het
// frame komt — de referentie houdt de gouden lijst over de volle hoogte
// ononderbroken, dus er is geen voorlaag en geen frontmasker.
//
// Beide onderdelen hangen ín `hero__vlak` (HeroLijst) en worden dus op de
// binnenrand van de keyline geklipt: ze kunnen per constructie niet over de
// lijst schilderen. De plaatsing staat in DashboardHero.css en volgt dezelfde
// twee regels als elk ander dashboardonderdeel — verankerd aan één rand, maat
// in `cqw`, hoogte uit de beeldverhouding van het bestand.

import ember from "./assets/if-ember.webp";
import storm from "./assets/if-storm.webp";

/** Eén onderdeel. `decoding="sync"` is geen detail: op de headless
 *  screenshotroute blijft een async gedecodeerde WebP leeg, en dan lijkt een
 *  ontbrekend onderdeel op een z-index-fout. */
function Deel({ bron, plek }: { bron: string; plek: string }) {
  return (
    <img
      className={`hero-if hero-if--${plek}`}
      src={bron}
      alt=""
      draggable={false}
      decoding="sync"
      loading="eager"
    />
  );
}

/** Wat ín het kaartvlak hoort — en dat is bij deze kaart alles. De stormkolom
 *  draagt het racketsilhouet als gat in zijn eigen alfa, dus daar is geen tweede
 *  onderdeel voor nodig en kan het ook niet uit registratie lopen. */
export function InformDecor() {
  return (
    <>
      <Deel bron={storm} plek="storm" />
      <Deel bron={ember} plek="ember" />
    </>
  );
}

export default InformDecor;
