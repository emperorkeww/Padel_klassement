// Upset-detectie (#85): won het onderliggende team? De winkans van het winnende
// team vóór de match (échte pre-match ratings uit rating_history) bepaalt of
// een uitslag een verrassing is. Eén plek voor de drempel en de pure math,
// gedeeld door de feed, de matchkaarten/-detail en de avondsamenvatting.

import type { Match, RatingPoint, Team } from "./types";
import { expected } from "./elo";

/** Winkans-grens: won een team met minder kans dan dit, dan is het een upset. */
export const UPSET_MAX_KANS = 0.35;

export type Upset = {
  /** Winkans van het winnende team vóór de match (0..1). */
  chance: number;
  winnerTeamId: string;
};

/** Het rating_history-punt per speler voor één match, uit de volledige historie. */
export function preMatchPoints(
  histories: Record<string, RatingPoint[]>,
  matchId: string,
): Map<string, RatingPoint> {
  const out = new Map<string, RatingPoint>();
  for (const [pid, points] of Object.entries(histories)) {
    const p = points.find((x) => x.match_id === matchId);
    if (p) out.set(pid, p);
  }
  return out;
}

/**
 * Upset als het winnende team met minder dan UPSET_MAX_KANS won, gemeten aan de
 * échte pre-match ratings (rating_before, gemiddeld per team). Null bij
 * gelijkspel, een ontbrekend team, of ontbrekende rating_before van één van de
 * vier spelers (bv. bij de allereerste matches) — dan doen we geen uitspraak.
 */
export function matchUpset(
  m: Match,
  teams: Record<string, Team>,
  points: Map<string, RatingPoint> | undefined,
): Upset | null {
  if (!m.winner_team_id || !points) return null;
  const winner = teams[m.winner_team_id];
  const loserId = m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id;
  const loser = teams[loserId];
  if (!winner || !loser) return null;
  const avg = (t: Team): number | null => {
    const p1 = points.get(t.player1_id)?.rating_before;
    const p2 = points.get(t.player2_id)?.rating_before;
    return p1 == null || p2 == null ? null : (p1 + p2) / 2;
  };
  const w = avg(winner);
  const l = avg(loser);
  if (w == null || l == null) return null;
  const chance = expected(w, l);
  return chance < UPSET_MAX_KANS
    ? { chance, winnerTeamId: m.winner_team_id }
    : null;
}

/** Upsets voor een hele lijst matches; bouwt de match→speler-map één keer. */
export function upsetsByMatch(
  matches: Match[],
  teams: Record<string, Team>,
  histories: Record<string, RatingPoint[]>,
): Map<string, Upset> {
  const byMatch = new Map<string, Map<string, RatingPoint>>();
  for (const [pid, points] of Object.entries(histories)) {
    for (const p of points) {
      let inner = byMatch.get(p.match_id);
      if (!inner) byMatch.set(p.match_id, (inner = new Map()));
      inner.set(pid, p);
    }
  }
  const out = new Map<string, Upset>();
  for (const m of matches) {
    const u = matchUpset(m, teams, byMatch.get(m.id));
    if (u) out.set(m.id, u);
  }
  return out;
}
