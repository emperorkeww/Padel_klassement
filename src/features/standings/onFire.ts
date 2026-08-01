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

/** De lopende delta>0-reeks van één speler, recentste eerst; leeg als de
 *  laatste match geen winst was. */
function actieveReeks(punten: RatingPoint[]): RatingPoint[] {
  // De histories komen chronologisch binnen (ratingsApi), maar daar rekent
  // deze helper niet op: sorteer zelf recentste-eerst, net als results.ts.
  const recentEerst = [...punten].sort((a, b) =>
    b.played_at.localeCompare(a.played_at),
  );
  const reeks: RatingPoint[] = [];
  for (const p of recentEerst) {
    if (!(p.delta > 0)) break;
    reeks.push(p);
  }
  return reeks;
}

/** Actieve delta>0-reeks per speler (teruggeteld vanaf de recentste match),
 *  alleen voor spelers die de drempel halen. Anders dan bij de andere edities
 *  kunnen dit er meerdere tegelijk zijn. */
export function onFireSpelers(
  histories: Record<string, RatingPoint[]>,
): Record<string, number> {
  const dragers: Record<string, number> = {};
  for (const [playerId, punten] of Object.entries(histories)) {
    const streak = actieveReeks(punten).length;
    if (streak >= ONFIRE_DREMPEL) dragers[playerId] = streak;
  }
  return dragers;
}

/** Het moment waarop de 🔥-editie ging branden (#986). */
export interface OnFireDoorbraak {
  playerId: string;
  /** De match waarin de reeks de drempel haalde. */
  matchId: string;
  /** `played_at` van die match. */
  at: string;
  /** De reekslengte op dát moment — dus altijd `ONFIRE_DREMPEL`, niet de
   *  huidige reeks. Zie de kop van `onFireDoorbraken`. */
  streak: number;
}

/** Wie draagt de editie, en sinds welke match?
 *
 *  `onFireSpelers` beantwoordt "wie is nu on fire" — genoeg voor een kaart, die
 *  een toestand toont. De feed vertelt gebeurtenissen en heeft daarom een
 *  tijdstip nodig, en het enige eerlijke tijdstip is de match waarin de reeks de
 *  drempel haalde: dáár ging de kaart branden.
 *
 *  Dat maakt het item meteen idempotent. Groeit de reeks van 5 naar 8, dan
 *  blijft de doorbraakmatch dezelfde en verschijnt er geen tweede item — terwijl
 *  een item op "de recentste match van de reeks" bij elke zege opnieuw bovenaan
 *  zou komen. Om dezelfde reden telt `streak` de reeks op het doorbraakmoment:
 *  datum en getal beschrijven dan hetzelfde moment. Dat de speler inmiddels op 8
 *  staat, leest de feed af aan de match-items die er sindsdien boven staan.
 *
 *  Randgeval: bij een gekapte historie (RECENT_HISTORY_LIMIT) kan de échte
 *  doorbraak buiten het venster liggen. De reeks telt dan door tot de rand en
 *  wijst een te late match aan — hetzelfde venster dat `onFireSpelers` al
 *  gebruikt, dus geen nieuwe onnauwkeurigheid. */
export function onFireDoorbraken(
  histories: Record<string, RatingPoint[]>,
): OnFireDoorbraak[] {
  const uit: OnFireDoorbraak[] = [];
  for (const [playerId, punten] of Object.entries(histories)) {
    const reeks = actieveReeks(punten);
    if (reeks.length < ONFIRE_DREMPEL) continue;
    // reeks[0] is de recentste; de reeks begint achteraan. De drempelmatch is
    // dus de ONFIRE_DREMPEL-de vanaf het eind geteld.
    const doorbraak = reeks[reeks.length - ONFIRE_DREMPEL];
    uit.push({
      playerId,
      matchId: doorbraak.match_id,
      at: doorbraak.played_at,
      streak: ONFIRE_DREMPEL,
    });
  }
  return uit;
}
