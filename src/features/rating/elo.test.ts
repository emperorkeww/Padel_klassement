import { describe, it, expect } from "vitest";
import { teamRating, winChance } from "@/features/rating/elo";
import type { PlayerRating, Team } from "@/types";

const team = (id: string, p1: string, p2: string): Team => ({
  id,
  name: null,
  player1_id: p1,
  player2_id: p2,
  created_at: "2026-07-02T10:00:00.000Z",
});

const rating = (r: number): PlayerRating => ({
  player_id: "x",
  rating: r,
  games: 1,
  updated_at: "2026-07-02T10:00:00.000Z",
});

describe("teamRating", () => {
  it("middelt de ratings van beide spelers", () => {
    const ratings = { a: rating(1100), b: rating(900) };
    expect(teamRating(team("t", "a", "b"), ratings)).toBe(1000);
  });

  it("valt terug op 1000 voor ongerate spelers en onbekende teams", () => {
    expect(teamRating(team("t", "a", "b"), {})).toBe(1000);
    expect(teamRating(undefined, {})).toBe(1000);
  });
});

describe("winChance", () => {
  it("geeft 50% bij gelijke teams", () => {
    expect(winChance(team("t1", "a", "b"), team("t2", "c", "d"), {})).toBeCloseTo(0.5);
  });

  it("volgt de Elo-verwachting: +400 teampunten ≈ 91%", () => {
    const ratings = { a: rating(1400), b: rating(1400) };
    const kans = winChance(team("t1", "a", "b"), team("t2", "c", "d"), ratings);
    expect(kans).toBeCloseTo(1 / (1 + Math.pow(10, -1)), 5);
  });

  it("is symmetrisch: kansen sommeren tot 1", () => {
    const ratings = { a: rating(1050), c: rating(970) };
    const a = winChance(team("t1", "a", "b"), team("t2", "c", "d"), ratings);
    const b = winChance(team("t2", "c", "d"), team("t1", "a", "b"), ratings);
    expect(a + b).toBeCloseTo(1);
  });
});
