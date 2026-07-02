import { describe, it, expect } from "vitest";
import { eveningSummary } from "./eveningSummary";
import type { Match, Team } from "./types";

const TEAMS: Record<string, Team> = {
  "t-ab": { id: "t-ab", name: null, player1_id: "a", player2_id: "b", created_at: "x" },
  "t-cd": { id: "t-cd", name: null, player1_id: "c", player2_id: "d", created_at: "x" },
};

const match = (over: Partial<Match>): Match => ({
  id: Math.random().toString(36).slice(2),
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "completed",
  winner_team_id: "t-ab",
  score_a: 6,
  score_b: 3,
  played_at: "2026-07-02T19:00:00.000Z",
  created_at: "2026-07-02T18:00:00.000Z",
  created_by: null,
  group_id: "g1",
  round_number: null,
  ...over,
});

describe("eveningSummary", () => {
  it("telt alleen de afgeronde matches van de gevraagde dag", () => {
    const s = eveningSummary(
      [
        match({}),
        match({ played_at: "2026-07-01T19:00:00.000Z" }), // gisteren
        match({ status: "scheduled", winner_team_id: null }), // nog niet gespeeld
      ],
      TEAMS,
      "2026-07-02",
    );
    expect(s.matches).toHaveLength(1);
    expect(s.rows.find((r) => r.playerId === "a")?.points).toBe(3);
  });

  it("rangschikt op punten en saldo en wijst het beste duo aan", () => {
    const s = eveningSummary(
      [
        match({}), // a/b winnen 6-3
        match({ winner_team_id: "t-cd", score_a: 2, score_b: 6 }), // c/d winnen 6-2
        match({ winner_team_id: "t-cd", score_a: 4, score_b: 6 }), // c/d winnen 6-4
      ],
      TEAMS,
      "2026-07-02",
    );
    // c/d: 2 winsten (6 ptn), a/b: 1 winst (3 ptn).
    expect(s.rows[0].playerId).toMatch(/c|d/);
    expect(s.rows[0].points).toBe(6);
    expect(s.bestDuo).toEqual({ teamId: "t-cd", won: 2 });
  });

  it("geeft geen beste duo bij enkel gelijkspel", () => {
    const s = eveningSummary(
      [match({ winner_team_id: null, score_a: 5, score_b: 5 })],
      TEAMS,
      "2026-07-02",
    );
    expect(s.bestDuo).toBeNull();
    expect(s.rows[0].points).toBe(1);
  });
});
