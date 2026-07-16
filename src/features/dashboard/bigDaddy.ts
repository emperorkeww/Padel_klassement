// "Big Daddy" (#127-vervolg): wie #1 staat in het klassement is de baas, en dat
// mag geweten zijn. Een roze kroon op het podium met een spottende ondertitel.
// De regel wordt deterministisch gekozen uit de seed (de speler-key), zodat hij
// vast staat per leider maar per persoon verschilt — geen geflikker, geen
// Math.random.
//
// Sinds #297 doet Coach Rudy er ook zijn zegje over: een lof-regel voor de
// kroondrager plus een sneer richting de rest van het klassement, gerenderd
// als bubbel onder het podium. Zelfde determinisme, via het gedeelde
// roast-fundament (roastTone.ts).

import { kiesUniek, roastSeed } from "@/features/coach/roastTone";

export const BIG_DADDY_TITEL = "Big Daddy";
export const BIG_DADDY_EMOJI = "👑";

const ROASTS = [
  "regeert over de hele bende",
  "de rest speelt om plek 2",
  "iedereen is z'n padelkindje",
  "buigt de baan naar z'n hand",
  "wie is je vaderfiguur?",
  "de baas van de baan, punt",
  "de rest? kanonnenvoer",
  "papa is thuis",
] as const;

// Stabiele, kleine string-hash (djb2-variant). Puur zodat dezelfde seed altijd
// dezelfde roast oplevert.
function hash(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 33) ^ seed.charCodeAt(i);
  }
  return Math.abs(h);
}

/** Spottende ondertitel voor de #1; deterministisch per seed (bv. speler-key). */
export function bigDaddyRoast(seed: string): string {
  return ROASTS[hash(seed) % ROASTS.length];
}

// Coach Rudy's regel bij de kroondrager (#297). Let op: nergens de letterlijke
// titel gebruiken — de podium-tests matchen op die tekst en verwachten hem
// precies één keer.

/** Ophemeling voor de #1; export zodat tests de pool kunnen controleren. */
export const BIG_DADDY_LOF = [
  "Kijk, dát is nu klasse. De kroon staat je verdacht goed.",
  "Eindelijk iemand die mijn notitieboekje vult met complimenten.",
  "De baas van het klassement. Zelfs ik heb even niks te zeuren.",
  "Chapeau. Dit niveau heb ik sinds mijn gloriejaren niet meer gezien.",
  "De troon is van jou, en terecht. Voor één keer klopt de stand.",
  "Dit is het soort spel waar ik als bondscoach van droomde.",
  "Nummer één, en het klassement liegt niet. Petje af — en dat zeg ik zelden.",
  "Je regeert dit klassement met een ijzeren racket. Prachtig om te zien.",
] as const;

/** Sneer-staart richting de rest van het klassement: generiek, geen namen.
 *  Export zodat tests de pool kunnen controleren. */
export const BIG_DADDY_REST_SNEER = [
  "De rest speelt gezellig om de kruimels.",
  "De rest? Die staan in mijn notitieboekje onder 'figuranten'.",
  "De rest mag alvast oefenen op het applaudisseren.",
  "De achtervolgers noem ik voorlopig gewoon publiek.",
  "De rest van het klassement is vooral decor.",
  "De concurrentie? Ik heb bidons met meer weerstand gezien.",
  "De rest traint hopelijk in het geheim, want zichtbaar is het niet.",
  "De achtervolging heeft de urgentie van een derde helft.",
] as const;

/** Neutrale lof bij roast-schild: wel een bubbel, geen gepeperde staart
 *  (patroon: KAMPIOEN_NEUTRAAL in coachFeed). */
export const BIG_DADDY_LOF_NEUTRAAL = [
  "De nummer één van het klassement. De cijfers zijn helder.",
  "Bovenaan, en verdiend op basis van de stand.",
  "De koppositie is binnen. Sterk seizoen tot nu toe.",
  "Eerste plaats. Het klassement spreekt voor zich.",
] as const;

/** Coach Rudy's regel bij de #1: ophemeling plus een sneer richting de rest;
 *  bij roast-schild alleen neutrale lof. Deterministisch per speler-key, met
 *  aparte seeds zodat lof en sneer onafhankelijk variëren. */
export function bigDaddyCoachQuote(key: string, schild: boolean): string {
  if (schild) {
    return kiesUniek(BIG_DADDY_LOF_NEUTRAAL, roastSeed(key, "bd-lof"));
  }
  const lof = kiesUniek(BIG_DADDY_LOF, roastSeed(key, "bd-lof"));
  const sneer = kiesUniek(BIG_DADDY_REST_SNEER, roastSeed(key, "bd-sneer"));
  return `${lof} ${sneer}`;
}
