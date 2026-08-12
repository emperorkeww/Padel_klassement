import { byRank } from "@/features/rating/standings";
import type { Row } from "./leaderboardHelpers";

// De race-tijdlijn (#1241): uit de recente rating-historie reconstrueren we
// per speeldag een compleet "frame" — rating én rang per speler — zodat de
// scrubber het verloop kan afspelen. De oude één-dag-replay is hiervan het
// kortste geval (startframe + één speeldag).

/** Hooguit zoveel speeldagen in de film; met 50 punten per speler dekt dat
 *  ruim de recente weken en blijft de scrubber behapbaar. */
export const MAX_TIMELINE_DAYS = 10;

export function calculateRankingMovement(
  currentRank: number,
  previousRank: number | null,
): number | "nieuw" {
  return previousRank == null ? "nieuw" : previousRank - currentRank;
}

export interface RaceFrameRiser {
  key: string;
  from: number;
  to: number;
}

export interface RaceFrame {
  /** ISO-dag (YYYY-MM-DD); null voor het startframe vóór het venster. */
  day: string | null;
  ratings: Map<string, number>;
  ranks: Map<string, number>;
  /** Wie op deze dag al minstens één match in de historie heeft; de rest
   *  staat gedimd op zijn startwaarde — geen verzonnen beweging. */
  debuted: Set<string>;
  /** De grootste stijger t.o.v. het vorige frame — de verhaallijn. */
  riser: RaceFrameRiser | null;
}

export interface RaceTimeline {
  frames: RaceFrame[];
}

/**
 * Bouwt de film uit echte history: startframe (de stand vóór het venster) plus
 * één frame per speeldag, met carry-forward voor wie die dag niet speelde.
 * Rangen per frame gebruiken dezelfde tie-break als het klassement zelf;
 * punten/saldo zijn eindstandwaarden — een gedocumenteerde benadering.
 * Zonder minstens één aantoonbare ratingwijziging is er bewust geen film.
 */
export function buildRaceTimeline(rows: readonly Row[]): RaceTimeline | null {
  const rated = rows.filter((r): r is Row & { rating: number } => r.rating != null);
  if (rated.length === 0) return null;

  const dagen = [
    ...new Set(
      rated.flatMap((row) => row.history.map((p) => p.played_at.slice(0, 10))),
    ),
  ]
    .sort()
    .slice(-MAX_TIMELINE_DAYS);
  if (dagen.length === 0) return null;

  // Per speler chronologisch; de API levert al oud → nieuw, maar de hele film
  // hangt van die volgorde af.
  const punten = new Map(
    rated.map((row) => [
      row.key,
      [...row.history].sort((a, b) => a.played_at.localeCompare(b.played_at)),
    ]),
  );

  const start = new Map<string, number>();
  const debuut = new Map<string, string | null>();
  for (const row of rated) {
    const eigen = punten.get(row.key)!;
    const voorVenster = eigen.filter((p) => p.played_at.slice(0, 10) < dagen[0]);
    start.set(
      row.key,
      voorVenster.at(-1)?.rating_after ?? eigen[0]?.rating_before ?? row.rating,
    );
    // Zonder recente historie geen debuutdag: die speler staat gewoon
    // (constant en ongedimd) op de baan.
    debuut.set(row.key, eigen.length ? eigen[0].played_at.slice(0, 10) : null);
  }

  const frames: RaceFrame[] = [null as string | null, ...dagen].map((dag) => {
    const ratings = new Map<string, number>();
    const debuted = new Set<string>();
    for (const row of rated) {
      const eigen = punten.get(row.key)!;
      const laatste =
        dag == null
          ? undefined
          : eigen.filter((p) => p.played_at.slice(0, 10) <= dag).at(-1);
      ratings.set(row.key, laatste?.rating_after ?? start.get(row.key)!);
      const eersteDag = debuut.get(row.key);
      if (eersteDag == null || (dag == null ? eersteDag < dagen[0] : eersteDag <= dag)) {
        debuted.add(row.key);
      }
    }
    const volgorde = [...rated].sort(
      (a, b) =>
        ratings.get(b.key)! - ratings.get(a.key)! ||
        byRank(
          { points: a.points, goal_diff: a.goalDiff, won: a.won },
          { points: b.points, goal_diff: b.goalDiff, won: b.won },
        ) ||
        a.name.localeCompare(b.name),
    );
    const ranks = new Map(volgorde.map((row, index) => [row.key, index + 1]));
    return { day: dag, ratings, ranks, debuted, riser: null };
  });

  for (let i = 1; i < frames.length; i++) {
    const vorig = frames[i - 1];
    const frame = frames[i];
    let beste: RaceFrameRiser | null = null;
    let besteSprong = 0;
    let besteDelta = -Infinity;
    for (const row of rated) {
      const van = vorig.ranks.get(row.key)!;
      const naar = frame.ranks.get(row.key)!;
      const sprong = van - naar;
      if (sprong <= 0) continue;
      const delta = frame.ratings.get(row.key)! - vorig.ratings.get(row.key)!;
      if (sprong > besteSprong || (sprong === besteSprong && delta > besteDelta)) {
        beste = { key: row.key, from: van, to: naar };
        besteSprong = sprong;
        besteDelta = delta;
      }
    }
    frame.riser = beste;
  }

  const startFrame = frames[0];
  const veranderd = frames.some((frame) =>
    rated.some(
      (row) => frame.ratings.get(row.key) !== startFrame.ratings.get(row.key),
    ),
  );
  if (!veranderd) return null;

  return { frames };
}
