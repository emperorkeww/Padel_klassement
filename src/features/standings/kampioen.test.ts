import { describe, it, expect } from "vitest";
import { seizoenskampioen, vorigSeizoen } from "./kampioen";
import type { PlayerStanding } from "@/types";

const rij = (player_id: string, points: number): PlayerStanding =>
  ({
    player_id,
    username: player_id,
    full_name: null,
    played: 4,
    won: points / 3,
    drawn: 0,
    lost: 4 - points / 3,
    points,
    goal_diff: 0,
  }) as PlayerStanding;

describe("vorigSeizoen (#625)", () => {
  it("geeft het kwartaal vóór dat van nu", () => {
    expect(vorigSeizoen(new Date(2026, 6, 22)).id).toBe("2026-q2");
    expect(vorigSeizoen(new Date(2026, 3, 1)).id).toBe("2026-q1");
  });

  it("rolt over de jaarwissel terug naar Q4", () => {
    const s = vorigSeizoen(new Date(2026, 0, 1));
    expect(s.id).toBe("2025-q4");
    expect(s.label).toBe("Q4 2025");
  });
});

describe("seizoenskampioen (#625)", () => {
  it("kiest de #1 van de (al gesorteerde) seizoenstand", () => {
    const kampioen = seizoenskampioen([rij("p2", 9), rij("p1", 6)], "Q2 2026");
    expect(kampioen).toEqual({ playerId: "p2", seasonLabel: "Q2 2026" });
  });

  it("geeft null zonder spelers in het kwartaal", () => {
    expect(seizoenskampioen([], "Q2 2026")).toBeNull();
  });
});
