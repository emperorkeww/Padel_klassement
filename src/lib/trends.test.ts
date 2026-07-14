import { describe, it, expect } from "vitest";
import { bestWeekday, monthlyWinRate, opponentExtremes } from "./trends";
import type { Match, Team } from "@/types";

// p1 speelt met p2 (team t-a) tegen p3+p4 (team t-b).
const TEAMS: Record<string, Team> = {
  "t-a": { id: "t-a", player1_id: "p1", player2_id: "p2" } as Team,
  "t-b": { id: "t-b", player1_id: "p3", player2_id: "p4" } as Team,
  "t-c": { id: "t-c", player1_id: "p5", player2_id: "p6" } as Team,
};

let seq = 0;
function match(playedAt: string, won: boolean, opp: "t-b" | "t-c" = "t-b"): Match {
  return {
    id: `m-${seq++}`,
    team_a_id: "t-a",
    team_b_id: opp,
    status: "completed",
    winner_team_id: won ? "t-a" : opp,
    played_at: playedAt,
    created_at: playedAt,
  } as Match;
}

describe("monthlyWinRate", () => {
  it("groepeert per maand, oplopend, met win%", () => {
    const trends = monthlyWinRate(
      [
        match("2026-05-10T18:00:00Z", true),
        match("2026-05-20T18:00:00Z", false),
        match("2026-06-05T18:00:00Z", true),
      ],
      TEAMS,
      "p1",
    );
    expect(trends.map((t) => `${t.month}:${t.rate}`)).toEqual([
      "2026-05:50",
      "2026-06:100",
    ]);
    expect(trends[0].label).toBe("mei");
  });

  it("beperkt tot de laatste N maanden met matches", () => {
    const list = ["2026-01", "2026-02", "2026-03", "2026-04"].map((m) =>
      match(`${m}-10T18:00:00Z`, true),
    );
    const trends = monthlyWinRate(list, TEAMS, "p1", 2);
    expect(trends.map((t) => t.month)).toEqual(["2026-03", "2026-04"]);
  });
});

describe("opponentExtremes", () => {
  it("vindt de sterkste (meer winst) en lastigste (meer verlies) tegenstander", () => {
    const list = [
      // Tegen t-b: 3-1 → sterkst.
      match("2026-05-01T18:00:00Z", true),
      match("2026-05-02T18:00:00Z", true),
      match("2026-05-03T18:00:00Z", true),
      match("2026-05-04T18:00:00Z", false),
      // Tegen t-c: 0-2 → lastigst.
      match("2026-05-05T18:00:00Z", false, "t-c"),
      match("2026-05-06T18:00:00Z", false, "t-c"),
    ];
    const { favorite, hardest } = opponentExtremes(list, TEAMS, "p1");
    expect(favorite?.oppId).toBe("p3"); // (of p4 — zelfde team, zelfde record)
    expect(favorite?.rate).toBe(75);
    expect(hardest?.oppId).toBe("p5");
    expect(hardest?.rate).toBe(0);
  });

  it("licht niemand uit onder de minimumgrens of bij een blanco balans", () => {
    const { favorite, hardest } = opponentExtremes(
      [match("2026-05-01T18:00:00Z", true)], // 1 duel < minGames
      TEAMS,
      "p1",
    );
    expect(favorite).toBeNull();
    expect(hardest).toBeNull();
  });
});

describe("bestWeekday", () => {
  it("kiest de weekdag met het hoogste win% (min. 3 matches)", () => {
    // 2026-07-03 = vrijdag, 2026-07-06 = maandag.
    const list = [
      match("2026-07-03T18:00:00Z", true),
      match("2026-07-10T18:00:00Z", true),
      match("2026-07-17T18:00:00Z", true),
      match("2026-07-06T18:00:00Z", false),
      match("2026-07-13T18:00:00Z", false),
      match("2026-07-20T18:00:00Z", true),
    ];
    const best = bestWeekday(list, TEAMS, "p1");
    expect(best?.label).toBe("vrijdag");
    expect(best?.rate).toBe(100);
    expect(best?.played).toBe(3);
  });

  it("geeft null bij spelen op maar één weekdag", () => {
    const list = [
      match("2026-07-03T18:00:00Z", true),
      match("2026-07-10T18:00:00Z", true),
      match("2026-07-17T18:00:00Z", true),
    ];
    expect(bestWeekday(list, TEAMS, "p1")).toBeNull();
  });
});
