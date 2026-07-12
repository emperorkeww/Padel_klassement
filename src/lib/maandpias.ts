// Pias van de maand 🤡 (#167): de maandelijkse anti-MVP. Puur client-side
// afgeleid uit de al geladen matches + teams (+ optioneel ratings) — geen tabel
// of servertaak, exact het patroon van badges.ts / missions.ts. Voor een
// gekozen periode (maand óf week) wijst dit de speler aan die het hardst afging,
// met een ludiek-brutale reden. De wekelijkse "Pias van de week" (#127) leeft
// serverside in pias.ts en kijkt alleen naar chokes; dit is de bredere,
// afgeleide tegenhanger die zowel de maand-kaart als het "pias-alarm" op het
// dashboard voedt. Geen echte afgang boven de drempel → null, net zoals
// RivalryCard niets rendert zonder rivaliteit.

import type { Match, RatingPoint, Team } from "./types";
import { inTeam, outcomeFor } from "./results";
import { expected } from "./elo";
import { matchDate } from "./missions";

/** Verliesmarge (in games) die minstens nodig is voor een "afdroging". */
export const AFDROGING_DREMPEL = 4;
/** Aantal opeenvolgende verliezen dat minstens nodig is voor een "zwarte reeks". */
export const ZWARTE_REEKS_DREMPEL = 3;
/** Winkans die het verliezende (favoriete) team minstens had voor een "choke". */
export const FAVORIET_DREMPEL = 0.6;

export type PiasReden = "afdroging" | "bagel" | "zwarte-reeks" | "choke";

export interface Pias {
  playerId: string;
  reden: PiasReden;
  /** Ludieke omschrijving zónder naam; de UI plakt de spelernaam ervoor. */
  detail: string;
  /** Ernst-score om kandidaten te rangschikken; hoger = gênanter. */
  ernst: number;
}

/** Ratings per speler bij een match (playerId → punt), zoals feed.ts ze bouwt. */
export type MatchRatings = Map<string, RatingPoint>;

/**
 * rating_history per speler → match → speler → punt. Handig om de optionele
 * choke-detectie te voeden vanuit de UI (dezelfde bron als de feed gebruikt).
 */
export function buildMatchRatings(
  histories: Record<string, RatingPoint[]>,
): Map<string, MatchRatings> {
  const byMatch = new Map<string, MatchRatings>();
  for (const [playerId, points] of Object.entries(histories)) {
    for (const p of points) {
      let inner = byMatch.get(p.match_id);
      if (!inner) byMatch.set(p.match_id, (inner = new Map()));
      inner.set(playerId, p);
    }
  }
  return byMatch;
}

/** Matches van de periode [start, end) waarin de speler meedeed en die afgerond zijn. */
function periodeMatches(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  period: { start: Date; end: Date },
): Match[] {
  return matches
    .filter((m) => outcomeFor(m, teams, playerId) !== null)
    .filter((m) => {
      const d = matchDate(m);
      return d != null && d >= period.start && d < period.end;
    })
    .sort((a, b) =>
      (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at),
    );
}

/** Eigen team-score en tegenscore van een afgeronde match, of null zonder cijfers. */
function scoreVoor(
  m: Match,
  teams: Record<string, Team>,
  playerId: string,
): { mij: number; hen: number } | null {
  if (m.score_a == null || m.score_b == null) return null;
  const inA = inTeam(teams[m.team_a_id], playerId);
  return inA ? { mij: m.score_a, hen: m.score_b } : { mij: m.score_b, hen: m.score_a };
}

