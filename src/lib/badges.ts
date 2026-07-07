// Prestatiebadges, puur afgeleid uit de al geladen matches + teams (+ ratings).
// Geen extra tabellen of queries: alles wordt client-side berekend, net zoals
// de helpers in results.ts.

import type { Match, PlayerRating, Team } from "./types";
import {
  inTeam,
  longestLossStreak,
  longestStreak,
  outcomeFor,
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

/** Puntenverschil vanaf wanneer een winst een "monsterzege" is. Bewust lager
 *  dan een volledige 6-0 (dat is al Broodje bal): 6-2 / 6-1 telt ook. */
export const MONSTERZEGE_DREMPEL = 4;

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

/** Tijdstip van een match als Date, of null bij een onbruikbare datum. */
function matchDate(m: Match): Date | null {
  const raw = m.played_at ?? m.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Won de speler ooit een match meteen ná minstens COMEBACK_DREMPEL verliezen
 * op rij? We lopen de afgewerkte matches chronologisch af en tellen de lopende
 * verliesreeks; een winst na een lange reeks is de comeback.
 */
function hadComeback(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): boolean {
  const chrono = [...matches].sort((a, b) =>
    (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at),
  );
  let verliezen = 0;
  for (const m of chrono) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    if (o === "W") {
      if (verliezen >= COMEBACK_DREMPEL) return true;
      verliezen = 0;
    } else if (o === "L") {
      verliezen++;
    } else {
      verliezen = 0; // gelijkspel breekt de reeks
    }
  }
  return false;
}

/** Verzamelde feiten uit één doorloop van de matches, voor de "leuke" badges. */
interface MatchFeiten {
  gelijk: number;
  weekend: boolean;
  nacht: boolean;
  vroeg: boolean;
  /** Meeste afgewerkte matches op één kalenderdag. */
  maxPerDag: number;
  /** Won ooit met exact 1 punt verschil (scores nodig). */
  nagelbijter: boolean;
  /** Won ooit zonder de tegenstander een game te gunnen. */
  broodje: boolean;
  /** Won ooit met minstens MONSTERZEGE_DREMPEL punten verschil. */
  monsterzege: boolean;
  /** Aantal verschillende partners. */
  partners: number;
  /** Meeste matches met eenzelfde partner. */
  maxZelfdePartner: number;
}

function verzamelFeiten(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): MatchFeiten {
  let gelijk = 0;
  let weekend = false;
  let nacht = false;
  let vroeg = false;
  let nagelbijter = false;
  let broodje = false;
  let monsterzege = false;
  const perDag = new Map<string, number>();
  const perPartner = new Map<string, number>();

  for (const m of matches) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    if (o === "D") gelijk++;

    const d = matchDate(m);
    if (d) {
      const dag = d.getDay(); // 0 = zondag, 6 = zaterdag
      if (dag === 0 || dag === 6) weekend = true;
      const uur = d.getHours();
      if (uur >= 22) nacht = true;
      if (uur < 8) vroeg = true;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      perDag.set(key, (perDag.get(key) ?? 0) + 1);
    }

    // Partner = de medespeler in het eigen team.
    const myTeam = inTeam(teams[m.team_a_id], playerId)
      ? teams[m.team_a_id]
      : teams[m.team_b_id];
    if (myTeam) {
      const partnerId =
        myTeam.player1_id === playerId ? myTeam.player2_id : myTeam.player1_id;
      perPartner.set(partnerId, (perPartner.get(partnerId) ?? 0) + 1);
    }

    // Score-afhankelijke prestaties: alleen als beide scores ingevuld zijn.
    if (o === "W" && m.score_a != null && m.score_b != null) {
      const mij = inTeam(teams[m.team_a_id], playerId) ? m.score_a : m.score_b;
      const hen = inTeam(teams[m.team_a_id], playerId) ? m.score_b : m.score_a;
      const verschil = mij - hen;
      if (verschil === 1) nagelbijter = true;
      if (hen === 0 && mij > 0) broodje = true;
      if (verschil >= MONSTERZEGE_DREMPEL) monsterzege = true;
    }
  }

  return {
    gelijk,
    weekend,
    nacht,
    vroeg,
    maxPerDag: Math.max(0, ...perDag.values()),
    nagelbijter,
    broodje,
    monsterzege,
    partners: perPartner.size,
    maxZelfdePartner: Math.max(0, ...perPartner.values()),
  };
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

  // Extra badges — een mix van serieuze prestaties en ludieke mijlpalen.
  // Bewust ná de reuzendoder: de deel-kaart toont de laatst behaalde badge, dus
  // de "zwaardere" prestaties staan achteraan zodat die bovenaan komen.
  badges.push(
    {
      id: "diplomaat",
      naam: "Diplomaat",
      emoji: "🤝",
      omschrijving: "Speel een match gelijk — soms is delen ook winnen.",
      behaald: feiten.gelijk >= 1,
    },
    {
      id: "weekendstrijder",
      naam: "Weekendstrijder",
      emoji: "🏖️",
      omschrijving: "Speel een match in het weekend.",
      behaald: feiten.weekend,
    },
    {
      id: "vroege-vogel",
      naam: "Vroege vogel",
      emoji: "🐓",
      omschrijving: "Speel een match vóór 8 uur 's ochtends.",
      behaald: feiten.vroeg,
    },
    {
      id: "nachtbraker",
      naam: "Nachtbraker",
      emoji: "🦉",
      omschrijving: "Speel een match ná 22 uur 's avonds.",
      behaald: feiten.nacht,
    },
    {
      id: "marathonspeler",
      naam: "Marathonspeler",
      emoji: "🥵",
      omschrijving: `Speel ${MARATHON_DOEL} matches op één dag.`,
      behaald: feiten.maxPerDag >= MARATHON_DOEL,
      voortgang: { nu: feiten.maxPerDag, doel: MARATHON_DOEL },
    },
    {
      id: "pechvogel",
      naam: "Pechvogel",
      emoji: "☔",
      omschrijving: `Verlies ${PECHVOGEL_DREMPEL} matches op rij — ook dat is een prestatie.`,
      behaald: pech >= PECHVOGEL_DREMPEL,
      voortgang: { nu: pech, doel: PECHVOGEL_DREMPEL },
    },
    {
      id: "nagelbijter",
      naam: "Nagelbijter",
      emoji: "😬",
      omschrijving: "Win een match met exact één punt verschil.",
      behaald: feiten.nagelbijter,
    },
    {
      id: "broodje-bal",
      naam: "Broodje bal",
      emoji: "🥯",
      omschrijving: "Win een match zonder de tegenstander één game te gunnen.",
      behaald: feiten.broodje,
    },
    {
      id: "sociale-vlinder",
      naam: "Sociale vlinder",
      emoji: "🦋",
      omschrijving: `Speel met ${SOCIALE_VLINDER_DOEL} verschillende partners.`,
      behaald: feiten.partners >= SOCIALE_VLINDER_DOEL,
      voortgang: { nu: feiten.partners, doel: SOCIALE_VLINDER_DOEL },
    },
    {
      id: "trouwe-ziel",
      naam: "Trouwe ziel",
      emoji: "💞",
      omschrijving: `Speel ${TROUWE_ZIEL_DOEL} matches met dezelfde partner.`,
      behaald: feiten.maxZelfdePartner >= TROUWE_ZIEL_DOEL,
      voortgang: { nu: feiten.maxZelfdePartner, doel: TROUWE_ZIEL_DOEL },
    },
    {
      id: "comebackkoning",
      naam: "Comebackkoning",
      emoji: "👑",
      omschrijving: `Win een match meteen na ${COMEBACK_DREMPEL} verliezen op rij.`,
      behaald: hadComeback(matches, teams, playerId),
    },
    {
      id: "monsterzege",
      naam: "Monsterzege",
      emoji: "🦖",
      omschrijving: `Win een match met minstens ${MONSTERZEGE_DREMPEL} punten verschil.`,
      behaald: feiten.monsterzege,
    },
  );

  return badges;
}
