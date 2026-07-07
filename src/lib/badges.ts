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

/** Verliezen op rij voor de (extreme) Zwarte reeks. */
export const ZWARTE_REEKS_DREMPEL = 10;

/** Matches met een vlekkeloze 100%-winst voor de Perfectionist. */
export const PERFECTIONIST_DOEL = 10;

/** Matches op één dag voor de (extreme) Ironman. */
export const IRONMAN_DOEL = 5;

/** Nachtmatches (na 22u) voor de Nachtwacht. */
export const NACHTWACHT_DOEL = 3;

/** Broodjes bal (6-0-winsten) voor de Bagelbakker. */
export const BAGELBAKKER_DOEL = 3;

/** Duels tegen hetzelfde team voor de Vaste rivaal. */
export const RIVAAL_DOEL = 10;

const WINSTEN: Array<{ doel: number; naam: string; emoji: string }> = [
  { doel: 25, naam: "Winnaarstype", emoji: "🏅" },
  { doel: 50, naam: "Halve eeuw zeges", emoji: "🏆" },
  { doel: 100, naam: "Honderd zeges", emoji: "🏛️" },
];

const RATINGTIERS: Array<{ drempel: number; naam: string; emoji: string }> = [
  { drempel: 1100, naam: "Gevestigde waarde", emoji: "📈" },
  { drempel: 1200, naam: "Grootmeester", emoji: "🧠" },
  { drempel: 1300, naam: "Levende legende", emoji: "👑" },
];

const MIJLPALEN: Array<{ doel: number; naam: string; emoji: string }> = [
  { doel: 10, naam: "Vaste klant", emoji: "🏓" },
  { doel: 25, naam: "Veelspeler", emoji: "🎾" },
  { doel: 50, naam: "Halve honderd", emoji: "💪" },
  { doel: 100, naam: "Eeuwfeest", emoji: "💯" },
  { doel: 200, naam: "Baanbewoner", emoji: "🏠" },
  { doel: 365, naam: "Jaarganger", emoji: "📅" },
];

