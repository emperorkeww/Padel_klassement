import { describe, it, expect } from "vitest";
import { matchUpset, preMatchPoints, upsetsByMatch } from "./upset";
import type { Match, RatingPoint, Team } from "./types";

const NOW = "2026-07-10T18:00:00.000Z";

const team = (id: string, p1: string, p2: string): Team => ({
  id,
  name: null,
  player1_id: p1,
  player2_id: p2,
  created_at: NOW,
});

const TEAMS: Record<string, Team> = {
  "t-ab": team("t-ab", "p1", "p2"),
  "t-cd": team("t-cd", "p3", "p4"),
};

const match = (id: string, winner: string | null): Match => ({
  id,
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "completed",
  winner_team_id: winner,
  played_at: NOW,
  created_by: "p1",
  created_at: NOW,
  group_id: "g1",
  round_number: null,
  score_a: winner === "t-ab" ? 6 : 3,
  score_b: winner === "t-ab" ? 3 : 6,
});

const pt = (matchId: string, before: number): RatingPoint => ({
  match_id: matchId,
  rating_before: before,
  rating_after: before,
  delta: 0,
  played_at: NOW,
});

/** Historie waarin t-ab (p1,p2) op `abBefore` stond en t-cd (p3,p4) op `cdBefore`. */
const histories = (
  matchId: string,
  abBefore: number,
  cdBefore: number,
): Record<string, RatingPoint[]> => ({
  p1: [pt(matchId, abBefore)],
  p2: [pt(matchId, abBefore)],
  p3: [pt(matchId, cdBefore)],
  p4: [pt(matchId, cdBefore)],
});

describe("matchUpset", () => {
  it("markeert een underdog-winst (winkans < 35%)", () => {
    // t-ab (950) verslaat t-cd (1150): winkans ≈ 24%.
    const m = match("m1", "t-ab");
    const u = matchUpset(m, TEAMS, preMatchPoints(histories("m1", 950, 1150), "m1"));
    expect(u).not.toBeNull();
    expect(u!.winnerTeamId).toBe("t-ab");
    expect(u!.chance).toBeLessThan(0.35);
    expect(Math.round(u!.chance * 100)).toBe(24);
  });

  it("geen upset als de favoriet wint", () => {
    // t-ab (1150) verslaat t-cd (950): winkans ≈ 76%.
    const m = match("m2", "t-ab");
    expect(
      matchUpset(m, TEAMS, preMatchPoints(histories("m2", 1150, 950), "m2")),
    ).toBeNull();
  });

  it("net boven de drempel (≈36%) is géén upset", () => {
    // 1000 vs 1100 → winkans ≈ 36% (> 35%).
    const m = match("m3", "t-ab");
    expect(
      matchUpset(m, TEAMS, preMatchPoints(histories("m3", 1000, 1100), "m3")),
    ).toBeNull();
  });

  it("null bij gelijkspel (geen winnaar)", () => {
    const m = match("m4", null);
    expect(
      matchUpset(m, TEAMS, preMatchPoints(histories("m4", 950, 1150), "m4")),
    ).toBeNull();
  });

  it("null als een speler geen rating_before heeft", () => {
    const m = match("m5", "t-ab");
    const hist = histories("m5", 950, 1150);
    delete hist.p2; // winnaar mist een pre-match rating
    expect(matchUpset(m, TEAMS, preMatchPoints(hist, "m5"))).toBeNull();
  });

  it("null zonder points-map", () => {
    expect(matchUpset(match("m6", "t-ab"), TEAMS, undefined)).toBeNull();
  });
});

describe("preMatchPoints", () => {
  it("kiest per speler het punt van de juiste match", () => {
    const hist: Record<string, RatingPoint[]> = {
      p1: [pt("mA", 900), pt("mB", 1000)],
      p3: [pt("mB", 1100)],
    };
    const map = preMatchPoints(hist, "mB");
    expect(map.get("p1")?.rating_before).toBe(1000);
    expect(map.get("p3")?.rating_before).toBe(1100);
  });
});

describe("upsetsByMatch", () => {
  it("levert alleen de upset-matches, gesleuteld op id", () => {
    const upset = match("up", "t-ab"); // 950 vs 1150 → upset
    const normal = match("no", "t-ab"); // 1150 vs 950 → geen upset
    const hist: Record<string, RatingPoint[]> = {
      p1: [pt("up", 950), pt("no", 1150)],
      p2: [pt("up", 950), pt("no", 1150)],
      p3: [pt("up", 1150), pt("no", 950)],
      p4: [pt("up", 1150), pt("no", 950)],
    };
    const map = upsetsByMatch([upset, normal], TEAMS, hist);
    expect([...map.keys()]).toEqual(["up"]);
    expect(map.get("up")?.winnerTeamId).toBe("t-ab");
  });
});
