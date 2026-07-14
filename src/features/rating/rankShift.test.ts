import { describe, it, expect } from "vitest";
import { rankShifts } from "@/features/rating/rankShift";
import type { Match, PlayerStanding, Team } from "@/types";

const row = (
  id: string,
  username: string,
  points: number,
  extra: Partial<PlayerStanding> = {},
): PlayerStanding => ({
  player_id: id,
  username,
  full_name: null,
  played: 2,
  won: points / 3,
  drawn: 0,
  lost: 2 - points / 3,
  points,
  goal_diff: points,
  ...extra,
});

const TEAMS: Record<string, Team> = {
  "t-ab": { id: "t-ab", name: null, player1_id: "a", player2_id: "b", created_at: "x" },
  "t-cd": { id: "t-cd", name: null, player1_id: "c", player2_id: "d", created_at: "x" },
};

const match = (over: Partial<Match>): Match => ({
  id: "m1",
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "completed",
  winner_team_id: "t-ab",
  score_a: 6,
  score_b: 3,
  played_at: "2026-07-02T19:00:00.000Z",
  created_at: "2026-07-02T19:00:00.000Z",
  created_by: null,
  group_id: null,
  round_number: null,
  ...over,
});

describe("rankShifts", () => {
  it("laat winnaars stijgen en verliezers zakken t.o.v. de vorige speeldag", () => {
    // Huidige stand ná de 6–3-winst van a/b: iedereen 3 punten, saldo 0,
    // dus alfabetische volgorde a, b, c, d.
    const stats = { played: 2, won: 1, drawn: 0, lost: 1, goal_diff: 0 };
    const standings = [
      row("a", "alice", 3, stats),
      row("b", "bob", 3, stats),
      row("c", "carol", 3, stats),
      row("d", "dave", 3, stats),
    ];
    // Teruggedraaid stond c/d op 3 punten (saldo +3) en a/b op 0 (saldo −3):
    // c en d stonden dus eerste en tweede, a en b derde en vierde.
    const shifts = rankShifts(standings, [match({})], TEAMS);
    expect(shifts.get("a")).toBe(2); // van 3 naar 1
    expect(shifts.get("b")).toBe(2); // van 4 naar 2
    expect(shifts.get("c")).toBe(-2);
    expect(shifts.get("d")).toBe(-2);
  });

  it("markeert spelers zonder eerdere matches als nieuw", () => {
    const standings = [
      row("a", "alice", 3, { played: 1, won: 1, lost: 0, goal_diff: 3 }),
      row("b", "bob", 3, { played: 1, won: 1, lost: 0, goal_diff: 3 }),
      row("c", "carol", 0, { played: 1, won: 0, lost: 1, goal_diff: -3 }),
      row("d", "dave", 0, { played: 1, won: 0, lost: 1, goal_diff: -3 }),
    ];
    const shifts = rankShifts(standings, [match({})], TEAMS);
    // Iedereen speelde zijn allereerste match op de laatste speeldag.
    for (const id of ["a", "b", "c", "d"]) expect(shifts.get(id)).toBe("nieuw");
  });

  it("respecteert het groepsfilter en geeft niets terug zonder matches", () => {
    const standings = [row("a", "alice", 3)];
    expect(rankShifts(standings, [match({ group_id: "g1" })], TEAMS, "g2").size).toBe(0);
    expect(rankShifts(standings, [], TEAMS).size).toBe(0);
  });

  it("draait een gelijkspel correct terug", () => {
    const standings = [
      row("a", "alice", 4, { drawn: 1, won: 1, lost: 0, goal_diff: 3 }),
      row("c", "carol", 1, { drawn: 1, won: 0, lost: 1, goal_diff: -3 }),
    ];
    const shifts = rankShifts(
      standings,
      [match({ winner_team_id: null, score_a: 5, score_b: 5 })],
      TEAMS,
    );
    // Beide spelers verliezen 1 punt (gelijkspel) — volgorde blijft gelijk.
    expect(shifts.get("a")).toBe(0);
    expect(shifts.get("c")).toBe(0);
  });
});
