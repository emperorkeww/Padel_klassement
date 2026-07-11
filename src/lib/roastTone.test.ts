import { describe, it, expect } from "vitest";
import {
  COMMENTATOR,
  kleurRoast,
  roastCtx,
  roastSeed,
  SNEER,
  type RoastCtx,
} from "./roastTone";

const ctx = (over: Partial<RoastCtx> = {}): RoastCtx => ({
  intensiteit: "gemeen",
  schild: false,
  ...over,
});

describe("kleurRoast", () => {
  it("laat het feit ongekleurd als het schild aan staat", () => {
    const feit = "Jan verloor als torenhoge favoriet (85%)";
    expect(kleurRoast(feit, ctx({ schild: true }), 3)).toBe(feit);
  });

  it("voegt zonder schild een commentator-sneer toe", () => {
    const feit = "Jan verloor als favoriet";
    const uit = kleurRoast(feit, ctx(), 3);
    expect(uit).not.toBe(feit);
    expect(uit.startsWith(feit)).toBe(true);
    expect(uit).toContain(COMMENTATOR.emoji);
  });

  it("kiest de sneer uit de pool van de gekozen intensiteit", () => {
    const feit = "Jan ging onderuit";
    for (const intensiteit of ["mild", "gemeen", "radioactief"] as const) {
      const uit = kleurRoast(feit, ctx({ intensiteit }), 2);
      const gebruikt = SNEER[intensiteit].some((s) => uit.endsWith(s));
      expect(gebruikt).toBe(true);
    }
  });

  it("is deterministisch op de seed", () => {
    const feit = "Jan ging onderuit";
    expect(kleurRoast(feit, ctx(), 7)).toBe(kleurRoast(feit, ctx(), 7));
  });
});

describe("roastCtx", () => {
  it("valt terug op de DB-defaults (gemeen / schild neer)", () => {
    expect(roastCtx(null, null)).toEqual({ intensiteit: "gemeen", schild: false });
  });

  it("neemt de groeps-intensiteit en het speler-schild over", () => {
    expect(
      roastCtx({ roast_intensiteit: "radioactief" }, { roast_schild: true }),
    ).toEqual({ intensiteit: "radioactief", schild: true });
  });
});

describe("roastSeed", () => {
  it("is stabiel en hangt van de delen af", () => {
    expect(roastSeed("p1", "2026-07")).toBe(roastSeed("p1", "2026-07"));
    expect(roastSeed("p1", "2026-07")).not.toBe(roastSeed("p2", "2026-07"));
  });
});
