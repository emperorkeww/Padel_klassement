import { describe, it, expect } from "vitest";
import {
  bouwStreng,
  GOAT_BAARD_BLAD,
  GOAT_BAARD_FLICK,
  GOAT_BAARD_NERVEN,
  GOAT_HOORN,
  GOAT_MEDAILLON,
  ORNAMENT_DOOS,
  ORNAMENT_VIEWBOX,
  type Streng,
} from "./futKaartOrnamenten";

/** Alle coördinaten uit een pad-string, als [x, y]-paren. De generator schrijft
 *  alleen M/L/C met absolute getallen, dus dit dekt de hele ornamentlaag. */
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

describe("bouwStreng", () => {
  it("levert een gesloten omtrek die van dik naar dun loopt", () => {
    const streng = bouwStreng({
      start: [0, 0],
      segmenten: [
        [
          [10, 0],
          [20, 0],
          [30, 0],
        ],
      ],
      dikte: 4,
      punt: 0.2,
      stappen: 20,
    });
    expect(streng.omtrek.startsWith("M ")).toBe(true);
    expect(streng.omtrek.endsWith("Z")).toBe(true);
    // Rechte streng langs de x-as: de omtrek is bij de wortel ±dikte hoog en
    // bij de punt ±punt — de taper moet dus meetbaar knijpen.
    const p = punten(streng.omtrek);
    const bijWortel = p.filter((q) => q[0] < 1).map((q) => Math.abs(q[1]));
    const bijPunt = p.filter((q) => q[0] > 29).map((q) => Math.abs(q[1]));
    expect(Math.max(...bijWortel)).toBeCloseTo(4, 1);
    expect(Math.max(...bijPunt)).toBeLessThan(0.5);
  });

  it("geeft evenveel groeven als ruggen, en geen enkele NaN", () => {
    expect(GOAT_HOORN.ribbels.length).toBe(GOAT_HOORN.ribbelGlans.length);
    expect(GOAT_HOORN.ribbels.length).toBeGreaterThan(15);
    for (const pad of alleStrengPaden(GOAT_HOORN))
      expect(pad, `NaN in ${pad.slice(0, 40)}…`).not.toMatch(/NaN/);
  });
});

describe("GOAT-ornament (#710)", () => {
  it("past binnen de ornament-viewBox, met de CSS-doos in dezelfde maten", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const g = grenzen([
      ...alleStrengPaden(GOAT_HOORN),
      ...alleStrengPaden(GOAT_BAARD_FLICK),
      GOAT_BAARD_BLAD,
      ...GOAT_BAARD_NERVEN,
    ]);
    // Ook de gespiegelde helft (x → 100 − x) moet passen.
    expect(Math.min(g.xMin, 100 - g.xMax)).toBeGreaterThan(vx);
    expect(Math.max(g.xMax, 100 - g.xMin)).toBeLessThan(vx + vw);
    expect(g.yMin).toBeGreaterThan(vy);
    expect(g.yMax).toBeLessThan(vy + vh);

    // En de CSS-plaatsing (.fut-kaart__ornament) rekent met exact deze doos.
    expect(ORNAMENT_DOOS.links).toBeCloseTo(vx / 100, 5);
    expect(ORNAMENT_DOOS.boven).toBeCloseTo(vy / 139, 5);
    expect(ORNAMENT_DOOS.breedte).toBeCloseTo(vw / 100, 5);
    expect(ORNAMENT_DOOS.hoogte).toBeCloseTo(vh / 139, 5);
  });

  it("de hoorn steekt links én boven de kaart uit, zoals de referentie", () => {
    // Opgemeten uit de referentie in issue #710: buitenrand tot u≈−17,5 en de
    // boogtop tot v≈−16,5. Ruime marges: dit bewaakt de leesbaarheid van het
    // silhouet, niet de exacte kromming.
    const g = grenzen(alleStrengPaden(GOAT_HOORN));
    expect(g.xMin).toBeLessThan(-14);
    expect(g.xMin).toBeGreaterThan(-22);
    expect(g.yMin).toBeLessThan(-13);
    expect(g.yMin).toBeGreaterThan(-22);
    // De wortel zit áchter de kaart (rechts van de linkerrand, onder de
    // bovenrand van de kroon-crest op v≈4,9), anders zweeft de hoorn los.
    const [wortelX, wortelY] = punten(GOAT_HOORN.omtrek)[0];
    expect(wortelX).toBeGreaterThan(15);
    expect(wortelY).toBeGreaterThan(6);
  });

  it("het baardblad is symmetrisch rond de as en groeit uit de punt", () => {
    const p = punten(GOAT_BAARD_BLAD);
    const g = grenzen([GOAT_BAARD_BLAD]);
    // Even ver naar links als naar rechts van x=50.
    expect(50 - g.xMin).toBeCloseTo(g.xMax - 50, 1);
    // Begint achter de schildpunt (v<139) en steekt eronder uit.
    expect(g.yMin).toBeLessThan(139);
    expect(g.yMax).toBeGreaterThan(150);
    // Elk punt heeft zijn spiegelbeeld in het pad — de generator bouwt de
    // tweede helft uit de eerste, dus dit vangt een handmatige tik erin.
    for (const [x, y] of p) {
      const spiegel = p.some(
        (q) => Math.abs(q[0] - (100 - x)) < 0.2 && Math.abs(q[1] - y) < 0.2,
      );
      expect(spiegel, `(${x}, ${y}) heeft geen spiegelbeeld`).toBe(true);
    }
  });

  it("de baard-flick steekt náást het schild uit, niet erachter", () => {
    // De ornamentlaag ligt achter de kaart: een flick die binnen de
    // schildrand blijft, is onzichtbaar. Op zijn hoogte (v≈132–140) loopt het
    // schild van de taille naar de punt; de flick moet daar links van blijven.
    const g = grenzen(alleStrengPaden(GOAT_BAARD_FLICK));
    const schildRandBij = (v: number) => {
      // Onderkant van het schildpad: (0.135, 0.838) → (0.435, 0.972) → punt.
      const t = v / 139;
      if (t <= 0.838) return 13.5;
      if (t <= 0.972) return (13.5 + ((t - 0.838) / 0.134) * 30) as number;
      return 43.5 + ((t - 0.972) / 0.028) * 6.5;
    };
    expect(g.xMin).toBeLessThan(schildRandBij(g.yMin) - 1);
  });

  it("het medaillon blijft binnen zijn 100×100-viewBox", () => {
    const g = grenzen(GOAT_MEDAILLON.map((p) => p.d));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(100);
  });
});
