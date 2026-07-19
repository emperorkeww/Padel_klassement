// El Padelissimo — "De Troon" (#528, vervolg op #527): een gekwalificeerde
// dictator-#1 (tier `dictator`, rating 1600+) wordt van het klassement
// losgekoppeld en op een eigen troon gezet. Waar de Big Daddy (bigDaddy.ts) nog
// gewoon op het podium tussen het volk staat, deelt een dictator geen podium.
//
// Deze module levert de troon-copy: de over-the-top slogan op de troon (i.p.v.
// de neutrale Big Daddy-roast) plus de waarnemend-dictator-constanten (#530).
// Deterministisch per seed (de speler-key), zodat ze vast staan per dictator
// maar per persoon verschillen — geen geflikker, geen Math.random. Coach Rudy's
// kijker-gerichte reactie op de troon is z'n knieval (#531) en woont in
// roastTone.ts (`coachBuiging`), niet hier.

import mbappePortret from "@/features/dictator/components/dictator-portret-groen-uniform.png";

export const DICTATOR_EMOJI = "🫡";
/** Insigne op de troon i.p.v. een rangnummer — hij staat buiten de lijst. */
export const DICTATOR_INSIGNE = "№1 · Dictator";

// Propaganda-ondertitel op de troon: staatspropaganda i.p.v. spot.
const PROPAGANDA = [
  "regeert de baan als onbetwiste alleenheerser",
  "deelt geen podium — hij ís het podium",
  "bepaalt wie er speelt en wie z'n koffers pakt",
  "het volk speelt hooguit om plek twee",
  "onaantastbaar, onbetwist, ondraaglijk",
  "de baan buigt naar z'n hand of gaat op slot",
  "z'n woord is vanaf nu de huisregel",
  "verbiedt kebabs met z'n beeltenis in de kantine",
] as const;

// Stabiele, kleine string-hash (djb2-variant) — zelfde idee als bigDaddy.ts,
// puur zodat dezelfde seed altijd dezelfde regel oplevert.
function hash(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 33) ^ seed.charCodeAt(i);
  }
  return Math.abs(h);
}

/** Propaganda-ondertitel voor de troon; deterministisch per seed (speler-key). */
export function dictatorPropaganda(seed: string): string {
  return PROPAGANDA[hash(seed) % PROPAGANDA.length];
}

// Waarnemend dictator (#530): een dictatuur zónder dictator is een anticlimax,
// dus zolang geen enkele échte speler El Padelissimo (1600+) haalt, blijft de
// troon bezet — door Kylian Mbappé, de meme-dictator van de baan (#527). Hij
// regeert bij verstek en verdwijnt zodra een clublid kwalificeert (#528).
export const DEFAULT_DICTATOR = {
  name: "Kylian Mbappé",
  emoji: "🐐",
  /** Portret van de waarnemend dictator (militair uniform, past bij --dictator). */
  image: mbappePortret,
} as const;

/** Waarnemend-label i.p.v. een ambtstermijn — het is geen echt clublid. */
export const DEFAULT_DICTATOR_LABEL = "Regeert bij verstek";

/** Korte slogan op de troon voor de waarnemend dictator (los van de echte roast). */
export const DEFAULT_DICTATOR_PROPAGANDA =
  "de waarnemend despoot van de baan";
