// Prestatiebadges, puur afgeleid uit de al geladen matches + teams (+ ratings).
// Geen extra tabellen of queries: alles wordt client-side berekend, net zoals
// de helpers in results.ts.

import type { Match, PlayerRating, Team } from "@/types";
import {
  inTeam,
  longestLossStreak,
  longestStreak,
  outcomeFor,
} from "@/features/rating/results";
import { matchDate, perfecteWeken, weekIndex } from "@/features/dashboard/missions";

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

/** Winsten met exact één punt verschil voor de Fotofinish. */
export const FOTOFINISH_DOEL = 3;

/** Verschillende maanden (van het jaar) waarin je speelde voor de Kalenderslokker. */
export const KALENDER_DOEL = 12;

/** Minimum aantal matches voor de perfect gebalanceerde Yin-yang. */
export const YINYANG_DOEL = 10;

/** Eigen game-score vanaf wanneer een winst "dubbele cijfers" haalt. */
export const DUBBELE_CIJFERS_DREMPEL = 10;

/** Rating waaronder je de (ludieke) Diepzeeduiker wordt. */
export const DIEPZEE_DREMPEL = 900;

/** Dagen zonder match voordat je De verloren zoon bent. */
export const VERLOREN_ZOON_DAGEN = 60;

/** Dagen rust waarna een winst meteen "Roestvrij" oplevert. */
export const ROESTVRIJ_DAGEN = 30;

/** Afwisselende winst/verlies-uitslagen op rij voor de Jojo. */
export const JOJO_DOEL = 6;

/** Gelijke spelen voor Neutraal als Zwitserland. */
export const ZWITSERLAND_DOEL = 5;

/** Opeenvolgende matches met exact dezelfde eindscore voor Déjà vu. */
export const DEJAVU_DOEL = 3;

/** Winsten met exact hetzelfde puntenverschil voor de Sniper. */
export const SNIPER_DOEL = 5;

/** Totaal aantal zelf gepakte games voor de Puntenmachine. */
export const PUNTENMACHINE_DOEL = 500;

/** Winsten op rij met dezelfde partner voor Tweelingzielen. */
export const TWEELING_DOEL = 5;

/** Verliezen op rij tegen één team dat dat team je "angstgegner" maakt. */
export const ANGSTGEGNER_DREMPEL = 5;

/** Matches met exact dezelfde starttijd (uur + minuut) voor Klokvast. */
export const KLOKVAST_DOEL = 10;

/** Opeenvolgende kalenderweken met minstens één match voor het Weekritme. */
export const WEEKRITME_DOEL = 5;

/** Maximale minuten tussen twee matchstarts voor Back-to-back. */
export const BACK_TO_BACK_MINUTEN = 90;

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

/** Perfecte weken (alle weekmissies van die week gehaald, #118). */
const PERFECTE_WEKEN: Array<{ doel: number; naam: string; emoji: string }> = [
  { doel: 1, naam: "Perfecte week", emoji: "🌠" },
  { doel: 10, naam: "Weekheld", emoji: "🦸" },
];

const MIJLPALEN: Array<{ doel: number; naam: string; emoji: string }> = [
  { doel: 10, naam: "Vaste klant", emoji: "🏓" },
  { doel: 25, naam: "Veelspeler", emoji: "🎾" },
  { doel: 50, naam: "Halve honderd", emoji: "💪" },
  { doel: 100, naam: "Eeuwfeest", emoji: "💯" },
  { doel: 200, naam: "Baanbewoner", emoji: "🏠" },
  { doel: 365, naam: "Jaarganger", emoji: "📅" },
  { doel: 500, naam: "Halve legende", emoji: "🗿" },
  { doel: 1000, naam: "Onsterfelijk", emoji: "🐢" },
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

/**
 * Won de speler ooit een match meteen ná minstens COMEBACK_DREMPEL verliezen
 * op rij? We lopen de afgewerkte matches chronologisch af en tellen de lopende
 * verliesreeks; een winst na een lange reeks is de comeback.
 */
function hadComeback(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  drempel: number = COMEBACK_DREMPEL,
): boolean {
  const chrono = [...matches].sort((a, b) =>
    (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at),
  );
  let verliezen = 0;
  for (const m of chrono) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    if (o === "W") {
      if (verliezen >= drempel) return true;
      verliezen = 0;
    } else if (o === "L") {
      verliezen++;
    } else {
      verliezen = 0; // gelijkspel breekt de reeks
    }
  }
  return false;
}

