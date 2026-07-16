// Rivaliteiten tussen spelersparen, client-side afgeleid uit de al geladen
// matches + teams (geen extra views nodig). Een "duel" is elke afgeronde match
// waarin twee spelers in tegengestelde teams stonden; partners tellen dus
// nooit mee. De spannendste paren — veel duels, klein verschil, recente
// wissels in wie leidt — komen bovenaan.

import type { Match, Team } from "@/types";
import { playersOf } from "@/features/rating/results";

/** Minimum aantal onderlinge duels vóór we van een rivaliteit spreken.
 *  Zelfde drempel als MIN_SAMEN in features/profiles/headToHead.ts —
 *  bewust gedupliceerd: lib importeert niet uit features. */
export const MIN_DUELS = 3;

export interface Rivalry {
  /** Speler-ids; `a` is alfabetisch de kleinste, zodat het paar een stabiele
   *  sleutel heeft ongeacht wie in welk team stond. */
  a: string;
  b: string;
  /** Afgeronde duels als tegenstanders, inclusief gelijkspelen. */
  played: number;
  winsA: number;
  winsB: number;
  draws: number;
  /** Recentste duel; winnerId null = gelijkspel. */
  last: { match: Match; winnerId: string | null };
  /** Hoe vaak de leiding in de onderlinge stand van kant wisselde. */
  leadChanges: number;
  /** Rivaliteitsscore: hoger = spannender (zie groupRivalries). */
  score: number;
}

