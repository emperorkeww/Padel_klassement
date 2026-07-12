import { describe, it, expect } from "vitest";
import { coachBriefing, coachMatchQuip, coachPreMatch } from "./coachMoments";
import type { RoastCtx } from "./roastTone";

const roast: RoastCtx = { intensiteit: "gemeen", schild: false };
const schild: RoastCtx = { intensiteit: "gemeen", schild: true };

describe("coachBriefing", () => {
  it("is deterministisch per seed", () => {
    const f = { rank: 5, streak: 0, losing: 0, heeftMatch: false, seed: "p1", ctx: roast };
    expect(coachBriefing(f)).toBe(coachBriefing(f));
  });

  it("kiest een verliesreeks-toon bij losing >= 3", () => {
    const dip = coachBriefing({ rank: 20, streak: 0, losing: 4, heeftMatch: false, seed: "p1", ctx: roast });
    expect(dip).toMatch(/karakter|omhoog|grip|spiegel|Rode Duivels|notitieboekje|wissels/i);
  });

  it("met roast-schild een neutrale, niet-spottende regel", () => {
    const line = coachBriefing({ rank: 20, streak: 0, losing: 5, heeftMatch: false, seed: "p1", ctx: schild });
    expect(line).toMatch(/kans|balletje|succes/i);
  });
});

describe("coachMatchQuip", () => {
  it("bagel-winst levert een andere toon dan een gewone winst", () => {
    const bagel = coachMatchQuip({ uitkomst: "W", bagel: true, seed: "m1", ctx: roast });
    expect(bagel).toMatch(/6-0|bagel|vernedering/i);
  });

  it("schild → kale bevestiging", () => {
    expect(coachMatchQuip({ uitkomst: "L", bagel: true, seed: "m1", ctx: schild })).toBe(
      "Match toegevoegd.",
    );
  });
});

describe("coachPreMatch", () => {
  it("lage winkans = underdog-praatje", () => {
    expect(coachPreMatch(0.2, "m1", roast)).toMatch(/bookmaker|kansloos|underdog|Winamax/i);
  });
  it("hoge winkans = favoriet-waarschuwing", () => {
    expect(coachPreMatch(0.85, "m1", roast)).toMatch(/favoriet|druk|verkloten|schande/i);
  });
  it("schild → neutraal", () => {
    expect(coachPreMatch(0.1, "m1", schild)).toMatch(/plezier|succes/i);
  });
});