/**
 * Verloor de speler ooit van een team dat gemiddeld minstens
 * REUZENDODER_DREMPEL rating LAGER stond dan zijn eigen team? De omgekeerde
 * reuzendoder: een pijnlijke uitschuiver tegen een (op papier) zwakker team.
 */
function isGestruikeld(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  ratings: Record<string, PlayerRating>,
): boolean {
  for (const m of matches) {
    if (outcomeFor(m, teams, playerId) !== "L") continue;
    const mineIsA = inTeam(teams[m.team_a_id], playerId);
    const mine = teamRating(teams[mineIsA ? m.team_a_id : m.team_b_id], ratings);
    const theirs = teamRating(teams[mineIsA ? m.team_b_id : m.team_a_id], ratings);
    if (mine == null || theirs == null) continue;
    if (mine - theirs >= REUZENDODER_DREMPEL) return true;
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
  /** Speelde ooit op Halloween (31 oktober). */
  halloween: boolean;
  /** Speelde ooit op sinterklaas (5 december). */
  sinterklaas: boolean;
  /** Speelde ooit op een vrijdag de 13e. */
  vrijdag13: boolean;
  /** Speelde ooit op 29 februari (schrikkeldag). */
  schrikkeldag: boolean;
  /** Speelde ooit tussen 12 en 14 uur (lunchtijd). */
  lunch: boolean;
  /** Speelde ooit op een werkdag tussen 9 en 17 uur. */
  kantooruren: boolean;
  /** Aantal winsten met exact één punt verschil. */
  nagelbijterAantal: number;
  /** Won ooit een match waarin je 10+ games pakte. */
  dubbeleCijfers: boolean;
  /** Aantal verschillende maanden (van het jaar) waarin gespeeld werd. */
  maandenAantal: number;
  /** Speelde in december, januari én februari. */
  winterkoning: boolean;
  /** Speelde in alle vier de seizoenen. */
  vierSeizoenen: boolean;
  /** Meeste opeenvolgende kalenderweken met minstens één match. */
  maxWekenOpRij: number;
  /** Meeste matches met exact dezelfde starttijd (uur + minuut). */
  maxZelfdeStarttijd: number;
  /** Speelde ooit op oudejaarsdag (31 december). */
  oudejaar: boolean;
  /** Speelde ooit op Valentijnsdag (14 februari). */
  valentijn: boolean;
  /** Won ooit een match op 1 april. */
  aprilWinst: boolean;
  /** Speelde ooit op een palindroomdatum (dd-mm-jjjj, zoals 22-02-2022). */
  palindroomdag: boolean;
  /** Speelde ooit op één dag zowel vóór 12 uur als na 18 uur. */
  dubbeleDienst: boolean;
  /** Won én verloor ooit op dezelfde kalenderdag. */
  achtbaan: boolean;
  /** Startte ooit twee matches binnen BACK_TO_BACK_MINUTEN na elkaar. */
  backToBack: boolean;
  /** Totaal aantal zelf gepakte games (alle matches met score). */
  eigenGamesTotaal: number;
  /** Meeste winsten met exact hetzelfde puntenverschil. */
  maxZelfdeVerschilWinst: number;
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
  let halloween = false;
  let sinterklaas = false;
  let vrijdag13 = false;
  let schrikkeldag = false;
  let lunch = false;
  let kantooruren = false;
  let nagelbijterAantal = 0;
  let dubbeleCijfers = false;
  let oudejaar = false;
  let valentijn = false;
  let aprilWinst = false;
  let palindroomdag = false;
  let eigenGamesTotaal = 0;
  const perDag = new Map<
    string,
    { gespeeld: number; gewonnen: number; verloren: number; voor12: boolean; na18: boolean }
  >();
  const perPartner = new Map<string, number>();
  const perTegenstander = new Map<string, number>();
  const maanden = new Set<number>();
  const weken = new Set<number>();
  const perStarttijd = new Map<string, number>();
  const perVerschilWinst = new Map<number, number>();
  const tijdstippen: number[] = [];

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
      if (uur === 12 || uur === 13) lunch = true; // 12:00–13:59
      if (dag >= 1 && dag <= 5 && uur >= 9 && uur <= 16) kantooruren = true;
      const maand = d.getMonth();
      const datum = d.getDate();
      maanden.add(maand);
      if (maand >= 5 && maand <= 7) zomer = true; // juni, juli, augustus
      if (maand === 0 && datum === 1) nieuwjaar = true;
      if (maand === 11 && datum === 25) kerst = true;
      if (maand === 9 && datum === 31) halloween = true; // 31 oktober
      if (maand === 11 && datum === 5) sinterklaas = true; // 5 december
      if (maand === 1 && datum === 29) schrikkeldag = true; // 29 februari
      if (dag === 5 && datum === 13) vrijdag13 = true; // vrijdag de 13e
      if (maand === 11 && datum === 31) oudejaar = true;
      if (maand === 1 && datum === 14) valentijn = true;
      if (maand === 3 && datum === 1 && o === "W") aprilWinst = true; // 1 april
      const ddmmjjjj =
        `${String(datum).padStart(2, "0")}${String(maand + 1).padStart(2, "0")}` +
        String(d.getFullYear());
      if (ddmmjjjj === [...ddmmjjjj].reverse().join("")) palindroomdag = true;
      weken.add(weekIndex(d));
      const startKey = `${uur}:${d.getMinutes()}`;
      perStarttijd.set(startKey, (perStarttijd.get(startKey) ?? 0) + 1);
      tijdstippen.push(d.getTime());
      const key = `${d.getFullYear()}-${maand}-${datum}`;
      const dagRij =
        perDag.get(key) ??
        { gespeeld: 0, gewonnen: 0, verloren: 0, voor12: false, na18: false };
      dagRij.gespeeld += 1;
      if (o === "W") dagRij.gewonnen += 1;
      if (o === "L") dagRij.verloren += 1;
      if (uur < 12) dagRij.voor12 = true;
      if (uur >= 18) dagRij.na18 = true;
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
      eigenGamesTotaal += mij;
      if (o === "W") {
        if (verschil === 1) {
          nagelbijter = true;
          nagelbijterAantal++;
        }
        if (hen === 0 && mij > 0) {
          broodje = true;
          broodjeAantal++;
        }
        if (verschil >= MONSTERZEGE_DREMPEL) monsterzege = true;
        if (mij >= DUBBELE_CIJFERS_DREMPEL) dubbeleCijfers = true;
        perVerschilWinst.set(verschil, (perVerschilWinst.get(verschil) ?? 0) + 1);
      } else if (o === "L") {
        if (hen - mij === 1) verliesMet1 = true;
        if (mij === 0 && hen > 0) verliesZonderScore = true;
      }
    }
  }

  let perfecteDag = false;
  let rampdag = false;
  let dubbeleDienst = false;
  let achtbaan = false;
  for (const { gespeeld, gewonnen, verloren, voor12, na18 } of perDag.values()) {
    if (gespeeld >= MARATHON_DOEL && gewonnen === gespeeld) perfecteDag = true;
    if (gespeeld >= MARATHON_DOEL && gewonnen === 0) rampdag = true;
    if (voor12 && na18) dubbeleDienst = true;
    if (gewonnen > 0 && verloren > 0) achtbaan = true;
  }

  // Langste run van opeenvolgende kalenderweken met minstens één match.
  let maxWekenOpRij = 0;
  let wekenRun = 0;
  let vorigeWeek = Number.NaN;
  for (const w of [...weken].sort((a, b) => a - b)) {
    wekenRun = w === vorigeWeek + 1 ? wekenRun + 1 : 1;
    vorigeWeek = w;
    maxWekenOpRij = Math.max(maxWekenOpRij, wekenRun);
  }

  // Back-to-back: twee starts vlak na elkaar. Exact gelijke tijdstippen tellen
  // niet — dat is vrijwel altijd een gedeeld "aanmaakmoment" van rondes.
  tijdstippen.sort((a, b) => a - b);
  let backToBack = false;
  for (let i = 1; i < tijdstippen.length; i++) {
    const diff = tijdstippen[i] - tijdstippen[i - 1];
    if (diff > 0 && diff <= BACK_TO_BACK_MINUTEN * 60_000) backToBack = true;
  }

  const winterMaanden = [11, 0, 1]; // dec, jan, feb
  const seizoenen = [[2, 3, 4], [5, 6, 7], [8, 9, 10], winterMaanden];

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
    halloween,
    sinterklaas,
    vrijdag13,
    schrikkeldag,
    lunch,
    kantooruren,
    nagelbijterAantal,
    dubbeleCijfers,
    maandenAantal: maanden.size,
    winterkoning: winterMaanden.every((mnd) => maanden.has(mnd)),
    vierSeizoenen: seizoenen.every((s) => s.some((mnd) => maanden.has(mnd))),
    maxWekenOpRij,
    maxZelfdeStarttijd: Math.max(0, ...perStarttijd.values()),
    oudejaar,
    valentijn,
    aprilWinst,
    palindroomdag,
    dubbeleDienst,
    achtbaan,
    backToBack,
    eigenGamesTotaal,
    maxZelfdeVerschilWinst: Math.max(0, ...perVerschilWinst.values()),
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

