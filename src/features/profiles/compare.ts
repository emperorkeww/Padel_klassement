// Speler Duel & Vergelijker (#469): pure helpers om twee spelers naast elkaar
// te leggen. Net als headToHead.ts/synergy.ts rekenen we over reeds geladen
// data en importeren we bewust géén api/supabase, zodat de logica los testbaar
// blijft. De onderlinge balans zelf komt uit headToHead() (profiles/headToHead).

import type { Match, PlayerRating, PlayerStanding, Team } from "@/types";
import {
  inTeam,
  recentForm,
  winRate,
  type Outcome,
} from "@/features/rating/results";
import { byRank } from "@/features/rating/standings";
import { tierFor, type Tier } from "@/features/rating/tiers";
import { deriveBadges } from "@/features/profiles/badges";

/** De side-by-side statistieken van één speler in de vergelijker. */
export interface VergelijkKant {
  id: string;
  naam: string;
  /** Elo; null als de speler nog nooit een rating kreeg. */
  rating: number | null;
  /** Divisie bij die rating; null zonder rating. */
  tier: Tier | null;
  /** Klassementpositie (#N) op Elo; null als de speler niet in de stand staat. */
  rank: number | null;
  punten: number;
  gespeeld: number;
  /** Winstpercentage 0-100; null zonder gespeelde matches. */
  winrate: number | null;
  /** Recente vorm, nieuwste eerst (zoals recentForm). */
  vorm: Outcome[];
  /** Aantal behaalde badges. */
  badges: number;
}

/**
 * Klassementpositie (#N) per speler, exact de volgorde van het ratingklassement
 * (#52 / PlayerProfile): rating aflopend, met de klassieke punten-tie-break bij
 * gelijke of ontbrekende rating. Zo tonen profiel en vergelijker dezelfde #N.
 */
export function ratingRankIndex(
  standings: PlayerStanding[],
  ratings: Record<string, PlayerRating>,
): Map<string, number> {
  const sorted = [...standings].sort(
    (a, b) =>
      (ratings[b.player_id]?.rating ?? -Infinity) -
        (ratings[a.player_id]?.rating ?? -Infinity) || byRank(a, b),
  );
  const index = new Map<string, number>();
  sorted.forEach((s, i) => index.set(s.player_id, i + 1));
  return index;
}

/** Bouwt één kant van de vergelijking uit reeds geladen data. */
export function comparisonSide(input: {
  id: string;
  naam: string;
  standing: PlayerStanding | null;
  matches: Match[];
  teams: Record<string, Team>;
  ratings: Record<string, PlayerRating>;
  rankIndex: Map<string, number>;
}): VergelijkKant {
  const { id, naam, standing, matches, teams, ratings, rankIndex } = input;
  const rating = ratings[id]?.rating ?? null;
  return {
    id,
    naam,
    rating,
    tier: tierFor(rating),
    rank: rankIndex.get(id) ?? null,
    punten: standing?.points ?? 0,
    gespeeld: standing?.played ?? 0,
    winrate: standing ? winRate(standing.won, standing.played) : null,
    vorm: recentForm(matches, teams, id),
    badges: deriveBadges(matches, teams, id, ratings).filter((b) => b.behaald)
      .length,
  };
}

/** Stonden beide spelers in hetzelfde team (duo) of tegenover elkaar (rivalen)? */
export type JointRol = "duo" | "rivalen";

/** Rol van twee spelers in één (gezamenlijke) match. */
export function jointRol(
  match: Match,
  teams: Record<string, Team>,
  aId: string,
  bId: string,
): JointRol {
  const teamA = teams[match.team_a_id];
  const teamB = teams[match.team_b_id];
  const samenInA = inTeam(teamA, aId) && inTeam(teamA, bId);
  const samenInB = inTeam(teamB, aId) && inTeam(teamB, bId);
  return samenInA || samenInB ? "duo" : "rivalen";
}

/**
 * De (afgewerkte) matches waarin beide spelers op de baan stonden — als duo of
 * als rivalen — nieuwste eerst, gekapt op `limit`. Voedt de gezamenlijke
 * match-historie.
 */
export function jointMatches(
  matches: Match[],
  teams: Record<string, Team>,
  aId: string,
  bId: string,
  limit = 10,
): Match[] {
  return matches
    .filter((m) => {
      if (m.status !== "completed") return false;
      const teamA = teams[m.team_a_id];
      const teamB = teams[m.team_b_id];
      const aIn = inTeam(teamA, aId) || inTeam(teamB, aId);
      const bIn = inTeam(teamA, bId) || inTeam(teamB, bId);
      return aIn && bIn;
    })
    .sort((x, y) =>
      (y.played_at ?? y.created_at).localeCompare(x.played_at ?? x.created_at),
    )
    .slice(0, limit);
}

/** Percentages (0-100) voor de gekleurde onderlinge ratio-balk. */
export function ratioBalk(
  gewonnen: number,
  verloren: number,
  gelijk = 0,
): { win: number; draw: number; loss: number } {
  const totaal = gewonnen + verloren + gelijk;
  if (totaal === 0) return { win: 0, draw: 0, loss: 0 };
  return {
    win: (gewonnen / totaal) * 100,
    draw: (gelijk / totaal) * 100,
    loss: (verloren / totaal) * 100,
  };
}
