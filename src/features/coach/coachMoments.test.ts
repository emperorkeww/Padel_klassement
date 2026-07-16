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
  const mild: RoastCtx = { intensiteit: "mild", schild: false };
  const radioactief: RoastCtx = { intensiteit: "radioactief", schild: false };
  const seeds = ["seed-a", "seed-b", "seed-c", "seed-d", "seed-e"];
  // Elke regel in de plaagpool bevat precies één van deze markers; de warme
  // welkomstpool geen enkele — zo onderscheiden we de pools zonder ze te exporteren.
  const plaag = /statistisch|notitieboekje|Rating 1000|In theorie|gratis compliment/;

  it("groep → uitnodigende tekst, ongeacht schild", () => {
    for (const ctx of [roast, schild]) {
      expect(coachEmptyState({ type: "group", seed: "g1", ctx })).toMatch(
        /leeg|blik|Nodig|padelbaan|solo|invite|troon/i,
      );
    }
  });

  it("matches → neutrale aanmoediging", () => {
    expect(
      coachEmptyState({ type: "matches", seed: "m1", ctx: roast }),
    ).toMatch(/kooi|match|baan|canvas|speler|winnen|statistieken|profiel/i);
  });

  it("dashboard boven mild zonder schild → licht plagend welkom", () => {
    for (const seed of seeds) {
      expect(coachEmptyState({ type: "dashboard", seed, ctx: roast })).toMatch(plaag);
      expect(
        coachEmptyState({ type: "dashboard", seed, ctx: radioactief }),
      ).toMatch(plaag);
    }
  });

  it("dashboard met schild of intensiteit mild → warm welkom", () => {
    for (const seed of seeds) {
      expect(
        coachEmptyState({ type: "dashboard", seed, ctx: schild }),
      ).not.toMatch(plaag);
      expect(
        coachEmptyState({ type: "dashboard", seed, ctx: mild }),
      ).not.toMatch(plaag);
    }
  });

  it("is deterministisch per seed en type", () => {
    for (const type of ["dashboard", "group", "matches"] as const) {
      const f = { type, seed: "vast", ctx: roast };
      expect(coachEmptyState(f)).toBe(coachEmptyState(f));
    }
  });
});