/** Best (= ergste) reden voor één speler over zijn periodematches, of null. */
function ergsteRedenVoor(
  eigen: Match[],
  teams: Record<string, Team>,
  playerId: string,
  ratingsByMatch?: Map<string, MatchRatings>,
): Pias | null {
  let afdroging = 0; // grootste verliesmarge
  let bagels = 0; // aantal 6–0's geslikt
  let langsteReeks = 0;
  let lopendeReeks = 0;
  let choke = 0; // hoogste winkans die als favoriet tóch verloren werd

  for (const m of eigen) {
    const o = outcomeFor(m, teams, playerId);
    if (o === "L") {
      lopendeReeks += 1;
      langsteReeks = Math.max(langsteReeks, lopendeReeks);
      const s = scoreVoor(m, teams, playerId);
      if (s) {
        afdroging = Math.max(afdroging, s.hen - s.mij);
        if (s.mij === 0 && s.hen > 0) bagels += 1;
      }
      const kans = favorietKans(m, teams, playerId, ratingsByMatch?.get(m.id));
      if (kans != null) choke = Math.max(choke, kans);
    } else {
      lopendeReeks = 0;
    }
  }

  const kandidaten: Pias[] = [];
  if (bagels > 0) {
    kandidaten.push({
      playerId,
      reden: "bagel",
      detail: bagels === 1 ? "kreeg een droog broodje bagel geserveerd 🥯" : `is inmiddels eigenaar van een bagel-bakkerij (${bagels} stuks) 🥯`,
      // Een bagel is het sappigste verhaal: weegt zwaar zodat hij meestal wint.
      ernst: 100 + bagels * 10,
    });
  }
  if (afdroging >= AFDROGING_DREMPEL) {
    kandidaten.push({
      playerId,
      reden: "afdroging",
      detail: `werd met ${afdroging} games verschil vakkundig afgedroogd`,
      ernst: 50 + afdroging,
    });
  }
  if (langsteReeks >= ZWARTE_REEKS_DREMPEL) {
    kandidaten.push({
      playerId,
      reden: "zwarte-reeks",
      detail: `stapelde verlies op verlies (${langsteReeks}× op rij)`,
      ernst: 40 + langsteReeks,
    });
  }
  if (choke >= FAVORIET_DREMPEL) {
    kandidaten.push({
      playerId,
      reden: "choke",
      detail: `dacht de buit al binnen te hebben, maar choke-te hard (${Math.round(choke * 100)}% winkans vooraf)`,
      ernst: 30 + Math.round(choke * 10),
    });
  }
  if (kandidaten.length === 0) return null;
  return kandidaten.sort((a, b) => b.ernst - a.ernst)[0];
}

/**
 * Winkans van het verliezende team van de speler vóór de match (échte
 * pre-match ratings). Alleen een getal als de speler verloor én favoriet was
 * (kans ≥ 0.5); anders null. Zonder ratings voor alle vier de spelers: null.
 */
function favorietKans(
  m: Match,
  teams: Record<string, Team>,
  playerId: string,
  ratings: MatchRatings | undefined,
): number | null {
  if (!ratings || outcomeFor(m, teams, playerId) !== "L") return null;
  const inA = inTeam(teams[m.team_a_id], playerId);
  const mijnTeam = inA ? teams[m.team_a_id] : teams[m.team_b_id];
  const tegenTeam = inA ? teams[m.team_b_id] : teams[m.team_a_id];
  if (!mijnTeam || !tegenTeam) return null;
  const avg = (t: Team): number | null => {
    const p1 = ratings.get(t.player1_id)?.rating_before;
    const p2 = ratings.get(t.player2_id)?.rating_before;
    return p1 == null || p2 == null ? null : (p1 + p2) / 2;
  };
  const mij = avg(mijnTeam);
  const hen = avg(tegenTeam);
  if (mij == null || hen == null) return null;
  const kans = expected(mij, hen);
  return kans >= 0.5 ? kans : null;
}

/**
 * De pias van een periode: de speler met de gênantste afgang. Bekijkt elke
 * speler die in de periode meedeed, kiest per speler zijn ergste reden en levert
 * de allerergste terug. Null als niemand boven een drempel komt.
 */
export function bepaalPias(
  matches: Match[],
  teams: Record<string, Team>,
  period: { start: Date; end: Date },
  ratingsByMatch?: Map<string, MatchRatings>,
): Pias | null {
  // Spelers die in de periode een afgeronde match speelden.
  const spelers = new Set<string>();
  for (const m of matches) {
    if (m.status !== "completed") continue;
    const d = matchDate(m);
    if (d == null || d < period.start || d >= period.end) continue;
    for (const t of [teams[m.team_a_id], teams[m.team_b_id]]) {
      if (t) {
        spelers.add(t.player1_id);
        spelers.add(t.player2_id);
      }
    }
  }

  let pias: Pias | null = null;
  for (const pid of spelers) {
    const eigen = periodeMatches(matches, teams, pid, period);
    const reden = ergsteRedenVoor(eigen, teams, pid, ratingsByMatch);
    if (!reden) continue;
    // Tie-break deterministisch op playerId zodat de uitkomst stabiel is.
    if (
      !pias ||
      reden.ernst > pias.ernst ||
      (reden.ernst === pias.ernst && reden.playerId < pias.playerId)
    ) {
      pias = reden;
    }
  }
  return pias;
}