const REEKSEN: Array<{ doel: number; naam: string; emoji: string }> = [
  { doel: 3, naam: "Hattrick", emoji: "⚡" },
  { doel: 5, naam: "On fire", emoji: "🔥" },
  { doel: 10, naam: "Onstuitbaar", emoji: "🚀" },
  { doel: 20, naam: "Onaanraakbaar", emoji: "🛡️" },
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
  /** Speelde ooit op een maandag. */
  maandag: boolean;
  /** Speelde ooit op vrijdagavond (na 18u). */
  vrijdagavond: boolean;
  /** Speelde ooit in de zomer (juni t/m augustus). */
  zomer: boolean;
  /** Speelde ooit op nieuwjaarsdag. */
  nieuwjaar: boolean;
  /** Speelde ooit op eerste kerstdag. */
  kerst: boolean;
  /** Speelde ooit tussen middernacht en 5 uur 's nachts. */
  naMiddernacht: boolean;
  /** Verloor ooit met exact 1 punt verschil. */
  verliesMet1: boolean;
  /** Verloor ooit zonder zelf een game te pakken. */
  verliesZonderScore: boolean;
  /** Won ooit álle matches op een dag met minstens 3 partijen. */
  perfecteDag: boolean;
  /** Verloor ooit álle matches op een dag met minstens 3 partijen. */
  rampdag: boolean;
  /** Aantal matches gespeeld ná 22 uur. */
  nachtAantal: number;
  /** Aantal keer gewonnen zonder de tegenstander een game te gunnen. */
  broodjeAantal: number;
  /** Meeste matches tegen hetzelfde tegenstanderteam. */
  maxTegenstander: number;
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
  let maandag = false;
  let vrijdagavond = false;
  let zomer = false;
  let nieuwjaar = false;
  let kerst = false;
  let naMiddernacht = false;
  let verliesMet1 = false;
  let verliesZonderScore = false;
  let nachtAantal = 0;
  let broodjeAantal = 0;
  const perDag = new Map<string, { gespeeld: number; gewonnen: number }>();
  const perPartner = new Map<string, number>();
  const perTegenstander = new Map<string, number>();

  for (const m of matches) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    if (o === "D") gelijk++;

    const d = matchDate(m);
    if (d) {
      const dag = d.getDay(); // 0 = zondag, 6 = zaterdag
      if (dag === 0 || dag === 6) weekend = true;
      if (dag === 1) maandag = true;
      const uur = d.getHours();
      if (uur >= 22) {
        nacht = true;
        nachtAantal++;
      }
      if (uur < 8) vroeg = true;
      if (uur < 5) naMiddernacht = true;
      if (dag === 5 && uur >= 18) vrijdagavond = true;
      const maand = d.getMonth();
      const datum = d.getDate();
      if (maand >= 5 && maand <= 7) zomer = true; // juni, juli, augustus
      if (maand === 0 && datum === 1) nieuwjaar = true;
      if (maand === 11 && datum === 25) kerst = true;
      const key = `${d.getFullYear()}-${maand}-${datum}`;
      const dagRij = perDag.get(key) ?? { gespeeld: 0, gewonnen: 0 };
      dagRij.gespeeld += 1;
      if (o === "W") dagRij.gewonnen += 1;
      perDag.set(key, dagRij);
    }

    // Partner = de medespeler in het eigen team; tegenstander = het andere team.
    const inA = inTeam(teams[m.team_a_id], playerId);
    const myTeam = inA ? teams[m.team_a_id] : teams[m.team_b_id];
    if (myTeam) {
      const partnerId =
        myTeam.player1_id === playerId ? myTeam.player2_id : myTeam.player1_id;
      perPartner.set(partnerId, (perPartner.get(partnerId) ?? 0) + 1);
    }
    const oppId = inA ? m.team_b_id : m.team_a_id;
    perTegenstander.set(oppId, (perTegenstander.get(oppId) ?? 0) + 1);

    // Score-afhankelijke prestaties: alleen als beide scores ingevuld zijn.
    if (m.score_a != null && m.score_b != null) {
      const mij = inA ? m.score_a : m.score_b;
      const hen = inA ? m.score_b : m.score_a;
      const verschil = mij - hen;
      if (o === "W") {
        if (verschil === 1) nagelbijter = true;
        if (hen === 0 && mij > 0) {
          broodje = true;
          broodjeAantal++;
        }
        if (verschil >= MONSTERZEGE_DREMPEL) monsterzege = true;
      } else if (o === "L") {
        if (hen - mij === 1) verliesMet1 = true;
        if (mij === 0 && hen > 0) verliesZonderScore = true;
      }
    }
  }

  let perfecteDag = false;
  let rampdag = false;
  for (const { gespeeld, gewonnen } of perDag.values()) {
    if (gespeeld >= MARATHON_DOEL && gewonnen === gespeeld) perfecteDag = true;
    if (gespeeld >= MARATHON_DOEL && gewonnen === 0) rampdag = true;
  }

  return {
    gelijk,
    weekend,
    nacht,
    vroeg,
    maxPerDag: Math.max(0, ...[...perDag.values()].map((r) => r.gespeeld)),
    nagelbijter,
    broodje,
    monsterzege,
    partners: perPartner.size,
    maxZelfdePartner: Math.max(0, ...perPartner.values()),
    maandag,
    vrijdagavond,
    zomer,
    nieuwjaar,
    kerst,
    naMiddernacht,
    verliesMet1,
    verliesZonderScore,
    perfecteDag,
    rampdag,
    nachtAantal,
    broodjeAantal,
    maxTegenstander: Math.max(0, ...perTegenstander.values()),
  };
}

/**
 * Versloeg de speler ooit een tegenstanderteam waarvan hij eerder verloor?
 * Chronologisch: we onthouden tegen welke teams we al verloren; een latere
 * winst tegen zo'n team is de revanche.
 */
