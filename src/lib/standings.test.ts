import { describe, it, expect } from "vitest";
import {
  computePlayerStandings,
  computeTeamStandings,
  matchesInSeason,
  matchesUpTo,
  rankProgression,
} from "./standings";
import { seasonFromId } from "./seasons";
import type { Match, Profile, Team } from "./types";

const NOW = "2026-05-10T10:00:00.000Z";

function profile(id: string, username: string, full_name: string): Profile {
  return { id, username, full_name, avatar_url: null, created_at: NOW };
}

function team(id: string, p1: string, p2: string): Team {
  return { id, name: null, player1_id: p1, player2_id: p2, created_at: NOW };
}

function match(over: Partial<Match> & Pick<Match, "id" | "team_a_id" | "team_b_id">): Match {
  return {
    status: "completed",
    winner_team_id: null,
    played_at: NOW,
    created_by: "p1",
    created_at: NOW,
    group_id: null,
    round_number: null,
    score_a: null,
    score_b: null,
    ...over,
  };
}

const PROFILES = {
  p1: profile("p1", "alice", "Alice Anders"),
  p2: profile("p2", "bob", "Bob Boers"),
  p3: profile("p3", "carol", "Carol Claes"),
  p4: profile("p4", "dave", "Dave De Vos"),
};

const TEAMS = {
  "t-ab": team("t-ab", "p1", "p2"),
  "t-cd": team("t-cd", "p3", "p4"),
};

// Winst, gelijkspel en verlies voor beide teams; plus een geplande match
// die niet mag meetellen en een uitslag zonder scores (saldo 0).
const MATCHES: Match[] = [
  match({ id: "m1", team_a_id: "t-ab", team_b_id: "t-cd", winner_team_id: "t-ab", score_a: 6, score_b: 3 }),
  match({ id: "m2", team_a_id: "t-ab", team_b_id: "t-cd", score_a: 4, score_b: 4 }),
  match({ id: "m3", team_a_id: "t-cd", team_b_id: "t-ab", winner_team_id: "t-cd" }),
  match({ id: "m4", team_a_id: "t-ab", team_b_id: "t-cd", status: "scheduled", played_at: null }),
];

describe("computePlayerStandings", () => {
  it("telt punten (3/1/0), saldo en aantallen zoals de player_standings-view", () => {
    const rows = computePlayerStandings(MATCHES, TEAMS, PROFILES);
    const alice = rows.find((r) => r.player_id === "p1")!;
    expect(alice).toMatchObject({
      username: "alice",
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      points: 4,
      goal_diff: 3, // (6-3) + (4-4) + ontbrekende scores als 0
    });
    const carol = rows.find((r) => r.player_id === "p3")!;
    expect(carol).toMatchObject({ played: 3, won: 1, drawn: 1, lost: 1, points: 4, goal_diff: -3 });
  });

  it("negeert niet-afgeronde matches", () => {
    const rows = computePlayerStandings(
      [match({ id: "m", team_a_id: "t-ab", team_b_id: "t-cd", status: "scheduled", played_at: null })],
      TEAMS,
      PROFILES,
    );
    expect(rows).toEqual([]);
  });

  it("sorteert op punten, dan saldo, dan naam", () => {
    const rows = computePlayerStandings(MATCHES, TEAMS, PROFILES);
    // Iedereen 4 punten; saldo +3 gaat voor -3, daarna alfabetisch op username.
    expect(rows.map((r) => r.username)).toEqual(["alice", "bob", "carol", "dave"]);
  });

  it("laat winst voorgaan op naam bij gelijke punten en gelijk saldo", () => {
    const profiles = {
      ...PROFILES,
      p5: profile("p5", "zoe", "Zoe Zeger"),
      p6: profile("p6", "yves", "Yves IJzer"),
    };
    const teams = {
      ...TEAMS,
      "t-z": team("t-z", "p5", "p6"),
    };
    // t-ab: 1 winst = 3 ptn, saldo 0. t-z: 3 gelijkspelen = 3 ptn, saldo 0.
    // Ondanks "alice" < "zoe" alfabetisch andersom: winst telt eerst… en hier
    // wint juist t-ab, dus zetten we de usernames expres "verkeerd om".
    const matches = [
      match({ id: "w", team_a_id: "t-z", team_b_id: "t-cd", winner_team_id: "t-z" }),
      match({ id: "d1", team_a_id: "t-ab", team_b_id: "t-cd" }),
      match({ id: "d2", team_a_id: "t-ab", team_b_id: "t-cd" }),
      match({ id: "d3", team_a_id: "t-ab", team_b_id: "t-cd" }),
    ];
    const rows = computePlayerStandings(matches, teams, profiles);
    // p5/p6 (1 winst, 3 ptn) vóór p1/p2 (3 gelijkspelen, 3 ptn).
    expect(rows.slice(0, 2).map((r) => r.player_id).sort()).toEqual(["p5", "p6"]);
  });
});

