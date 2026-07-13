// Smoesjesmachine (#167): na een verloren match één tik → een willekeurig,
// ludiek excuus. Puur client-side, geen data — een vaste NL-lijst met een
// deterministische keuze op een seed, zodat dezelfde (match, worp) altijd
// hetzelfde smoesje geeft en "opnieuw" een nieuwe trekt.

/** De volledige smoezenpool. Zelfspottend en plagend — donker mag, echt
 *  beledigend of grof nooit. */
export const SMOESJES: string[] = [
  "Mijn gripje was veel te glad, m'n racket gleed zó uit m'n hand.",
  "De glazen wanden waren vandaag opvallend stroef.",
  "Ik had gisteren legday, m'n benen voelden letterlijk als beton.",
  "M'n partner stond constant in mijn weg te zwaaien.",
  "Die ballen waren veel te zacht, alsof we met tennisballen speelden.",
  "De tegenstanders waren stiekem linkshandig. Dat is gewoon niet eerlijk.",
  "Ik had m'n racket blijkbaar verkeerd vast bij die beslissende lobs.",
  "Het veld was vandaag echt abnormaal snel.",
  "Die lampen stonden zó fel afgesteld dat ik verblind werd.",
  "De tegenstanders speelden elk punt via het glas. Dat is toch geen echt padel?",
  "We hadden gewoon zware pech met de netband vandaag.",
  "Ik had te veel koffie op en trilde m'n racket zowat uit.",
  "Mijn schoenen hadden nul grip op dit kunstgras.",
  "Het was veel te koud voor fatsoenlijke spinballen.",
  "Mijn racket trilde te veel bij elke impact.",
  "Ik was gewoon te sportief en sloeg ze allemaal recht op hun racket.",
  "Hun tactiek was puur geluk en windvlagen.",
  "De wind waaide al mijn perfecte effectballen de kooi uit.",
  "De tegenstanders bleven maar praten. Psychologische oorlogsvoering, noem ik dat.",
  "Ik zat er met m'n hoofd al op café.",
  "M'n motivatie checkte na de eerste opslag alweer uit.",
  "Verloren, maar mét stijl. Dat telt toch ook?",
  "Nederlagen bouwen karakter. Ik zit ondertussen bomvol karakter.",
  "M'n beste shots bewaar ik voor in m'n dromen.",
];

/**
 * Kleine deterministische hash van een string (djb2-variant), zodat een
 * match-id in een stabiele seed omgezet kan worden zonder dependency.
 */
export function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  }
  return h;
}

/** Kiest deterministisch één smoesje uit de pool op basis van `seed`. */
export function kiesSmoes(seed: number): string {
  const i = ((seed % SMOESJES.length) + SMOESJES.length) % SMOESJES.length;
  return SMOESJES[i];
}

// ── Rudy's Goedkeuring (#296) ────────────────────────────────────────────────
// Coach Rudy neemt de rol van juryvoorzitter: elk smoesje krijgt een oordeel of
// het "professioneel genoeg" is. Drie gradaties, elk met een eigen pool. Het
// oordeel is deterministisch geseed op het smoesje zélf (niet op de worp), zodat
// hetzelfde smoesje altijd hetzelfde oordeel geeft — reproduceerbaar en deelbaar.

export type OordeelGradatie = "afgekeurd" | "matig" | "goedgekeurd";

/** De drie jury-pools. Elke regel bevat zijn eigen ❌/⚠️/✅-teken. */
export const OORDEEL: Record<OordeelGradatie, readonly string[]> = {
  afgekeurd: [
    "❌ Te zwak. Zeg liever dat je gripje in de boter was gevallen.",
    "❌ Afgekeurd. Dit overtuigt zelfs de goedgelovigste supporter op vak G niet.",
    "❌ Amateuristisch. Zo'n excuus gaf ik nog niet eens na de groepsfase van het WK.",
    "❌ Nee. Kom terug als je er echt over hebt nagedacht, net als bij een tactische wissel.",
    "❌ Te doorzichtig. Ik prik hier sneller doorheen dan door mijn eigen persconferenties.",
  ],
  matig: [
    "⚠️ Matig. Dit excuus gebruikte ik al in 2024 tegen Frankrijk. Iedereen prikte erdoorheen.",
    "⚠️ Kan ermee door, maar het mist overtuiging. Net als mijn opstelling tegen Egypte.",
    "⚠️ Redelijk. Niet je sterkste werk, maar ook geen totale moderamp.",
    "⚠️ Twijfelgeval. Ik noteer 'm met potlood in mijn boekje.",
    "⚠️ Het houdt net stand. Maar bij de eerste kritische vraag stort het in.",
  ],
  goedgekeurd: [
    "✅ Goedgekeurd! Deze ga ik zelf ook gebruiken bij de volgende persconferentie.",
    "✅ Uitstekend. Zo verkoop je een nederlaag als een tactisch meesterplan.",
    "✅ Sterk staaltje smoeswerk. Hier kan de Belgische pers nog van leren.",
    "✅ Klasse. Dit excuus verdient een plek in mijn beruchte notitieboekje.",
    "✅ Perfect. Geen speld tussen te krijgen, zelfs niet voor mij.",
  ],
} as const;

/** Neutrale variant bij roast-schild: geen jury-oordeel, enkel een nuchtere
 *  notering. Plagen, geen kwetsen — wie niet mee wil, hoeft niet. */
export const OORDEEL_NEUTRAAL: readonly string[] = [
  "Genoteerd. Volgende keer beter.",
  "Ook een reden is een reden. Doorgaan.",
  "Genoteerd zonder commentaar.",
] as const;

export interface Oordeel {
  gradatie: OordeelGradatie;
  tekst: string;
}

const GRADATIES: readonly OordeelGradatie[] = ["afgekeurd", "matig", "goedgekeurd"];

/**
 * Coach Rudy's jurybeoordeling van een smoesje. Deterministisch geseed op de
 * smoesje-tekst zelf: hetzelfde smoesje → hetzelfde oordeel. Gradatie en de
 * regel binnen die gradatie krijgen aparte seeds, zodat ze niet gecorreleerd
 * zijn. Bij `schild` een neutrale, ongekleurde notering (geen ❌/⚠️/✅).
 */
export function kiesOordeel(smoes: string, schild = false): Oordeel {
  if (schild) {
    const i = hashPrefixed("oordeel-neutraal", smoes, OORDEEL_NEUTRAAL.length);
    return { gradatie: "matig", tekst: OORDEEL_NEUTRAAL[i] };
  }
  const gradatie = GRADATIES[hashPrefixed("oordeel-graad", smoes, GRADATIES.length)];
  const pool = OORDEEL[gradatie];
  const tekst = pool[hashPrefixed("oordeel-tekst", smoes, pool.length)];
  return { gradatie, tekst };
}

/** Positieve index in `[0, len)` uit een geprefixte hash van `smoes`. Het
 *  prefix ontkoppelt de verschillende keuzes (gradatie vs. regel) van elkaar. */
function hashPrefixed(prefix: string, smoes: string, len: number): number {
  const h = hashString(`${prefix}|${smoes}`);
  return ((h % len) + len) % len;
}
