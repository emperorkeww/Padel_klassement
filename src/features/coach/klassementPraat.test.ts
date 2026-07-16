import { describe, expect, it } from "vitest";
import type { RoastCtx, RoastIntensiteit } from "./roastTone";
import type { KlassementFeiten } from "./klassementFeiten";
import {
  coachKlassement,
  coachKlassementMood,
  JAGER,
  KELDER,
  KELDER_NEUTRAAL,
  MIDDENMOOT,
  MIDDENMOOT_NEUTRAAL,
  NIEUW,
  TROON,
} from "./klassementPraat";

const INTENSITEITEN: RoastIntensiteit[] = ["mild", "gemeen", "radioactief"];

const feit = (over: Partial<KlassementFeiten> = {}): KlassementFeiten => ({
  rank: 5,
  totaal: 10,
  tier: "middenmoot",
  deltaNaarBoven: null,
  deltaNaarOnder: null,
  buurmanBoven: null,
  deltaNaarTop3: null,
  shift: null,
  scope: "globaal",
  ...over,
});

const ctx = (over: Partial<RoastCtx> = {}): RoastCtx => ({
  intensiteit: "gemeen",
  schild: false,
  ...over,
});

describe("pools", () => {
  it("heeft minstens 12 unieke kelder-regels per intensiteit", () => {
    for (const i of INTENSITEITEN) {
      expect(KELDER[i].length).toBeGreaterThanOrEqual(12);
      expect(new Set(KELDER[i]).size).toBe(KELDER[i].length);
    }
  });

  it("heeft minstens 12 unieke regels per tier-pool", () => {
    for (const pool of [TROON, JAGER, MIDDENMOOT, NIEUW]) {
      expect(pool.length).toBeGreaterThanOrEqual(12);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });

  it("houdt de neutrale pools gescheiden van de kelder-burns", () => {
    const burns = new Set(INTENSITEITEN.flatMap((i) => [...KELDER[i]]));
    for (const regel of [...KELDER_NEUTRAAL, ...MIDDENMOOT_NEUTRAAL]) {
      expect(burns.has(regel)).toBe(false);
    }
    expect(KELDER_NEUTRAAL.length).toBeGreaterThanOrEqual(4);
    expect(MIDDENMOOT_NEUTRAAL.length).toBeGreaterThanOrEqual(4);
  });
});

describe("coachKlassement — tier-takken", () => {
  it("kiest zonder bruikbare feiten uit de kále pool van de tier", () => {
    const gevallen: [KlassementFeiten["tier"], readonly string[]][] = [
      ["troon", TROON],
      ["jager", JAGER],
      ["middenmoot", MIDDENMOOT],
      ["kelder", KELDER.gemeen],
      ["nieuw", NIEUW],
    ];
    for (const [tier, pool] of gevallen) {
      const r = coachKlassement({ feiten: feit({ tier }), seed: "s", ctx: ctx() });
      expect(pool).toContain(r);
    }
  });

  it("schaalt de kelder mee met de intensiteit", () => {
    for (const i of INTENSITEITEN) {
      const r = coachKlassement({
        feiten: feit({ tier: "kelder" }),
        seed: "s",
        ctx: ctx({ intensiteit: i }),
      });
      expect(KELDER[i]).toContain(r);
    }
  });
});

describe("coachKlassement — feit-interpolatie", () => {
  it("noemt bij een jager met klein gat het Elo-verschil en de buurman", () => {
    const r = coachKlassement({
      feiten: feit({ tier: "jager", rank: 2, deltaNaarBoven: 18, buurmanBoven: "Bert" }),
      seed: "s",
      ctx: ctx(),
    });
    expect(r).toMatch(/18/);
    expect(r).toMatch(/Bert/);
  });

  it("valt bij een jager met groot gat terug op de kále pool", () => {
    const r = coachKlassement({
      feiten: feit({ tier: "jager", rank: 2, deltaNaarBoven: 120, buurmanBoven: "Bert" }),
      seed: "s",
      ctx: ctx(),
    });
    expect(JAGER).toContain(r);
  });

  it("noemt in de middenmoot de afstand tot de top-3", () => {
    const r = coachKlassement({
      feiten: feit({ deltaNaarTop3: 25 }),
      seed: "s",
      ctx: ctx(),
    });
    expect(r).toMatch(/25/);
    expect(r).toMatch(/top-3/);
  });

  it("noemt de sprong-grootte bij een val van meerdere plekken", () => {
    const r = coachKlassement({
      feiten: feit({ shift: -3 }),
      seed: "s",
      ctx: ctx(),
    });
    expect(r).toMatch(/3 plekken/);
    expect(r).toMatch(/gezakt|omlaag/);
  });

  it("noemt de sprong-grootte en nieuwe positie bij een klim", () => {
    const r = coachKlassement({
      feiten: feit({ shift: 4, rank: 4 }),
      seed: "s",
      ctx: ctx(),
    });
    expect(r).toMatch(/4 plekken/);
    expect(r).toMatch(/#4/);
  });

  it("negeert een sprong van één plek", () => {
    const r = coachKlassement({ feiten: feit({ shift: -1 }), seed: "s", ctx: ctx() });
    expect(MIDDENMOOT).toContain(r);
  });

  it("noemt de troon-voorsprong naar onder", () => {
    const r = coachKlassement({
      feiten: feit({ tier: "troon", rank: 1, deltaNaarOnder: 85 }),
      seed: "s",
      ctx: ctx(),
    });
    expect(r).toMatch(/85/);
  });

  it("geeft de kelder een reddingsboei met de buurman boven", () => {
    const r = coachKlassement({
      feiten: feit({ tier: "kelder", rank: 10, deltaNaarBoven: 12, buurmanBoven: "An" }),
      seed: "s",
      ctx: ctx(),
    });
    expect(r).toMatch(/12/);
    expect(r).toMatch(/An/);
  });
});

describe("coachKlassement — groep vs globaal", () => {
  const groepsTroon = feit({ tier: "troon", rank: 1, scope: "groep" });

  it("speelt het contrast uit: hoog in de groep, laag globaal", () => {
    const r = coachKlassement({
      feiten: groepsTroon,
      globaal: feit({ rank: 40, totaal: 60 }),
      groepsNaam: "De Dinsdagclub",
      seed: "s",
      ctx: ctx(),
    });
    expect(r).toMatch(/#40/);
  });

  it("speelt het omgekeerde contrast uit: kelder in de groep, subtop globaal", () => {
    const r = coachKlassement({
      feiten: feit({ tier: "kelder", rank: 6, totaal: 6, scope: "groep" }),
      globaal: feit({ rank: 5, totaal: 60 }),
      seed: "s",
      ctx: ctx(),
    });
    expect(r).toMatch(/#5/);
  });

  it("zwijgt over het contrast als de globale positie ook hoog is", () => {
    const r = coachKlassement({
      feiten: groepsTroon,
      globaal: feit({ rank: 4, totaal: 60 }),
      seed: "s",
      ctx: ctx(),
    });
    expect(TROON).toContain(r);
  });

  it("kent geen contrast op het globale klassement zelf", () => {
    const r = coachKlassement({
      feiten: feit({ tier: "troon", rank: 1, scope: "globaal" }),
      globaal: feit({ rank: 40, totaal: 60 }),
      seed: "s",
      ctx: ctx(),
    });
    expect(TROON).toContain(r);
  });
});

describe("coachKlassement — roast-schild", () => {
  it("maakt de kelder neutraal, op elke intensiteit", () => {
    for (const i of INTENSITEITEN) {
      const r = coachKlassement({
        feiten: feit({ tier: "kelder", deltaNaarBoven: 12, buurmanBoven: "An" }),
        seed: "s",
        ctx: ctx({ schild: true, intensiteit: i }),
      });
      expect(KELDER_NEUTRAAL).toContain(r);
    }
  });

  it("maakt de middenmoot neutraal", () => {
    const r = coachKlassement({
      feiten: feit({ shift: -5 }),
      seed: "s",
      ctx: ctx({ schild: true }),
    });
    expect(MIDDENMOOT_NEUTRAAL).toContain(r);
  });

  it("slaat het contrast over", () => {
    const r = coachKlassement({
      feiten: feit({ tier: "troon", rank: 1, scope: "groep" }),
      globaal: feit({ rank: 40, totaal: 60 }),
      seed: "s",
      ctx: ctx({ schild: true }),
    });
    expect(TROON).toContain(r);
  });

  it("laat de troon en de nieuwkomer gewoon doorpraten", () => {
    const troon = coachKlassement({
      feiten: feit({ tier: "troon", rank: 1 }),
      seed: "s",
      ctx: ctx({ schild: true }),
    });
    expect(TROON).toContain(troon);
    const nieuw = coachKlassement({
      feiten: feit({ tier: "nieuw" }),
      seed: "s",
      ctx: ctx({ schild: true }),
    });
    expect(NIEUW).toContain(nieuw);
  });
});

describe("coachKlassement — determinisme", () => {
  it("geeft dezelfde regel voor dezelfde seed", () => {
    const invoer = { feiten: feit({ deltaNaarTop3: 25 }), seed: "p1|globaal|2026-07-16", ctx: ctx() };
    expect(coachKlassement(invoer)).toBe(coachKlassement(invoer));
  });

  it("varieert over seeds binnen de pool", () => {
    const uniek = new Set(
      ["a", "b", "c", "d", "e", "f"].map((s) =>
        coachKlassement({ feiten: feit(), seed: s, ctx: ctx() }),
      ),
    );
    expect(uniek.size).toBeGreaterThan(1);
  });
});

describe("coachKlassementMood", () => {
  it("is trots bovenin, de burn-intensiteit in de kelder en anders portret", () => {
    const m = (over: Partial<KlassementFeiten>, c: Partial<RoastCtx> = {}) =>
      coachKlassementMood({ feiten: feit(over), seed: "s", ctx: ctx(c) });
    expect(m({ tier: "troon" })).toBe("trots");
    expect(m({ tier: "jager" })).toBe("trots");
    expect(m({ tier: "kelder" })).toBe("gemeen");
    expect(m({ tier: "kelder" }, { intensiteit: "radioactief" })).toBe("radioactief");
    expect(m({ tier: "kelder" }, { schild: true })).toBe("portret");
    expect(m({ tier: "middenmoot" })).toBe("portret");
    expect(m({ tier: "nieuw" })).toBe("portret");
  });
});
