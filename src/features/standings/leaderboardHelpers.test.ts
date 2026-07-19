import { describe, it, expect } from "vitest";
import { splitDictatorThrone } from "./leaderboardHelpers";

// Compacte rijen — splitDictatorThrone kijkt enkel naar `rating`.
const row = (key: string, rating: number | null) => ({ key, rating });

describe("splitDictatorThrone (#528)", () => {
  it("splitst een dictator-#1 (rating 1600+) af; het volk begint bij #2", () => {
    const rows = [
      row("dictator", 1687),
      row("a", 1543),
      row("b", 1498),
      row("c", 1471),
    ];
    const { throne, rest } = splitDictatorThrone(rows);
    expect(throne?.key).toBe("dictator");
    expect(rest.map((r) => r.key)).toEqual(["a", "b", "c"]);
  });

  it("laat een gewone #1 zónder dictator-tier staan (geen troon)", () => {
    const rows = [row("a", 1543), row("b", 1498), row("c", 1471)];
    const { throne, rest } = splitDictatorThrone(rows);
    expect(throne).toBeNull();
    // GOAT (1400–1599) is nog geen dictator: volledige lijst blijft.
    expect(rest).toHaveLength(3);
  });

  it("geeft geen troon bij een lege lijst of een #1 zonder rating", () => {
    expect(splitDictatorThrone([]).throne).toBeNull();
    expect(splitDictatorThrone([row("x", null)]).throne).toBeNull();
  });

  it("triggert exact op de tier-grens (1600), niet op 1599", () => {
    expect(splitDictatorThrone([row("x", 1599)]).throne).toBeNull();
    expect(splitDictatorThrone([row("x", 1600)]).throne?.key).toBe("x");
  });
});
