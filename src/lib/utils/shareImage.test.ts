import { describe, it, expect } from "vitest";
import { canvasPalette, ellipsize, wrapLines } from "@/lib/utils/shareImage";

// Nep-context: elk teken telt voor 10px, zodat het meten voorspelbaar is.
const ctx = {
  measureText: (t: string) => ({ width: t.length * 10 }),
} as unknown as CanvasRenderingContext2D;

describe("ellipsize", () => {
  it("laat tekst die past ongemoeid", () => {
    expect(ellipsize(ctx, "abc", 100)).toBe("abc");
  });

  it("kapt af met een ellipsis binnen maxWidth", () => {
    expect(ellipsize(ctx, "abcdefghij", 50)).toBe("abcd…");
  });

  it("geeft alleen de ellipsis als geen enkel teken past", () => {
    expect(ellipsize(ctx, "abc", 5)).toBe("…");
  });
});

describe("wrapLines", () => {
  it("breekt af op woordgrenzen binnen maxWidth", () => {
    expect(wrapLines(ctx, "aa bb cc", 50, 2)).toEqual(["aa bb", "cc"]);
  });

  it("kapt de laatste toegestane regel af i.p.v. door te lopen", () => {
    expect(wrapLines(ctx, "aa bb cc dd", 50, 1)).toEqual(["aa b…"]);
  });

  it("kapt een enkel te lang woord af", () => {
    expect(wrapLines(ctx, "abcdefghij", 50, 2)).toEqual(["abcd…"]);
  });

  it("houdt korte tekst op één regel", () => {
    expect(wrapLines(ctx, "aa", 100, 2)).toEqual(["aa"]);
  });
});

describe("canvasPalette", () => {
  it("bevat Coach Rudy's tokens uit index.css (#421)", () => {
    const c = canvasPalette();
    expect(c.coach).toBe("#e0821c");
    expect(c.coachSoft).toBe("#fdf0dc");
    expect(c.coachLine).toBe("#f0d3a3");
    expect(c.coachInk).toBe("#5a3410");
  });

  it("gebruikt de medaille-tokens van het design-system", () => {
    const c = canvasPalette();
    // #664: de FUT-materiaalladder — waarden spiegelen index.css.
    expect(c.silver).toBe("#8595a8");
    expect(c.bronze).toBe("#b45f1d");
  });
});
