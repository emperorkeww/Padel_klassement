import { describe, it, expect } from "vitest";
import {
  coachBriefing,
  coachMatchQuip,
  coachTierQuip,
  coachStreakQuip,
  STREAK_MIJLPALEN,
  coachPreMatch,
  OCHTEND_JAGER,
  OCHTEND_KELDER,
  OCHTEND_NIEUW,
} from "@/features/coach/coachMoments";
import type { RoastCtx } from "@/features/coach/roastTone";
import type { KlassementFeiten, PositieTier } from "@/features/coach/klassementFeiten";

const roast: RoastCtx = { intensiteit: "gemeen", schild: false };
const schild: RoastCtx = { intensiteit: "gemeen", schild: true };

const klassement = (tier: PositieTier): KlassementFeiten => ({
  rank: 5,
  totaal: 10,
  tier,
  deltaNaarBoven: null,
  deltaNaarOnder: null,
  buurmanBoven: null,
  deltaNaarTop3: null,
  shift: null,
  scope: "globaal",
});

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
    expect(line).toMatch(/kans|balletje|succes|dweil|kooi|looplijnen|experimenten/i);
  });

  it("kiest per klassement-tier de bijbehorende pool (#411)", () => {
    const basis = { rank: 5, streak: 0, losing: 0, heeftMatch: false, seed: "p1", ctx: roast };
    const troon = coachBriefing({ ...basis, klassement: klassement("troon") });
    expect(troon).toMatch(/één|Bovenaan/i);
    expect(coachBriefing({ ...basis, klassement: klassement("jager") })).toSatisfy((r: string) =>
      (OCHTEND_JAGER as readonly string[]).includes(r),
    );
    expect(coachBriefing({ ...basis, klassement: klassement("kelder") })).toSatisfy((r: string) =>
      (OCHTEND_KELDER as readonly string[]).includes(r),
    );
    expect(coachBriefing({ ...basis, klassement: klassement("nieuw") })).toSatisfy((r: string) =>
      (OCHTEND_NIEUW as readonly string[]).includes(r),
    );
  });

  it("heeft minstens 12 unieke regels per nieuwe tier-pool", () => {
    for (const pool of [OCHTEND_JAGER, OCHTEND_KELDER, OCHTEND_NIEUW]) {
      expect(pool.length).toBeGreaterThanOrEqual(12);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });

  it("laat dip, hype, match en schild boven de tier gaan", () => {
    const kelder = klassement("kelder");
    const dip = coachBriefing({ rank: 9, streak: 0, losing: 4, heeftMatch: false, klassement: kelder, seed: "p1", ctx: roast });
    expect((OCHTEND_KELDER as readonly string[]).includes(dip)).toBe(false);
    const beschermd = coachBriefing({ rank: 9, streak: 0, losing: 0, heeftMatch: false, klassement: kelder, seed: "p1", ctx: schild });
    expect(beschermd).toMatch(/kans|balletje|succes|dweil|kooi|looplijnen|experimenten/i);
  });

  it("gedraagt zich zonder klassement-veld zoals vroeger (rank 1 → top-regel)", () => {
    const top = coachBriefing({ rank: 1, streak: 0, losing: 0, heeftMatch: false, seed: "p1", ctx: roast });
    expect(top).toMatch(/één|Bovenaan/i);
    const rest = coachBriefing({ rank: 7, streak: 0, losing: 0, heeftMatch: false, seed: "p1", ctx: roast });
    expect(rest).toMatch(/middenmoot|midden|klassement|voetstuk|stabiel/i);
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

describe("coachTierQuip", () => {
  const tier = (over: Partial<Parameters<typeof coachTierQuip>[0]>) =>
    coachTierQuip({ richting: "promotie", tierLabel: "Prof II", seed: "m1", ctx: roast, ...over });

  it("vervangt %tier% door het divisielabel", () => {
    const zin = tier({ tierLabel: "Prof II" });
    expect(zin).toContain("Prof II");
    expect(zin).not.toContain("%tier%");
  });

  it("is deterministisch per seed", () => {
    expect(tier({ seed: "x" })).toBe(tier({ seed: "x" }));
  });

  it("promotie en degradatie geven een andere toon", () => {
    const promo = tier({ richting: "promotie", seed: "s" });
    const degr = tier({ richting: "degradatie", seed: "s" });
    expect(promo).not.toBe(degr);
  });

  it("schild dempt degradatie tot de neutrale variant", () => {
    const zin = tier({ richting: "degradatie", ctx: schild });
    expect(zin).toMatch(/terug|volgende|weg omhoog|stand van nu/i);
  });

  it("promotie negeert schild (lof blijft lof)", () => {
    const zin = tier({ richting: "promotie", ctx: schild });
    expect(zin).toContain("Prof II");
    // Promotie is lof: geen kale/degradatie-toon, gewoon een promotie-regel.
    expect(zin.toLowerCase()).not.toContain("zakt");
  });
});

describe("coachStreakQuip", () => {
  const streak = (over: Partial<Parameters<typeof coachStreakQuip>[0]>) =>
    coachStreakQuip({ richting: "winst", mijlpaal: 5, seed: "m1", ctx: roast, ...over });

  it("laat nooit een %n%-placeholder achter", () => {
    for (const mijlpaal of STREAK_MIJLPALEN) {
      for (const richting of ["winst", "verlies"] as const) {
        for (const ctx of [roast, schild]) {
          expect(streak({ mijlpaal, richting, ctx })).not.toContain("%n%");
        }
      }
    }
  });

  it("is deterministisch per seed", () => {
    expect(streak({ seed: "x" })).toBe(streak({ seed: "x" }));
  });

  it("winst en verlies geven een andere toon", () => {
    const win = streak({ richting: "winst", seed: "s" });
    const los = streak({ richting: "verlies", seed: "s" });
    expect(win).not.toBe(los);
  });

  it("elke mijlpaal put uit een andere pool", () => {
    const zinnen = STREAK_MIJLPALEN.map((mijlpaal) => streak({ mijlpaal, seed: "s" }));
    expect(new Set(zinnen).size).toBe(STREAK_MIJLPALEN.length);
  });

  it("schild dempt de verliesreeks tot de neutrale variant", () => {
    const zin = streak({ richting: "verlies", ctx: schild });
    expect(zin).toMatch(/tij|omhoog|doorbreken|eindigt|frisse start|vorm komt/i);
  });

  it("winst negeert schild (lof blijft lof)", () => {
    // Lof: het schild verandert niets aan de winst-quip.
    expect(streak({ richting: "winst", ctx: schild, seed: "s" })).toBe(
      streak({ richting: "winst", ctx: roast, seed: "s" }),
    );
  });
});

describe("coachPreMatch", () => {
  it("lage winkans = underdog-praatje", () => {
    expect(coachPreMatch(0.2, "m1", roast)).toMatch(/bookmaker|kansloos|underdog|Winamax|partner|medelijden|minuut|opgeschort|outsider/i);
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

import {
  coachVrienden,
  VRIENDEN_LEEG,
  VRIENDEN_NIEUW,
  VRIENDEN_NEUTRAAL,
  H2H_LEIDT,
  H2H_ACHTER,
  H2H_GELIJK,
} from "@/features/coach/coachMoments";

describe("coachVrienden", () => {
  const seeds = ["a", "b", "c", "d", "e"];
  const inPool = (pool: readonly string[], s: string) => pool.includes(s);

  it("is deterministisch per seed en situatie", () => {
    for (const seed of seeds) {
      const f = { situatie: "leeg" as const, seed, ctx: roast };
      expect(coachVrienden(f)).toBe(coachVrienden(f));
    }
  });

  it("lege lijst → een regel uit de leeg-pool (incl. de afscheidsreceptie-quip)", () => {
    for (const seed of seeds) {
      expect(inPool(VRIENDEN_LEEG, coachVrienden({ situatie: "leeg", seed, ctx: roast }))).toBe(true);
    }
    expect(VRIENDEN_LEEG).toContain("Nul vrienden. Net als op mijn afscheidsreceptie.");
  });

  it("nieuw verzoek → een regel uit de nieuw-pool", () => {
    for (const seed of seeds) {
      expect(inPool(VRIENDEN_NIEUW, coachVrienden({ situatie: "nieuw", seed, ctx: roast }))).toBe(true);
    }
  });

  it("head-to-head kiest op teken van winst − verlies", () => {
    const h2h = (gewonnen: number, verloren: number) =>
      coachVrienden({
        situatie: "h2h",
        balans: { gewonnen, verloren, gespeeld: gewonnen + verloren },
        seed: "x",
        ctx: roast,
      });
    expect(inPool(H2H_LEIDT, h2h(5, 2))).toBe(true);
    expect(inPool(H2H_ACHTER, h2h(2, 5))).toBe(true);
    expect(inPool(H2H_GELIJK, h2h(3, 3))).toBe(true);
    // Ontbrekende balans telt als gelijkstand.
    expect(inPool(H2H_GELIJK, coachVrienden({ situatie: "h2h", seed: "x", ctx: roast }))).toBe(true);
  });

  it("met roast-schild altijd een neutrale, niet-spottende regel", () => {
    for (const seed of seeds) {
      for (const situatie of ["leeg", "nieuw", "h2h"] as const) {
        const line = coachVrienden({
          situatie,
          balans: { gewonnen: 1, verloren: 4, gespeeld: 5 },
          seed,
          ctx: schild,
        });
        expect(inPool(VRIENDEN_NEUTRAAL, line)).toBe(true);
      }
    }
  });
});
