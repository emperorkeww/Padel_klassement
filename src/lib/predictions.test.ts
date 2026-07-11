import { describe, it, expect } from "vitest";
import {
  computePredictionStandings,
  predictionPoints,
  type MatchPrediction,
} from "./predictions";
import type { Profile } from "./types";

const profile = (id: string, username: string): Profile => ({
  id,
  username,
  full_name: null,
  avatar_url: null,
  created_at: "2026-07-01T10:00:00.000Z",
});

const prediction = (
  playerId: string,
  matchId: string,
  points: number | null,
): MatchPrediction => ({
  match_id: matchId,
  player_id: playerId,
  group_id: "g1",
  predicted_team_id: "team-a",
  win_chance: 0.5,
  points,
  created_at: "2026-07-01T10:00:00.000Z",
  updated_at: "2026-07-01T10:00:00.000Z",
});

describe("predictionPoints", () => {
  it("volgt de staffel 1-4: hoe kleiner de winkans, hoe meer punten", () => {
    // Spiegel van public.prediction_points (pgTAP dekt de SQL-kant).
    expect(predictionPoints(0.75)).toBe(1);
    expect(predictionPoints(0.6)).toBe(2);
    expect(predictionPoints(0.5)).toBe(3);
    expect(predictionPoints(0.4)).toBe(3);
    expect(predictionPoints(0.25)).toBe(4);
  });

  it("klemt op 1 (extreme favoriet) en 4 (extreme underdog)", () => {
    expect(predictionPoints(0.95)).toBe(1);
    expect(predictionPoints(0.99)).toBe(1);
    expect(predictionPoints(0.05)).toBe(4);
    expect(predictionPoints(0.01)).toBe(4);
  });
});

describe("computePredictionStandings", () => {
  const profiles = {
    a: profile("a", "anna"),
    b: profile("b", "bram"),
    c: profile("c", "cas"),
  };

  it("telt beoordeelde tips, juiste tips en punten per speler", () => {
    const standings = computePredictionStandings(
      [
        prediction("a", "m1", 3),
        prediction("a", "m2", 0),
        prediction("b", "m1", 0),
        prediction("b", "m2", 4),
      ],
      profiles,
    );
    expect(standings).toHaveLength(2);
    expect(standings[0]).toMatchObject({
      player_id: "b",
      predicted: 2,
      correct: 1,
      points: 4,
    });
    expect(standings[1]).toMatchObject({
      player_id: "a",
      predicted: 2,
      correct: 1,
      points: 3,
    });
  });

  it("negeert onbeoordeelde tips (match nog open of geannuleerd)", () => {
    const standings = computePredictionStandings(
      [prediction("a", "m1", null), prediction("b", "m1", 2)],
      profiles,
    );
    expect(standings).toHaveLength(1);
    expect(standings[0].player_id).toBe("b");
  });

  it("sorteert op punten, dan juiste tips, dan minste tips, dan naam", () => {
    const standings = computePredictionStandings(
      [
        // a: 3 punten uit 2 tips (1 juist), b: 3 punten uit 1 tip (1 juist),
        // c: 3 punten uit 1 tip (1 juist) — b en c gelijk → naam beslist.
        prediction("a", "m1", 3),
        prediction("a", "m2", 0),
        prediction("b", "m1", 3),
        prediction("c", "m1", 3),
      ],
      profiles,
    );
    expect(standings.map((s) => s.player_id)).toEqual(["b", "c", "a"]);
  });

  it("een foute tip (0 punten) telt wel als beoordeeld", () => {
    const standings = computePredictionStandings(
      [prediction("a", "m1", 0)],
      profiles,
    );
    expect(standings[0]).toMatchObject({ predicted: 1, correct: 0, points: 0 });
  });
});