describe("computeTeamStandings", () => {
  it("telt per team en sorteert op punten, saldo, winst", () => {
    const rows = computeTeamStandings(MATCHES, TEAMS);
    expect(rows.map((r) => r.team_id)).toEqual(["t-ab", "t-cd"]);
    expect(rows[0]).toMatchObject({
      team_name: null,
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      points: 4,
      goal_diff: 3,
    });
  });
});

describe("matchesInSeason", () => {
  const q2 = seasonFromId("2026-q2")!;

  it("neemt de start inclusief en het einde exclusief", () => {
    const atStart = match({ id: "s", team_a_id: "t-ab", team_b_id: "t-cd", played_at: q2.start.toISOString() });
    const inside = match({ id: "i", team_a_id: "t-ab", team_b_id: "t-cd", played_at: "2026-05-15T18:00:00.000Z" });
    const atEnd = match({ id: "e", team_a_id: "t-ab", team_b_id: "t-cd", played_at: q2.end.toISOString() });
    const before = match({ id: "b", team_a_id: "t-ab", team_b_id: "t-cd", played_at: new Date(q2.start.getTime() - 1).toISOString() });
    const kept = matchesInSeason([atStart, inside, atEnd, before], q2);
    expect(kept.map((m) => m.id)).toEqual(["s", "i"]);
  });

  it("valt terug op created_at zonder played_at", () => {
    const m = match({ id: "c", team_a_id: "t-ab", team_b_id: "t-cd", played_at: null, created_at: "2026-05-01T10:00:00.000Z" });
    expect(matchesInSeason([m], q2)).toHaveLength(1);
    expect(matchesInSeason([m], seasonFromId("2026-q1")!)).toHaveLength(0);
  });
});

describe("matchesUpTo", () => {
  const ms: Match[] = [
    match({ id: "a", team_a_id: "t-ab", team_b_id: "t-cd", played_at: "2026-01-01T10:00:00Z", winner_team_id: "t-ab" }),
    match({ id: "b", team_a_id: "t-ab", team_b_id: "t-cd", played_at: "2026-02-01T10:00:00Z", winner_team_id: "t-ab" }),
    match({ id: "c", team_a_id: "t-ab", team_b_id: "t-cd", played_at: "2026-03-01T10:00:00Z", winner_team_id: "t-ab" }),
  ];
  it("houdt alleen matches op of vóór de datum (inclusief die dag)", () => {
    expect(matchesUpTo(ms, "2026-02-01").map((m) => m.id)).toEqual(["a", "b"]);
    expect(matchesUpTo(ms, "2026-01-15").map((m) => m.id)).toEqual(["a"]);
    expect(matchesUpTo(ms, "2025-12-31")).toEqual([]);
  });
});

describe("rankProgression", () => {
  it("geeft de positie na elke eigen speeldag, cumulatief herrekend", () => {
    // Dag 1: alice&bob winnen (3 ptn); dag 2: carol&dave winnen twee keer (6 ptn).
    const ms: Match[] = [
      match({ id: "1", team_a_id: "t-ab", team_b_id: "t-cd", played_at: "2026-01-01T10:00:00Z", winner_team_id: "t-ab", score_a: 6, score_b: 0 }),
      match({ id: "2", team_a_id: "t-cd", team_b_id: "t-ab", played_at: "2026-01-02T10:00:00Z", winner_team_id: "t-cd", score_a: 6, score_b: 0 }),
      match({ id: "3", team_a_id: "t-cd", team_b_id: "t-ab", played_at: "2026-01-02T12:00:00Z", winner_team_id: "t-cd", score_a: 6, score_b: 0 }),
    ];
    const prog = rankProgression(ms, TEAMS, PROFILES, "p3"); // carol
    expect(prog.map((p) => p.date)).toEqual(["2026-01-01", "2026-01-02"]);
    expect(prog[0].rank).toBe(3); // dag 1: nog onderaan (0 ptn)
    expect(prog[prog.length - 1].rank).toBe(1); // dag 2: naar de top
  });
});
