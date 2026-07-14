// Stats- & context-afleiding voor Coach Rudy (#200): pure functies die uit de
// al geladen matches concrete feiten destilleren waarmee zijn feed-quips
// gevuld worden — hoeveelste nederlaag/bagel deze maand, een verliesreeks tegen
// dezelfde rivaal, een persoonlijk dieptepunt (grootste afgang ooit) en of een
// winreeks een record is. Geen IO; deterministisch en getest in
// coachStats.test.ts. coachFeed kiest hiermee tussen een feit-sjabloon en de
// generieke pool (valt terug op generiek zodra de data ontbreekt).

import type { Match, Team } from "@/types";
import { inTeam, longestStreak, outcomeFor } from "@/features/rating/results";

/** Datum waarop een match telt (gespeeld, anders aangemaakt). */
const datumVan = (m: Match): string => m.played_at ?? m.created_at;
/** Stabiele, chronologische sorteersleutel; id breekt gelijke datums. */
const sleutel = (m: Match): string => `${datumVan(m)}|${m.id}`;
/** Kalendermaand (YYYY-MM) van een match. */
const maandVan = (m: Match): string => datumVan(m).slice(0, 7);

/** Spelers van een team (leeg als het team onbekend is). */
function teamSpelers(teams: Record<string, Team>, teamId: string): string[] {
  const t = teams[teamId];
  return t ? [t.player1_id, t.player2_id] : [];
}

/** De verliezende spelers van een afgeronde match (leeg zonder winnaar). */
export function verliezersVan(m: Match, teams: Record<string, Team>): string[] {
  if (m.status !== "completed" || !m.winner_team_id) return [];
  const loserTeam = m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id;
  return teamSpelers(teams, loserTeam);
}

/** De winnende spelers van een afgeronde match (leeg zonder winnaar). */
export function winnaarsVan(m: Match, teams: Record<string, Team>): string[] {
  if (m.status !== "completed" || !m.winner_team_id) return [];
  return teamSpelers(teams, m.winner_team_id);
}

/** Puntenverschil van een match, of null zonder beide scores. */
export function margeVan(m: Match): number | null {
  if (m.score_a == null || m.score_b == null) return null;
  return Math.abs(m.score_a - m.score_b);
}

/** Was dit een bagel (één kant nul games, de ander meer)? */
function isBagel(m: Match): boolean {
  if (m.score_a == null || m.score_b == null) return false;
  return Math.min(m.score_a, m.score_b) === 0 && Math.max(m.score_a, m.score_b) > 0;
}

/**
 * Hoeveelste nederlaag deze kalendermaand is `opMatch` voor de speler — de
 * repetitie-drijver ("je Nde nederlaag deze maand"). Telt alle verloren matches
 * in dezelfde maand tot en met `opMatch` (chronologisch). Null als de speler
 * `opMatch` niet verloor.
 */
export function nederlaagNrDezeMaand(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  opMatch: Match,
): number | null {
  if (outcomeFor(opMatch, teams, playerId) !== "L") return null;
  const maand = maandVan(opMatch);
  const grens = sleutel(opMatch);
  let n = 0;
  for (const m of matches) {
    if (outcomeFor(m, teams, playerId) !== "L") continue;
    if (maandVan(m) !== maand) continue;
    if (sleutel(m) <= grens) n++;
  }
  return n;
}

/**
 * Hoeveelste bagel-nederlaag deze maand is `opMatch` voor de speler. Als
 * nederlaagNrDezeMaand, maar telt enkel matches die de speler met 0 games
 * verloor. Null als `opMatch` zelf geen bagel-nederlaag van de speler is.
 */
export function bagelNrDezeMaand(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  opMatch: Match,
): number | null {
  if (outcomeFor(opMatch, teams, playerId) !== "L" || !isBagel(opMatch)) return null;
  const maand = maandVan(opMatch);
  const grens = sleutel(opMatch);
  let n = 0;
  for (const m of matches) {
    if (outcomeFor(m, teams, playerId) !== "L" || !isBagel(m)) continue;
    if (maandVan(m) !== maand) continue;
    if (sleutel(m) <= grens) n++;
  }
  return n;
}

/**
 * Aantal opeenvolgende onderlinge nederlagen van de speler tegen één specifieke
 * tegenstander, eindigend op `opMatch` — de "rivaal"-drijver. Telt alleen
 * afgeronde matches waarin beiden in tegengestelde teams speelden, tot en met
 * `opMatch`, en telt de aaneengesloten reeks verliezen vanaf achteren. 0 als de
 * laatste onderlinge match geen nederlaag was.
 */
