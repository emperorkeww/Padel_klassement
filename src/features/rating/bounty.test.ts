import { describe, expect, it } from "vitest";
import {
  BOUNTY_BASIS,
  BOUNTY_MAX,
  bountiesVoor,
  bountyPool,
  matchBounties,
  type ActiveBounty,
} from "./bounty";
import type { Team } from "@/types";

// Spiegel-tests: dezelfde gevallen als supabase/tests/bounty_test.sql, zodat de
// waarde op de kaart en de waarde die de databank uitkeert niet uit elkaar
// kunnen lopen.

const bounty = (
  playerId: string,
  groupId: string | null,
  pool: number,
  reden: ActiveBounty["reden"] = groupId ? "bigdaddy" : "dictator",
): ActiveBounty => ({ playerId, groupId, reden, streak: 0, pool });

const team = (id: string, p1: string, p2: string | null): Team =>
  ({ id, player1_id: p1, player2_id: p2 }) as Team;

describe("bountyPool", () => {
  it("start op de basiswaarde zonder zegereeks", () => {
    expect(bountyPool(0)).toBe(BOUNTY_BASIS);
  });

  it("legt er per opeenvolgende zege drie bij", () => {
    expect(bountyPool(1)).toBe(18);
    expect(bountyPool(3)).toBe(24);
  });

  it("stopt op het plafond", () => {
    expect(bountyPool(5)).toBe(BOUNTY_MAX);
    expect(bountyPool(20)).toBe(BOUNTY_MAX);
  });

  it("behandelt een negatieve reeks als geen reeks", () => {
    expect(bountyPool(-3)).toBe(BOUNTY_BASIS);
  });
});

describe("bountiesVoor", () => {
  const rijen = [
    bounty("dictator", null, 21),
    bounty("kroon-a", "groep-a", 15),
    bounty("kroon-b", "groep-b", 30),
  ];

  it("neemt de troon overal mee", () => {
    expect(bountiesVoor(rijen, null)).toEqual({ dictator: 21 });
    expect(bountiesVoor(rijen, "groep-a").dictator).toBe(21);
  });

  it("neemt alleen de kroon van de gevraagde groep mee", () => {
    const pools = bountiesVoor(rijen, "groep-a");
    expect(pools["kroon-a"]).toBe(15);
    expect(pools["kroon-b"]).toBeUndefined();
  });

  it("telt een speler die beide draagt maar één keer", () => {
    const dubbel = [bounty("x", null, 24), bounty("x", "groep-a", 24)];
    expect(bountiesVoor(dubbel, "groep-a")).toEqual({ x: 24 });
  });
});

describe("matchBounties", () => {
  const teams = {
    ta: team("ta", "kroon-a", "partner"),
    tb: team("tb", "uitdager-1", "uitdager-2"),
    solo: team("solo", "dictator", null),
  };
  const rijen = [bounty("dictator", null, 21), bounty("kroon-a", "groep-a", 15)];

  it("vindt de drager in de match van zijn eigen groep", () => {
    const gevonden = matchBounties(
      rijen,
      { group_id: "groep-a", team_a_id: "ta", team_b_id: "tb" },
      teams,
    );
    expect(gevonden).toEqual([{ playerId: "kroon-a", pool: 15 }]);
  });

  it("laat de kroon van een andere groep buiten beschouwing", () => {
    const gevonden = matchBounties(
      rijen,
      { group_id: "groep-b", team_a_id: "ta", team_b_id: "tb" },
      teams,
    );
    expect(gevonden).toEqual([]);
  });

  it("neemt de troon ook mee in een match zonder groep", () => {
    const gevonden = matchBounties(
      rijen,
      { group_id: null, team_a_id: "solo", team_b_id: "tb" },
      teams,
    );
    expect(gevonden).toEqual([{ playerId: "dictator", pool: 21 }]);
  });
});
