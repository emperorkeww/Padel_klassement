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

/**
 * Vanaf welk moment (epoch ms) de cron de rondes van een speeldag mag
 * klaarzetten (#846): de ochtend van de speeldag zelf, zodat de indeling de
 * hele dag zichtbaar is en er ruim tijd blijft om een lef-tip te plaatsen.
 *
 * Een speeldag die vóór dat ochtenduur begint zou zo nooit aan de beurt komen
 * — vandaar het vangnet vlak vóór de start. De vroegste van de twee wint.
 */
export function rondesDrempel(
  ochtend: number,
  start: number,
  leadMin: number,
): number {
  return Math.min(ochtend, start - leadMin * 60_000);
}
