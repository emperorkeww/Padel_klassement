import { describe, it, expect } from "vitest";
import { ORNAMENT_VIEWBOX, type Streng } from "./futKaartOrnamenten";
import {
  KAMPIOEN_CREST_GLANS,
  KAMPIOEN_CREST_KLAUW,
  KAMPIOEN_CREST_KRUIS,
  KAMPIOEN_CREST_RING,
  KAMPIOEN_CREST_STEEN,
  KAMPIOEN_CREST_ZETTING,
  KAMPIOEN_KRANS_BLAD,
  KAMPIOEN_KRANS_STAM,
  KAMPIOEN_LINT_AS,
  KAMPIOEN_LINT_BUITEN,
  KAMPIOEN_LINT_EMBLEEM,
  KAMPIOEN_LINT_PLATINA,
  KAMPIOEN_STEEN_FACETTEN,
  KAMPIOEN_CREST_FACET,
  KAMPIOEN_ZEGEL,
  KAMPIOEN_ZEGEL_BREEDTE,
  KAMPIOEN_ZEGEL_POSITIE,
} from "./ornamentenKampioen";

/** Alle coördinaten uit een pad-string, als [x, y]-paren. De generators
 *  schrijven alleen M/L/C/A met absolute getallen; bij een A-boog zijn de
 *  eerste getallen radiussen en geen punt, maar voor een grensmeting is dat
 *  ruim genoeg — een radius is nooit groter dan de boog zelf. */
