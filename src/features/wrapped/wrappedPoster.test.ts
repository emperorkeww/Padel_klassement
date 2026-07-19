import { describe, it, expect } from "vitest";
import { posterLayout } from "./wrappedPoster";
import type { WrappedCard, WrappedJaarStats } from "./wrapped";

const JAAR = 2025;
const layout = (card: WrappedCard) => posterLayout(card, "Alice Anders", JAAR);

const stats = (winrate: number | null): WrappedJaarStats => ({
  gespeeld: 10,
  gewonnen: 5,
  verloren: 5,
  winrate,
  langsteWinst: 2,
  langsteVerlies: 2,
  bagelsVoor: 0,
  bagelsTegen: 0,
  ratingDelta: null,
});

describe("posterLayout", () => {
  it("cover: naam als hero, korte variant met charmante copy", () => {
    const vol = layout({ kind: "cover", jaar: JAAR, naam: "Alice Anders", gespeeld: 12, kort: false });
    expect(vol).toMatchObject({ kicker: "Wrapped 2025", hero: "Alice Anders", heroKlein: true });
    expect(vol.sub[1]).toBe("12 matches vol verhalen");

    const kort = layout({ kind: "cover", jaar: JAAR, naam: "Alice Anders", gespeeld: 1, kort: true });
    expect(kort.sub).toEqual(["1 match — elke legende begint ergens."]);
  });

  it("volume: aantal als hero met winrate-regel, zonder winrate geen puntkomma-rommel", () => {
    const met = layout({ kind: "volume", gespeeld: 47, gewonnen: 29, winrate: 62 });
    expect(met.hero).toBe("47");
    expect(met.sub).toEqual(["matches gespeeld", "29 gewonnen · 62% winrate"]);

    const zonder = layout({ kind: "volume", gespeeld: 1, gewonnen: 0, winrate: null });
    expect(zonder.sub).toEqual(["match gespeeld", "0 gewonnen"]);
  });

  it("kalender en reeks dragen de juiste labels", () => {
    const kal = layout({
      kind: "kalender",
      maand: { label: "juni", aantal: 9 },
      topdag: { label: "za 14 juni", aantal: 4 },
    });
    expect(kal.hero).toBe("juni");
    expect(kal.sub).toEqual(["Drukste maand: 9 matches", "Topdag: za 14 juni · 4 matches"]);

    expect(layout({ kind: "reeks", type: "winst", lengte: 7 })).toMatchObject({
      hero: "7",
      sub: ["op rij gewonnen", "je langste reeks van 2025"],
    });
    expect(layout({ kind: "reeks", type: "verlies", lengte: 4 }).kicker).toContain("Taaiste");
  });

  it("rivalen: alleen aanwezige rivalen krijgen een regel", () => {
    const beide = layout({
      kind: "rivalen",
      favoriet: { naam: "Bob", gewonnen: 5, verloren: 1, gespeeld: 6 },
      nemesis: { naam: "Carol", gewonnen: 1, verloren: 5, gespeeld: 6 },
    });
    expect(beide.sub).toHaveLength(2);
    expect(beide.sub[0]).toContain("Bob — 5 van 6 gewonnen");
    expect(beide.sub[1]).toContain("Carol — 5 van 6 verloren");

    const alleen = layout({ kind: "rivalen", favoriet: null, nemesis: { naam: "Carol", gewonnen: 0, verloren: 3, gespeeld: 3 } });
    expect(alleen.sub).toHaveLength(1);
  });

  it("prestatie, rating en badge formuleren hun hoogtepunt", () => {
    const p = layout({ kind: "prestatie", zege: { score: "6–1", marge: 5 }, comeback: { naVerliezen: 4 } });
    expect(p.hero).toBe("6–1");
    expect(p.sub).toEqual([
      "Grootste zege: 6–1 (+5)",
      "Comeback: na 4 verliezen op rij stond je weer op",
    ]);

    const r = layout({ kind: "rating", start: 1000, piek: 1112, eind: 1085 });
    expect(r.hero).toBe("1085");
    expect(r.sub[0]).toBe("Start 1000 → piek 1112 → eind 1085");
    expect(r.sub[1]).toBe("+85 dit jaar");
    const daler = layout({ kind: "rating", start: 1100, piek: 1100, eind: 1060 });
    expect(daler.sub[1]).toContain("-40 dit jaar");

    const uniek = layout({ kind: "badge", badgeId: "x", naam: "Broodje", emoji: "🥖", aantalSpelers: 1 });
    expect(uniek.sub[1]).toBe("Jij was de enige die deze in 2025 haalde");
    const duo = layout({ kind: "badge", badgeId: "x", naam: "Broodje", emoji: "🥖", aantalSpelers: 2 });
    expect(duo.sub[1]).toBe("Slechts 2 spelers haalden deze in 2025");
  });

  it("outro: volle en korte afsluiter", () => {
    expect(layout({ kind: "outro", jaar: JAAR, kort: false }).sub[0]).toBe("Vamos! Op naar 2026");
    expect(layout({ kind: "outro", jaar: JAAR, kort: true }).sub).toEqual([
      "Een korte maar krachtige eerste set.",
      "2026 wordt jouw jaar",
    ]);
  });

  it("eindoordeel: Rudy-frame met een cijfer-emoji op winrate; body komt van de coach", () => {
    const goed = layout({ kind: "eindoordeel", stats: stats(70) });
    expect(goed).toMatchObject({ kicker: "🎙️ Rudy's Eindoordeel", hero: "🏆", sub: [] });
    expect(layout({ kind: "eindoordeel", stats: stats(30) }).hero).toBe("📉");
    expect(layout({ kind: "eindoordeel", stats: stats(50) }).hero).toBe("📋");
    expect(layout({ kind: "eindoordeel", stats: stats(null) }).hero).toBe("📋");
  });
});
