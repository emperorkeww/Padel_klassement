import { describe, it, expect } from "vitest";
import { dayMovers } from "./dayOverview";
import type { RatingPoint } from "@/types";

function pt(match_id: string, delta: number): RatingPoint {
  return {
    match_id,
    delta,
    rating_before: 1000,
    rating_after: 1000 + delta,
    played_at: "2026-07-14T18:00:00Z",
  } as RatingPoint;
}

describe("dayMovers", () => {
  const histories: Record<string, RatingPoint[]> = {
    winner: [pt("m1", 12), pt("m2", 8), pt("old", 30)],
    loser: [pt("m1", -12), pt("m2", -4)],
    outsider: [pt("old", 5)],
  };
  const todayIds = new Set(["m1", "m2"]);

  it("sommeert de delta per speler over de matches van vandaag", () => {
    const movers = dayMovers(histories, todayIds);
    expect(movers).toEqual([
      { playerId: "winner", delta: 20 },
      { playerId: "loser", delta: -16 },
    ]);
  });

  it("negeert punten van andere dagen en spelers zonder match vandaag", () => {
    const movers = dayMovers(histories, todayIds);
    expect(movers.map((m) => m.playerId)).not.toContain("outsider");
    // 'winner' telt 'old' (30) niet mee → 20, niet 50.
    expect(movers[0].delta).toBe(20);
  });

  it("geeft een lege lijst als geen enkele match vandaag is", () => {
    expect(dayMovers(histories, new Set())).toEqual([]);
  });
});
