import { byRank } from "@/features/rating/standings";
import { tierProgress, TIER_BANDEN, type TierBand } from "@/features/rating/tiers";
import type { Row } from "./leaderboardHelpers";

export const PACK_NEIGHBOR_GAP = 40;
export const PACK_MAX_SPREAD = 60;
export const PACK_MIN_PLAYERS = 3;

export interface RaceAxisRange {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/** Eén gedeelde, afgeronde rating-as voor alle lanes. */
export function calculateAxisRange(
  ratings: readonly number[],
  targetIntervals = 5,
): RaceAxisRange {
  const finite = ratings.filter(Number.isFinite);
  if (finite.length === 0) return { min: 0, max: 1, step: 1, ticks: [0, 1] };

  const actualMin = Math.min(...finite);
  const actualMax = Math.max(...finite);
  const spread = actualMax - actualMin;
  const rawStep =
    spread > 0
      ? spread / Math.max(2, targetIntervals)
      : Math.max(10, Math.abs(actualMin) / 20);
  const step = niceStep(rawStep);
  let min = Math.floor(actualMin / step) * step;
  let max = Math.ceil(actualMax / step) * step;

  // Een vlak klassement heeft nog steeds een leesbare schaal nodig.
  if (min === max) {
    min -= step;
    max += step;
  }

  const ticks: number[] = [];
  for (let value = min; value <= max + step / 100; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return { min, max, step, ticks };
}

/** Rating naar een geklemde x-positie op de gedeelde as. */
export function calculateRacePosition(
  rating: number,
  axis: Pick<RaceAxisRange, "min" | "max">,
): number {
  if (axis.max <= axis.min) return 50;
  return Math.min(100, Math.max(0, ((rating - axis.min) / (axis.max - axis.min)) * 100));
}

export interface RacePack {
  id: string;
  rows: Row[];
  startRank: number;
  endRank: number;
  spread: number;
  includesCurrentUser: boolean;
}

/**
 * Vindt compacte clusters in ratingvolgorde. Een limiet op zowel de afstand
 * tussen buren als de totale spreiding voorkomt kettingreacties waarbij bijna
 * de hele ranglijst één pack wordt.
 */
export function detectRatingPacks(
  rows: readonly Row[],
  neighborGap = PACK_NEIGHBOR_GAP,
  maxSpread = PACK_MAX_SPREAD,
  minPlayers = PACK_MIN_PLAYERS,
): RacePack[] {
  const rated = rows.filter((r): r is Row & { rating: number } => r.rating != null);
  const packs: RacePack[] = [];

  for (let start = 0; start < rated.length; ) {
    let end = start;
    while (end + 1 < rated.length) {
      const next = rated[end + 1];
      const neighborDistance = rated[end].rating - next.rating;
      const totalSpread = rated[start].rating - next.rating;
      if (neighborDistance > neighborGap || totalSpread > maxSpread) break;
      end += 1;
    }

    if (end - start + 1 >= minPlayers) {
      const members = rated.slice(start, end + 1);
      const startRank = members[0].rank ?? start + 1;
      const endRank = members.at(-1)!.rank ?? end + 1;
      packs.push({
        id: `${members[0].key}:${members.at(-1)!.key}`,
        rows: members,
        startRank,
        endRank,
        spread: members[0].rating - members.at(-1)!.rating,
        includesCurrentUser: members.some((r) => r.isMe),
      });
      start = end + 1;
    } else {
      start += 1;
    }
  }
  return packs;
}

export function findCurrentUser(rows: readonly Row[]): Row | null {
  return rows.find((row) => row.isMe) ?? null;
}

export interface NearestCompetitors {
  above: { row: Row; gap: number } | null;
  below: { row: Row; gap: number } | null;
}

export function getNearestCompetitors(
  rows: readonly Row[],
  playerKey: string,
): NearestCompetitors {
  const rated = rows.filter((r): r is Row & { rating: number } => r.rating != null);
  const index = rated.findIndex((r) => r.key === playerKey);
  if (index < 0) return { above: null, below: null };
  const player = rated[index];
  const above = rated[index - 1];
  const below = rated[index + 1];
  return {
    above: above ? { row: above, gap: Math.max(0, above.rating - player.rating) } : null,
    below: below ? { row: below, gap: Math.max(0, player.rating - below.rating) } : null,
  };
}

export function getNextDivision(rating: number | null) {
  return tierProgress(rating);
}

/** Alleen de hoofddivisiegrenzen die werkelijk op de zichtbare as liggen. */
export function divisionCheckpoints(axis: RaceAxisRange): TierBand[] {
  return TIER_BANDEN.filter(
    (band, index) => index > 0 && band.min > axis.min && band.min < axis.max,
  );
}

export function calculateRankingMovement(
  currentRank: number,
  previousRank: number | null,
): number | "nieuw" {
  return previousRank == null ? "nieuw" : previousRank - currentRank;
}

export interface RaceReplayPlayer {
  key: string;
  currentRating: number;
  previousRating: number;
  currentRank: number;
  previousRank: number | null;
  movement: number | "nieuw";
}

export interface RaceReplay {
  day: string;
  players: Map<string, RaceReplayPlayer>;
  event: string | null;
}

/**
 * Reconstrueert de markers van vóór de recentste speeldag uit echte history.
 * Zonder minstens één aantoonbare ratingwijziging is er bewust geen replay.
 */
export function buildRaceReplay(rows: readonly Row[]): RaceReplay | null {
  const rated = rows.filter((r): r is Row & { rating: number } => r.rating != null);
  const latestDay = rated
    .flatMap((row) => row.history.map((point) => point.played_at.slice(0, 10)))
    .sort()
    .at(-1);
  if (!latestDay) return null;

  const previousRating = new Map<string, number>();
  let changed = false;
  for (const row of rated) {
    const points = row.history
      .filter((point) => point.played_at.slice(0, 10) === latestDay)
      .sort((a, b) => a.played_at.localeCompare(b.played_at));
    const before = points[0]?.rating_before ?? row.rating;
    previousRating.set(row.key, before);
    if (before !== row.rating) changed = true;
  }
  if (!changed) return null;

  const previousOrder = [...rated].sort(
    (a, b) =>
      previousRating.get(b.key)! - previousRating.get(a.key)! ||
      byRank(
        { points: a.points, goal_diff: a.goalDiff, won: a.won },
        { points: b.points, goal_diff: b.goalDiff, won: b.won },
      ) ||
      a.name.localeCompare(b.name),
  );
  const derivedRanks = new Map(previousOrder.map((row, index) => [row.key, index + 1]));
  const players = new Map<string, RaceReplayPlayer>();

  for (const [index, row] of rated.entries()) {
    const currentRank = row.rank ?? index + 1;
    const previousRank =
      row.shift === "nieuw"
        ? null
        : typeof row.shift === "number"
          ? currentRank + row.shift
          : (derivedRanks.get(row.key) ?? currentRank);
    players.set(row.key, {
      key: row.key,
      currentRating: row.rating,
      previousRating: previousRating.get(row.key)!,
      currentRank,
      previousRank,
      movement: calculateRankingMovement(currentRank, previousRank),
    });
  }

  const riser = [...players.values()]
    .filter((player) => typeof player.movement === "number" && player.movement > 0)
    .sort((a, b) => (b.movement as number) - (a.movement as number))[0];
  const riserRow = riser ? rated.find((row) => row.key === riser.key) : null;
  return {
    day: latestDay,
    players,
    event: riser && riserRow ? `${riserRow.name} stijgt naar #${riser.currentRank}` : null,
  };
}
