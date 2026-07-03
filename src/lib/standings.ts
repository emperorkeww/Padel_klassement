// Client-side evenknie van de standen-views (standings/player_standings in
// supabase/migrations/20260701170000_draws_and_points.sql): zelfde punten
// (winst 3, gelijkspel 1, verlies 0) en zelfde sortering (punten ↓, saldo ↓,
// winst ↓, en bij spelers de naam ↑). Wordt gebruikt voor de kwartaalstand,
// die uit een gefilterde matchlijst berekend wordt in plaats van server-side.

import type { Season } from "./seasons";
import type {
  Match,
  PlayerStanding,
  Profile,
  Team,
  TeamStanding,
} from "./types";

type Line = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goal_diff: number;
};

function newLine(): Line {
  return { played: 0, won: 0, drawn: 0, lost: 0, points: 0, goal_diff: 0 };
}

function addResult(
  line: Line,
  match: Match,
  teamId: string,
  scoredFor: number | null,
  scoredAgainst: number | null,
) {
  line.played++;
  if (match.winner_team_id === null) line.drawn++;
  else if (match.winner_team_id === teamId) line.won++;
  else line.lost++;
  line.points = line.won * 3 + line.drawn;
  // Ontbrekende scores tellen als 0, net zoals coalesce() in de views.
  line.goal_diff += (scoredFor ?? 0) - (scoredAgainst ?? 0);
}

/** Elke afgeronde match telt twee teamresultaten: één per kant. */
function forEachTeamResult(
  matches: Match[],
  fn: (
    teamId: string,
    match: Match,
    scoredFor: number | null,
    scoredAgainst: number | null,
  ) => void,
) {
  for (const m of matches) {
    if (m.status !== "completed") continue;
    fn(m.team_a_id, m, m.score_a, m.score_b);
    fn(m.team_b_id, m, m.score_b, m.score_a);
  }
}

function byRank(
  a: { points: number; goal_diff: number; won: number },
  b: { points: number; goal_diff: number; won: number },
): number {
  return b.points - a.points || b.goal_diff - a.goal_diff || b.won - a.won;
}

export function computePlayerStandings(
  matches: Match[],
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
): PlayerStanding[] {
  const lines = new Map<string, Line>();
  forEachTeamResult(matches, (teamId, m, scoredFor, scoredAgainst) => {
    const team = teams[teamId];
    if (!team) return;
    for (const playerId of [team.player1_id, team.player2_id]) {
      const line = lines.get(playerId) ?? newLine();
      addResult(line, m, teamId, scoredFor, scoredAgainst);
      lines.set(playerId, line);
    }
  });
  return [...lines.entries()]
    .map(([player_id, line]) => ({
      player_id,
      username: profiles[player_id]?.username ?? "",
      full_name: profiles[player_id]?.full_name ?? null,
      ...line,
    }))
    .sort((a, b) => byRank(a, b) || a.username.localeCompare(b.username));
}

export function computeTeamStandings(
  matches: Match[],
  teams: Record<string, Team>,
): TeamStanding[] {
  const lines = new Map<string, Line>();
  forEachTeamResult(matches, (teamId, m, scoredFor, scoredAgainst) => {
    const line = lines.get(teamId) ?? newLine();
    addResult(line, m, teamId, scoredFor, scoredAgainst);
    lines.set(teamId, line);
  });
  return [...lines.entries()]
    .map(([team_id, line]) => ({
      team_id,
      team_name: teams[team_id]?.name ?? null,
      ...line,
    }))
    .sort(byRank);
}

/** Matches binnen de seizoensgrenzen (start inclusief, einde exclusief). */
export function matchesInSeason(matches: Match[], season: Season): Match[] {
  return matches.filter((m) => {
    const d = new Date(m.played_at ?? m.created_at);
    return d >= season.start && d < season.end;
  });
}
