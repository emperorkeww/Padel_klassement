import { describe, it, expect } from "vitest";
import { coachEindoordeel, coachWrappedRegel } from "./coachWrapped";
import type { RoastCtx } from "@/features/coach/roastTone";
import type { WrappedCard, WrappedJaarStats } from "./wrapped";

const gemeen: RoastCtx = { intensiteit: "gemeen", schild: false };
const schild: RoastCtx = { intensiteit: "gemeen", schild: true };
const SEED = 918273;

const stats = (o: Partial<WrappedJaarStats> = {}): WrappedJaarStats => ({
  gespeeld: 20,
  gewonnen: 10,
  verloren: 10,
  winrate: 50,
  langsteWinst: 2,
  langsteVerlies: 2,
  bagelsVoor: 0,
  bagelsTegen: 0,
  ratingDelta: null,
  ...o,
});

describe("coachWrappedRegel", () => {
  it("is deterministisch: zelfde kaart + seed → zelfde regel", () => {
    const card: WrappedCard = { kind: "cover", jaar: 2025, naam: "Alice", gespeeld: 20, kort: false };
    const a = coachWrappedRegel(card, gemeen, SEED);
    const b = coachWrappedRegel(card, gemeen, SEED);
    expect(a).toEqual(b);
    expect(a.tekst.length).toBeGreaterThan(0);
    expect(a.mood).toBe("portret");
  });

  it("kiest een trotse mood bij vleiende stats", () => {
    expect(coachWrappedRegel({ kind: "reeks", type: "winst", lengte: 5 }, gemeen, SEED).mood).toBe("trots");
    expect(coachWrappedRegel({ kind: "prestatie", zege: null, comeback: { naVerliezen: 3 } }, gemeen, SEED).mood).toBe("trots");
    expect(coachWrappedRegel({ kind: "badge", badgeId: "x", naam: "B", emoji: "🥖", aantalSpelers: 1 }, gemeen, SEED).mood).toBe("trots");
    expect(coachWrappedRegel({ kind: "volume", gespeeld: 30, gewonnen: 20, winrate: 67 }, gemeen, SEED).mood).toBe("trots");
    expect(coachWrappedRegel({ kind: "rating", start: 1000, piek: 1050, eind: 1040 }, gemeen, SEED).mood).toBe("trots");
  });

  it("kiest de groepsintensiteit als mood bij gênante stats", () => {
    expect(coachWrappedRegel({ kind: "volume", gespeeld: 30, gewonnen: 8, winrate: 27 }, gemeen, SEED).mood).toBe("gemeen");
    expect(coachWrappedRegel({ kind: "rating", start: 1050, piek: 1050, eind: 1000 }, gemeen, SEED).mood).toBe("gemeen");
    // Lange verliesreeks schaalt door naar radioactief.
    expect(coachWrappedRegel({ kind: "reeks", type: "verlies", lengte: 6 }, gemeen, SEED).mood).toBe("radioactief");
    expect(coachWrappedRegel({ kind: "reeks", type: "verlies", lengte: 3 }, gemeen, SEED).mood).toBe("gemeen");
  });

  it("dempt burns tot een neutrale portret-mood met het roast-schild aan", () => {
    expect(coachWrappedRegel({ kind: "volume", gespeeld: 30, gewonnen: 8, winrate: 27 }, schild, SEED).mood).toBe("portret");
    expect(coachWrappedRegel({ kind: "reeks", type: "verlies", lengte: 6 }, schild, SEED).mood).toBe("portret");
    expect(coachWrappedRegel({ kind: "rating", start: 1050, piek: 1050, eind: 1000 }, schild, SEED).mood).toBe("portret");
  });
});

describe("coachEindoordeel", () => {
  it("is deterministisch op de seed", () => {
    const s = stats({ winrate: 62 });
    expect(coachEindoordeel(s, gemeen, SEED)).toEqual(coachEindoordeel(s, gemeen, SEED));
  });

  it("juicht bij een hoge winrate en veroordeelt een lage", () => {
    const hoog = coachEindoordeel(stats({ winrate: 72 }), gemeen, SEED);
    expect(hoog.mood).toBe("trots");
    expect(hoog.kop.length).toBeGreaterThan(0);
    expect(hoog.regels.length).toBeGreaterThanOrEqual(1);

    const laag = coachEindoordeel(stats({ winrate: 22 }), gemeen, SEED);
    expect(laag.mood).toBe("gemeen");
    expect(laag.regels.length).toBeGreaterThanOrEqual(1);
    expect(hoog.regels[0]).not.toBe(laag.regels[0]);
  });

  it("verzacht tot een positief slot met het roast-schild aan", () => {
    const eo = coachEindoordeel(stats({ winrate: 20, langsteVerlies: 6, bagelsTegen: 3 }), schild, SEED);
    expect(eo.mood).toBe("portret");
    expect(eo.kop.length).toBeGreaterThan(0);
  });

  it("stapelt assen: winrate + reeks + bagels tot maximaal drie regels", () => {
    const eo = coachEindoordeel(
      stats({ winrate: 70, langsteWinst: 6, langsteVerlies: 1, bagelsVoor: 3 }),
      gemeen,
      SEED,
    );
    expect(eo.regels.length).toBe(3);
    // Geen dubbele regels binnen één rapport.
    expect(new Set(eo.regels).size).toBe(eo.regels.length);
  });
});
