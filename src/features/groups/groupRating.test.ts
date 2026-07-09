import { describe, it, expect } from "vitest";
import { groupRatingStandings, playedInGroup } from "./groupRating";
import type { Match, PlayerRating, Team } from "../../lib/types";

const rating = (id: string, r: number, games = 5): PlayerRating => ({
  player_id: id,
  rating: r,
  games,
  updated_at: "2026-07-08T10:00:00Z",
});

const NAMES: Record<string, string> = {
  p1: "Alice",
  p2: "Bob",
  p3: "Carol",
  p4: "Dave",
  p5: "Erik",
};
const nameOf = (id: string) => NAMES[id] ?? id;

describe("groupRatingStandings", () => {
  it("sorteert op rating, dan matches, dan naam; niet-gespeeld onderaan", () => {
    const rows = groupRatingStandings(
      ["p1", "p2", "p3", "p4", "p5"],
      {
        p1: rating("p1", 1012, 10),
        p2: rating("p2", 1012, 4), // zelfde rating, minder matches → na p1
        p3: rating("p3", 988),
        // p4 en p5 speelden nog nooit → onderaan op naam (Dave, Erik)
      },
      {},
      nameOf,
    );
    expect(rows.map((r) => r.playerId)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(rows[3].rating).toBeNull();
  });

  it("markeert dunne ratings (< 3 matches) en nooit-gespeeld niet", () => {
    const rows = groupRatingStandings(
      ["p1", "p2", "p3"],
      { p1: rating("p1", 1020, 2), p2: rating("p2", 1000, 3) },
      {},
      nameOf,
    );
    expect(rows.find((r) => r.playerId === "p1")?.thin).toBe(true);
    expect(rows.find((r) => r.playerId === "p2")?.thin).toBe(false);
    expect(rows.find((r) => r.playerId === "p3")?.thin).toBe(false); // null-rating: geen dim, eigen label
  });
});

describe("playedInGroup", () => {
  it("telt alleen afgeronde matches, per speler via de teams", () => {
    const teams: Record<string, Team> = {
      "t-ab": { id: "t-ab", player1_id: "p1", player2_id: "p2" } as Team,
      "t-cd": { id: "t-cd", player1_id: "p3", player2_id: "p4" } as Team,
    };
    const matches = [
      { team_a_id: "t-ab", team_b_id: "t-cd", status: "completed" },
      { team_a_id: "t-ab", team_b_id: "t-cd", status: "planned" }, // telt niet
      { team_a_id: "t-ab", team_b_id: "t-cd", status: "completed" },
    ] as Match[];
    const counts = playedInGroup(matches, teams);
    expect(counts).toEqual({ p1: 2, p2: 2, p3: 2, p4: 2 });
  });
});
