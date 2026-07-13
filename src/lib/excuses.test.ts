import { describe, it, expect } from "vitest";
import {
  SMOESJES,
  OORDEEL,
  OORDEEL_NEUTRAAL,
  hashString,
  kiesSmoes,
  kiesOordeel,
} from "./excuses";

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

describe("kiesOordeel", () => {
  it("geeft altijd een oordeel uit de juiste pool", () => {
    for (const smoes of SMOESJES) {
      const { gradatie, tekst } = kiesOordeel(smoes);
      expect(OORDEEL[gradatie]).toContain(tekst);
    }
  });

  it("is deterministisch: zelfde smoesje → zelfde oordeel", () => {
    for (const smoes of SMOESJES) {
      expect(kiesOordeel(smoes)).toEqual(kiesOordeel(smoes));
    }
  });

  it("gebruikt alle drie de gradaties over de pool", () => {
    const gradaties = new Set(SMOESJES.map((s) => kiesOordeel(s).gradatie));
    expect(gradaties).toEqual(new Set(["afgekeurd", "matig", "goedgekeurd"]));
  });

  it("valt bij schild terug op een neutrale, ongekleurde notering", () => {
    for (const smoes of SMOESJES) {
      const { tekst } = kiesOordeel(smoes, true);
      expect(OORDEEL_NEUTRAAL).toContain(tekst);
      // Geen jury-tekens in de neutrale variant.
      for (const teken of ["❌", "⚠️", "✅"]) expect(tekst).not.toContain(teken);
    }
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
