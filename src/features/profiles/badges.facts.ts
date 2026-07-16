// Verzamelt in één doorloop alle feiten uit de matches voor de badges.
import { BACK_TO_BACK_MINUTEN, DUBBELE_CIJFERS_DREMPEL, MARATHON_DOEL, MONSTERZEGE_DREMPEL } from "./badges.constants";
import { matchDate, weekIndex } from "@/features/dashboard/missions";
import { inTeam, outcomeFor } from "@/features/rating/results";
import type { Match, Team } from "@/types";

/** Verzamelde feiten uit één doorloop van de matches, voor de "leuke" badges. */
export interface MatchFeiten {
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

export function verzamelFeiten(
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
    // Bij singles (1v1) is er geen partner, dus telt de match hier niet mee.
    const inA = inTeam(teams[m.team_a_id], playerId);
    const myTeam = inA ? teams[m.team_a_id] : teams[m.team_b_id];
    if (myTeam) {
      const partnerId =
        myTeam.player1_id === playerId ? myTeam.player2_id : myTeam.player1_id;
      if (partnerId) perPartner.set(partnerId, (perPartner.get(partnerId) ?? 0) + 1);
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
