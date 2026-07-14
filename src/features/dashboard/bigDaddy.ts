// "Big Daddy" (#127-vervolg): wie #1 staat in het klassement is de baas, en dat
// mag geweten zijn. Een roze kroon op het podium met een spottende ondertitel.
// De regel wordt deterministisch gekozen uit de seed (de speler-key), zodat hij
// vast staat per leider maar per persoon verschilt — geen geflikker, geen
// Math.random.

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