/** Chronologisch gesorteerde kopie van de matches (op speeltijd). */
function chronologisch(matches: Match[]): Match[] {
  return [...matches].sort((a, b) =>
    (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at),
  );
}

/**
 * Langste reeks opeenvolgende matches met exact dezelfde eindscore, gezien
 * vanuit de speler (7-5 en daarna 5-7 verloren is dus niét hetzelfde).
 * Een match zonder score breekt de reeks.
 */
function dejaVuReeks(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): number {
  let vorige: string | null = null;
  let run = 0;
  let max = 0;
  for (const m of chronologisch(matches)) {
    if (!outcomeFor(m, teams, playerId)) continue;
    if (m.score_a == null || m.score_b == null) {
      vorige = null;
      run = 0;
      continue;
    }
    const inA = inTeam(teams[m.team_a_id], playerId);
    const score = inA ? `${m.score_a}-${m.score_b}` : `${m.score_b}-${m.score_a}`;
    run = score === vorige ? run + 1 : 1;
    vorige = score;
    max = Math.max(max, run);
  }
  return max;
}

/**
 * Langste reeks waarin winst en verlies elkaar strikt afwisselen (W-L-W-…).
 * Een gelijkspel breekt het ritme.
 */
function jojoReeks(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): number {
  let vorige: "W" | "L" | null = null;
  let run = 0;
  let max = 0;
  for (const m of chronologisch(matches)) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    if (o === "D") {
      vorige = null;
      run = 0;
      continue;
    }
    run = vorige != null && o !== vorige ? run + 1 : 1;
    vorige = o;
    max = Math.max(max, run);
  }
  return max;
}

