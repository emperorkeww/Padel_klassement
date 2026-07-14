// Rangverschuiving in het klassement t.o.v. vóór de laatste speeldag,
// client-side gereconstrueerd: de uitslagen van de recentste dag worden van
// de huidige stand afgetrokken, beide standen worden gerangschikt met
// dezelfde tie-breakers als de views, en het verschil is de verschuiving.

import type { Match, PlayerStanding, Team } from "@/types";

/** Positief = gestegen, negatief = gezakt, 0 = gelijk, "nieuw" = stond er
 *  vóór de laatste speeldag nog niet in. */
export type Shift = number | "nieuw";

const matchDay = (m: Match) => (m.played_at ?? m.created_at).slice(0, 10);

export function rankShifts(
  standings: PlayerStanding[],
  matches: Match[],
  teams: Record<string, Team>,
  groupId: string | null = null,
): Map<string, Shift> {
  const out = new Map<string, Shift>();
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
    for (const pid of [team.player1_id, team.player2_id]) {
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

  // Zelfde volgorde als de standings-query: punten, saldo, winst, naam.
  const prevRanked = [...prev.values()]
    .filter((p) => p.played > 0)
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goal_diff - a.goal_diff ||
        b.won - a.won ||
        a.username.localeCompare(b.username),
    );
  const prevRank = new Map(prevRanked.map((p, i) => [p.player_id, i + 1]));

  standings.forEach((p, i) => {
    const was = prevRank.get(p.player_id);
    out.set(p.player_id, was == null ? "nieuw" : was - (i + 1));
  });
  return out;
}
