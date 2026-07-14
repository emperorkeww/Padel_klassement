// Dag-statistieken voor de Vandaag-tab van een groep (#342): de ELO-bewegers
// van de dag, afgeleid uit de rating-historie over de matches van vandaag.

import type { RatingPoint } from "@/types";

export type Mover = { playerId: string; delta: number };

/** Sommeert de rating-delta per speler over de meegegeven match-ids (de
 *  afgeronde matches van vandaag). Aflopend gesorteerd: de grootste stijger
 *  staat vooraan, de grootste daler achteraan. Spelers zonder een punt in deze
 *  matches (o.a. gasten zonder rating-historie) vallen weg. */
export function dayMovers(
  histories: Record<string, RatingPoint[]>,
  matchIds: Set<string>,
): Mover[] {
  const totals = new Map<string, number>();
  for (const [playerId, points] of Object.entries(histories)) {
    let sum = 0;
    let touched = false;
    for (const p of points) {
      if (matchIds.has(p.match_id)) {
        sum += p.delta;
        touched = true;
      }
    }
    if (touched) totals.set(playerId, sum);
  }
  return [...totals.entries()]
    .map(([playerId, delta]) => ({ playerId, delta }))
    .sort((a, b) => b.delta - a.delta);
}
