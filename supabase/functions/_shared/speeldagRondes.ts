// Rondes automatisch klaarzetten (#827): hoeveel rondes passen er in de
// geboekte duur van een speeldag? De indeling zelf is Americano, zie
// americano.ts.
//
// Pure logica, zonder Deno-globals.

/** Speelduur van één ronde, in minuten. Spiegel van src/features/groups/speeldagRondes.ts. */
export const RONDE_MIN = 10;

/** Minuten die vóór de eerste ronde gereserveerd blijven voor klaarzetten. */
export const KLAARZET_MIN = 10;

/**
 * Hoeveel rondes er in een geboekt blok passen: tien minuten gaan naar
 * klaarzetten en wisselen, de rest wordt in blokken van tien minuten verdeeld.
 * 60 min → 5, 90 min → 8, 120 min → 11.
 */
export function rondesVoorDuur(duration: number): number {
  return Math.max(0, Math.floor((duration - KLAARZET_MIN) / RONDE_MIN));
}
