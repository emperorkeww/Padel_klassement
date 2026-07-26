// Thema-keuze van de dashboard player card (#771).
//
// Tot #771 koos één functie (`heroThema` in dashboardHelpers.ts) één skin uit
// zeven statussen: de winnaar nam de hele kaart over. In-Form en On Fire deden
// dat ook — en dat is precies wat #771 rechtzet. Die twee zijn *tijdelijke*
// statussen: In-Form wisselt wekelijks, On Fire hangt aan een lopende reeks. Ze
// horen dus als overlaag boven de kaart die je permanent draagt, niet in de
// plaats daarvan. Wie deze week in vorm is én de pias van zijn groep, hoort een
// piaskaart met een In-Form-glans te zien — niet een In-Form-kaart waarop de
// schande onzichtbaar is geworden.
//
// Vandaar twee assen in plaats van één ladder:
//
//   permanent  dictator › bigdaddy › kampioen › pias › piet   (materiaal)
//   overlay    inform › onfire                                (glans erover)
//
// De *relatieve* volgorde binnen elke as is ongewijzigd overgenomen uit
// HERO_THEMA_PRIORITEIT (#644/#760), en welke speler een status heeft blijft
// een vraag voor de bestaande productlogica (edities.ts, dictatorApi, onFire).
// Deze module beslist alleen hoe die statussen zich visueel stapelen.
//
// Basis (#771): draagt een speler géén permanent thema, dan is de kaart niet
// langer neutraal maar het materiaal van zijn divisie — zie heroDivisie.ts.

/** Permanente kaartvarianten: het materiaal van de kaart zelf. */
export type HeroPermanent =
  | "dictator"
  | "bigdaddy"
  | "kampioen"
  | "pias"
  | "piet"
  | null;

/** Tijdelijke statusoverlays: een laag bóvenop het permanente materiaal. */
export type HeroOverlay = "inform" | "onfire" | null;

/** Alle statusvlaggen die de twee assen lezen. */
export type HeroStatusVlaggen = {
  dictator: boolean;
  bigDaddy: boolean;
  kampioen: boolean;
  inForm: boolean;
  onFire: boolean;
  pias: boolean;
  piet: boolean;
  /** Roast-schild (#183) van de speler zelf. */
  schild: boolean;
};

/** Prioriteit van de permanente varianten: het eerste thema dat de speler
 *  draagt wint. Dezelfde volgorde als op de FUT-kaart (EDITIE_PRIORITEIT in
 *  edities.ts) — verdienste verdringt schande, en binnen de schande wint de
 *  weeklens (de pias van déze week) van het rondgaande token (de Piet).
 *
 *  Dictator staat vóór Big Daddy zoals de hero dat al deed sinds #613 (en
 *  Podium.tsx op het klassement): in de praktijk sluiten ze elkaar al uit — een
 *  bezette troon dooft de kroon — maar de volgorde legt vast wat er zou gebeuren
 *  als dat ooit verandert. Op de FUT-kaart draagt de dictator juist géén editie
 *  (troonkaart); hier is de kaart zélf zijn troonvlak.
 *
 *  De assen zijn onafhankelijk: dictator, Big Daddy en kampioen komen club-breed
 *  uit het klassement, pias/Piet uit een gróep (#655/#645). Je kunt dus tegelijk
 *  #1 én schande-token-drager zijn; dan kleurt de kaart naar de eer en blijft de
 *  schande-crest ernaast staan. Kleur is nooit de enige indicator (#613), dus
 *  het verliezende thema verdwijnt alleen als vlak, niet als chip. */
export const HERO_PERMANENT_PRIORITEIT = [
  "dictator",
  "bigdaddy",
  "kampioen",
  "pias",
  "piet",
] as const;

/** Prioriteit van de tijdelijke overlays. On Fire staat ná In-Form omdat het de
 *  enige status is die meerdere dragers tegelijk kan hebben (#632): een gedeelde
 *  eer mag geen zeldzamere verdringen. Er is er altijd hoogstens één zichtbaar —
 *  twee bewegende glansbanen over elkaar is precies wat #771 wil voorkomen. */
export const HERO_OVERLAY_PRIORITEIT = ["inform", "onfire"] as const;

/** Welk permanent materiaal draagt de kaart?
 *
 *  `schild` is het roast-schild (#183) van de speler zelf: dat dooft de twee
 *  schande-thema's volledig — de kaart valt terug op zijn divisie, precies zoals
 *  de FUT-kaart bij een schild z'n mond houdt. De crest-chip blijft wél staan
 *  (met de neutrale 📊-variant, zie Dashboard.tsx): het feit blijft, de spot
 *  verdwijnt. Halfslachtig dempen — kartonnen vlak met een neutraal woordje
 *  erop — zou geen schild zijn maar een zachtere sneer. Op eer heeft het schild
 *  geen invloed: er valt niets te beschermen, dus de drie verdiende thema's
 *  trekken zich er niets van aan. */
export function heroPermanent(s: HeroStatusVlaggen): HeroPermanent {
  for (const thema of HERO_PERMANENT_PRIORITEIT) {
    switch (thema) {
      case "dictator":
        if (s.dictator) return "dictator";
        break;
      case "bigdaddy":
        if (s.bigDaddy) return "bigdaddy";
        break;
      case "kampioen":
        if (s.kampioen) return "kampioen";
        break;
      case "pias":
        if (s.pias && !s.schild) return "pias";
        break;
      case "piet":
        if (s.piet && !s.schild) return "piet";
        break;
    }
  }
  return null;
}

/** Welke tijdelijke overlay ligt erover? Anders dan bij de schande-thema's
 *  speelt het schild hier geen rol: In-Form en On Fire zijn eer, en daar is
 *  niets tegen te beschermen. */
export function heroOverlay(s: HeroStatusVlaggen): HeroOverlay {
  for (const overlay of HERO_OVERLAY_PRIORITEIT) {
    switch (overlay) {
      case "inform":
        if (s.inForm) return "inform";
        break;
      case "onfire":
        if (s.onFire) return "onfire";
        break;
    }
  }
  return null;
}

/** De klassenlijst van de kaart. Permanent thema en overlay staan naast elkaar
 *  op hetzelfde element: de overlay vervangt de variant dus niet, hij komt
 *  erbovenop (#771, AC4). */
export function heroKlassen(
  permanent: HeroPermanent,
  overlay: HeroOverlay,
): string {
  return [
    "hero",
    permanent ? `hero--${permanent}` : null,
    overlay ? `hero--overlay-${overlay}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}