/** Stabiele sleutel voor een spelerpaar, onafhankelijk van de volgorde. */
export function pairKey(x: string, y: string): string {
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

interface PairAcc {
  a: string;
  b: string;
  played: number;
  winsA: number;
  winsB: number;
  draws: number;
  last: { match: Match; winnerId: string | null };
  leadChanges: number;
  /** Laatste niet-nul teken van winsA - winsB: wie het laatst de leiding had.
   *  De stand verandert per duel met hooguit 1, dus een wissel gaat altijd
   *  via een gelijke stand — daarom volstaat het tekenverschil niet. */
  lastLeader: number;
  /** Momentum: exponentieel afnemend gewicht per lead-wissel; wordt na afloop
   *  nog geschaald zodat de recentste wissel ~1 telt. */
  momentumRaw: number;
  /** 0.8^-i-gewichten lopen op met de duel-index; onthoud de laatste index. */
  duelIndex: number;
}

const MOMENTUM_DECAY = 0.8;

/**
 * Alle rivaliteiten in een set matches, gesorteerd op score (spannendste
 * eerst). Paren met minder dan `minPlayed` duels vallen weg.
 *
 * Score = duels * (0.5 + spanning) + 2 * momentum, met
 * - duels    = min(played, 10) — volume telt, maar met een plafond;
 * - spanning = 1 - |winsA - winsB| / played — 1 bij perfect evenwicht;
 * - momentum = som van 0.8^(afstand tot nu) per lead-wissel — een wissel in
 *   het laatste duel telt ~1, oude wissels sterven uit.
 */
export function groupRivalries(
  matches: Match[],
  teams: Record<string, Team>,
  minPlayed = MIN_DUELS,
): Rivalry[] {
  const sorted = matches
    .filter((m) => m.status === "completed")
    .sort((a, b) =>
      (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at),
    );

  const pairs = new Map<string, PairAcc>();
  for (const m of sorted) {
    const ta = teams[m.team_a_id];
    const tb = teams[m.team_b_id];
    if (!ta || !tb) continue;
    // Singles-teams leveren gewoon één speler; een 1v1-duel is óók een rivaliteit.
    for (const pa of playersOf(ta)) {
      for (const pb of playersOf(tb)) {
        if (pa === pb) continue; // defensief: kapotte data
        const key = pairKey(pa, pb);
        const acc =
          pairs.get(key) ??
          ({
            a: pa < pb ? pa : pb,
            b: pa < pb ? pb : pa,
            played: 0,
            winsA: 0,
            winsB: 0,
            draws: 0,
            last: { match: m, winnerId: null },
            leadChanges: 0,
            lastLeader: 0,
            momentumRaw: 0,
            duelIndex: 0,
          } satisfies PairAcc);

        let winnerId: string | null = null;
        if (m.winner_team_id === m.team_a_id) winnerId = pa;
        else if (m.winner_team_id === m.team_b_id) winnerId = pb;

        if (winnerId === null) acc.draws++;
        else if (winnerId === acc.a) acc.winsA++;
        else acc.winsB++;

        const leadAfter = Math.sign(acc.winsA - acc.winsB);
        if (leadAfter !== 0 && acc.lastLeader !== 0 && leadAfter !== acc.lastLeader) {
          acc.leadChanges++;
          // Gewicht groeit met de duel-index; delen door het gewicht van het
          // laatste duel maakt de recentste wissel ~1 (zie hieronder).
          acc.momentumRaw += Math.pow(1 / MOMENTUM_DECAY, acc.played);
        }
        if (leadAfter !== 0) acc.lastLeader = leadAfter;

        acc.played++;
        acc.duelIndex = acc.played - 1;
        acc.last = { match: m, winnerId };
        pairs.set(key, acc);
      }
    }
  }

  const out: Rivalry[] = [];
  for (const acc of pairs.values()) {
    if (acc.played < minPlayed) continue;
    const duels = Math.min(acc.played, 10);
    const spanning = 1 - Math.abs(acc.winsA - acc.winsB) / acc.played;
    const momentum =
      acc.momentumRaw * Math.pow(MOMENTUM_DECAY, acc.duelIndex);
    out.push({
      a: acc.a,
      b: acc.b,
      played: acc.played,
      winsA: acc.winsA,
      winsB: acc.winsB,
      draws: acc.draws,
      last: acc.last,
      leadChanges: acc.leadChanges,
      score: duels * (0.5 + spanning) + 2 * momentum,
    });
  }
  return out.sort((x, y) => y.score - x.score);
}

/**
 * De relevante rivaliteit voor een (geplande of gespeelde) match: van de vier
 * kruisparen tussen beide teams het hoogst scorende, of null als geen enkel
 * paar de drempel haalt.
 */
export function rivalryForMatch(
  match: Match,
  teams: Record<string, Team>,
  rivalries: Rivalry[],
): Rivalry | null {
  const ta = teams[match.team_a_id];
  const tb = teams[match.team_b_id];
  if (!ta || !tb) return null;
  const byKey = new Map(rivalries.map((r) => [pairKey(r.a, r.b), r]));
  let best: Rivalry | null = null;
  for (const pa of playersOf(ta)) {
    for (const pb of playersOf(tb)) {
      if (pa === pb) continue;
      const r = byKey.get(pairKey(pa, pb));
      if (r && (!best || r.score > best.score)) best = r;
    }
  }
  return best;
}

/**
 * Eerstvolgende geplande confrontatie tussen twee spelers als tegenstanders:
 * de vroegste niet-afgeronde, niet-geannuleerde match waarin ze in
 * tegengestelde teams staan. Voor de "revanche"-regel op de rivaliteitskaart.
 */
export function nextEncounter(
  matches: Match[],
  teams: Record<string, Team>,
  a: string,
  b: string,
): Match | null {
  const opposed = (m: Match): boolean => {
    const ta = teams[m.team_a_id];
    const tb = teams[m.team_b_id];
    if (!ta || !tb) return false;
    const aInA = ta.player1_id === a || ta.player2_id === a;
    const aInB = tb.player1_id === a || tb.player2_id === a;
    const bInA = ta.player1_id === b || ta.player2_id === b;
    const bInB = tb.player1_id === b || tb.player2_id === b;
    return (aInA && bInB) || (aInB && bInA);
  };
  const planned = matches
    .filter(
      (m) => m.status !== "completed" && m.status !== "cancelled" && opposed(m),
    )
    .sort((x, y) =>
      (x.played_at ?? x.created_at).localeCompare(y.played_at ?? y.created_at),
    );
  return planned[0] ?? null;
}

/** Onderlinge stand nadat er één duel bij komt — voor het viermoment direct
 *  na het opslaan, vóórdat de herlaadde matches binnen zijn. */
export function standAfter(
  r: Rivalry,
  winnerPlayerId: string | null,
): { winsA: number; winsB: number; draws: number } {
  return {
    winsA: r.winsA + (winnerPlayerId === r.a ? 1 : 0),
    winsB: r.winsB + (winnerPlayerId === r.b ? 1 : 0),
    draws: r.draws + (winnerPlayerId === null ? 1 : 0),
  };
}

/**
 * Kop voor het viermoment na een rivaliteitsduel, met de bijgewerkte stand.
 * De stand staat vanuit de winnaar ("Bob slaat terug: 4–5" = Bob staat nog
 * achter); bij gelijkspel blijft de stand zoals hij was, plus een draw.
 */
export function rivalryHeadline(
  r: Rivalry,
  winnerPlayerId: string | null,
  nameOf: (id: string) => string,
): string {
  const after = standAfter(r, winnerPlayerId);
  if (winnerPlayerId === null) {
    return `Gelijkspel — de stand blijft ${after.winsA}–${after.winsB}.`;
  }
  const winnerIsA = winnerPlayerId === r.a;
  const winner = nameOf(winnerPlayerId);
  const loser = nameOf(winnerIsA ? r.b : r.a);
  const w = winnerIsA ? after.winsA : after.winsB;
  const l = winnerIsA ? after.winsB : after.winsA;
  const stand = `${w}–${l}`;
  if (w < l) return `${winner} slaat terug: ${stand} tegen ${loser}!`;
  if (w === l) return `${winner} komt langszij met ${loser}: ${stand}!`;
  // De winnaar leidt: net de leiding gepakt of verder uitgelopen?
  const ledBefore = winnerIsA ? r.winsA > r.winsB : r.winsB > r.winsA;
  return ledBefore
    ? `${winner} loopt verder uit: ${stand} tegen ${loser}!`
    : `${winner} pakt de leiding: ${stand} tegen ${loser}!`;
}
