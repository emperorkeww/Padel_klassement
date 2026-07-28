// Bounty op de leider (#805): client-side evenknie van de databank-logica.
// BOUNTY_BASIS/STAP/MAX spiegelen public.bounty_value, de drempels spiegelen
// _bounty_deltas (supabase/schemas/functions/31_bounty.sql).
//
// De databank blijft de enige die uitkeert; dit bestand bestaat zodat het
// klassement en de matchkaart vooraf kunnen tonen wat er op iemands hoofd
// staat, met exact hetzelfde getal als straks verrekend wordt.

import type { Team } from "@/types";
import { playersOf } from "@/features/rating/results";

/** Waarde van een verse bounty, zonder zegereeks. */
export const BOUNTY_BASIS = 15;
/** Wat elke opeenvolgende zege van de drager erbij legt. */
export const BOUNTY_STAP = 3;
/** Plafond: één claim mag nooit zwaarder wegen dan twee normale matches. */
export const BOUNTY_MAX = 30;
/** Rating vanaf wanneer je overal een bounty draagt (El Padelissimo, tiers.ts). */
export const BOUNTY_DICTATOR_RATING = 1600;
/** Het tekentje naast de naam van een drager. */
export const BOUNTY_EMOJI = "🎯";

/** Waarom deze speler een bounty draagt: de troon (overal) of de kroon van
 *  één groep. */
export type BountyReden = "dictator" | "bigdaddy";

/** Rij uit de view public.active_bounties. */
export interface ActiveBounty {
  playerId: string;
  /** null = dictator-bounty, geldt in élke match. */
  groupId: string | null;
  reden: BountyReden;
  streak: number;
  pool: number;
}

/** Wat er op iemands hoofd staat bij een gegeven zegereeks — spiegel van
 *  public.bounty_value. */
export function bountyPool(streak: number): number {
  return Math.min(BOUNTY_BASIS + BOUNTY_STAP * Math.max(streak, 0), BOUNTY_MAX);
}

/**
 * Pool per speler binnen één context: de dictator-bounty's (die gelden overal)
 * plus, als je een groep meegeeft, de kroon van díé groep. Een speler die
 * allebei draagt telt één keer — de pool hangt aan zijn zegereeks, niet aan de
 * reden, en wordt bij een claim ook maar één keer uitgekeerd.
 */
export function bountiesVoor(
  bounties: ActiveBounty[],
  groupId?: string | null,
): Record<string, number> {
  const pools: Record<string, number> = {};
  for (const b of bounties) {
    if (b.groupId != null && b.groupId !== groupId) continue;
    pools[b.playerId] = Math.max(pools[b.playerId] ?? 0, b.pool);
  }
  return pools;
}

/** Eén drager die in een match meespeelt. */
export interface MatchBounty {
  playerId: string;
  pool: number;
}

/**
 * De dragers die in deze match meespelen, met wat er op hun hoofd staat.
 * Bewust beide teams: wie een bounty draagt is ook in de ploeg die kan winnen
 * een doelwit, en de kaart hoort te tonen wie er te pakken valt.
 */
export function matchBounties(
  bounties: ActiveBounty[],
  match: { group_id: string | null; team_a_id: string; team_b_id: string },
  teams: Record<string, Team>,
): MatchBounty[] {
  const pools = bountiesVoor(bounties, match.group_id);
  const spelers = [
    ...playersOf(teams[match.team_a_id]),
    ...playersOf(teams[match.team_b_id]),
  ];
  return spelers
    .filter((id) => pools[id] != null)
    .map((id) => ({ playerId: id, pool: pools[id] }));
}