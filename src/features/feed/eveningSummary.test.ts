import { describe, it, expect } from "vitest";
import { eveningSummary } from "@/features/feed/eveningSummary";
import type { Match, RatingPoint, Team } from "@/types";

const pt = (matchId: string, before: number): RatingPoint => ({
  match_id: matchId,
  rating_before: before,
  rating_after: before,
  delta: 0,
  played_at: "2026-07-02T19:00:00.000Z",
});

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
  format: "2v2",
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
      "UTC",
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
      "UTC",
    );
    // c/d: 2 winsten (6 ptn), a/b: 1 winst (3 ptn).
    expect(s.rows[0].playerId).toMatch(/c|d/);
    expect(s.rows[0].points).toBe(6);
    expect(s.bestDuo).toEqual({ teamId: "t-cd", won: 2 });
  });

  it("rekent in de opgegeven tijdzone, niet in UTC (#783)", () => {
    // 2026-07-02T22:30Z is in Europe/Brussels (zomertijd, UTC+2) al
    // 2026-07-03T00:30 — dus clubdag "03", ook al is de UTC-kalenderdag nog "02".
    const s = eveningSummary(
      [match({ played_at: "2026-07-02T22:30:00.000Z" })],
      TEAMS,
      "2026-07-03",
      "Europe/Brussels",
    );
    expect(s.matches).toHaveLength(1);
  });

  it("geeft geen beste duo bij enkel gelijkspel", () => {
    const s = eveningSummary(
      [match({ winner_team_id: null, score_a: 5, score_b: 5 })],
      TEAMS,
      "2026-07-02",
      "UTC",
    );
    expect(s.bestDuo).toBeNull();
    expect(s.rows[0].points).toBe(1);
  });
});

describe("eveningSummary — grootste upset (#85)", () => {
  it("is null zonder rating-historie", () => {
    const s = eveningSummary([match({ id: "m1" })], TEAMS, "2026-07-02", "UTC");
    expect(s.biggestUpset).toBeNull();
  });

  it("kiest de gewonnen match met de laagste winkans", () => {
    // m1: t-ab (950) wint van t-cd (1150) → ≈24% (upset).
    // m2: t-ab (990) wint van t-cd (1090) → ≈36% (geen upset).
    const matches = [
      match({ id: "m1", winner_team_id: "t-ab" }),
      match({ id: "m2", winner_team_id: "t-ab" }),
    ];
    const histories: Record<string, RatingPoint[]> = {
      a: [pt("m1", 950), pt("m2", 990)],
      b: [pt("m1", 950), pt("m2", 990)],
      c: [pt("m1", 1150), pt("m2", 1090)],
      d: [pt("m1", 1150), pt("m2", 1090)],
    };
    const s = eveningSummary(matches, TEAMS, "2026-07-02", "UTC", histories);
    expect(s.biggestUpset?.matchId).toBe("m1");
    expect(s.biggestUpset?.winnerTeamId).toBe("t-ab");
    expect(Math.round((s.biggestUpset?.chance ?? 0) * 100)).toBe(24);
  });

  it("negeert gelijkspel", () => {
    const s = eveningSummary(
      [match({ id: "m1", winner_team_id: null, score_a: 5, score_b: 5 })],
      TEAMS,
      "2026-07-02",
      "UTC",
      { a: [pt("m1", 950)], b: [pt("m1", 950)], c: [pt("m1", 1150)], d: [pt("m1", 1150)] },
    );
    expect(s.biggestUpset).toBeNull();
  });
});
