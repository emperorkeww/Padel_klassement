// Helpers om matches vanuit het perspectief van één speler te lezen:
// win/verlies/gelijk, recente vorm en winstreeks. Alles wordt client-side
// berekend uit de al geladen matches + teams (geen extra views nodig).

import type { Match, Team } from "./types";

export type Outcome = "W" | "D" | "L";

/** Zit de speler in dit team? */
export function inTeam(team: Team | undefined, playerId: string): boolean {
  return !!team && (team.player1_id === playerId || team.player2_id === playerId);
}

/**
 * Uitslag van een match vanuit de speler: 'W' | 'D' | 'L',
 * of null als de speler niet meedeed of de match niet is afgerond.
 */
export function outcomeFor(
  match: Match,
  teams: Record<string, Team>,
  playerId: string,
): Outcome | null {
  if (match.status !== "completed") return null;
  const inA = inTeam(teams[match.team_a_id], playerId);
  const inB = inTeam(teams[match.team_b_id], playerId);
  if (!inA && !inB) return null;
  if (match.winner_team_id === null) return "D";
  const won = match.winner_team_id === (inA ? match.team_a_id : match.team_b_id);
  return won ? "W" : "L";
}

/** Recente vorm: uitslagen van de laatste `n` afgeronde matches, nieuwste eerst. */
export function recentForm(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  n = 5,
): Outcome[] {
  const sorted = [...matches].sort((a, b) =>
    (b.played_at ?? b.created_at).localeCompare(a.played_at ?? a.created_at),
  );
  const form: Outcome[] = [];
  for (const m of sorted) {
    const o = outcomeFor(m, teams, playerId);
    if (o) form.push(o);
    if (form.length >= n) break;
  }
  return form;
}

/** Huidige winstreeks (aantal opeenvolgende winsten, vanaf de recentste match). */
export function winStreak(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): number {
  const form = recentForm(matches, teams, playerId, Number.MAX_SAFE_INTEGER);
  let streak = 0;
  for (const o of form) {
    if (o !== "W") break;
    streak++;
  }
  return streak;
}

/** Winpercentage (0–100, afgerond) of null zonder gespeelde matches. */
export function winRate(won: number, played: number): number | null {
  if (!played) return null;
  return Math.round((won / played) * 100);
}

/**
 * Beste maatje: partner met wie de speler de meeste matches won.
 * Geeft null zonder gewonnen dubbels.
 */
export function bestPartner(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): { partnerId: string; wins: number; played: number } | null {
  const stats = new Map<string, { wins: number; played: number }>();
  for (const m of matches) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    const myTeam = inTeam(teams[m.team_a_id], playerId)
      ? teams[m.team_a_id]
      : teams[m.team_b_id];
    if (!myTeam) continue;
    const partnerId =
      myTeam.player1_id === playerId ? myTeam.player2_id : myTeam.player1_id;
    const s = stats.get(partnerId) ?? { wins: 0, played: 0 };
    s.played++;
    if (o === "W") s.wins++;
    stats.set(partnerId, s);
  }
  let best: { partnerId: string; wins: number; played: number } | null = null;
  for (const [partnerId, s] of stats) {
    if (s.wins === 0) continue;
    if (!best || s.wins > best.wins) best = { partnerId, ...s };
  }
  return best;
}