import { describe, it, expect } from "vitest";
import {
  BUIGING,
  coachBuiging,
  COMMENTATOR,
  coachLof,
  coachSneer,
  kiesUniek,
  kleurRoast,
  LOF,
  roastCtx,
  roastSeed,
  SNEER,
  type RoastCtx,
} from "@/features/coach/roastTone";

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

describe("SNEER — rijkere pools (#201)", () => {
  it("heeft minstens 12 unieke varianten per intensiteit", () => {
    for (const i of ["mild", "gemeen", "radioactief"] as const) {
      expect(SNEER[i].length).toBeGreaterThanOrEqual(12);
      expect(new Set(SNEER[i]).size).toBe(SNEER[i].length);
    }
  });
});

describe("kiesUniek — anti-herhaling (#201)", () => {
  const pool = ["a", "b", "c", "d"] as const;

  it("is zonder set deterministisch en levert een lid van de pool", () => {
    expect(kiesUniek(pool, 5)).toBe(kiesUniek(pool, 5));
    expect(pool).toContain(kiesUniek(pool, 5));
  });

  it("slaat gebruikte lijnen over binnen één gedeelde set", () => {
    const g = new Set<string>();
    const drie = [0, 0, 0].map(() => kiesUniek(pool, 0, g)); // zelfde seed
    expect(new Set(drie).size).toBe(3); // toch alle drie verschillend
  });

  it("valt terug op de seed-keuze als de pool op is", () => {
    const g = new Set<string>(pool);
    expect(pool).toContain(kiesUniek(pool, 2, g));
  });
});

describe("LOF + coachLof — hype-modus (#199)", () => {
  it("heeft minstens 12 unieke varianten per intensiteit", () => {
    for (const i of ["mild", "gemeen", "radioactief"] as const) {
      expect(LOF[i].length).toBeGreaterThanOrEqual(12);
      expect(new Set(LOF[i]).size).toBe(LOF[i].length);
    }
  });

  it("kiest de lof uit de pool van de gekozen intensiteit", () => {
    for (const intensiteit of ["mild", "gemeen", "radioactief"] as const) {
      expect(LOF[intensiteit]).toContain(coachLof(ctx({ intensiteit }), 4));
    }
  });

  it("is deterministisch op de seed", () => {
    expect(coachLof(ctx(), 7)).toBe(coachLof(ctx(), 7));
  });

  it("tempert bij een schild tot oprechte lof, maar zwijgt nooit", () => {
    // Hét onderscheid met coachSneer: het schild blokkeert de lof niet, het
    // schaalt hem terug naar mild — ook op radioactief.
    const uit = coachLof({ intensiteit: "radioactief", schild: true }, 3);
    expect(LOF.mild).toContain(uit);
    expect(LOF.radioactief).not.toContain(uit);
  });

  it("herhaalt geen lof met een gedeelde set (zelfde seed)", () => {
    const g = new Set<string>();
    const lijnen = [0, 0, 0].map(() => coachLof(ctx({ intensiteit: "gemeen" }), 0, g));
    expect(new Set(lijnen).size).toBe(3);
  });

  it("deelt geen enkele lijn met de sneer-pools", () => {
    for (const i of ["mild", "gemeen", "radioactief"] as const) {
      const overlap = LOF[i].filter((l) => (SNEER[i] as readonly string[]).includes(l));
      expect(overlap).toEqual([]);
    }
  });
});

describe("coachSneer — dedup + schild (#201)", () => {
  it("herhaalt geen sneer met een gedeelde set (zelfde seed)", () => {
    const g = new Set<string>();
    const c: RoastCtx = { intensiteit: "radioactief", schild: false };
    const lijnen = [0, 0, 0].map(() => coachSneer(c, 0, g));
    expect(new Set(lijnen).size).toBe(3);
  });

  it("geeft null bij schild en raakt de set niet aan", () => {
    const g = new Set<string>();
    expect(coachSneer({ intensiteit: "gemeen", schild: true }, 0, g)).toBeNull();
    expect(g.size).toBe(0);
  });
});

describe("coachBuiging — knieval voor de dictator (#531)", () => {
  it("heeft een niet-lege copypool", () => {
    expect(BUIGING.length).toBeGreaterThan(0);
    expect(BUIGING.every((r) => r.trim().length > 0)).toBe(true);
  });

  it("kiest deterministisch uit de pool per seed", () => {
    expect(coachBuiging("speler-1")).toBe(coachBuiging("speler-1"));
    expect(BUIGING as readonly string[]).toContain(coachBuiging("speler-1"));
    expect(BUIGING as readonly string[]).toContain(coachBuiging("kylian-mbappe"));
  });

  it("cyclet met de rotatie: opeenvolgende bezoeken schuiven één plek op (#535)", () => {
    // Eén volle ronde over de pool levert elke regel precies één keer op —
    // dus geen "altijd dezelfde" en geen dubbelen binnen de cyclus.
    const ronde = BUIGING.map((_, i) => coachBuiging("kylian-mbappe", i));
    expect(new Set(ronde).size).toBe(BUIGING.length);
    // Na een volle ronde is de keuze weer gelijk (stabiel modulo pool-lengte).
    expect(coachBuiging("kylian-mbappe", BUIGING.length)).toBe(
      coachBuiging("kylian-mbappe", 0),
    );
  });

  it("blijft stabiel bij gelijke seed én rotatie — geen geflikker", () => {
    expect(coachBuiging("speler-1", 2)).toBe(coachBuiging("speler-1", 2));
  });
});
