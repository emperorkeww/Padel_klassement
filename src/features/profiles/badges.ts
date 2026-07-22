// Prestatiebadges, puur afgeleid uit de al geladen matches + teams (+ ratings).
// Geen extra tabellen of queries: alles wordt client-side berekend, net zoals
// de helpers in results.ts. Deze module bundelt de losse onderdelen:
//   - badges.constants  drempels, doelen en tabellen
//   - badges.facts      verzamelFeiten: alle feiten in één doorloop
//   - badges.streaks    reeks-/comeback-/rating-helpers
//   - badges.catalog    de volledige badge-catalogus (buildBadges)

import type { Match, PlayerRating, Team } from "@/types";
import { longestLossStreak, longestStreak, outcomeFor } from "@/features/rating/results";
import { verzamelFeiten } from "./badges.facts";
import {
  dejaVuReeks,
  jojoReeks,
  rustFeiten,
  tweelingReeks,
} from "./badges.streaks";
import { buildBadges, type BadgeContext } from "./badges.catalog";

// De drempels/doelen blijven vanaf @/features/profiles/badges beschikbaar.
export * from "./badges.constants";

export interface BadgeVoortgang {
  nu: number;
  doel: number;
}

export interface Badge {
  id: string;
  naam: string;
  /** Eén emoji als icoontje. */
  emoji: string;
  omschrijving: string;
  behaald: boolean;
  /** Telbare voortgang ("38/50"); ontbreekt bij alles-of-niets-badges. */
  voortgang?: BadgeVoortgang;
}

/**
 * Leidt alle badges van een speler af uit zijn afgewerkte matches.
 * Geeft altijd de volledige set terug (ook niet-behaalde, met voortgang),
 * zodat de UI kan tonen wat er nog te verzamelen valt.
 */
export function deriveBadges(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  ratings?: Record<string, PlayerRating>,
): Badge[] {
  let gespeeld = 0;
  let gewonnen = 0;
  for (const m of matches) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    gespeeld++;
    if (o === "W") gewonnen++;
  }
  const reeks = longestStreak(matches, teams, playerId);
  const pech = longestLossStreak(matches, teams, playerId);
  const feiten = verzamelFeiten(matches, teams, playerId);
  const verloren = gespeeld - gewonnen - feiten.gelijk;
  const eigenRating = ratings?.[playerId]?.rating ?? null;
  const dejaVu = dejaVuReeks(matches, teams, playerId);
  const jojo = jojoReeks(matches, teams, playerId);
  const rust = rustFeiten(matches, teams, playerId);
  const tweeling = tweelingReeks(matches, teams, playerId);

  const ctx: BadgeContext = {
    matches,
    teams,
    playerId,
    ratings,
    gespeeld,
    gewonnen,
    verloren,
    reeks,
    pech,
    eigenRating,
    feiten,
    dejaVu,
    jojo,
    rust,
    tweeling,
  };
  return buildBadges(ctx);
}

// Statische kaart-info (id, naam, emoji) per badge: de catalogus afgeleid uit
// een lege context — de definities zijn statisch, alleen behaald/voortgang
// hangen van de speler af. Lui opgebouwd bij het eerste gebruik.
let catalogus: Map<string, Badge> | null = null;

/**
 * PlayStyle-chips buiten het profiel (#621): resolvet de opgeslagen
 * featured-ids van een speler naar badge-definities voor op de FUT-kaart in
 * klassement en opstelling. Daar is niet de volledige matchhistorie van elke
 * speler geladen, dus we vertrouwen de opgeslagen ids — uitlichten kan alleen
 * bij behaalde badges. Onbekende ids vallen stil weg.
 */
export function featuredPlaystyles(
  ids: readonly string[] | null | undefined,
): Badge[] {
  if (!ids || ids.length === 0) return [];
  catalogus ??= new Map(deriveBadges([], {}, "").map((b) => [b.id, b]));
  return ids
    .map((id) => catalogus!.get(id))
    .filter((b): b is Badge => b != null);
}