// Reeks-, comeback- en rating-gebaseerde badge-helpers (chronologische doorlopen).
import { ANGSTGEGNER_DREMPEL, COMEBACK_DREMPEL, REUZENDODER_DREMPEL, ROESTVRIJ_DAGEN } from "./badges.constants";
import { matchDate } from "@/features/dashboard/missions";
import { inTeam, outcomeFor, playersOf } from "@/features/rating/results";
import { FAVORIET_DREMPEL, favorietKans } from "@/features/groups/maandpias";
import type { MatchRatings } from "@/features/groups/maandpias";
import type { Match, PlayerRating, Team } from "@/types";

/**
 * Aantal matches waarin de speler "gechoket" heeft: verloren terwijl hij
 * favoriet was met een pre-match winkans van minstens FAVORIET_DREMPEL (0.6).
 *
 * Bewust dezelfde definitie als de pias (recompute_pias in de DB en bepaalPias
 * hier ernaast), zodat de feed, de Pias en de badge dezelfde matches "choke"
 * noemen (#809). De issue vroeg om "verliezen na een 5-1-voorsprong", maar
 * punt-voor-punt-data bestaat niet: match_points heeft geen enkele schrijver
 * (zie ook de toelichting in features/seizoen/awards.ts).
 *
 * Zonder pre-match ratings (bv. in useBadgeAnnouncement, dat rating_history
 * niet laadt) is het antwoord 0 — de badge blijft dan gewoon niet-behaald.
 */
export function chokeAantal(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  ratingsByMatch: Map<string, MatchRatings> | undefined,
): number {
  if (!ratingsByMatch) return 0;
  let n = 0;
  for (const m of matches) {
    const kans = favorietKans(m, teams, playerId, ratingsByMatch.get(m.id));
    if (kans != null && kans >= FAVORIET_DREMPEL) n++;
  }
  return n;
}

/** Gemiddelde huidige rating van een team (bij singles: die ene rating), of
 *  null zodra één rating ontbreekt. */
function teamRating(
  team: Team | undefined,
  ratings: Record<string, PlayerRating>,
): number | null {
  const spelers = playersOf(team);
  if (spelers.length === 0) return null;
  let som = 0;
  for (const id of spelers) {
    const r = ratings[id]?.rating;
    if (r == null) return null;
    som += r;
  }
  return som / spelers.length;
}

/**
 * Won de speler ooit van een team dat gemiddeld minstens `drempel` rating
 * hoger stond dan zijn eigen team?
 *
 * Bewuste benadering: we vergelijken met de HUIDIGE ratings, niet met de
 * ratings op het moment van de match. De historische rating per speler per
 * match zou vier extra rating_history-opzoekingen per match vragen; de
 * huidige stand is ruim goed genoeg voor een verzamelbadge. Ontbreekt een
 * rating (of zijn er geen ratings), dan telt die match gewoon niet mee.
 *
 * De drempel is instelbaar (#809): naast de Reuzendoder (50) staat de veel
 * zwaardere Reuzenmoordenaar (150) op dezelfde doorloop.
 */
export function isReuzendoder(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  ratings: Record<string, PlayerRating>,
  drempel: number = REUZENDODER_DREMPEL,
): boolean {
  for (const m of matches) {
    if (outcomeFor(m, teams, playerId) !== "W") continue;
    const mineIsA = inTeam(teams[m.team_a_id], playerId);
    const mine = teamRating(teams[mineIsA ? m.team_a_id : m.team_b_id], ratings);
    const theirs = teamRating(teams[mineIsA ? m.team_b_id : m.team_a_id], ratings);
    if (mine == null || theirs == null) continue;
    if (theirs - mine >= drempel) return true;
  }
  return false;
}

/**
 * Won de speler ooit een match meteen ná minstens COMEBACK_DREMPEL verliezen
 * op rij? We lopen de afgewerkte matches chronologisch af en tellen de lopende
 * verliesreeks; een winst na een lange reeks is de comeback.
 */
export function hadComeback(
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
export function isGestruikeld(
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

/**
 * Versloeg de speler ooit een tegenstanderteam waarvan hij eerder verloor?
 * Chronologisch: we onthouden tegen welke teams we al verloren; een latere
 * winst tegen zo'n team is de revanche.
 */
export function hadRevanche(
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
export function dejaVuReeks(
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
export function jojoReeks(
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
export function rustFeiten(
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
export function tweelingReeks(
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
    // Singles (1v1) heeft geen partner: de match telt niet mee voor de reeks,
    // maar breekt hem ook niet.
    if (!partner) continue;
    if (o !== "W") {
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
export function angstgegnerVerslagen(
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
