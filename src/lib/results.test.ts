import { describe, it, expect } from "vitest";
import {
  longestStreak,
  biggestWin,
  headToHead,
  winStreak,
} from "./results";
import type { Match, Team } from "./types";

// Vier spelers, twee vaste teams: A = {p1,p2}, B = {p3,p4}.
const teams: Record<string, Team> = {
  tA: { id: "tA", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tB: { id: "tB", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
};

let seq = 0;
function match(part: Partial<Match>): Match {
  seq += 1;
  return {
    id: `m${seq}`,
    team_a_id: "tA",
    team_b_id: "tB",
    status: "completed",
    winner_team_id: null,
    played_at: `2026-07-0${seq}T12:00:00Z`,
    created_by: null,
    created_at: `2026-07-0${seq}T12:00:00Z`,
    group_id: null,
    round_number: null,
    score_a: null,
    score_b: null,
    ...part,
  };
}

// Uitslagen vanuit p1 (team A): W, W, L  (played_at oplopend m1..m3).
const aWin1 = match({ winner_team_id: "tA", score_a: 6, score_b: 2 });
const aWin2 = match({ winner_team_id: "tA", score_a: 6, score_b: 5 });
const bWin1 = match({ winner_team_id: "tB", score_a: 3, score_b: 6 });

describe("longestStreak", () => {
  it("vindt de langste rij winsten, ook al is de huidige reeks korter", () => {
    // p1: chronologisch W(m1), W(m2), L(m3) → langste = 2, huidige = 0.
    const all = [aWin1, aWin2, bWin1];
    expect(longestStreak(all, teams, "p1")).toBe(2);
    expect(winStreak(all, teams, "p1")).toBe(0);
  });

  it("is 0 zonder winsten", () => {
    expect(longestStreak([bWin1], teams, "p1")).toBe(0);
  });
});

describe("biggestWin", () => {
  it("kiest de winst met het grootste puntenverschil", () => {
    const res = biggestWin([aWin1, aWin2], teams, "p1");
    expect(res?.match.id).toBe(aWin1.id); // 6-2 (verschil 4) > 6-5 (verschil 1)
    expect(res?.margin).toBe(4);
  });

  it("negeert verliezen en scoreloze matches", () => {
    const noScore = match({ winner_team_id: "tA", score_a: null, score_b: null });
    expect(biggestWin([bWin1, noScore], teams, "p1")).toBeNull();
  });
});

describe("headToHead", () => {
  it("telt W/D/L per tegenstander vanuit de speler", () => {
    const draw = match({ winner_team_id: null, score_a: 5, score_b: 5 });
    const h = headToHead([aWin1, bWin1, draw], teams, "p1");
    // Tegenstanders p3 en p4 (team B): 1 winst, 1 verlies, 1 gelijk.
    expect(h.get("p3")).toEqual({ won: 1, drawn: 1, lost: 1, played: 3 });
    expect(h.get("p4")).toEqual({ won: 1, drawn: 1, lost: 1, played: 3 });
    // Teamgenoot p2 is geen tegenstander.
    expect(h.has("p2")).toBe(false);
  });
});
