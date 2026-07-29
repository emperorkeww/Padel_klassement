// Tijdrekenen rond de speeldag (#827): hoeveel rondes passen er in de geboekte
// duur, en op welk tijdstip start ronde N? Tot nu toe kregen gegenereerde
// matches geen `played_at` en viel de hele app terug op `created_at` — waardoor
// een speeldag als "hele dag" verscheen.

import { clubEpoch, dayInZone } from "@/lib/utils/time";
import type { Match } from "@/types";
import type { PollOption } from "./pollsApi";

/** Speelduur van één ronde, in minuten. */
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
 * Starttijdstip (ISO) van ronde `index` (0-based) van een speeldag-optie.
 * De datum + "HH:MM" staan in clubtijd; `clubEpoch` maakt daar DST-proof een
 * echt moment van.
 */
export function rondeStart(
  option: Pick<PollOption, "date" | "start_time">,
  timeZone: string,
  index = 0,
): string {
  const start = clubEpoch(option.date, option.start_time, timeZone);
  return new Date(start + index * RONDE_MIN * 60_000).toISOString();
}

/**
 * Hoeveel rondes er op die kalenderdag al klaarstaan — het vertrekpunt voor de
 * starttijden van de volgende generatie, zodat rondes blijven oplopen in plaats
 * van allemaal op de starttijd te landen. Losse matches (geen rondenummer)
 * tellen niet mee.
 */
export function rondesOpDag(
  matches: Match[],
  timeZone: string,
  dag: string,
): number {
  const rondes = new Set<number>();
  for (const m of matches) {
    const r = m.round_number ?? 0;
    if (r <= 0) continue;
    if (dayInZone(m.played_at ?? m.created_at, timeZone) === dag) rondes.add(r);
  }
  return rondes.size;
}
