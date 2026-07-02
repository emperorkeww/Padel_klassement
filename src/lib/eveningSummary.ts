// Samenvatting van één speelavond in een groep: de stand over alleen de
// afgeronde matches van die dag, plus het best presterende duo.

import type { Match, Team } from "./types";

export type EveningRow = {
  playerId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalDiff: number;
};

export type EveningSummary = {
  /** Afgeronde matches van de dag, in speelvolgorde. */
  matches: Match[];
  /** Avondstand, gesorteerd op punten → saldo → winst. */
  rows: EveningRow[];
  /** Team met de meeste winsten die avond (bij gelijk: beste saldo). */
  bestDuo: { teamId: string; won: number } | null;
};

const dayOf = (m: Match) => (m.played_at ?? m.created_at).slice(0, 10);

export function eveningSummary(
  matches: Match[],
  teams: Record<string, Team>,
  day: string,
): EveningSummary {
  const todays = matches
    .filter((m) => m.status === "completed" && dayOf(m) === day)
    .sort((a, b) =>
      (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at),
    );

  const rows = new Map<string, EveningRow>();
  const duo = new Map<string, { won: number; goalDiff: number }>();

  const bump = (
    teamId: string,
    scoreFor: number | null,
    scoreAgainst: number | null,
    result: "won" | "drawn" | "lost",
  ) => {
    const team = teams[teamId];
    const diff = (scoreFor ?? 0) - (scoreAgainst ?? 0);
    const d = duo.get(teamId) ?? { won: 0, goalDiff: 0 };
    d.goalDiff += diff;
    if (result === "won") d.won += 1;
    duo.set(teamId, d);
    if (!team) return;
    for (const pid of [team.player1_id, team.player2_id]) {
      const row =
        rows.get(pid) ??
        ({
          playerId: pid,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          points: 0,
          goalDiff: 0,
        } satisfies EveningRow);
      row.played += 1;
      row.goalDiff += diff;
      if (result === "won") {
        row.won += 1;
        row.points += 3;
      } else if (result === "drawn") {
        row.drawn += 1;
        row.points += 1;
      } else {
        row.lost += 1;
      }
      rows.set(pid, row);
    }
  };

  for (const m of todays) {
    const draw = m.winner_team_id == null;
    bump(
      m.team_a_id,
      m.score_a,
      m.score_b,
      draw ? "drawn" : m.winner_team_id === m.team_a_id ? "won" : "lost",
    );
    bump(
      m.team_b_id,
      m.score_b,
      m.score_a,
      draw ? "drawn" : m.winner_team_id === m.team_b_id ? "won" : "lost",
    );
  }

  const sorted = [...rows.values()].sort(
    (a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.won - a.won,
  );

  let bestDuo: EveningSummary["bestDuo"] = null;
  let best = { won: 0, goalDiff: -Infinity };
  for (const [teamId, d] of duo) {
    if (d.won > best.won || (d.won === best.won && d.goalDiff > best.goalDiff)) {
      best = d;
      bestDuo = { teamId, won: d.won };
    }
  }
  if (bestDuo && bestDuo.won === 0) bestDuo = null;

  return { matches: todays, rows: sorted, bestDuo };
}
