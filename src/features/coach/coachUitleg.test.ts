import { describe, it, expect } from "vitest";
import { SECTIE_IDS } from "@/features/uitleg/secties";
import type { RoastCtx } from "./roastTone";
import {
  UITLEG_REGELS,
  coachUitlegRegel,
  uitlegMood,
  uitlegSeed,
  type UitlegSleutel,
} from "./coachUitleg";

const SLEUTELS: UitlegSleutel[] = ["intro", ...SECTIE_IDS];

const ctx = (over: Partial<RoastCtx> = {}): RoastCtx => ({
  intensiteit: "radioactief",
  schild: false,
  ...over,
});

describe("UITLEG_REGELS", () => {
  it("heeft voor elke sectie én de intro beide pools gevuld", () => {
    for (const sleutel of SLEUTELS) {
      const pools = UITLEG_REGELS[sleutel];
      expect(pools, sleutel).toBeDefined();
      expect(pools.zacht.length, `${sleutel} zacht`).toBeGreaterThanOrEqual(3);
      expect(pools.scherp.length, `${sleutel} scherp`).toBeGreaterThanOrEqual(3);
    }
  });

  it("bevat geen lege of dubbele regels binnen een pool", () => {
    for (const sleutel of SLEUTELS) {
      const { zacht, scherp } = UITLEG_REGELS[sleutel];
      for (const regel of [...zacht, ...scherp]) {
        expect(regel.trim().length, sleutel).toBeGreaterThan(0);
      }
      expect(new Set(zacht).size, `${sleutel} zacht`).toBe(zacht.length);
      expect(new Set(scherp).size, `${sleutel} scherp`).toBe(scherp.length);
    }
  });
});

describe("coachUitlegRegel", () => {
  it("geeft de zachte gids bij roast-schild, ook op de hardste intensiteit", () => {
    for (const sleutel of SLEUTELS) {
      const regel = coachUitlegRegel(sleutel, ctx({ schild: true }), 7);
      expect(UITLEG_REGELS[sleutel].zacht, sleutel).toContain(regel);
    }
  });

  it("geeft de zachte gids bij intensiteit 'mild'", () => {
    const regel = coachUitlegRegel("rating", ctx({ intensiteit: "mild" }), 3);
    expect(UITLEG_REGELS.rating.zacht).toContain(regel);
  });

  it("geeft de scherpe variant bij gemeen en radioactief", () => {
    for (const intensiteit of ["gemeen", "radioactief"] as const) {
      const regel = coachUitlegRegel("troon", ctx({ intensiteit }), 3);
      expect(UITLEG_REGELS.troon.scherp, intensiteit).toContain(regel);
    }
  });

  it("is deterministisch bij gelijke seed", () => {
    const a = coachUitlegRegel("kaarten", ctx(), 11);
    const b = coachUitlegRegel("kaarten", ctx(), 11);
    expect(a).toBe(b);
  });

  it("herhaalt binnen één weergave geen regel uit dezelfde pool", () => {
    // Een pool van drie: drie trekkingen met dezelfde gebruikt-set moeten drie
    // verschillende regels geven.
    const gebruikt = new Set<string>();
    const regels = [0, 0, 0].map(() => coachUitlegRegel("feed", ctx(), 5, gebruikt));
    expect(new Set(regels).size).toBe(3);
  });

  it("cyclet over bezoeken heen door de oplopende beurt", () => {
    const eerste = coachUitlegRegel("intro", ctx(), uitlegSeed("intro", 0));
    const tweede = coachUitlegRegel("intro", ctx(), uitlegSeed("intro", 1));
    expect(tweede).not.toBe(eerste);
  });
});

describe("uitlegMood", () => {
  it("blijft neutraal bij schild of mild", () => {
    expect(uitlegMood(ctx({ schild: true }))).toBe("portret");
    expect(uitlegMood(ctx({ intensiteit: "mild" }))).toBe("portret");
  });

  it("volgt de intensiteit als er wél geroast mag worden", () => {
    expect(uitlegMood(ctx({ intensiteit: "gemeen" }))).toBe("gemeen");
    expect(uitlegMood(ctx({ intensiteit: "radioactief" }))).toBe("radioactief");
  });
});