function punten(pad: string): [number, number][] {
  const getallen = pad.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const uit: [number, number][] = [];
  for (let i = 0; i + 1 < getallen.length; i += 2)
    uit.push([getallen[i], getallen[i + 1]]);
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

const alleStrengPaden = (s: Streng) => [
  s.omtrek,
  s.highlight,
  s.schaduw,
  ...s.ribbels,
  ...s.ribbelGlans,
];

/** Alles wat de áchterste ornamentlaag van de Kampioen tekent (één helft). */
const ACHTER: readonly string[] = [
  ...alleStrengPaden(KAMPIOEN_KRANS_STAM),
  ...KAMPIOEN_KRANS_BLAD.flatMap((b) => [b.d, b.nerf, b.rand]),
  KAMPIOEN_LINT_BUITEN.d,
  ...KAMPIOEN_LINT_BUITEN.lijnen,
  KAMPIOEN_LINT_PLATINA.d,
  ...KAMPIOEN_LINT_PLATINA.lijnen,
  KAMPIOEN_LINT_AS.d,
  ...KAMPIOEN_LINT_AS.lijnen,
  ...KAMPIOEN_LINT_EMBLEEM,
];

/** Linkerrand van het schild op hoogte `v` (kaart-units), uit de onderkant van
 *  de clipPaths in FutKaartDefs: recht tot v=83,4 en dan via de taille naar de
 *  punt op (50, 139). Nodig om te toetsen dat een ornament náást de kaart
 *  uitsteekt en niet onzichtbaar erachter blijft. */
function schildRandBij(v: number): number {
  const t = v / 139;
  if (t <= 0.6) return 0;
  if (t <= 0.838) return ((t - 0.6) / 0.238) * 13.5;
  if (t <= 0.972) return 13.5 + ((t - 0.838) / 0.134) * 30;
  return 43.5 + ((t - 0.972) / 0.028) * 6.5;
}

describe("Kampioen-ornament (#710)", () => {
  it("past binnen de ornament-viewBox, ook gespiegeld", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const g = grenzen([
      ...ACHTER,
      KAMPIOEN_CREST_ZETTING,
      KAMPIOEN_CREST_RING,
      KAMPIOEN_CREST_STEEN,
      KAMPIOEN_CREST_KRUIS,
      ...KAMPIOEN_CREST_FACET,
      KAMPIOEN_CREST_GLANS,
      ...KAMPIOEN_CREST_KLAUW,
    ]);
    expect(Math.min(g.xMin, 100 - g.xMax)).toBeGreaterThan(vx);
    expect(Math.max(g.xMax, 100 - g.xMin)).toBeLessThan(vx + vw);
    expect(g.yMin).toBeGreaterThan(vy);
    expect(g.yMax).toBeLessThan(vy + vh);
  });

  it("geen enkele NaN in de gegenereerde paden", () => {
    for (const pad of ACHTER)
      expect(pad, `NaN in ${pad.slice(0, 40)}…`).not.toMatch(/NaN/);
    for (const pad of KAMPIOEN_ZEGEL)
      expect(pad.d, `NaN in ${pad.d.slice(0, 40)}…`).not.toMatch(/NaN/);
  });

  it("de lauwerkrans loopt achter de zijkanten omhoog en steekt links uit", () => {
    // Opgemeten aan de referentie (issue #710): de uiterste bladpunten liggen
    // op u≈−9,6 rond v≈86, de krans begint op v≈59 en eindigt achter de linten
    // op v≈133. Ruime marges: dit bewaakt de lezing van het silhouet, niet de
    // exacte kromming van elk blad.
    const loof = [
      ...alleStrengPaden(KAMPIOEN_KRANS_STAM),
      ...KAMPIOEN_KRANS_BLAD.map((b) => b.d),
    ];
    const g = grenzen(loof);
    expect(g.xMin).toBeLessThan(-6.5);
    expect(g.xMin).toBeGreaterThan(-13);
    expect(g.yMin).toBeGreaterThan(50);
    expect(g.yMin).toBeLessThan(65);
    // De wortel van de tak zit áchter de kaart: rechts van de schildrand op
    // die hoogte, anders zweeft de krans los onder de punt.
    const [wortelX, wortelY] = punten(KAMPIOEN_KRANS_STAM.omtrek)[0];
    expect(wortelX).toBeGreaterThan(schildRandBij(wortelY) - 4);
    expect(wortelY).toBeGreaterThan(125);
  });

  it("elk blad steekt náást het schild uit, niet erachter", () => {
    // De ornamentlaag ligt achter de kaart: een blad dat volledig binnen de
    // schildrand valt, is onzichtbaar werk. Getoetst op de bladpunt, want de
    // basis mág (en moet) achter de kaart verdwijnen.
    for (const b of KAMPIOEN_KRANS_BLAD) {
      const p = punten(b.d);
      // De generator schrijft de punt als het derde punt van de bolle flank.
      const tip = p[3];
      expect(
        tip[0],
        `bladpunt (${tip[0]}, ${tip[1]}) blijft achter het schild`,
      ).toBeLessThan(schildRandBij(tip[1]) - 0.5);
    }
  });

  it("de linten beginnen achter de kaart en steken onder de punt uit", () => {
    // Elk lint moet zijn bovenrand binnen het schild hebben (anders zweeft er
    // een afgesneden band naast de kaart) en met zijn staart onder de punt
    // (v=139) uitkomen — anders is het lint onzichtbaar.
    for (const l of [KAMPIOEN_LINT_BUITEN, KAMPIOEN_LINT_PLATINA, KAMPIOEN_LINT_AS]) {
      const p = punten(l.d);
      // Pad-volgorde uit `lint`: A (buitenste bovenhoek), B, C, M, D.
      const [ax, ay] = p[0];
      expect(ax, `linttop (${ax}, ${ay}) valt buiten het schild`).toBeGreaterThan(
        schildRandBij(ay) + 1,
      );
      const g = grenzen([l.d]);
      expect(g.yMax).toBeGreaterThan(145);
      expect(g.yMin).toBeLessThan(139);
    }
    // Het middenlint staat op de as en reikt het diepst: hij ís de punt van de
    // hele lintenfan.
    expect(grenzen([KAMPIOEN_LINT_AS.d]).yMax).toBeGreaterThan(
      grenzen([KAMPIOEN_LINT_BUITEN.d]).yMax,
    );
  });

  it("middenlint en embleem zijn symmetrisch rond de as", () => {
    // De band zelf is per pad symmetrisch; vouwlijnen en embleem bestaan uit
    // paden die elk één helft zijn, dus dáár is de envelop de maat.
    for (const set of [
      [KAMPIOEN_LINT_AS.d],
      KAMPIOEN_LINT_AS.lijnen,
      KAMPIOEN_LINT_EMBLEEM,
    ]) {
      const g = grenzen(set);
      expect(50 - g.xMin, set[0].slice(0, 30)).toBeCloseTo(g.xMax - 50, 1);
    }
    // En het embleem blijft binnen de band van het middenlint.
    const band = grenzen([KAMPIOEN_LINT_AS.d]);
    const merk = grenzen(KAMPIOEN_LINT_EMBLEEM);
    expect(merk.xMin).toBeGreaterThan(band.xMin);
    expect(merk.xMax).toBeLessThan(band.xMax);
    expect(merk.yMax).toBeLessThan(band.yMax);
  });

  it("de diamantcrest zit op de as, boven de bovenrand, met vier facetten", () => {
    for (const pad of [
      KAMPIOEN_CREST_ZETTING,
      KAMPIOEN_CREST_RING,
      KAMPIOEN_CREST_STEEN,
    ]) {
      const g = grenzen([pad]);
      expect(50 - g.xMin).toBeCloseTo(g.xMax - 50, 5);
    }
    // Hij hangt met zijn punt boven de kaart (v<0) en zakt in de inkeping
    // (de notch-vorm dipt tot v≈3,1), dus de crest hóórt in de voorste laag.
    const g = grenzen([KAMPIOEN_CREST_ZETTING]);
    expect(g.yMin).toBeLessThan(-3);
    expect(g.yMax).toBeGreaterThan(10);
    // Zetting ruimer dan de ring, ring ruimer dan de steen: drie geneste ruiten.
    const breedte = (p: string) => grenzen([p]).xMax - grenzen([p]).xMin;
    expect(breedte(KAMPIOEN_CREST_ZETTING)).toBeGreaterThan(
      breedte(KAMPIOEN_CREST_RING),
    );
    expect(breedte(KAMPIOEN_CREST_RING)).toBeGreaterThan(
      breedte(KAMPIOEN_CREST_STEEN),
    );
    // Vier facetten, vier tinten — de tabel en de paden mogen niet uit de maat
    // lopen, want de tekenaars koppelen ze op index.
    expect(KAMPIOEN_CREST_FACET).toHaveLength(4);
    expect(KAMPIOEN_STEEN_FACETTEN).toHaveLength(KAMPIOEN_CREST_FACET.length);
    expect(KAMPIOEN_CREST_KLAUW).toHaveLength(4);
  });

  it("het legacy-zegel blijft binnen zijn 100×100-viewBox", () => {
    const g = grenzen(KAMPIOEN_ZEGEL.map((p) => p.d));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(100);
    // Motiefmaat blijft binnen het vlak en boven de naamplaat: een breedte > 1
    // of een positie > 1 zou het zegel uit het vlak duwen.
    expect(KAMPIOEN_ZEGEL_BREEDTE).toBeLessThanOrEqual(1);
    expect(KAMPIOEN_ZEGEL_POSITIE).toBeGreaterThanOrEqual(0);
    expect(KAMPIOEN_ZEGEL_POSITIE).toBeLessThan(1);
  });

  it("het zegel draagt ringen, een krans en een schild — en geen kroon", () => {
    // De drie lagen die #710 vraagt, plus de stijlbeperking: geen kroon, want
    // die zou actuele nummer-éénstatus suggereren.
    const ringen = KAMPIOEN_ZEGEL.filter((p) => /A \d/.test(p.d) && p.soort === "lijn");
    expect(ringen.length).toBeGreaterThanOrEqual(3);
    const bladen = KAMPIOEN_ZEGEL.filter((p) => p.soort === "vlak");
    expect(bladen.length).toBeGreaterThan(10);
    // Krans links en rechts van de as, symmetrisch in envelop.
    const g = grenzen(bladen.map((p) => p.d));
    expect(50 - g.xMin).toBeCloseTo(g.xMax - 50, 0);
  });
});
