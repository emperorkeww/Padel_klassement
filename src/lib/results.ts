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

/** Langste winreeks ooit: grootste aaneengesloten rij "W" in de historie. */
export function longestStreak(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): number {
  const form = recentForm(matches, teams, playerId, Number.MAX_SAFE_INTEGER);
  let best = 0;
  let run = 0;
  for (const o of form) {
    run = o === "W" ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Grootste overwinning: de gewonnen match met het hoogste puntenverschil.
 * Vereist dat beide scores zijn ingevuld; geeft null zonder zulke winst.
 */
export function biggestWin(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): { match: Match; margin: number } | null {
  let best: { match: Match; margin: number } | null = null;
  for (const m of matches) {
    if (outcomeFor(m, teams, playerId) !== "W") continue;
    if (m.score_a == null || m.score_b == null) continue;
    const margin = Math.abs(m.score_a - m.score_b);
    if (!best || margin > best.margin) best = { match: m, margin };
  }
  return best;
}

/**
 * Onderlinge stand tegen elke tegenstander: W/D/L vanuit de speler, geteld
 * over matches waarin beide meededen maar in verschillende teams. De sleutel
 * van de map is het speler-id van de tegenstander.
 */
export function headToHead(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): Map<string, { won: number; drawn: number; lost: number; played: number }> {
  const out = new Map<
    string,
    { won: number; drawn: number; lost: number; played: number }
  >();
  for (const m of matches) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    // Het tegenteam is het team waar de speler niet in zit.
    const oppTeam = inTeam(teams[m.team_a_id], playerId)
      ? teams[m.team_b_id]
      : teams[m.team_a_id];
    if (!oppTeam) continue;
    for (const oppId of [oppTeam.player1_id, oppTeam.player2_id]) {
      const s = out.get(oppId) ?? { won: 0, drawn: 0, lost: 0, played: 0 };
      s.played++;
      if (o === "W") s.won++;
      else if (o === "D") s.drawn++;
      else s.lost++;
      out.set(oppId, s);
    }
  }
  return out;
}