export function verliesreeksTegen(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  oppId: string,
  opMatch: Match,
): number {
  const grens = sleutel(opMatch);
  const h2h = matches
    .filter((m) => {
      if (m.status !== "completed") return false;
      const pInA = inTeam(teams[m.team_a_id], playerId);
      const pInB = inTeam(teams[m.team_b_id], playerId);
      if (!pInA && !pInB) return false;
      const oppInA = inTeam(teams[m.team_a_id], oppId);
      const oppInB = inTeam(teams[m.team_b_id], oppId);
      return (pInA && oppInB) || (pInB && oppInA);
    })
    .filter((m) => sleutel(m) <= grens)
    .sort((a, b) => sleutel(a).localeCompare(sleutel(b)));
  let run = 0;
  for (let i = h2h.length - 1; i >= 0; i--) {
    if (outcomeFor(h2h[i], teams, playerId) === "L") run++;
    else break;
  }
  return run;
}

/**
 * Is `opMatch` (een van) de grootste nederlaag(margin) ooit voor de speler? Een
 * "persoonlijk dieptepunt": geen enkele andere verloren match heeft een groter
 * puntenverschil. Vereist twee ingevulde scores op `opMatch`.
 */
export function isVerliesRecord(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  opMatch: Match,
): boolean {
  if (outcomeFor(opMatch, teams, playerId) !== "L") return false;
  const marge = margeVan(opMatch);
  if (marge == null) return false;
  for (const m of matches) {
    if (m.id === opMatch.id) continue;
    if (outcomeFor(m, teams, playerId) !== "L") continue;
    const andere = margeVan(m);
    if (andere != null && andere > marge) return false;
  }
  return true;
}

/** Is de lopende winreeks een persoonlijk record (langste ooit)? */
export function isWinreeksRecord(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  huidigeReeks: number,
): boolean {
  if (huidigeReeks <= 0) return false;
  return huidigeReeks >= longestStreak(matches, teams, playerId);
}

/**
 * Hoeveelste pias-van-de-week deze kalendermaand is `weekStart` voor de speler
 * — de herhaling achter "al je Nde pias deze maand". Telt de aangeduide piassen
 * van dezelfde speler in dezelfde maand tot en met deze week. Structurele
 * invoer (playerId + weekStart), zodat de lib los blijft van PiasWeek.
 */
export function piasNrDezeMaand(
  piasWeeks: { playerId: string; weekStart: string }[],
  playerId: string,
  weekStart: string,
): number {
  const maand = weekStart.slice(0, 7);
  let n = 0;
  for (const p of piasWeeks) {
    if (p.playerId !== playerId) continue;
    if (p.weekStart.slice(0, 7) !== maand) continue;
    if (p.weekStart <= weekStart) n++;
  }
  return n;
}

/** Gebundelde feiten rond een nederlaag, klaar voor Coach Rudy's sjablonen. */
export interface VerliesFeiten {
  /** Puntenverschil van de nederlaag. */
  marge: number | null;
  /** Hoeveelste nederlaag deze maand (max over de twee verliezers). */
  nederlaagNr: number | null;
  /** Hoeveelste bagel-nederlaag deze maand (max over de verliezers). */
  bagelNr: number | null;
  /** Grootste afgang ooit voor (minstens) één verliezer. */
  record: boolean;
  /** Langste lopende onderlinge verliesreeks (≥2) + naam van de rivaal. */
  rivaal: { count: number; naam: string } | null;
}

/**
 * Leidt de nederlaag-feiten van `opMatch` af, geaggregeerd over béide
 * verliezers (de meest sáppige waarde wint) en over hun tegenstanders voor de
 * rivaal-reeks. Null als `opMatch` geen afgeronde match met verliezers is.
 * `naamVoor` levert de weergavenaam van de rivaal; ontbreekt die, dan valt hij
 * terug op het id.
 */
export function verliesFeiten(
  opMatch: Match,
  matches: Match[],
  teams: Record<string, Team>,
  naamVoor?: (id: string) => string,
): VerliesFeiten | null {
  const verliezers = verliezersVan(opMatch, teams);
  if (verliezers.length === 0) return null;
  const winnaars = winnaarsVan(opMatch, teams);

  let nederlaagNr: number | null = null;
  let bagelNr: number | null = null;
  let record = false;
  let rivaal: { count: number; naam: string } | null = null;

  for (const loser of verliezers) {
    const nl = nederlaagNrDezeMaand(matches, teams, loser, opMatch);
    if (nl != null && (nederlaagNr == null || nl > nederlaagNr)) nederlaagNr = nl;
    const bg = bagelNrDezeMaand(matches, teams, loser, opMatch);
    if (bg != null && (bagelNr == null || bg > bagelNr)) bagelNr = bg;
    if (isVerliesRecord(matches, teams, loser, opMatch)) record = true;
    for (const opp of winnaars) {
      const count = verliesreeksTegen(matches, teams, loser, opp, opMatch);
      if (count >= 2 && (!rivaal || count > rivaal.count)) {
        rivaal = { count, naam: naamVoor ? naamVoor(opp) : opp };
      }
    }
  }

  return { marge: margeVan(opMatch), nederlaagNr, bagelNr, record, rivaal };
}
