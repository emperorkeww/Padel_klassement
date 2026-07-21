// Rangverschuiving in het klassement t.o.v. vóór de laatste speeldag,
// client-side gereconstrueerd: de uitslagen van de recentste dag worden van
// de huidige stand afgetrokken, beide standen worden gerangschikt met
// dezelfde volgorde als het zichtbare klassement, en het verschil is de
// verschuiving.
//
// Het klassement voor spelers is rating-leidend (#52): rating ↓, en pas bij
// gelijke/ontbrekende rating de klassieke punten-tie-break. De rating komt uit
// de rating-historie (rating_after) — de huidige rating is het laatste punt,
// de rating "van vóór de laatste speeldag" is het laatste punt vóór die dag.
// Zonder historie valt de berekening terug op louter punten (o.a. de tests en
// scopes zonder rating-data), zodat het gedrag identiek blijft.

import { playersOf } from "@/features/rating/results";
import { byRank } from "@/features/rating/standings";
import type { Match, PlayerStanding, RatingPoint, Team } from "@/types";

/** Positief = gestegen, negatief = gezakt, 0 = gelijk, "nieuw" = stond er
 *  vóór de laatste speeldag nog niet in. */
export type Shift = number | "nieuw";

/** Verschuiving + de bijbehorende posities, zodat de feed zowel de sprong als
 *  de huidige/vorige plek in dezelfde (rating-leidende) volgorde heeft. */
export interface RankShift {
  shift: Shift;
  /** Huidige plek (1-gebaseerd) in de rating-leidende volgorde. */
  rank: number;
  /** Vorige plek, of null als de speler er vóór de laatste speeldag nog niet in stond. */
  was: number | null;
}

const matchDay = (m: Match) => (m.played_at ?? m.created_at).slice(0, 10);

/** Rating uit de historie: het laatste punt (op rating_after) vóór `day`.
 *  Met `day === null` telt de hele historie mee → de huidige rating. */
function ratingBefore(
  history: RatingPoint[] | undefined,
  day: string | null,
): number | null {
  if (!history || history.length === 0) return null;
  let best: RatingPoint | null = null;
  for (const p of history) {
    if (day !== null && p.played_at.slice(0, 10) >= day) continue;
    if (!best || p.played_at > best.played_at) best = p;
  }
  return best ? best.rating_after : null;
}

type Ranked = {
  points: number;
  goal_diff: number;
  won: number;
  username: string;
  rating: number | null;
};

/** Zelfde volgorde als het zichtbare klassement (Leaderboard): rating ↓, dan de
 *  punten-tie-break, en tot slot de naam voor een stabiele rang. */
const byDisplay = (a: Ranked, b: Ranked) =>
  (b.rating ?? -Infinity) - (a.rating ?? -Infinity) ||
  byRank(a, b) ||
  a.username.localeCompare(b.username);

export function rankShifts(
  standings: PlayerStanding[],
  matches: Match[],
  teams: Record<string, Team>,
  groupId: string | null = null,
  histories: Record<string, RatingPoint[]> = {},
): Map<string, RankShift> {
  const out = new Map<string, RankShift>();
  const done = matches.filter(
    (m) =>
      m.status === "completed" && (groupId == null || m.group_id === groupId),
  );
  if (standings.length === 0 || done.length === 0) return out;

  const lastDay = done.map(matchDay).sort().at(-1)!;
  const lastDayMatches = done.filter((m) => matchDay(m) === lastDay);

  // Stand van vóór de laatste speeldag: de resultaten van die dag terugdraaien.
  const prev = new Map(standings.map((p) => [p.player_id, { ...p }]));
  const undo = (
    teamId: string,
    scoreFor: number | null,
    scoreAgainst: number | null,
    result: "won" | "drawn" | "lost",
  ) => {
    const team = teams[teamId];
    if (!team) return;
    for (const pid of playersOf(team)) {
      const row = prev.get(pid);
      if (!row) continue;
      row.played -= 1;
      row.goal_diff -= (scoreFor ?? 0) - (scoreAgainst ?? 0);
      if (result === "won") {
        row.won -= 1;
        row.points -= 3;
      } else if (result === "drawn") {
        row.drawn -= 1;
        row.points -= 1;
      } else {
        row.lost -= 1;
      }
    }
  };
  for (const m of lastDayMatches) {
    const draw = m.winner_team_id == null;
    undo(
      m.team_a_id,
      m.score_a,
      m.score_b,
      draw ? "drawn" : m.winner_team_id === m.team_a_id ? "won" : "lost",
    );
    undo(
      m.team_b_id,
      m.score_b,
      m.score_a,
      draw ? "drawn" : m.winner_team_id === m.team_b_id ? "won" : "lost",
    );
  }

  // Huidige rang: de standings zélf opnieuw ordenen op de klassement-volgorde —
  // de aangeleverde array-volgorde (punten) is níét leidend (#570).
  const currentRanked = [...standings]
    .map((p) => ({ ...p, rating: ratingBefore(histories[p.player_id], null) }))
    .sort(byDisplay);
  const currentRank = new Map(
    currentRanked.map((p, i) => [p.player_id, i + 1] as const),
  );

  // Vorige rang: de teruggedraaide stand met de rating van vóór de laatste dag.
  const prevRanked = [...prev.values()]
    .filter((p) => p.played > 0)
    .map((p) => ({
      ...p,
      rating: ratingBefore(histories[p.player_id], lastDay),
    }))
    .sort(byDisplay);
  const prevRank = new Map(prevRanked.map((p, i) => [p.player_id, i + 1]));

  for (const p of standings) {
    const rank = currentRank.get(p.player_id)!;
    const was = prevRank.get(p.player_id) ?? null;
    out.set(p.player_id, {
      rank,
      was,
      shift: was == null ? "nieuw" : was - rank,
    });
  }
  return out;
}
