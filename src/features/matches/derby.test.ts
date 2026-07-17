import { describe, it, expect } from "vitest";
import { matchDerby } from "@/features/matches/derby";
import type { Match, Team } from "@/types";

const TEAMS: Record<string, Team> = {
  "t-ab": { id: "t-ab", name: null, player1_id: "a", player2_id: "b", created_at: "x" },
  "t-cd": { id: "t-cd", name: null, player1_id: "c", player2_id: "d", created_at: "x" },
  "t-a": { id: "t-a", name: null, player1_id: "a", player2_id: null, created_at: "x" },
  "t-c": { id: "t-c", name: null, player1_id: "c", player2_id: null, created_at: "x" },
};

const match = (over: Partial<Match> = {}): Match => ({
  id: "m1",
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "completed",
  winner_team_id: "t-ab",
  score_a: 6,
  score_b: 3,
  played_at: "2026-07-01T19:00:00.000Z",
  created_at: "2026-06-01T18:00:00.000Z",
  created_by: null,
  group_id: "g1",
  round_number: null,
  format: "2v2",
  ...over,
});

const ratingOf =
  (ratings: Record<string, number | null>) =>
  (pid: string): number | null =>
    ratings[pid] ?? null;

describe("matchDerby", () => {
  it("derby als alle vier de spelers in dezelfde hoofddivisie zitten", () => {
    // Sub-niveaus verschillen (Wannabe III t/m I) — nog steeds een derby.
    const band = matchDerby(
      match(),
      TEAMS,
      ratingOf({ a: 1000, b: 1040, c: 1075, d: 1099 }),
    )!;
    expect(band.naam).toBe("Wannabe");
  });

  it("geen derby zodra één speler in een andere divisie zit", () => {
    expect(
      matchDerby(match(), TEAMS, ratingOf({ a: 1000, b: 1040, c: 1075, d: 1100 })),
    ).toBeNull();
  });

  it("geen uitspraak zonder rating van één van de spelers", () => {
    expect(
      matchDerby(match(), TEAMS, ratingOf({ a: 1000, b: 1040, c: 1075 })),
    ).toBeNull();
  });

  it("geen uitspraak als een team niet geladen is", () => {
    expect(
      matchDerby(
        match({ team_b_id: "t-xx" }),
        TEAMS,
        ratingOf({ a: 1000, b: 1040 }),
      ),
    ).toBeNull();
  });

  it("singles (1v1): derby over de twee spelers", () => {
    const m = match({ team_a_id: "t-a", team_b_id: "t-c", format: "1v1" });
    expect(matchDerby(m, TEAMS, ratingOf({ a: 1150, c: 1199 }))?.naam).toBe(
      "Glazenwasser",
    );
    expect(matchDerby(m, TEAMS, ratingOf({ a: 1150, c: 1200 }))).toBeNull();
  });
});
