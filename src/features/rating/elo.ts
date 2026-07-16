// Verwachte winstkans van een geplande match, gespiegeld aan de rating-
// trigger in de databank (supabase/schemas/functions/09_ratings.sql):
// Elo met basis 1000, teamrating = gemiddelde van beide spelers en de
// klassieke 400-puntenschaal.

import type { PlayerRating, Team } from "@/types";

export const BASE_RATING = 1000;

/** Verwachte score (0..1) van rating a tegen rating b — de kern-Elo-formule. */
export function expected(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

export function teamRating(
  team: Team | undefined,
  ratings: Record<string, PlayerRating>,
): number {
  if (!team) return BASE_RATING;
  const r1 = ratings[team.player1_id]?.rating ?? BASE_RATING;
  // Singles (1v1): de teamrating is gewoon de rating van die ene speler.
  if (!team.player2_id) return r1;
  const r2 = ratings[team.player2_id]?.rating ?? BASE_RATING;
  return (r1 + r2) / 2;
}

/** Kans (0..1) dat team A wint van team B volgens de huidige ratings. */
export function winChance(
  teamA: Team | undefined,
  teamB: Team | undefined,
  ratings: Record<string, PlayerRating>,
): number {
  return expected(teamRating(teamA, ratings), teamRating(teamB, ratings));
}
