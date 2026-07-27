/** Het sieraad naast de statusbadge (#771).
 *
 *  Eén thema vraagt om iets náást de badge in plaats van eromheen: de Dictator
 *  krijgt zijn lakzegel, precies zoals de referentie en De Troon (#769) hem
 *  zetten. Dat kan niet in de decoratielaag — die staat achter de inhoud en
 *  weet niet waar de badge belandt, want de titelrij wrapt met de inhoud mee.
 *  Vandaar dit kleine haakje: het zegel is een broertje van de badge in de rij,
 *  zodat het altijd naast de juiste chip staat, ook op een smal scherm.
 *
 *  Puur decoratief: de titel staat al in de badge ernaast, dus `aria-hidden`.
 *  Levert `null` voor elk thema zonder sieraad — de andere thema's dragen hun
 *  ornamenten in de lagen (HeroLagen). */
import { DictatorZegel } from "@/features/standings/components/dictatorOrnamenten";
import type { HeroPermanent } from "../heroThema";

export function HeroBadgeSieraad({ permanent }: { permanent: HeroPermanent }) {
  if (permanent !== "dictator") return null;
  return <DictatorZegel className="hero__zegel" />;
}

export default HeroBadgeSieraad;
