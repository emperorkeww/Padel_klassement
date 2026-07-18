import { describe, it, expect } from "vitest";
import { partnerSynergy, synergyExtremes } from "@/features/profiles/synergy";
import type { Match, Team } from "@/types";

// p1 speelt met wisselende maatjes (t-a met p2, t-d met p5, t-e met p7) tegen
// de tegenteams t-b/t-c. t-s is een singles-"team" (geen partner).
const TEAMS: Record<string, Team> = {
  "t-a": { id: "t-a", player1_id: "p1", player2_id: "p2" } as Team,
  "t-d": { id: "t-d", player1_id: "p1", player2_id: "p5" } as Team,
  "t-e": { id: "t-e", player1_id: "p1", player2_id: "p7" } as Team,
  "t-b": { id: "t-b", player1_id: "p3", player2_id: "p4" } as Team,
  "t-c": { id: "t-c", player1_id: "p8", player2_id: "p9" } as Team,
  "t-s": { id: "t-s", player1_id: "p1", player2_id: null } as Team,
};

type Uitslag = "W" | "L" | "D";
let seq = 0;
function match(myTeam: string, uitslag: Uitslag, opp = "t-b"): Match {
  return {
    id: `m-${seq++}`,
    team_a_id: myTeam,
    team_b_id: opp,
    status: "completed",
    winner_team_id:
      uitslag === "W" ? myTeam : uitslag === "L" ? opp : null,
    score_a: uitslag === "D" ? 6 : undefined,
    score_b: uitslag === "D" ? 6 : undefined,
    played_at: "2026-06-01T18:00:00Z",
    created_at: "2026-06-01T18:00:00Z",
  } as Match;
}

describe("partnerSynergy", () => {
  it("telt per maatje samen/gewonnen/verloren/gelijk en win%", () => {
    const rows = partnerSynergy(
      [
        match("t-a", "W"),
        match("t-a", "W"),
        match("t-a", "D"),
        match("t-d", "L"),
        match("t-d", "W"),
      ],
      TEAMS,
      "p1",
    );
    const p2 = rows.find((r) => r.partnerId === "p2")!;
    expect(p2).toMatchObject({
      samen: 3,
      gewonnen: 2,
      gelijk: 1,
      verloren: 0,
      rate: 67,
    });
    const p5 = rows.find((r) => r.partnerId === "p5")!;
    expect(p5).toMatchObject({ samen: 2, gewonnen: 1, verloren: 1, rate: 50 });
  });

  it("sorteert op win% aflopend, dan op aantal matches", () => {
    const rows = partnerSynergy(
      [
        match("t-a", "W"),
        match("t-a", "L"), // p2: 1/2 = 50%
        match("t-d", "W"),
        match("t-d", "W"), // p5: 2/2 = 100%
      ],
      TEAMS,
      "p1",
    );
    expect(rows.map((r) => r.partnerId)).toEqual(["p5", "p2"]);
  });

  it("negeert singles (geen partner)", () => {
    const rows = partnerSynergy([match("t-s", "W")], TEAMS, "p1");
    expect(rows).toEqual([]);
  });
});

describe("synergyExtremes", () => {
  it("kiest Dream Team (hoogste) en Choke Combo (laagste) met genoeg matches", () => {
    const rows = partnerSynergy(
      [
        // p2: 3× winst → 100%
        match("t-a", "W"),
        match("t-a", "W"),
        match("t-a", "W"),
        // p5: 4 matches, 1 winst → 25%
        match("t-d", "W"),
        match("t-d", "L"),
        match("t-d", "L"),
        match("t-d", "L"),
        // p7: maar 1 match → onder de drempel
        match("t-e", "L"),
      ],
      TEAMS,
      "p1",
    );
    const { dreamTeam, chokeCombo } = synergyExtremes(rows);
    expect(dreamTeam?.partnerId).toBe("p2");
    expect(chokeCombo?.partnerId).toBe("p5");
  });

  it("laat de Choke Combo leeg bij maar één gekwalificeerd duo", () => {
    const rows = partnerSynergy(
      [match("t-a", "W"), match("t-a", "W"), match("t-a", "L")],
      TEAMS,
      "p1",
    );
    const { dreamTeam, chokeCombo } = synergyExtremes(rows);
    expect(dreamTeam?.partnerId).toBe("p2");
    expect(chokeCombo).toBeNull();
  });
});