/**
 * Rustpauzes tussen opeenvolgende matches: de langste kloof in dagen, plus of
 * er ooit meteen gewonnen werd na minstens ROESTVRIJ_DAGEN dagen stilte.
 */
function rustFeiten(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): { maxKloofDagen: number; winstNaRust: boolean } {
  let vorige: Date | null = null;
  let maxKloofDagen = 0;
  let winstNaRust = false;
  for (const m of chronologisch(matches)) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    const d = matchDate(m);
    if (!d) continue;
    if (vorige) {
      const dagen = (d.getTime() - vorige.getTime()) / 86_400_000;
      maxKloofDagen = Math.max(maxKloofDagen, Math.floor(dagen));
      if (dagen >= ROESTVRIJ_DAGEN && o === "W") winstNaRust = true;
    }
    vorige = d;
  }
  return { maxKloofDagen, winstNaRust };
}

/** Langste winstreeks met telkens exact dezelfde partner. */
function tweelingReeks(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): number {
  let vorigePartner: string | null = null;
  let run = 0;
  let max = 0;
  for (const m of chronologisch(matches)) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    const inA = inTeam(teams[m.team_a_id], playerId);
    const myTeam = inA ? teams[m.team_a_id] : teams[m.team_b_id];
    const partner = myTeam
      ? myTeam.player1_id === playerId
        ? myTeam.player2_id
        : myTeam.player1_id
      : null;
    if (o !== "W" || !partner) {
      vorigePartner = null;
      run = 0;
      continue;
    }
    run = partner === vorigePartner ? run + 1 : 1;
    vorigePartner = partner;
    max = Math.max(max, run);
  }
  return max;
}

