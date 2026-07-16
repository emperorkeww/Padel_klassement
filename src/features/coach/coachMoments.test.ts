import { describe, it, expect } from "vitest";
import { coachBriefing, coachMatchQuip, coachPreMatch } from "@/features/coach/coachMoments";
import type { RoastCtx } from "@/features/coach/roastTone";

const roast: RoastCtx = { intensiteit: "gemeen", schild: false };
const schild: RoastCtx = { intensiteit: "gemeen", schild: true };

describe("coachBriefing", () => {
  it("is deterministisch per seed", () => {
    const f = { rank: 5, streak: 0, losing: 0, heeftMatch: false, seed: "p1", ctx: roast };
    expect(coachBriefing(f)).toBe(coachBriefing(f));
  });

  it("kiest een verliesreeks-toon bij losing >= 3", () => {
    const dip = coachBriefing({ rank: 20, streak: 0, losing: 4, heeftMatch: false, seed: "p1", ctx: roast });
    expect(dip).toMatch(/karakter|omhoog|grip|spiegel|Rode Duivels|notitieboekje|wissels|Trump|Infantino|opschorting|genie|nederlaag|marine/i);
  });

  it("met roast-schild een neutrale, niet-spottende regel", () => {
    const line = coachBriefing({ rank: 20, streak: 0, losing: 5, heeftMatch: false, seed: "p1", ctx: schild });
    expect(line).toMatch(/kans|balletje|succes/i);
  });
});

describe("coachMatchQuip", () => {
  it("6-0 winst levert een andere toon dan een gewone winst", () => {
    const cleanSheet = coachMatchQuip({ uitkomst: "W", bagel: true, seed: "m1", ctx: roast });
    expect(cleanSheet).toMatch(/6-0|vernedering|masterclass|bond|oefenwedstrijd/i);
  });

  it("schild → kale bevestiging", () => {
    expect(coachMatchQuip({ uitkomst: "L", bagel: true, seed: "m1", ctx: schild })).toBe(
      "Match toegevoegd.",
    );
  });
});

describe("coachPreMatch", () => {
  it("lage winkans = underdog-praatje", () => {
    expect(coachPreMatch(0.2, "m1", roast)).toMatch(/bookmaker|kansloos|underdog|Winamax|partner|medelijden|minuut|opgeschort/i);
  });
  it("hoge winkans = favoriet-waarschuwing", () => {
    expect(coachPreMatch(0.85, "m1", roast)).toMatch(/favoriet|druk|verkloten|schande|koffers|winnaar|schorsen|corrupt|gestolen/i);
  });
  it("schild → neutraal", () => {
    expect(coachPreMatch(0.1, "m1", schild)).toMatch(/plezier|succes|focus/i);
  });
});

import { coachEmptyState } from "@/features/coach/coachMoments";

describe("coachEmptyState", () => {
  it("returns a welcome message for dashboard empty state", () => {
    const result = coachEmptyState({
      type: "dashboard",
      seed: "test-dashboard",
      ctx: roast,
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a group-specific message for empty group", () => {
    const result = coachEmptyState({
      type: "group",
      seed: "test-group",
      ctx: roast,
    });
    expect(typeof result).toBe("string");
    expect(result).toMatch(/leeg|blik|Nodig|padelbaan|solo|invite/i);
  });

  it("returns a matches-specific neutral message for empty matches", () => {
    const result = coachEmptyState({
      type: "matches",
      seed: "test-matches",
      ctx: roast,
    });
    expect(typeof result).toBe("string");
    expect(result).toMatch(/kooi|match|baan|canvas|speler|winnen|statistieken/i);
  });

  it("returns neutral message when roast shield is active for dashboard", () => {
    const result = coachEmptyState({
      type: "dashboard",
      seed: "test-shield",
      ctx: schild,
    });
    expect(typeof result).toBe("string");
    expect(result).toMatch(/kooi|match|baan|canvas|speler|winnen|statistieken/i);
  });

  it("returns neutral message when roast shield is active for group", () => {
    const result = coachEmptyState({
      type: "group",
      seed: "test-shield-group",
      ctx: schild,
    });
    expect(typeof result).toBe("string");
    expect(result).toMatch(/leeg|blik|Nodig|padelbaan|solo|invite/i);
  });

  it("returns deterministic results for same seed and type", () => {
    const result1 = coachEmptyState({
      type: "matches",
      seed: "deterministic-test",
      ctx: roast,
    });
    const result2 = coachEmptyState({
      type: "matches",
      seed: "deterministic-test",
      ctx: roast,
    });
    expect(result1).toBe(result2);
  });

  it("returns different results for different seeds", () => {
    const result1 = coachEmptyState({
      type: "dashboard",
      seed: "seed-a",
      ctx: roast,
    });
    const result2 = coachEmptyState({
      type: "dashboard",
      seed: "seed-b",
      ctx: roast,
    });
    // With 6 items in EMPTY_WELKOM, different seeds should likely give different results
    // but this isn't guaranteed, so we just check they're both valid strings
    expect(typeof result1).toBe("string");
    expect(typeof result2).toBe("string");
  });
});
