// De decoratieve lagen van de dashboard player card (#771).
//
// Alle thema's — divisie, Big Daddy, Dictator, Pias, schande-token — en de twee
// tijdelijke overlays tekenen in dezelfde vaste volgorde:
//
//   1. buitenste kaartschaduw        → box-shadow op .hero zelf
//   2. achterste ornamenten          ┐
//   3. basisachtergrond van de divisie│
//   4. permanent speciaal thema       ├ .hero__lagen (geklipt)
//   5. watermerken en materiaaltextuur│
//   7. tijdelijke In-Form/On Fire-tint│
//   8. bewegende glans               ┘
//   6. profielavatar en inhoud       → .hero__main / __divide / __foot (z-index 1)
//   9. crest, badge, voorste randhighlights → .hero__lagen--voor (niet geklipt)
//  10. interactieve knoppen          → in de inhoud, dus altijd boven de decoratie
//
// Stap 9 krijgt straks een tweede container (`.hero__lagen--voor`, niet geklipt):
// een crest in de bovenrand of een medaillon in een hoek hangt juist half buiten
// de kaart, terwijl het materiaal binnen de afgeronde hoeken moet blijven.
// Klippen op .hero zelf kan niet — dat zou de tooltip van een HeroCrest afkappen.
//
// De container is `aria-hidden` en laat alle aanwijzers door: decoratie mag nooit
// een knop of link afvangen (#771, AC10).
//
// PR 1 van #771 zet de architectuur; de ornamentlagen per thema (kroon, ster in
// lauwerkrans, narrenkap, pion, bliksem, vlam) komen in de vervolg-PR's uit het
// bestaande vocabulaire van #710/#769/#770 en vullen deze container.

import type { HeroOverlay, HeroPermanent } from "../heroThema";
import { HeroSheen } from "./HeroSheen";

export function HeroLagen({
  permanent,
  overlay,
}: {
  permanent: HeroPermanent;
  overlay: HeroOverlay;
}) {
  // Zonder thema én zonder overlay is er niets te tekenen: geen lege lagen in de
  // DOM van een neutrale kaart.
  if (!permanent && !overlay) return null;

  return (
    <span className="hero__lagen" aria-hidden="true">
      {/* Stap 7: de tint van de tijdelijke overlay. Bewust een láág en niet de
          achtergrond van .hero — anders vervangt de overlay het permanente
          materiaal in plaats van erop te liggen (AC4), en dat is precies wat #771
          rechtzet. Half doorlatend, zodat de kaart eronder herkenbaar blijft. */}
      {overlay && <span className={`hero__tint hero__tint--${overlay}`} />}
      {/* Stap 8: de bewegende glans, gedeeld door beide overlays. */}
      {overlay && <HeroSheen overlay={overlay} />}
    </span>
  );
}

export default HeroLagen;
