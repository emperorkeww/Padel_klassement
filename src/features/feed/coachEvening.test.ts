import { describe, it, expect } from "vitest";
import { coachAvond, type AvondCtx } from "./coachEvening";
import type { EveningSummary, EveningRow } from "@/features/feed/eveningSummary";
import type { Match, Profile, Team } from "@/types";

const row = (over: Partial<EveningRow> & { playerId: string }): EveningRow => ({
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  points: 0,
  goalDiff: 0,
  ...over,
});

const summary = (over: Partial<EveningSummary> = {}): EveningSummary => ({
  matches: [],
  rows: [],
  bestDuo: null,
  biggestUpset: null,
  ...over,
});

const ctx = (over: Partial<AvondCtx> = {}): AvondCtx => ({
  intensiteit: "gemeen",
  profiles: {},
  naam: (id) => id,
  ...over,
});

const team = (id: string, ...players: string[]): Team => ({
  id,
  name: null,
  player1_id: players[0],
  player2_id: players[1] ?? null,
  created_at: "2026-07-01",
});

const match = (over: Partial<Match> & { id: string }): Match => ({
  team_a_id: "ta",
  team_b_id: "tb",
  status: "completed",
  winner_team_id: null,
  played_at: "2026-07-01T18:00:00Z",
  created_by: null,
  created_at: "2026-07-01T18:00:00Z",
  group_id: "g1",
  round_number: null,
  score_a: null,
  score_b: null,
  format: "2v2",
  ...over,
});

describe("coachAvond", () => {
  it("geeft niets terug zonder spelers", () => {
    expect(coachAvond(summary(), "g1|2026-07-01", ctx())).toEqual([]);
  });

  it("hypet de held van de avond", () => {
    const s = summary({ rows: [row({ playerId: "p1", won: 3, played: 3 })] });
    const uit = coachAvond(s, "g1|2026-07-01", ctx());
    expect(uit[0]).toContain("p1");
    expect(uit[0]).toMatch(/winst/);
  });

  it("sneert de afgang van de avond, en respecteert het schild", () => {
    const rows = [
      row({ playerId: "p1", won: 2, played: 2 }),
      row({ playerId: "p3", won: 0, lost: 2, played: 2 }),
    ];
    const zonderSchild = coachAvond(summary({ rows }), "g1|d", ctx());
    // Tweede regel gaat over de afgang p3, met een sneer (streepje).
    expect(zonderSchild.some((l) => l.includes("p3") && l.includes("—"))).toBe(true);

    const metSchild = coachAvond(
      summary({ rows }),
      "g1|d",
      ctx({ profiles: { p3: { roast_schild: true } as Profile } }),
    );
    const afgangregel = metSchild.find((l) => l.includes("p3"));
    expect(afgangregel).toBeTruthy();
    expect(afgangregel).not.toContain("—"); // schild → enkel het feit
  });

  it("meldt een upset als cijfer-observatie", () => {
    const s = summary({
      rows: [row({ playerId: "p1", won: 1, played: 1 })],
      biggestUpset: { winnerTeamId: "t1", chance: 0.18, matchId: "m1" },
    });
    const uit = coachAvond(s, "g1|d", ctx());
    expect(uit.some((l) => l.includes("18%"))).toBe(true);
  });

  it("is deterministisch op de seed", () => {
    const s = summary({
      rows: [
        row({ playerId: "p1", won: 2, played: 2 }),
        row({ playerId: "p3", won: 0, lost: 2, played: 2 }),
      ],
      matches: [{} as never, {} as never],
    });
    expect(coachAvond(s, "g1|d", ctx())).toEqual(coachAvond(s, "g1|d", ctx()));
  });

  // ── Concrete varianten met `teams` (#580) ─────────────────────────────────
  it("noemt tegenstander en score bij een overtuigende zege van de held", () => {
    const teams = { t1: team("t1", "p1", "p2"), t2: team("t2", "p3", "p4") };
    const m = match({
      id: "m1",
      team_a_id: "t1",
      team_b_id: "t2",
      winner_team_id: "t1",
      score_a: 6,
      score_b: 1,
    });
    const s = summary({ rows: [row({ playerId: "p1", won: 1, played: 1 })], matches: [m] });
    const uit = coachAvond(s, "g1|d", ctx({ teams }));
    expect(uit[0]).toContain("6-1");
    expect(uit[0]).toContain("p3");
    expect(uit[0]).toContain("p4");
  });

  it("valt bij een nipte zege terug op de generieke flavor", () => {
    const teams = { t1: team("t1", "p1"), t2: team("t2", "p3") };
    const m = match({
      id: "m1",
      team_a_id: "t1",
      team_b_id: "t2",
      winner_team_id: "t1",
      score_a: 6,
      score_b: 5,
      format: "1v1",
    });
    const s = summary({ rows: [row({ playerId: "p1", won: 1, played: 1 })], matches: [m] });
    const uit = coachAvond(s, "g1|d", ctx({ teams }));
    expect(uit[0]).not.toContain("6-5");
    expect(uit[0]).not.toContain("p3");
  });

  it("valt zonder teams terug op de generieke held-flavor (geen score)", () => {
    const m = match({ id: "m1", winner_team_id: "ta", score_a: 6, score_b: 0 });
    const s = summary({ rows: [row({ playerId: "p1", won: 1, played: 1 })], matches: [m] });
    const uit = coachAvond(s, "g1|d", ctx());
    expect(uit[0]).not.toMatch(/\d-\d/);
  });

  it("noemt de kale bagel bij de afgang", () => {
    const teams = { t1: team("t1", "p1"), t2: team("t2", "p3") };
    const m = match({
      id: "m1",
      team_a_id: "t1",
      team_b_id: "t2",
      winner_team_id: "t1",
      score_a: 6,
      score_b: 0,
      format: "1v1",
    });
    const rows = [
      row({ playerId: "p1", won: 1, played: 1 }),
      row({ playerId: "p3", won: 0, lost: 1, played: 1 }),
    ];
    const uit = coachAvond(summary({ rows, matches: [m] }), "g1|d", ctx({ teams }));
    const afgangregel = uit.find((l) => l.includes("onderuit"));
    expect(afgangregel).toContain("0-6");
    expect(afgangregel).toMatch(/kale/);
  });

  it("noemt de winnaar bij een upset als teams beschikbaar zijn", () => {
    const teams = { t2: team("t2", "p3", "p4") };
    const s = summary({
      rows: [row({ playerId: "p1", won: 1, played: 1 })],
      biggestUpset: { winnerTeamId: "t2", chance: 0.18, matchId: "m1" },
    });
    const upsetregel = coachAvond(s, "g1|d", ctx({ teams })).find((l) => l.includes("18%"));
    expect(upsetregel).toBeTruthy();
    expect(upsetregel).toContain("p3");
  });
});
