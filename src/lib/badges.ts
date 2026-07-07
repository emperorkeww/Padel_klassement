// Prestatiebadges, puur afgeleid uit de al geladen matches + teams (+ ratings).
// Geen extra tabellen of queries: alles wordt client-side berekend, net zoals
// de helpers in results.ts.

import type { Match, PlayerRating, Team } from "./types";
import {
  inTeam,
  longestLossStreak,
  longestStreak,
  outcomeFor,
  type Outcome,
} from "./results";

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

/** Rating-voorsprong die een tegenstanderteam tot "reus" maakt. */
export const REUZENDODER_DREMPEL = 50;

/** Puntenverschil vanaf wanneer een winst een "monsterzege" is. */
export const MONSTERZEGE_DREMPEL = 6;

/** Verliesreeks die de (ludieke) Pechvogel-badge oplevert. */
export const PECHVOGEL_DREMPEL = 5;

/** Verliezen op rij waarna een winst als "comeback" telt. */
export const COMEBACK_DREMPEL = 3;

/** Aantal verschillende partners voor de Sociale vlinder. */
export const SOCIALE_VLINDER_DOEL = 5;

/** Matches met dezelfde partner voor de Trouwe ziel. */
export const TROUWE_ZIEL_DOEL = 10;

/** Aantal matches op één dag voor de Marathonspeler. */
export const MARATHON_DOEL = 3;

const MIJLPALEN: Array<{ doel: number; naam: string; emoji: string }> = [
  { doel: 10, naam: "Vaste klant", emoji: "🏓" },
  { doel: 25, naam: "Veelspeler", emoji: "🎾" },
  { doel: 50, naam: "Halve honderd", emoji: "💪" },
  { doel: 100, naam: "Eeuwfeest", emoji: "💯" },
];

const REEKSEN: Array<{ doel: number; naam: string; emoji: string }> = [
  { doel: 3, naam: "Hattrick", emoji: "⚡" },
  { doel: 5, naam: "On fire", emoji: "🔥" },
  { doel: 10, naam: "Onstuitbaar", emoji: "🚀" },
];

/** Gemiddelde huidige rating van een team, of null zodra één rating ontbreekt. */
function teamRating(
  team: Team | undefined,
  ratings: Record<string, PlayerRating>,
): number | null {
  if (!team) return null;
  const r1 = ratings[team.player1_id]?.rating;
  const r2 = ratings[team.player2_id]?.rating;
  if (r1 == null || r2 == null) return null;
  return (r1 + r2) / 2;
}

/**
 * Won de speler ooit van een team dat gemiddeld minstens REUZENDODER_DREMPEL
 * rating hoger stond dan zijn eigen team?
 *
 * Bewuste benadering: we vergelijken met de HUIDIGE ratings, niet met de
 * ratings op het moment van de match. De historische rating per speler per
 * match zou vier extra rating_history-opzoekingen per match vragen; de
 * huidige stand is ruim goed genoeg voor een verzamelbadge. Ontbreekt een
 * rating (of zijn er geen ratings), dan telt die match gewoon niet mee.
 */
function isReuzendoder(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  ratings: Record<string, PlayerRating>,
): boolean {
  for (const m of matches) {
    if (outcomeFor(m, teams, playerId) !== "W") continue;
    const mineIsA = inTeam(teams[m.team_a_id], playerId);
    const mine = teamRating(teams[mineIsA ? m.team_a_id : m.team_b_id], ratings);
    const theirs = teamRating(teams[mineIsA ? m.team_b_id : m.team_a_id], ratings);
    if (mine == null || theirs == null) continue;
    if (theirs - mine >= REUZENDODER_DREMPEL) return true;
  }
  return false;
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

  const badges: Badge[] = [
    {
      id: "eerste-overwinning",
      naam: "Eerste overwinning",
      emoji: "🎉",
      omschrijving: "Win je allereerste match.",
      behaald: gewonnen >= 1,
    },
  ];

  for (const { doel, naam, emoji } of MIJLPALEN) {
    badges.push({
      id: `matches-${doel}`,
      naam,
      emoji,
      omschrijving: `Speel ${doel} matches.`,
      behaald: gespeeld >= doel,
      voortgang: { nu: gespeeld, doel },
    });
  }

  for (const { doel, naam, emoji } of REEKSEN) {
    badges.push({
      id: `reeks-${doel}`,
      naam,
      emoji,
      omschrijving: `Win ${doel} matches op rij.`,
      behaald: reeks >= doel,
      voortgang: { nu: reeks, doel },
    });
  }

  badges.push({
    id: "reuzendoder",
    naam: "Reuzendoder",
    emoji: "🗡️",
    omschrijving: `Klop een team met een gemiddelde rating die minstens ${REUZENDODER_DREMPEL} punten hoger ligt.`,
    behaald: ratings ? isReuzendoder(matches, teams, playerId, ratings) : false,
  });

  return badges;
}
