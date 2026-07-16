// Klassement-feiten voor Coach Rudy (#411): pure functies die uit een al
// gesorteerde ranglijst concrete feiten destilleren — positie-tier (troon /
// jager / middenmoot / kelder / nieuw), het Elo-gat naar de buurman boven en
// onder, de afstand tot de top-3 en de laatste sprong. Zelfde patroon als
// coachStats.ts, maar met ranglijstrijen als invoer i.p.v. matches. Geen IO;
// deterministisch en getest in klassementFeiten.test.ts.
//
// `shift` blijft bewust de getekende Shift (+3 / -2 / "nieuw") i.p.v. alleen
// de grootte: "drie plekken gezakt" heeft richting nodig; sjablonen nemen
// zelf Math.abs waar dat past.

import { THIN_GAMES } from "@/features/groups/groupRating";
import type { Shift } from "@/features/rating/rankShift";

export type PositieTier = "troon" | "jager" | "middenmoot" | "kelder" | "nieuw";
export type KlassementScope = "groep" | "globaal";

/** Structurele ranglijstrij — houdt deze module los van Leaderboard-Row en PlayerStanding. */
export interface KlassementRij {
  playerId: string;
  naam: string;
  rating: number | null;
  /** Matches achter de rating; onder THIN_GAMES is een positie nog niet zinnig. */
  games: number;
}

export interface KlassementFeiten {
  rank: number;
  totaal: number;
  tier: PositieTier;
  /** Elo-gat naar de buurman boven (≥0); null als #1 of een rating onbekend is. */
  deltaNaarBoven: number | null;
  /** Elo-gat naar de buurman onder (≥0); null als laatste of een rating onbekend is. */
  deltaNaarOnder: number | null;
  /** Naam van de buurman boven; null als #1. */
  buurmanBoven: string | null;
  /** Elo-gat tot plek 3 ("18 Elo van de top-3"); alleen buiten de top-3, anders null. */
  deltaNaarTop3: number | null;
  /** Laatste sprong, getekend (+3 / -2 / "nieuw"), of null als onbekend. */
  shift: Shift | null;
  scope: KlassementScope;
}

/** Binnen zoveel Elo van je buurman boven "ruikt" de jager bloed. */
export const JAGER_GAT = 40;

/**
 * Positie-tier van een speler. Kelder gaat vóór jager zodat de laatste van een
 * mini-groepje kelder is en niet "jager"; het onderste kwart telt pas mee
 * vanaf vier spelers (daaronder is alleen de laatste de kelder).
 */
export function positieTier(rank: number, totaal: number, games: number): PositieTier {
  if (games < THIN_GAMES) return "nieuw";
  if (rank === 1) return "troon";
  if (rank === totaal || (totaal >= 4 && rank > Math.ceil(0.75 * totaal))) return "kelder";
  if (rank <= 3) return "jager";
  return "middenmoot";
}

/** Elo-verschil tussen twee rijen (≥0), of null zodra een rating ontbreekt. */
function eloGat(hoger: KlassementRij | undefined, lager: KlassementRij | undefined): number | null {
  if (hoger?.rating == null || lager?.rating == null) return null;
  return Math.max(0, Math.round(hoger.rating - lager.rating));
}

/**
 * Feiten over de positie van `playerId` in `rows` (al gesorteerd zoals het
 * klassement, rating aflopend). Null als de speler er niet in staat.
 */
export function klassementFeiten(
  rows: KlassementRij[],
  playerId: string,
  scope: KlassementScope,
  shift?: Shift | null,
): KlassementFeiten | null {
  const idx = rows.findIndex((r) => r.playerId === playerId);
  if (idx < 0) return null;
  const rij = rows[idx];
  const boven = idx > 0 ? rows[idx - 1] : undefined;
  const onder = idx < rows.length - 1 ? rows[idx + 1] : undefined;
  const rank = idx + 1;
  return {
    rank,
    totaal: rows.length,
    tier: positieTier(rank, rows.length, rij.games),
    deltaNaarBoven: eloGat(boven, rij),
    deltaNaarOnder: eloGat(rij, onder),
    buurmanBoven: boven?.naam ?? null,
    deltaNaarTop3: rank > 3 ? eloGat(rows[2], rij) : null,
    shift: shift ?? null,
    scope,
  };
}
