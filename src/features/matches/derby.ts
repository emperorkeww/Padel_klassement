// Derby-detectie (#169): een match is een derby als álle spelers van beide
// teams in dezelfde hoofddivisie zitten — dan staat er divisie-eer op het spel.
// Puur en client-side, gedeeld door matchdetail en (later) de feed.

import type { Match, Team } from "@/types";
import { playersOf } from "@/features/rating/results";
import { zelfdeDivisie, type TierBand } from "@/features/rating/tiers";

/**
 * De gedeelde divisie van alle deelnemers, of null als de match geen derby is
 * (afwijkende divisies), een team ontbreekt, of een speler geen rating heeft
 * — dan doen we geen uitspraak.
 */
export function matchDerby(
  match: Match,
  teams: Record<string, Team>,
  ratingOf: (playerId: string) => number | null,
): TierBand | null {
  const teamA = teams[match.team_a_id];
  const teamB = teams[match.team_b_id];
  if (!teamA || !teamB) return null;
  const spelers = [...playersOf(teamA), ...playersOf(teamB)];
  return zelfdeDivisie(spelers.map(ratingOf));
}
