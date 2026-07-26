/** De bewegende glansbaan van de twee tijdelijke statusoverlays (#771).
 *
 *  Eén component voor In-Form én On Fire, want het gedrag is identiek en alleen
 *  de kleur verschilt (`--hero-sheen-kleur` in DashboardHero.css). De issue vraagt
 *  dit expliciet: twee kopieën van dezelfde animatie is precies hoe zulke lagen
 *  uit elkaar gaan lopen.
 *
 *  Tot #771 was dit `.hero--inform::after`. Nu is het een echt element, zodat de
 *  baan één laag in de vaste laagvolgorde is (stap 8) en niet vastzit aan de
 *  pseudo-element-slot van de kaart — die is straks nodig voor het permanente
 *  thema eronder.
 *
 *  Beweging staat in CSS achter `prefers-reduced-motion: no-preference`; zonder
 *  dat staat de baan stil op zijn breedste stand, precies zoals op de deel-poster
 *  (futKaartCanvas). Puur decoratief, dus `aria-hidden` en geen pointer-events. */
export function HeroSheen({ overlay }: { overlay: "inform" | "onfire" }) {
  return (
    <span className={`hero__sheen hero__sheen--${overlay}`} aria-hidden="true" />
  );
}

export default HeroSheen;