/**
 * Versloeg de speler ooit een team waarvan hij daarvóór minstens
 * ANGSTGEGNER_DREMPEL keer op rij verloor? Een winst of gelijkspel tegen dat
 * team zet de teller weer op nul.
 */
function angstgegnerVerslagen(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): boolean {
  const verliesOpRij = new Map<string, number>();
  for (const m of chronologisch(matches)) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    const oppId = inTeam(teams[m.team_a_id], playerId) ? m.team_b_id : m.team_a_id;
    if (o === "L") {
      verliesOpRij.set(oppId, (verliesOpRij.get(oppId) ?? 0) + 1);
    } else {
      if (o === "W" && (verliesOpRij.get(oppId) ?? 0) >= ANGSTGEGNER_DREMPEL)
        return true;
      verliesOpRij.set(oppId, 0);
    }
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
  const dejaVu = dejaVuReeks(matches, teams, playerId);
  const jojo = jojoReeks(matches, teams, playerId);
  const rust = rustFeiten(matches, teams, playerId);
  const tweeling = tweelingReeks(matches, teams, playerId);

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
      omschrijving: "Speel een match gelijk — niemand die durft te winnen.",
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
      naam: "6-0 Droog",
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
      naam: "Drooglegger",
      emoji: "🥖",
      omschrijving: `Win ${BAGELBAKKER_DOEL} keer een match met 6-0.`,
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

  // 4) Nog een lading — ludiek, vreemd en (bijna) onmogelijk. Negatieve eerst,
  //    de knapste achteraan.
  badges.push(
    {
      id: "struikelaar",
      naam: "Struikelaar",
      emoji: "🍌",
      omschrijving: `Verlies van een team dat gemiddeld minstens ${REUZENDODER_DREMPEL} punten lager staat — de omgekeerde reuzendoder.`,
      behaald: ratings ? isGestruikeld(matches, teams, playerId, ratings) : false,
    },
    {
      id: "lunchmatch",
      naam: "Lunchmatch",
      emoji: "🥪",
      omschrijving: "Speel een match tussen 12 en 14 uur — padel als middagpauze.",
      behaald: feiten.lunch,
    },
    {
      id: "spijbelaar",
      naam: "Spijbelaar",
      emoji: "🕴️",
      omschrijving: "Speel op een werkdag tussen 9 en 17 uur. Was je niet aan het werk?",
      behaald: feiten.kantooruren,
    },
    {
      id: "halloweenspook",
      naam: "Halloweenspook",
      emoji: "👻",
      omschrijving: "Speel een match op Halloween (31 oktober).",
      behaald: feiten.halloween,
    },
    {
      id: "sinterklaas",
      naam: "Sinterklaas",
      emoji: "🎁",
      omschrijving: "Speel een match op sinterklaas (5 december).",
      behaald: feiten.sinterklaas,
    },
    {
      id: "vrijdag-de-13e",
      naam: "Vrijdag de 13e",
      emoji: "🐈‍⬛",
      omschrijving: "Tart het lot: speel een match op een vrijdag de 13e.",
      behaald: feiten.vrijdag13,
    },
    {
      id: "schrikkelspringer",
      naam: "Schrikkelspringer",
      emoji: "🐸",
      omschrijving: "Speel op 29 februari — dat kan maar eens in de vier jaar.",
      behaald: feiten.schrikkeldag,
    },
    {
      id: "dubbele-cijfers",
      naam: "Dubbele cijfers",
      emoji: "🔢",
      omschrijving: `Win een match waarin je minstens ${DUBBELE_CIJFERS_DREMPEL} games pakt.`,
      behaald: feiten.dubbeleCijfers,
    },
    {
      id: "fotofinish",
      naam: "Fotofinish",
      emoji: "📸",
      omschrijving: `Win ${FOTOFINISH_DOEL} matches met exact één punt verschil.`,
      behaald: feiten.nagelbijterAantal >= FOTOFINISH_DOEL,
      voortgang: { nu: feiten.nagelbijterAantal, doel: FOTOFINISH_DOEL },
    },
    {
      id: "yin-yang",
      naam: "Yin-yang",
      emoji: "☯️",
      omschrijving: `Sta na minstens ${YINYANG_DOEL} matches op exact evenveel winst als verlies.`,
      behaald: gespeeld >= YINYANG_DOEL && gewonnen === verloren,
    },
    {
      id: "kalenderslokker",
      naam: "Kalenderslokker",
      emoji: "🗓️",
      omschrijving: `Speel in alle ${KALENDER_DOEL} maanden van het jaar.`,
      behaald: feiten.maandenAantal >= KALENDER_DOEL,
      voortgang: { nu: feiten.maandenAantal, doel: KALENDER_DOEL },
    },
    {
      id: "feniks",
      naam: "Feniks",
      emoji: "🐦‍🔥",
      omschrijving: `Herrijs uit de as: win een match ná ${PECHVOGEL_DREMPEL} verliezen op rij.`,
      behaald: hadComeback(matches, teams, playerId, PECHVOGEL_DREMPEL),
    },
  );

  // 5) De nieuwe lading (#119) — zelfde afspraak: pech en tegenslag eerst, de
  //    knapste prestaties achteraan zodat die bovenaan de deel-kaart komen.
  badges.push(
    {
      id: "diepzeeduiker",
      naam: "Diepzeeduiker",
      emoji: "🤿",
      omschrijving: `Zak onder een rating van ${DIEPZEE_DREMPEL} — vanaf hier kan het alleen beter.`,
      behaald: eigenRating != null && eigenRating < DIEPZEE_DREMPEL,
    },
    {
      id: "verloren-zoon",
      naam: "De verloren zoon",
      emoji: "🐐",
      omschrijving: `Sta weer op de baan na minstens ${VERLOREN_ZOON_DAGEN} dagen zonder match.`,
      behaald: rust.maxKloofDagen >= VERLOREN_ZOON_DAGEN,
    },
    {
      id: "achtbaan",
      naam: "Achtbaan",
      emoji: "🎢",
      omschrijving: "Win én verlies een match op dezelfde dag.",
      behaald: feiten.achtbaan,
    },
    {
      id: "jojo",
      naam: "Jojo",
      emoji: "🪀",
      omschrijving: `Wissel ${JOJO_DOEL} matches lang telkens winst en verlies af.`,
      behaald: jojo >= JOJO_DOEL,
      voortgang: { nu: jojo, doel: JOJO_DOEL },
    },
    // Tijd & kalender.
    {
      id: "valentijnsdate",
      naam: "Valentijnsdate",
      emoji: "💘",
      omschrijving: "Speel op Valentijn — je racket is toch je enige date.",
      behaald: feiten.valentijn,
    },
    {
      id: "oudejaarsknaller",
      naam: "Oudejaarsknaller",
      emoji: "🧨",
      omschrijving: "Sluit het jaar af met een match op 31 december.",
      behaald: feiten.oudejaar,
    },
    {
      id: "geen-grap",
      naam: "Geen grap",
      emoji: "🃏",
      omschrijving: "Win een match op 1 april — echt waar.",
      behaald: feiten.aprilWinst,
    },
    {
      id: "palindroomdag",
      naam: "Palindroomdag",
      emoji: "🪞",
      omschrijving: "Speel op een palindroomdatum, zoals 22-02-2022.",
      behaald: feiten.palindroomdag,
    },
    {
      id: "winterkoning",
      naam: "Winterkoning",
      emoji: "🥶",
      omschrijving: "Trotseer de kou: speel in december, januari én februari.",
      behaald: feiten.winterkoning,
    },
    {
      id: "dubbele-dienst",
      naam: "Dubbele dienst",
      emoji: "🌗",
      omschrijving: "Speel op één dag zowel vóór 12 uur als na 18 uur.",
      behaald: feiten.dubbeleDienst,
    },
    {
      id: "back-to-back",
      naam: "Back-to-back",
      emoji: "⏱️",
      omschrijving: `Start twee matches binnen ${BACK_TO_BACK_MINUTEN} minuten na elkaar.`,
      behaald: feiten.backToBack,
    },
    {
      id: "klokvast",
      naam: "Klokvast",
      emoji: "🕰️",
      omschrijving: `Speel ${KLOKVAST_DOEL} matches met exact dezelfde starttijd.`,
      behaald: feiten.maxZelfdeStarttijd >= KLOKVAST_DOEL,
      voortgang: { nu: feiten.maxZelfdeStarttijd, doel: KLOKVAST_DOEL },
    },
    {
      id: "weekritme",
      naam: "Weekritme",
      emoji: "📆",
      omschrijving: `Speel ${WEEKRITME_DOEL} weken op rij minstens één match.`,
      behaald: feiten.maxWekenOpRij >= WEEKRITME_DOEL,
      voortgang: { nu: feiten.maxWekenOpRij, doel: WEEKRITME_DOEL },
    },
    {
      id: "vier-seizoenen",
      naam: "Vier seizoenen",
      emoji: "🍂",
      omschrijving: "Speel in de lente, de zomer, de herfst én de winter.",
      behaald: feiten.vierSeizoenen,
    },
    // Zeldzaam & knap — de zwaarste achteraan.
    {
      id: "neutraal-zwitserland",
      naam: "Neutraal als Zwitserland",
      emoji: "🇨🇭",
      omschrijving: `Speel ${ZWITSERLAND_DOEL} keer gelijk.`,
      behaald: feiten.gelijk >= ZWITSERLAND_DOEL,
      voortgang: { nu: feiten.gelijk, doel: ZWITSERLAND_DOEL },
    },
    {
      id: "deja-vu",
      naam: "Déjà vu",
      emoji: "🔁",
      omschrijving: `Speel ${DEJAVU_DOEL} matches op rij met exact dezelfde eindscore.`,
      behaald: dejaVu >= DEJAVU_DOEL,
    },
    {
      id: "roestvrij",
      naam: "Roestvrij",
      emoji: "🦾",
      omschrijving: `Win meteen je eerste match na minstens ${ROESTVRIJ_DAGEN} dagen pauze.`,
      behaald: rust.winstNaRust,
    },
    {
      id: "sniper",
      naam: "Sniper",
      emoji: "🏹",
      omschrijving: `Win ${SNIPER_DOEL} matches met exact hetzelfde puntenverschil.`,
      behaald: feiten.maxZelfdeVerschilWinst >= SNIPER_DOEL,
      voortgang: { nu: feiten.maxZelfdeVerschilWinst, doel: SNIPER_DOEL },
    },
    {
      id: "puntenmachine",
      naam: "Puntenmachine",
      emoji: "🧮",
      omschrijving: `Pak in totaal ${PUNTENMACHINE_DOEL} games over al je matches.`,
      behaald: feiten.eigenGamesTotaal >= PUNTENMACHINE_DOEL,
      voortgang: { nu: feiten.eigenGamesTotaal, doel: PUNTENMACHINE_DOEL },
    },
    {
      id: "tweelingzielen",
      naam: "Tweelingzielen",
      emoji: "👯",
      omschrijving: `Win ${TWEELING_DOEL} matches op rij met dezelfde partner.`,
      behaald: tweeling >= TWEELING_DOEL,
      voortgang: { nu: tweeling, doel: TWEELING_DOEL },
    },
    {
      id: "angstgegner",
      naam: "Angstgegner verslagen",
      emoji: "😈",
      omschrijving: `Versla een team waarvan je eerst ${ANGSTGEGNER_DREMPEL} keer op rij verloor.`,
      behaald: angstgegnerVerslagen(matches, teams, playerId),
    },
  );

  // 6) Perfecte weken: alle weekmissies (missions.ts) van één week gehaald.
  //    Telt over de aangeleverde matches, zoals elke afgeleide badge.
  const perfect = perfecteWeken(matches, teams, playerId);
  for (const { doel, naam, emoji } of PERFECTE_WEKEN) {
    badges.push({
      id: `perfecte-weken-${doel}`,
      naam,
      emoji,
      omschrijving:
        doel === 1
          ? "Haal in één week álle weekmissies — een perfecte week."
          : `Haal ${doel} perfecte weken.`,
      behaald: perfect >= doel,
      voortgang: { nu: perfect, doel },
    });
  }

  // 7) Rating-mijlpalen (oplopend; "Levende legende" sluit de rij — de zeldzaamste).
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
