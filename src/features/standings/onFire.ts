// On-Fire-editie (#632): wie heeft een actieve winstreak? Client-side uit de
// al geladen rating-histories (dezelfde bron als de rangverschuivings-
// pijltjes en spelerVanDeWeek) — geen extra fetch per speler.
//
// Benadering (bewust, #632): delta > 0 telt als winst. Een gelijkspel kan
// een kleine plus of min opleveren, dus de reeks kan één afwijken van
// winStreak (results.ts), dat op échte uitslagen telt maar de matches +
// teams van de speler nodig heeft — en die zijn op klassement en matchdetail
// niet geladen. Een |delta|-drempel lost dat niet op maar verschuift het
// alleen (een echte winst met kleine delta valt er dan uit), dus de
// afwijking is gedocumenteerd in plaats van weggefilterd.

import type { RatingPoint } from "@/types";

/** Actieve winstreak vanaf wanneer je "on fire" bent — dezelfde lat als de
 *  reeks-5-badge "On fire" (badges.constants.ts). Gecheckt op de echte data
 *  (juli 2026): reeksen van 5 komen geregeld voor, dus de badge-lat volstaat. */
export const ONFIRE_DREMPEL = 5;

/** Actieve delta>0-reeks per speler (teruggeteld vanaf de recentste match),
 *  alleen voor spelers die de drempel halen. Anders dan bij de andere edities
 *  kunnen dit er meerdere tegelijk zijn. */
export function onFireSpelers(
  histories: Record<string, RatingPoint[]>,
): Record<string, number> {
  const dragers: Record<string, number> = {};
  for (const [playerId, punten] of Object.entries(histories)) {
    // De histories komen chronologisch binnen (ratingsApi), maar daar rekent
    // deze helper niet op: sorteer zelf recentste-eerst, net als results.ts.
    const recentEerst = [...punten].sort((a, b) =>
      b.played_at.localeCompare(a.played_at),
    );
    let streak = 0;
    for (const p of recentEerst) {
      if (!(p.delta > 0)) break;
      streak++;
    }
    if (streak >= ONFIRE_DREMPEL) dragers[playerId] = streak;
  }
  return dragers;
}
