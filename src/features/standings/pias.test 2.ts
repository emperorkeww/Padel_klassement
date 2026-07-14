import { describe, it, expect } from "vitest";
import { currentPias, isoParts, pickPias, type PiasWeek } from "@/features/standings/pias";
import type { Match, RatingPoint, Team } from "@/types";

const team = (id: string, p1: string, p2: string): Team =>
  ({ id, name: null, player1_id: p1, player2_id: p2, created_at: "" }) as Team;

const TEAMS: Record<string, Team> = {
  strong: team("strong", "p1", "p2"),
  weak: team("weak", "p3", "p4"),
  mid: team("mid", "p5", "p6"),
};

const match = (
  id: string,
  winner: string | null,
  over: Partial<Match> = {},
): Match =>
  ({
    id,
    team_a_id: "strong",
    team_b_id: "weak",
    status: "completed",
    winner_team_id: winner,
    played_at: "2026-07-08T18:00:00Z", // woensdag, ISO-week begint ma 2026-07-06
    created_at: "2026-07-08T18:00:00Z",
    group_id: "g1",
    round_number: null,
    score_a: null,
    score_b: null,
    created_by: null,
    ...over,
  }) as Match;

const point = (matchId: string, before: number): RatingPoint =>
  ({
    match_id: matchId,
    rating_before: before,
    rating_after: before,
    delta: 0,
    played_at: "",
  }) as RatingPoint;

// strong (1300/1250) is torenhoog favoriet tegen weak (1000/1000).
const HIST: Record<string, RatingPoint[]> = {
  p1: [point("m1", 1300)],
  p2: [point("m1", 1250)],
  p3: [point("m1", 1000)],
  p4: [point("m1", 1000)],
};

describe("pickPias — choke-detectie", () => {
  it("kiest de favoriet die verloor; pias = hoogst-gerate verliezer", () => {
    const rows = pickPias([match("m1", "weak")], TEAMS, HIST);
    expect(rows).toHaveLength(1);
    expect(rows[0].groupId).toBe("g1");
    expect(rows[0].playerId).toBe("p1"); // 1300 > 1250
    expect(rows[0].matchId).toBe("m1");
    expect(rows[0].weekStart).toBe("2026-07-06");
    expect(rows[0].winChance).toBeGreaterThan(0.65);
  });

  it("negeert de favoriet die gewoon wint (geen choke)", () => {
    expect(pickPias([match("m1", "strong")], TEAMS, HIST)).toEqual([]);
  });

  it("negeert een gelijkspel", () => {
    expect(pickPias([match("m1", null)], TEAMS, HIST)).toEqual([]);
  });

  it("negeert een underdog die verliest (verliezer was geen favoriet)", () => {
    // weak verliest van strong: verliezer had ~15% kans, geen choke.
    const rows = pickPias(
      [match("m1", "strong", { team_a_id: "weak", team_b_id: "strong" })],
      TEAMS,
      HIST,
    );
    expect(rows).toEqual([]);
  });

  it("negeert matches zonder groep", () => {
    expect(pickPias([match("m1", "weak", { group_id: null })], TEAMS, HIST)).toEqual(
      [],
    );
  });

  it("kiest per (groep, week) de pijnlijkste choke", () => {
    // m1: 1300/1250 favoriet flopt (grote kans). m2: 1150/1150 kleiner favoriet.
    const hist: Record<string, RatingPoint[]> = {
      p1: [point("m1", 1300)],
      p2: [point("m1", 1250)],
      p3: [point("m1", 1000), point("m2", 1000)],
      p4: [point("m1", 1000), point("m2", 1000)],
      p5: [point("m2", 1150)],
      p6: [point("m2", 1150)],
    };
    const m2 = match("m2", "weak", { team_a_id: "mid", team_b_id: "weak" });
    const rows = pickPias([match("m1", "weak"), m2], TEAMS, hist);
    expect(rows).toHaveLength(1);
    expect(rows[0].matchId).toBe("m1");
  });
});

describe("currentPias", () => {
  const row = (weekStart: string): PiasWeek => ({
    groupId: "g1",
    isoYear: 2026,
    isoWeek: 1,
    weekStart,
    playerId: "p1",
    matchId: "m",
    winChance: 0.8,
  });

  it("kiest de rij van de lopende week", () => {
    const rows = [row("2026-06-29"), row("2026-07-06")];
    const now = new Date("2026-07-08T10:00:00Z");
    expect(currentPias(rows, now)?.weekStart).toBe("2026-07-06");
  });

  it("valt terug op de meest recente rij buiten een lopende week", () => {
    const rows = [row("2026-06-29"), row("2026-07-06")];
    const now = new Date("2026-08-01T10:00:00Z");
    expect(currentPias(rows, now)?.weekStart).toBe("2026-07-06");
  });

  it("null zonder rijen", () => {
    expect(currentPias([], new Date("2026-07-08T10:00:00Z"))).toBeNull();
  });
});

describe("isoParts", () => {
  it("geeft de maandag van de ISO-week", () => {
    expect(isoParts(new Date("2026-07-08T18:00:00Z")).weekStart).toBe(
      "2026-07-06",
    );
  });
});
