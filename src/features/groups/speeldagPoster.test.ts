import { describe, it, expect } from "vitest";
import {
  kaartRaster,
  speeldagPoster,
  KAART_RATIO,
  MAX_KAARTEN,
  POSTER_W,
} from "@/features/groups/speeldagPoster";
import type { KaartData } from "@/features/profiles/profielPoster";

// Alleen de velden die de posterinhoud aanraakt; tier/editie zijn voor de
// tekenlaag en doen hier niet ter zake.
const speler = (name: string, rating: number | null = 1200): KaartData => ({
  name,
  avatarUrl: null,
  rating,
  tier: null,
  editie: null,
  editieTekst: null,
});

const basis = {
  groepsnaam: "Vrijdagavond padel",
  moment: "vrijdag 10 januari · 20:00",
  club: "LAGO CLUB Padel Beveren · 90 min",
};

describe("speeldagPoster", () => {
  it("neemt kop, moment en club letterlijk over", () => {
    const p = speeldagPoster({ ...basis, spelers: [speler("Ann")] });
    expect(p).toMatchObject(basis);
  });

  it("zet de sterkste speler vooraan", () => {
    const p = speeldagPoster({
      ...basis,
      spelers: [speler("Ann", 1100), speler("Bob", 1400), speler("Cis", 1250)],
    });
    expect(p.kaarten.map((k) => k.name)).toEqual(["Bob", "Cis", "Ann"]);
    expect(p.extraNamen).toBeNull();
  });

  it("zet spelers zonder rating achteraan, alfabetisch", () => {
    const p = speeldagPoster({
      ...basis,
      spelers: [speler("Zoe", null), speler("Ann", null), speler("Bob", 900)],
    });
    expect(p.kaarten.map((k) => k.name)).toEqual(["Bob", "Ann", "Zoe"]);
  });

  it("is deterministisch bij gelijke rating", () => {
    const spelers = [speler("Cis", 1200), speler("Ann", 1200), speler("Bob", 1200)];
    const eerst = speeldagPoster({ ...basis, spelers }).kaarten.map((k) => k.name);
    const nogmaals = speeldagPoster({
      ...basis,
      spelers: [...spelers].reverse(),
    }).kaarten.map((k) => k.name);
    expect(eerst).toEqual(["Ann", "Bob", "Cis"]);
    expect(nogmaals).toEqual(eerst);
  });

  it("valt boven acht spelers terug op namen i.p.v. kleinere kaarten", () => {
    const spelers = Array.from({ length: 12 }, (_, i) =>
      speler(`Speler ${String.fromCharCode(65 + i)}`, 1500 - i * 10),
    );
    const p = speeldagPoster({ ...basis, spelers });
    expect(p.kaarten).toHaveLength(MAX_KAARTEN);
    // De acht hoogst geratete krijgen een kaart; de rest staat in de regel.
    expect(p.kaarten.at(-1)?.name).toBe("Speler H");
    expect(p.extraNamen).toBe(
      "…en 4 anderen: Speler I, Speler J, Speler K, Speler L",
    );
  });

  it("schrijft één overgebleven speler enkelvoudig", () => {
    const spelers = Array.from({ length: 9 }, (_, i) => speler(`S${i}`, 100 - i));
    expect(speeldagPoster({ ...basis, spelers }).extraNamen).toBe(
      "…en 1 ander: S8",
    );
  });

  it("laat de code weg zolang er geen opt-in is", () => {
    const spelers = [speler("Ann")];
    expect(speeldagPoster({ ...basis, spelers }).code).toBeNull();
    expect(speeldagPoster({ ...basis, spelers, code: null }).code).toBeNull();
    // Witruimte telt niet als code.
    expect(speeldagPoster({ ...basis, spelers, code: "  " }).code).toBeNull();
  });

  it("zet de code er alleen op als hij expliciet is meegegeven", () => {
    const p = speeldagPoster({
      ...basis,
      spelers: [speler("Ann")],
      code: " b3: 1234 ",
    });
    expect(p.code).toBe("b3: 1234");
  });

  it("blijft overeind zonder deelnemers", () => {
    const p = speeldagPoster({ ...basis, spelers: [] });
    expect(p.kaarten).toEqual([]);
    expect(p.extraNamen).toBeNull();
  });
});

describe("kaartRaster", () => {
  // De ruimte die drawSpeeldagPoster overhoudt tussen header en voet.
  const ruimte = { breedte: POSTER_W - 112, hoogte: 940, gap: 22 };

  it("houdt de kaarten zo groot mogelijk: 2 kolommen tot vier spelers", () => {
    expect(kaartRaster(1, ruimte).kolommen).toBe(1);
    expect(kaartRaster(2, ruimte).kolommen).toBe(2);
    expect(kaartRaster(4, ruimte).kolommen).toBe(2);
    expect(kaartRaster(6, ruimte).kolommen).toBe(3);
    expect(kaartRaster(8, ruimte).kolommen).toBe(4);
  });

  it("rekent de rijen uit het aantal kolommen", () => {
    expect(kaartRaster(3, ruimte)).toMatchObject({ kolommen: 2, rijen: 2 });
    expect(kaartRaster(5, ruimte)).toMatchObject({ kolommen: 3, rijen: 2 });
    expect(kaartRaster(7, ruimte)).toMatchObject({ kolommen: 4, rijen: 2 });
  });

  it("laat het raster binnen de beschikbare ruimte vallen", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { kolommen, rijen, kaartBreedte } = kaartRaster(n, ruimte);
      const breed = kolommen * kaartBreedte + (kolommen - 1) * ruimte.gap;
      const hoog = rijen * kaartBreedte * KAART_RATIO + (rijen - 1) * ruimte.gap;
      expect(breed).toBeLessThanOrEqual(ruimte.breedte + 0.001);
      expect(hoog).toBeLessThanOrEqual(ruimte.hoogte + 0.001);
    }
  });

  it("laat de hoogte de breedte klemmen waar dat nodig is", () => {
    // 4 spelers in 2×2: op breedte alleen zou een kaart 473px worden en het
    // blok 1314px hoog — ruim buiten de poster. De hoogtegrens wint.
    const { kaartBreedte } = kaartRaster(4, ruimte);
    expect(kaartBreedte).toBeLessThan((ruimte.breedte - ruimte.gap) / 2);
  });
});
