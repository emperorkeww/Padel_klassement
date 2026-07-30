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
 * Mag de cron de rondes van deze speeldag nu klaarzetten (#846)? Twee
 * voorwaarden, allebei nodig:
 *
 * 1. De baan is **geboekt**. Dán pas ligt de spelerslijst vast — er kan niemand
 *    meer bij — en is de indeling definitief. Een `locked` poll telt niet: het
 *    moment ligt dan wel vast, de bezetting nog niet.
 * 2. Het is **de ochtend van de speeldag** (`ochtend`, epoch ms). Zo staat het
 *    schema de hele dag klaar en blijft er ruim tijd om een lef-tip te
 *    plaatsen, die op de starttijd van de match sluit. Wordt er pas later op de
 *    dag geboekt, dan is de eerstvolgende tik aan de beurt.
 *
 * Een speeldag die vóór dat ochtenduur begint zou zo nooit aan de beurt komen —
 * vandaar `leadMin` als vangnet vlak vóór de start. De vroegste van de twee
 * wint. `start > now` houdt een speeldag die intussen begonnen is met rust.
 */
export function magRondesZetten(opts: {
  status: string;
  rondesGezetOp: string | null;
  now: number;
  start: number;
  ochtend: number;
  leadMin: number;
}): boolean {
  const { status, rondesGezetOp, now, start, ochtend, leadMin } = opts;
  if (status !== "booked" || rondesGezetOp) return false;
  if (start <= now) return false;
  return now >= Math.min(ochtend, start - leadMin * 60_000);
}
