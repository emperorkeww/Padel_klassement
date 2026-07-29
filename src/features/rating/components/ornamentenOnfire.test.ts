import { describe, it, expect } from "vitest";
import { ORNAMENT_VIEWBOX, type Streng } from "./futKaartOrnamenten";
import {
  bouwVlam,
  bouwVlamNerven,
  kiesOrnament,
  ONFIRE_CREST_BAND,
  ONFIRE_CREST_NERVEN,
  ONFIRE_CREST_PLAAT,
  ONFIRE_CREST_VLAM,
  ONFIRE_MEDAILLON,
  ONFIRE_MEDAILLON_NERVEN,
  ONFIRE_MEDAILLON_VLAM,
  ONFIRE_PLUIMEN,
  ONFIRE_PLUIM_VERLOOP,
  ONFIRE_RANDVLAMMEN,
  ONFIRE_RANDVLAM_HARTEN,
  ONFIRE_RANDVLAM_VERLOOP,
  ONFIRE_SINTELS,
  ONFIRE_VINNEN,
  ONFIRE_WATERMARK,
} from "./ornamentenOnfire";

/** Alle coördinaten uit een pad-string, als [x, y]-paren. De generator schrijft
 *  alleen M/L/C met absolute getallen (en de ringen in het motief een A met een
 *  even aantal getallen), dus dit dekt de hele On-Fire-laag. */
function punten(pad: string): [number, number][] {
  const getallen = pad.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const uit: [number, number][] = [];
  for (let i = 0; i + 1 < getallen.length; i += 2)
    uit.push([getallen[i], getallen[i + 1]]);
  return uit;
}

/** Punten óp de kromme (i.p.v. de controlepunten): elk C-segment gesampled.
 *  Nodig waar het over de échte breedte van een vorm gaat — een controlepunt
 *  ligt buiten de kromme en zou de meting vertekenen. */
function samples(pad: string, stappen = 24): [number, number][] {
  const p = punten(pad);
  const uit: [number, number][] = [];
  for (let i = 1; i + 2 < p.length; i += 3) {
    const [p0, c1, c2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    for (let k = 0; k <= stappen; k++) {
      const t = k / stappen;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      uit.push([
        a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0],
        a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1],
      ]);
    }
  }
  return uit;
}

function grenzen(paden: readonly string[]) {
  const p = paden.flatMap(punten);
  return {
    xMin: Math.min(...p.map((q) => q[0])),
    xMax: Math.max(...p.map((q) => q[0])),
    yMin: Math.min(...p.map((q) => q[1])),
    yMax: Math.max(...p.map((q) => q[1])),
  };
}

/** De linkerrand van het schild op hoogte `v`, in kaart-units — de ónderkant,
 *  die alle vijf de schildvormen delen. Een ornament is "buiten de kaart"
 *  wanneer het links van deze rand ligt. Zelfde hulpfunctie als in
 *  futKaartOrnamenten.test.ts; de vinnen hangen precies aan dit stuk. */
function schildLinkerrand(v: number): number {
  const t = v / 139;
  if (t <= 0.6) return 0;
  if (t <= 0.838) return ((t - 0.6) / 0.238) * 13.5;
  if (t <= 0.972) return 13.5 + ((t - 0.838) / 0.134) * 30;
  return 43.5 + ((t - 0.972) / 0.028) * 6.5;
}

const alleStrengPaden = (s: Streng) => [
  s.omtrek,
  s.highlight,
  s.schaduw,
  ...s.ribbels,
  ...s.ribbelGlans,
];

/** Elk punt van een aspad moet zijn spiegelbeeld om x=50 in het pad hebben. */
function spiegelvrij(pad: string, marge = 0.2): [number, number][] {
  const p = punten(pad);
  return p.filter(
    ([x, y]) =>
      !p.some(
        (q) => Math.abs(q[0] - (100 - x)) < marge && Math.abs(q[1] - y) < marge,
      ),
  );
}

