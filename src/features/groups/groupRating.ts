import type { Match, PlayerRating, Team } from "@/types";

// Pure logica voor het rating-groepsklassement (#52): groepsleden gesorteerd
// op hun globale Elo, met het aantal groepsmatches ernaast. Getest in
// groupRating.test.ts.

/** Onder dit aantal totale matches tonen we de rating gedimd: te weinig
 *  data om er hard op te vertrouwen (zie ook #86, Glicko-2). */
export const THIN_GAMES = 3;

export interface RatingRow {
  playerId: string;
  /** Globale Elo; null = nog nooit een match gespeeld. */
  rating: number | null;
  /** Totale matches waarop de rating gebouwd is. */
  games: number;
  /** Afgeronde matches binnen deze groep. */
  playedInGroup: number;
  /** Rating gebouwd op weinig matches → gedimd weergeven. */
  thin: boolean;
}

/** Afgeronde groepsmatches per speler (via de teams van elke match). */
export function playedInGroup(
  matches: Match[],
  teams: Record<string, Team>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of matches) {
    if (m.status !== "completed") continue;
    for (const teamId of [m.team_a_id, m.team_b_id]) {
      const team = teams[teamId];
      if (!team) continue;
      for (const pid of [team.player1_id, team.player2_id]) {
        counts[pid] = (counts[pid] ?? 0) + 1;
      }
    }
  }
  return counts;
}

/**
 * Groepsleden gesorteerd op rating (aflopend). Tie-breaks: meer matches
 * eerst, dan naam. Leden zonder rating (nooit gespeeld) staan onderaan,
 * op naam gesorteerd.
 */
export function groupRatingStandings(
  memberIds: string[],
  ratings: Record<string, PlayerRating>,
  played: Record<string, number>,
  nameOf: (id: string) => string,
): RatingRow[] {
  const rows: RatingRow[] = memberIds.map((id) => {
    const r = ratings[id];
    return {
      playerId: id,
      rating: r?.rating ?? null,
      games: r?.games ?? 0,
      playedInGroup: played[id] ?? 0,
      thin: (r?.games ?? 0) > 0 && (r?.games ?? 0) < THIN_GAMES,
    };
  });
  return rows.sort((a, b) => {
    if (a.rating != null && b.rating != null) {
      return (
        b.rating - a.rating ||
        b.games - a.games ||
        nameOf(a.playerId).localeCompare(nameOf(b.playerId))
      );
    }
    if (a.rating != null) return -1;
    if (b.rating != null) return 1;
    return nameOf(a.playerId).localeCompare(nameOf(b.playerId));
  });
}
