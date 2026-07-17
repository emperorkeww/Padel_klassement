// De Wissel-Generator (#261): plakt willekeurige fragmenten aan elkaar tot een
// absurde wissel in Rudy-stijl. Puur en deterministisch op de seed, zodat de
// variatie-garanties unit-testbaar zijn; de component levert de seed (tijd +
// teller) en houdt de gebruikt-sets vast.

import { kiesUniek } from "@/features/coach/roastTone";

export const MINUTEN: readonly string[] = [
  "88",
  "89",
  "90+2",
  "90+4",
  "90+7",
  "90+13",
  "45+1 (te vroeg gedrukt)",
  "117",
  "1",
  "89 (op mijn horloge)",
];

export const ERAF: readonly string[] = [
  "de spits",
  "de aanvoerder",
  "de topscorer",
  "de enige verdediger",
  "de speler van de match",
  "de nummer 10",
  "de doelman (ja, echt)",
  "de invaller van daarnet",
  "je beste maat",
  "de linksback",
];

export const ERIN: readonly string[] = [
  "de derde keeper",
  "een extra flesje water",
  "de terreinknecht",
  "het notitieboekje zelf",
  "de fysio",
  "een extra verdedigende middenvelder",
  "de mascotte",
  "de buschauffeur",
  "mijn pet",
  "de vierde official",
  "een ladder",
  "de sponsor z'n neefje",
];

export const POSITIES: readonly string[] = [
  "als valse rechtsbuiten",
  "op de bank naast mij",
  "als vliegende keeper",
  "in een vrije rol achter niemand",
  "als menselijke muur",
  "op de plek van de watersproeier",
  "als extra grasspriet",
  "diep in de pocket",
  "als schaduwspits zonder schaduw",
  "ergens links, denk ik",
];

export interface WisselGebruikt {
  minuten: Set<string>;
  eraf: Set<string>;
  erin: Set<string>;
  posities: Set<string>;
}

export function leegGebruikt(): WisselGebruikt {
  return { minuten: new Set(), eraf: new Set(), erin: new Set(), posities: new Set() };
}

export interface Wissel {
  minuut: string;
  eraf: string;
  erin: string;
  positie: string;
  /** De volledige zin — voor anti-herhaling en schermlezers. */
  zin: string;
}

export function wisselZin(w: Omit<Wissel, "zin">): string {
  return `Wissel in minuut ${w.minuut}: ${w.eraf} eraf, ${w.erin} erin, ${w.positie}.`;
}

/**
 * Genereert de volgende absurde wissel. `gebruikt` zorgt dat elk fragment pas
 * terugkeert als zijn pool op is (kiesUniek stopt met variëren op een volle
 * set, dus die wordt hier eerst geleegd); `vorigeZin` sluit daarbovenop een
 * letterlijke herhaling van de vorige combinatie uit.
 */
export function genereerWissel(
  seed: number,
  gebruikt: WisselGebruikt,
  vorigeZin?: string,
): Wissel {
  let wissel: Wissel | null = null;
  for (let poging = 0; poging < 8 && !wissel; poging++) {
    if (gebruikt.minuten.size >= MINUTEN.length) gebruikt.minuten.clear();
    if (gebruikt.eraf.size >= ERAF.length) gebruikt.eraf.clear();
    if (gebruikt.erin.size >= ERIN.length) gebruikt.erin.clear();
    if (gebruikt.posities.size >= POSITIES.length) gebruikt.posities.clear();
    // Per pool een eigen afgeleide seed, anders lopen de pools in de pas mee.
    const s = seed + poging;
    const kandidaat = {
      minuut: kiesUniek(MINUTEN, s, gebruikt.minuten),
      eraf: kiesUniek(ERAF, s * 31 + 7, gebruikt.eraf),
      erin: kiesUniek(ERIN, s * 17 + 3, gebruikt.erin),
      positie: kiesUniek(POSITIES, s * 13 + 11, gebruikt.posities),
    };
    const zin = wisselZin(kandidaat);
    if (zin !== vorigeZin) wissel = { ...kandidaat, zin };
  }
  // Kan alleen bereikt worden als 8 pogingen op rij exact de vorige zin gaven —
  // met vier variërende pools praktisch onmogelijk, maar nooit crashen.
  return wissel ?? { minuut: MINUTEN[0], eraf: ERAF[0], erin: ERIN[0], positie: POSITIES[0], zin: wisselZin({ minuut: MINUTEN[0], eraf: ERAF[0], erin: ERIN[0], positie: POSITIES[0] }) };
}