describe("bouwVlam", () => {
  it("levert een gesloten, om de as symmetrische vlam", () => {
    const vlam = bouwVlam(50, 40, 20, 12);
    expect(vlam.startsWith("M 50 40")).toBe(true);
    expect(vlam.endsWith("Z")).toBe(true);
    expect(spiegelvrij(vlam)).toEqual([]);
    expect(vlam).not.toMatch(/NaN/);
  });

  it("houdt zich aan de opgegeven basis, hoogte en breedte", () => {
    // De vorm reikt tot ±0,44 breedte en van de basis tot precies de hoogte:
    // daarop is elke plaatsing hieronder gekalibreerd, dus dit bewaakt de
    // afspraak tussen `bouwVlam` en de crest-/medaillonmaten.
    const g = grenzen([bouwVlam(50, 40, 20, 12)]);
    expect(g.yMax).toBeCloseTo(40, 5);
    expect(g.yMin).toBeCloseTo(20, 5);
    expect(50 - g.xMin).toBeCloseTo(0.44 * 12, 5);
    expect(g.xMax - 50).toBeCloseTo(0.44 * 12, 5);
  });

  it("is onderaan geknepen en in het midden breed — een vlam, geen kroontje", () => {
    // Het verschil tussen "vlam" en "drietand" zit hier: onderaan moet de vorm
    // knijpen. Een profiel dat bij de voet het breedst is, leest onherroepelijk
    // als kroontje — dus dit bewaakt de ontwerpkeuze, niet de exacte kromming.
    const vlam = bouwVlam(0, 100, 100, 100);
    const breedteOp = (v: number) => {
      let breedste = 0;
      for (const [x, y] of samples(vlam))
        if (Math.abs(y - (100 - v)) < 2) breedste = Math.max(breedste, Math.abs(x));
      return breedste;
    };
    expect(breedteOp(6)).toBeLessThan(breedteOp(30) * 0.6);
    expect(breedteOp(30)).toBeGreaterThan(breedteOp(70));
  });

  it("legt de nerven binnen de vlam en symmetrisch om de as", () => {
    const nerven = bouwVlamNerven(50, 40, 20, 12);
    expect(nerven).toHaveLength(3);
    const g = grenzen(nerven);
    expect(g.xMin).toBeGreaterThan(50 - 0.44 * 12);
    expect(g.xMax).toBeLessThan(50 + 0.44 * 12);
    expect(g.yMin).toBeGreaterThan(20);
    expect(g.yMax).toBeLessThan(40);
    // Nerf 2 en 3 zijn elkaars spiegeling; nerf 1 staat op de as.
    expect(spiegelvrij(`${nerven[1]} ${nerven[2]}`)).toEqual([]);
    expect(spiegelvrij(nerven[0])).toEqual([]);
    for (const n of nerven) expect(n).not.toMatch(/NaN/);
  });
});

