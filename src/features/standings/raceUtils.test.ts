import { describe, expect, it } from "vitest";
import type { Row } from "./leaderboardHelpers";
import {
  buildRaceReplay,
  calculateAxisRange,
  calculateRacePosition,
  calculateRankingMovement,
  detectRatingPacks,
  findCurrentUser,
  getNextDivision,
} from "./raceUtils";

const row = (key: string, rating: number | null, options: Partial<Row> = {}): Row => ({
  key,
  rating,
  rank: Number(key.replace(/\D/g, "")) || 1,
  isMe: false,
  name: key,
  profile: null,
  played: 10,
  won: 5,
  drawn: 0,
  lost: 5,
  points: 15,
  goalDiff: 0,
  games: 10,
  history: [],
  form: [],
  ...options,
});

describe("race-as", () => {
  it("zet ratings op één gedeelde x-schaal", () => {
    const axis = calculateAxisRange([900, 1000, 1200]);
    expect(calculateRacePosition(axis.min, axis)).toBe(0);
    expect(calculateRacePosition(axis.max, axis)).toBe(100);
    expect(calculateRacePosition((axis.min + axis.max) / 2, axis)).toBe(50);
  });

  it("rondt min en max dynamisch af en bevat waarden buiten het normale bereik", () => {
    const axis = calculateAxisRange([347, 1842]);
    expect(axis.min).toBeLessThanOrEqual(347);
    expect(axis.max).toBeGreaterThanOrEqual(1842);
    expect(axis.ticks[0]).toBe(axis.min);
    expect(axis.ticks.at(-1)).toBe(axis.max);
  });

  it("geeft gelijke ratings dezelfde positie op een niet-lege as", () => {
    const axis = calculateAxisRange([1000, 1000]);
    expect(axis.max).toBeGreaterThan(axis.min);
    expect(calculateRacePosition(1000, axis)).toBe(50);
  });

  it("klemt ratings die buiten een aangeleverde as vallen", () => {
    expect(calculateRacePosition(800, { min: 900, max: 1100 })).toBe(0);
    expect(calculateRacePosition(1200, { min: 900, max: 1100 })).toBe(100);
  });
});

describe("race-afleidingen", () => {
  it("detecteert een compact pack en laat losse spelers ongemoeid", () => {
    const rows = [row("p1", 1100), row("p2", 1045), row("p3", 1020), row("p4", 1017), row("p5", 1011)];
    const packs = detectRatingPacks(rows);
    expect(packs).toHaveLength(1);
    expect(packs[0].rows.map((r) => r.key)).toEqual(["p2", "p3", "p4", "p5"]);
    expect(packs[0].spread).toBe(34);
  });

  it("maakt geen pack van twee spelers of van een ratingketting", () => {
    expect(detectRatingPacks([row("p1", 1000), row("p2", 990)])).toEqual([]);
    const chain = [1000, 970, 940, 910, 880].map((rating, i) => row(`p${i + 1}`, rating));
    expect(detectRatingPacks(chain)[0].rows).toHaveLength(3);
  });

  it("vindt de huidige gebruiker zonder op naam te gokken", () => {
    expect(findCurrentUser([row("p1", 1000), row("p2", 990, { isMe: true })])?.key).toBe("p2");
  });

  it("berekent de volgende echte hoofddivisie", () => {
    const next = getNextDivision(988);
    expect(next?.volgende).toMatchObject({ naam: "Wannabe", vanaf: 1000 });
    expect(next?.puntenNodig).toBe(12);
    expect(getNextDivision(1600)?.volgende).toBeNull();
  });

  it("berekent stijgen, dalen, gelijk en nieuw", () => {
    expect(calculateRankingMovement(5, 7)).toBe(2);
    expect(calculateRankingMovement(7, 5)).toBe(-2);
    expect(calculateRankingMovement(5, 5)).toBe(0);
    expect(calculateRankingMovement(5, null)).toBe("nieuw");
  });
});

describe("race-replay", () => {
  it("reconstrueert vorige ratings en posities uit de laatste echte speeldag", () => {
    const rows = [
      row("p1", 1020, {
        rank: 1,
        shift: 1,
        name: "Stijger",
        history: [{ match_id: "m1", rating_before: 990, rating_after: 1020, delta: 30, played_at: "2026-08-01T20:00:00Z" }],
      }),
      row("p2", 1000, { rank: 2, shift: -1 }),
    ];
    const replay = buildRaceReplay(rows);
    expect(replay?.day).toBe("2026-08-01");
    expect(replay?.players.get("p1")).toMatchObject({
      previousRating: 990,
      currentRating: 1020,
      previousRank: 2,
      currentRank: 1,
      movement: 1,
    });
    expect(replay?.event).toBe("Stijger stijgt naar #1");
  });

  it("biedt geen verzonnen replay zonder historische wijziging", () => {
    expect(buildRaceReplay([row("p1", 1000)])).toBeNull();
  });
});
