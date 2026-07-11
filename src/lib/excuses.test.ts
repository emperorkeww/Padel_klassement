import { describe, it, expect } from "vitest";
import { SMOESJES, hashString, kiesSmoes } from "./excuses";

describe("kiesSmoes", () => {
  it("geeft altijd een smoesje uit de pool", () => {
    for (let seed = -5; seed < 50; seed++) {
      expect(SMOESJES).toContain(kiesSmoes(seed));
    }
  });

  it("is deterministisch: zelfde seed → zelfde smoesje", () => {
    expect(kiesSmoes(42)).toBe(kiesSmoes(42));
  });

  it("werkt met negatieve seeds (geen out-of-bounds)", () => {
    expect(kiesSmoes(-1)).toBe(SMOESJES[SMOESJES.length - 1]);
  });

  it("verandert bij een opeenvolgende worp (opnieuw)", () => {
    const seed = hashString("match-123");
    // Over drie worpen zit er ten minste één verschil in (geen vaste herhaling).
    const worpen = [kiesSmoes(seed), kiesSmoes(seed + 1), kiesSmoes(seed + 2)];
    expect(new Set(worpen).size).toBeGreaterThan(1);
  });
});

describe("hashString", () => {
  it("is stabiel en geheel", () => {
    const h = hashString("abc");
    expect(h).toBe(hashString("abc"));
    expect(Number.isInteger(h)).toBe(true);
  });

  it("verschilt voor verschillende invoer", () => {
    expect(hashString("match-a")).not.toBe(hashString("match-b"));
  });
});