describe("On Fire-ornamenten (#710)", () => {
  const alles = [
    ...ONFIRE_VINNEN.flatMap(alleStrengPaden),
    ONFIRE_CREST_PLAAT,
    ONFIRE_CREST_BAND,
    ONFIRE_CREST_VLAM,
    ...ONFIRE_CREST_NERVEN,
    ONFIRE_MEDAILLON_VLAM,
    ...ONFIRE_MEDAILLON_NERVEN,
  ];

  it("past binnen de ornament-viewBox, ook gespiegeld", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const g = grenzen(alles);
    expect(Math.min(g.xMin, 100 - g.xMax)).toBeGreaterThan(vx);
    expect(Math.max(g.xMax, 100 - g.xMin)).toBeLessThan(vx + vw);
    expect(g.yMin).toBeGreaterThan(vy);
    expect(g.yMax).toBeLessThan(vy + vh);
    // Het medaillon is een cirkel, dus die valt buiten `grenzen`.
    const [mx, my] = ONFIRE_MEDAILLON.midden;
    expect(my + ONFIRE_MEDAILLON.ring).toBeLessThan(vy + vh);
    expect(mx - ONFIRE_MEDAILLON.ring).toBeGreaterThan(vx);
    // En de sintels, inclusief hun halo van 2,6 × de straal.
    for (const [u, v, r] of ONFIRE_SINTELS) {
      expect(u - r * 2.6).toBeGreaterThan(vx);
      expect(v + r * 2.6).toBeLessThan(vy + vh);
    }
  });

  it("geen NaN in de gegenereerde vinnen", () => {
    for (const vin of ONFIRE_VINNEN)
      for (const pad of alleStrengPaden(vin))
        expect(pad, `NaN in ${pad.slice(0, 40)}…`).not.toMatch(/NaN/);
  });

  it("de crest is symmetrisch en dekt élke schildbovenrand af", () => {
    // Crest en medaillon staan op de as en worden niet gespiegeld gerenderd,
    // dus ze moeten zélf symmetrisch zijn.
    for (const pad of [ONFIRE_CREST_PLAAT, ONFIRE_CREST_BAND, ONFIRE_CREST_VLAM])
      expect(spiegelvrij(pad), `${pad.slice(0, 24)}… mist spiegelbeelden`).toEqual(
        [],
      );

    // On Fire is een overlay op élke tier: de crest ligt vóór de kaart en moet
    // dus tot voorbij de diepste bovenrand reiken die een schildvorm heeft.
    // Dat is de V van de troon- en punt-vorm op v = 0,058 × 139 ≈ 8,1.
    const crest = grenzen([ONFIRE_CREST_PLAAT, ONFIRE_CREST_BAND]);
    expect(crest.yMax).toBeGreaterThan(0.058 * 139);
    // Maar hij mag de inkt niet raken: het vlak begint met het eloblok rond
    // v≈17 (12% padding op de kaartbreedte plus de randlagen).
    expect(crest.yMax).toBeLessThan(16);
    // En hij steekt bóven de kaart uit, anders is het geen crest.
    expect(grenzen([ONFIRE_CREST_VLAM]).yMin).toBeLessThan(-4);
  });

  it("het medaillon valt over de schildpunt en de vlam blijft in de schijf", () => {
    const [mx, my] = ONFIRE_MEDAILLON.midden;
    expect(mx).toBe(50);
    // De punt van élke schildvorm zit op (50, 139); de ring moet er dus
    // omheen vallen.
    expect(my - ONFIRE_MEDAILLON.ring).toBeLessThan(139);
    expect(my + ONFIRE_MEDAILLON.ring).toBeGreaterThan(139);
    for (const [x, y] of punten(ONFIRE_MEDAILLON_VLAM))
      expect(
        Math.hypot(x - mx, y - my),
        `vlampunt (${x}, ${y}) valt buiten de binnenschijf`,
      ).toBeLessThan(ONFIRE_MEDAILLON.vlak);
    expect(spiegelvrij(ONFIRE_MEDAILLON_VLAM)).toEqual([]);
  });

  it("de vinnen steken naast de kaart uit én hun wortels blijven bedekt", () => {
    // De ornamentlaag ligt achter de kaart: een vin die binnen de schildrand
    // blijft, is onzichtbaar. De bundel moet ~6 units naast de kaart uitkomen
    // (opgemeten in de referentie van #710) en op elke hoogte iets tonen.
    const g = grenzen(ONFIRE_VINNEN.flatMap((v) => [v.omtrek]));
    expect(g.xMin).toBeLessThan(-6);
    expect(g.xMin).toBeGreaterThan(-12);
    for (const vin of ONFIRE_VINNEN) {
      const buiten = punten(vin.omtrek).filter(
        ([x, y]) => x < schildLinkerrand(y) - 1,
      );
      expect(buiten.length, "vin blijft volledig achter de kaart").toBeGreaterThan(
        20,
      );
      // De wortel (het eerste punt van de omtrek) ligt op of over de as, zodat
      // de gespiegelde helft er tegenaan sluit, en onder de kaartpunt of achter
      // het medaillon — nooit als afgesneden uiteinde in het zicht.
      const [wortelX, wortelY] = punten(vin.omtrek)[0];
      expect(wortelX).toBeGreaterThan(46);
      expect(wortelY).toBeGreaterThan(139 - ONFIRE_MEDAILLON.ring);
    }
  });

  it("de achtergrondpluimen groeien achter beide kaartflanken vandaan (#834)", () => {
    expect(ONFIRE_PLUIMEN).toHaveLength(4);
    expect(ONFIRE_PLUIM_VERLOOP.at(-1)?.[1]).toContain(", 0)");
    for (const d of ONFIRE_PLUIMEN) {
      const p = punten(d);
      const xs = p.map(([x]) => x);
      expect(Math.min(...xs) < 0 || Math.max(...xs) > 100).toBe(true);
      expect(p[0][0]).toBeGreaterThan(0);
      expect(p[0][0]).toBeLessThan(100);
      expect(Math.min(...p.map(([, y]) => y))).toBeGreaterThanOrEqual(17);
      expect(Math.max(...p.map(([, y]) => y))).toBeLessThan(121);
    }
  });

  it("de voorste vlammen kruisen de rand van binnen naar buiten (#834)", () => {
    expect(ONFIRE_RANDVLAMMEN).toHaveLength(4);
    expect(ONFIRE_RANDVLAM_HARTEN).toHaveLength(4);
    expect(ONFIRE_RANDVLAM_VERLOOP).toHaveLength(4);
    for (const d of ONFIRE_RANDVLAMMEN) {
      const p = punten(d);
      const xs = p.map(([x]) => x);
      expect(Math.min(...xs) < 0 || Math.max(...xs) > 100).toBe(true);
      // Begin- en eindpunt liggen binnen de kaart; de cubic-buik gaat buiten.
      expect(p[0][0]).toBeGreaterThan(0);
      expect(p[0][0]).toBeLessThan(100);
      expect(p.at(-1)?.[0]).toBeGreaterThan(0);
      expect(p.at(-1)?.[0]).toBeLessThan(100);
    }
  });

  it("de sintels liggen in de marge bij de onderste zijkant, niet over de inkt", () => {
    // Het vlak zet zijn tekst tussen u≈14 en u≈86 en begint bij v≈17; alles
    // hier zit links van de tekst en onder de taille.
    for (const [u, v, r] of ONFIRE_SINTELS) {
      expect(u + r).toBeLessThan(10);
      expect(v).toBeGreaterThan(70);
      expect(v).toBeLessThan(139);
    }
    // Een handvol, geen wolk: performance en visuele rust (#710).
    expect(ONFIRE_SINTELS.length).toBeLessThanOrEqual(8);
  });

  it("het vlam-watermerk blijft binnen zijn 100×100-viewBox", () => {
    const g = grenzen(ONFIRE_WATERMARK.map((p) => p.d));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(100);
    // Eén silhouet plus drie thermische ringen.
    expect(ONFIRE_WATERMARK.filter((p) => p.soort === "vlak")).toHaveLength(1);
    expect(ONFIRE_WATERMARK.filter((p) => p.soort === "lijn")).toHaveLength(3);
  });
});

describe("kiesOrnament (#710)", () => {
  it("laat de editie van de tier winnen", () => {
    // De vastgelegde regel: On Fire vervangt het tier-ornament, want twee
    // volledige metaaloverlays stapelen mag niet van #710.
    expect(kiesOrnament("legende", "onfire")).toBe("onfire");
    expect(kiesOrnament("dictator", "onfire")).toBe("onfire");
    expect(kiesOrnament("brons", "onfire")).toBe("onfire");
    expect(kiesOrnament(undefined, "onfire")).toBe("onfire");
  });

  it("laat een editie zonder eigen ornament dat van de tier staan", () => {
    expect(kiesOrnament("legende", "inform")).toBe("goat");
    expect(kiesOrnament("dictator", "pias")).toBe("dictator");
    expect(kiesOrnament("goud", "inform")).toBeNull();
  });

  it("valt zonder editie terug op de tier", () => {
    expect(kiesOrnament("legende", null)).toBe("goat");
    expect(kiesOrnament("dictator", null)).toBe("dictator");
    expect(kiesOrnament("brons", null)).toBeNull();
    expect(kiesOrnament(undefined, null)).toBeNull();
  });
});