function hadRevanche(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): boolean {
  const chrono = [...matches].sort((a, b) =>
    (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at),
  );
  const verlorenTegen = new Set<string>();
  for (const m of chrono) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    const oppId = inTeam(teams[m.team_a_id], playerId) ? m.team_b_id : m.team_a_id;
    if (o === "L") verlorenTegen.add(oppId);
    else if (o === "W" && verlorenTegen.has(oppId)) return true;
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
  const pech = longestLossStreak(matches, teams, playerId);
  const feiten = verzamelFeiten(matches, teams, playerId);
  const verloren = gespeeld - gewonnen - feiten.gelijk;
  const eigenRating = ratings?.[playerId]?.rating ?? null;

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

  for (const { doel, naam, emoji } of WINSTEN) {
    badges.push({
      id: `winsten-${doel}`,
      naam,
      emoji,
      omschrijving: `Win ${doel} matches in totaal.`,
      behaald: gewonnen >= doel,
      voortgang: { nu: gewonnen, doel },
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

  // Nog een lading badges — ludiek, zeldzaam en een paar extreme. Allemaal puur
  // afgeleid uit de al geladen matches (uitslag, tijdstip, score, partner,
  // tegenstander, rating). Volgorde-afspraak: negatieve/pech-badges eerst en de
  // indrukwekkendste achteraan, want de deel-kaart toont de laatst behaalde.

  // 1) Pech & tegenslag (bewust vooraan zodat ze nooit het "hoogtepunt" zijn).
  badges.push(
    {
      id: "hartverscheurend",
      naam: "Hartverscheurend",
      emoji: "💔",
      omschrijving: "Verlies een match met exact één punt verschil.",
      behaald: feiten.verliesMet1,
    },
    {
      id: "afgedroogd",
      naam: "Afgedroogd",
      emoji: "🧽",
      omschrijving: "Verlies een match zonder zelf één game te pakken — au.",
      behaald: feiten.verliesZonderScore,
    },
    {
      id: "rampdag",
      naam: "Rampdag",
      emoji: "🌪️",
      omschrijving: `Verlies álle matches op een dag met minstens ${MARATHON_DOEL} partijen.`,
      behaald: feiten.rampdag,
    },
    {
      id: "zwarte-reeks",
      naam: "Zwarte reeks",
      emoji: "🕳️",
      omschrijving: `Verlies ${ZWARTE_REEKS_DREMPEL} matches op rij — dieper kan bijna niet.`,
      behaald: pech >= ZWARTE_REEKS_DREMPEL,
      voortgang: { nu: pech, doel: ZWARTE_REEKS_DREMPEL },
    },
  );

  // 2) Tijd, seizoen & feestdagen (ludiek).
  badges.push(
    {
      id: "debutant",
      naam: "Debutant",
      emoji: "🐣",
      omschrijving: "Speel je allereerste match — welkom op de baan.",
      behaald: gespeeld >= 1,
    },
    {
      id: "maandagmatch",
      naam: "Maandagmatch",
      emoji: "☕",
      omschrijving: "Trap de week af met een match op maandag.",
      behaald: feiten.maandag,
    },
    {
      id: "vrijdagborrel",
      naam: "Vrijdagborrel",
      emoji: "🍻",
      omschrijving: "Speel een match op vrijdagavond (na 18 uur).",
      behaald: feiten.vrijdagavond,
    },
    {
      id: "zomerkoning",
      naam: "Zomerkoning",
      emoji: "☀️",
      omschrijving: "Speel een match in de zomer (juni t/m augustus).",
      behaald: feiten.zomer,
    },
    {
      id: "nachtmens",
      naam: "Nachtmens",
      emoji: "🌙",
      omschrijving: "Sla een bal tussen middernacht en 5 uur 's nachts.",
      behaald: feiten.naMiddernacht,
    },
    {
      id: "nachtwacht",
      naam: "Nachtwacht",
      emoji: "🌃",
      omschrijving: `Speel ${NACHTWACHT_DOEL} matches ná 22 uur.`,
      behaald: feiten.nachtAantal >= NACHTWACHT_DOEL,
      voortgang: { nu: feiten.nachtAantal, doel: NACHTWACHT_DOEL },
    },
    {
      id: "nieuwjaarsduik",
      naam: "Nieuwjaarsduik",
      emoji: "🎆",
      omschrijving: "Begin het jaar sportief: speel op nieuwjaarsdag.",
      behaald: feiten.nieuwjaar,
    },
    {
      id: "kerstengel",
      naam: "Kerstengel",
      emoji: "🎄",
      omschrijving: "Ruil de kalkoen voor het racket op eerste kerstdag.",
      behaald: feiten.kerst,
    },
  );

  // 3) Zeldzame & knappe prestaties (oplopend naar de zwaarste; die staan
  //    achteraan zodat ze bovenaan de deel-kaart komen).
  badges.push(
    {
      id: "allrounder",
      naam: "Allrounder",
      emoji: "🎭",
      omschrijving: "Boek minstens één winst, één verlies én één gelijkspel.",
      behaald: gewonnen >= 1 && verloren >= 1 && feiten.gelijk >= 1,
    },
    {
      id: "bagelbakker",
      naam: "Bagelbakker",
      emoji: "🥖",
      omschrijving: `Deel ${BAGELBAKKER_DOEL} keer een "broodje bal" uit (6-0-winst).`,
      behaald: feiten.broodjeAantal >= BAGELBAKKER_DOEL,
      voortgang: { nu: feiten.broodjeAantal, doel: BAGELBAKKER_DOEL },
    },
    {
      id: "vaste-rivaal",
      naam: "Vaste rivaal",
      emoji: "🎯",
      omschrijving: `Speel ${RIVAAL_DOEL} keer tegen hetzelfde team.`,
      behaald: feiten.maxTegenstander >= RIVAAL_DOEL,
      voortgang: { nu: feiten.maxTegenstander, doel: RIVAAL_DOEL },
    },
    {
      id: "revanche",
      naam: "Revanche",
      emoji: "⚔️",
      omschrijving: "Versla een team waarvan je eerder verloor — koud opgediend.",
      behaald: hadRevanche(matches, teams, playerId),
    },
    {
      id: "ironman",
      naam: "Ironman",
      emoji: "🏋️",
      omschrijving: `Speel ${IRONMAN_DOEL} matches op één dag — ijzeren conditie.`,
      behaald: feiten.maxPerDag >= IRONMAN_DOEL,
      voortgang: { nu: feiten.maxPerDag, doel: IRONMAN_DOEL },
    },
    {
      id: "perfecte-dag",
      naam: "Perfecte dag",
      emoji: "🌟",
      omschrijving: `Win álle matches op een dag waarop je er minstens ${MARATHON_DOEL} speelde.`,
      behaald: feiten.perfecteDag,
    },
    {
      id: "perfectionist",
      naam: "Perfectionist",
      emoji: "💎",
      omschrijving: `Speel minstens ${PERFECTIONIST_DOEL} matches en verlies er geen enkele.`,
      behaald: gespeeld >= PERFECTIONIST_DOEL && gewonnen === gespeeld,
    },
  );

  // 4) Rating-mijlpalen (oplopend; "Levende legende" sluit de rij — de zeldzaamste).
  for (const { drempel, naam, emoji } of RATINGTIERS) {
    badges.push({
      id: `rating-${drempel}`,
      naam,
      emoji,
      omschrijving: `Bereik een rating van ${drempel}.`,
      behaald: eigenRating != null && eigenRating >= drempel,
      voortgang:
        eigenRating != null
          ? { nu: Math.round(eigenRating), doel: drempel }
          : undefined,
    });
  }

  return badges;
}
