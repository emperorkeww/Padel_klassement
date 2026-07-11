import { describe, it, expect } from "vitest";
import { bigDaddyRoast } from "./bigDaddy";

describe("bigDaddyRoast", () => {
  it("is deterministisch: zelfde seed → zelfde roast", () => {
    expect(bigDaddyRoast("p1")).toBe(bigDaddyRoast("p1"));
    expect(bigDaddyRoast("alice-key")).toBe(bigDaddyRoast("alice-key"));
  });

  it("levert altijd een niet-lege zin", () => {
    for (const seed of ["p1", "p2", "p3", "", "xyz-123"]) {
      expect(bigDaddyRoast(seed).length).toBeGreaterThan(0);
    }
  });

  it("varieert over verschillende seeds", () => {
    const seeds = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    const uniek = new Set(seeds.map(bigDaddyRoast));
    expect(uniek.size).toBeGreaterThan(1);
  });
});
