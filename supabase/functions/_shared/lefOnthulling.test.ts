import { describe, expect, it } from "vitest";
import { onthullingenVoorPartners } from "./lefOnthulling.ts";

const MATCH = { id: "m1", team_a_id: "t-ab", team_b_id: "t-cd" };
const TEAMS = [
  { id: "t-ab", player1_id: "p1", player2_id: "p2" },
  { id: "t-cd", player1_id: "p3", player2_id: "p4" },
];

describe("onthullingenVoorPartners", () => {
  it("meldt de inzet aan de partner, niet aan de inzetter zelf", () => {
    const uit = onthullingenVoorPartners([MATCH], TEAMS, [
      { match_id: "m1", player_id: "p1" },
    ]);
    expect(uit).toEqual([{ matchId: "m1", inzetterId: "p1", partnerId: "p2" }]);
  });

  it("meldt niets aan de tegenstanders", () => {
    const uit = onthullingenVoorPartners([MATCH], TEAMS, [
      { match_id: "m1", player_id: "p3" },
    ]);
    expect(uit.map((o) => o.partnerId)).toEqual(["p4"]);
  });

  it("bedient beide teamgenoten als ze allebei inzetten", () => {
    const uit = onthullingenVoorPartners([MATCH], TEAMS, [
      { match_id: "m1", player_id: "p1" },
      { match_id: "m1", player_id: "p2" },
    ]);
    expect(uit).toEqual([
      { matchId: "m1", inzetterId: "p1", partnerId: "p2" },
      { matchId: "m1", inzetterId: "p2", partnerId: "p1" },
    ]);
  });

  it("laat een 1v1 met rust: zonder partner valt er niets te melden", () => {
    const solo = { id: "m2", team_a_id: "t-a", team_b_id: "t-b" };
    const uit = onthullingenVoorPartners(
      [solo],
      [
        { id: "t-a", player1_id: "p1", player2_id: null },
        { id: "t-b", player1_id: "p3", player2_id: null },
      ],
      [{ match_id: "m2", player_id: "p1" }],
    );
    expect(uit).toEqual([]);
  });

  it("negeert een inzetter die niet meer in de opstelling staat", () => {
    // Kan als de teams na het inzetten nog gewijzigd zijn (#681 gastenruil).
    const uit = onthullingenVoorPartners([MATCH], TEAMS, [
      { match_id: "m1", player_id: "p9" },
    ]);
    expect(uit).toEqual([]);
  });

  it("houdt inzetten van andere matches uit elkaar", () => {
    const tweede = { id: "m2", team_a_id: "t-ab", team_b_id: "t-cd" };
    const uit = onthullingenVoorPartners([MATCH, tweede], TEAMS, [
      { match_id: "m2", player_id: "p4" },
    ]);
    expect(uit).toEqual([{ matchId: "m2", inzetterId: "p4", partnerId: "p3" }]);
  });
});
