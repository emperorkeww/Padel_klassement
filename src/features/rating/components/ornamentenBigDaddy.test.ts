import { describe, it, expect } from "vitest";
import { ORNAMENT_VIEWBOX, type Streng } from "./futKaartOrnamenten";
import {
  BD_BALLONNEN,
  BD_CONFETTI,
  BD_KROON,
  BD_KROON_BAND,
  BD_KROON_BANDGLANS,
  BD_KROON_BOLLEN,
  BD_KROON_MOTIEF,
  BD_KROON_MOTIEF_BREEDTE,
  BD_KROON_MOTIEF_POSITIE,
  BD_KROON_STEEN,
  BD_KROON_STEEN_FACETTEN,
  BD_LINT_BOOG,
  BD_LINT_STAART,
  BD_PUNT_STEEN,
  BD_PUNT_STEEN_FACETTEN,
  BD_PUNT_VLEUGEL,
  BD_PUNT_ZETTING,
  cirkelPad,
  padDoos,
  symmetrischeOmtrek,
  type Bol,
} from "./ornamentenBigDaddy";

/** Alle coördinaten uit een pad-string, als [x, y]-paren. Alleen geldig voor
 *  paden met M/L/C en absolute getallen — dus niet voor de boogpaden uit
 *  `cirkelPad`, die met hun radius-getallen uit de fase zouden lopen. */
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

/** Linkerrand van het schild op hoogte v (kaart-units). Alle vier de
 *  schildvormen delen deze onderkant, dus dit geldt voor élke divisie die een
 *  Big Daddy kan hebben. Conservatief lineair benaderd: het bewaakt of een
 *  ornament náást de kaart uitkomt, niet de exacte kromming. */
function schildRandBij(v: number): number {
  if (v <= 83.4) return 0;
  if (v <= 116.5) return ((v - 83.4) / 33.1) * 13.5;
  if (v <= 135.1) return 13.5 + ((v - 116.5) / 18.6) * 30;
  return 43.5 + ((v - 135.1) / 3.9) * 6.5;
}

/** Diepste bovenrand die een divisie kan meebrengen: de spitse vleugels
 *  (fut-schild-punt) dippen in het midden tot 0.058 × 139. Alles wat de
 *  vóór-laag over de inkeping legt moet daar onder komen, anders schijnt er
 *  achtergrond door tussen ornament en kaart. */
const DIEPSTE_BOVENRAND = 0.058 * 139;

describe("symmetrischeOmtrek", () => {
  it("sluit het pad en spiegelt elk punt om x=50", () => {
    const d = symmetrischeOmtrek([50, 0], [
      ["C", 44, 4, 40, 10, 40, 16],
      ["L", 42, 20],
      ["L", 50, 22],
    ] as const);
    expect(d.startsWith("M 50 0")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    for (const [x, y] of punten(d)) {
      const spiegel = punten(d).some(
        (q) => Math.abs(q[0] - (100 - x)) < 0.01 && Math.abs(q[1] - y) < 0.01,
      );
      expect(spiegel, `(${x}, ${y}) heeft geen spiegelbeeld`).toBe(true);
    }
  });

  it("levert net zoveel segmenten heen als terug", () => {
    const d = symmetrischeOmtrek([50, 0], [
      ["C", 44, 4, 40, 10, 40, 16],
      ["L", 50, 20],
    ] as const);
    expect((d.match(/C /g) ?? []).length).toBe(2);
    expect((d.match(/L /g) ?? []).length).toBe(2);
  });
});

describe("padDoos", () => {
  it("omvat het hele pad", () => {
    const doos = padDoos("M 10 20 L 30 20 L 30 50 L 10 50 Z");
    expect(doos).toEqual({ x: 10, y: 20, b: 20, h: 30 });
  });
});

describe("Big Daddy-ornament (#710)", () => {
  /** Alles wat als pad-string in de ornamentlaag terechtkomt, behalve de
   *  boogpaden (die dragen hun maten als Bol-data). */
  const rechtePaden = [
    BD_KROON,
    ...BD_KROON_BAND,
    ...BD_KROON_BANDGLANS,
    BD_KROON_STEEN,
    ...BD_KROON_STEEN_FACETTEN,
    BD_PUNT_ZETTING,
    BD_PUNT_STEEN,
    ...BD_PUNT_STEEN_FACETTEN,
    ...alleStrengPaden(BD_LINT_BOOG),
    ...alleStrengPaden(BD_LINT_STAART),
    ...alleStrengPaden(BD_PUNT_VLEUGEL),
    ...BD_CONFETTI.map((c) => c.d),
    ...BD_BALLONNEN.flatMap((b) => [b.d, b.knoop, b.touw]),
  ];
  const bollen: readonly Bol[] = [
    ...BD_KROON_BOLLEN,
    ...BD_BALLONNEN.map((b) => b.glans),
  ];

  it("past binnen de gedeelde ornament-viewBox", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af. Big Daddy hergebruikt
    // bewust dezelfde doos als de GOAT, zodat .fut-kaart__ornament niet per
    // ornament een eigen plaatsing nodig heeft.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const g = grenzen(rechtePaden);
    const xMin = Math.min(g.xMin, ...bollen.map((b) => b.cx - b.r));
    const xMax = Math.max(g.xMax, ...bollen.map((b) => b.cx + b.r));
    const yMin = Math.min(g.yMin, ...bollen.map((b) => b.cy - b.r));
    const yMax = Math.max(g.yMax, ...bollen.map((b) => b.cy + b.r));
    // Ook de gespiegelde helften (x → 100 − x) moeten passen.
    expect(Math.min(xMin, 100 - xMax)).toBeGreaterThan(vx);
    expect(Math.max(xMax, 100 - xMin)).toBeLessThan(vx + vw);
    expect(yMin).toBeGreaterThan(vy);
    expect(yMax).toBeLessThan(vy + vh);
  });

  it("bevat geen NaN", () => {
    for (const pad of [...rechtePaden, ...bollen.map(cirkelPad)])
      expect(pad, `NaN in ${pad.slice(0, 40)}…`).not.toMatch(/NaN/);
  });

  it("kroon, stenen en zetting zijn symmetrisch rond de as", () => {
    for (const [naam, pad] of [
      ["kroon", BD_KROON],
      ["kroonsteen", BD_KROON_STEEN],
      ["punt-zetting", BD_PUNT_ZETTING],
      ["puntsteen", BD_PUNT_STEEN],
    ] as const) {
      const g = grenzen([pad]);
      expect(50 - g.xMin, naam).toBeCloseTo(g.xMax - 50, 1);
    }
    // De kroonknoppen: de buitenste twee zijn elkaars spiegeling, de middelste
    // staat op de as.
    const cxs = BD_KROON_BOLLEN.map((b) => b.cx).sort((a, b) => a - b);
    expect(cxs[0] + cxs[2]).toBeCloseTo(100, 2);
    expect(cxs[1]).toBe(50);
  });

  it("de kroon zit in de inkeping, niet erboven", () => {
    // Opgemeten uit de referentie (#710): kroonbreedte ~16 units, top ~10,5
    // boven de bovenrand. De voet moet dieper reiken dan de diepste bovenrand
    // die een divisie meebrengt, anders schijnt er onder de kroon achtergrond
    // door — deze laag ligt namelijk vóór de kaart.
    const doos = padDoos(BD_KROON);
    expect(doos.x).toBeGreaterThan(38);
    expect(doos.x + doos.b).toBeLessThan(62);
    expect(doos.y + doos.h).toBeGreaterThan(DIEPSTE_BOVENRAND);
    const top = Math.min(
      doos.y,
      ...BD_KROON_BOLLEN.map((b) => b.cy - b.r),
    );
    expect(top).toBeLessThan(-8);
    expect(top).toBeGreaterThan(-16);
  });

  it("het punt-ornament omsluit de schildpunt en steekt eronder uit", () => {
    const doos = padDoos(BD_PUNT_ZETTING);
    // Begint achter de punt (v<139) en komt eronder uit.
    expect(doos.y).toBeLessThan(139);
    expect(doos.y + doos.h).toBeGreaterThan(148);
    // De vleugels waaieren náást het schild uit; op hun hoogte loopt de
    // onderrand al naar de punt, dus buiten die rand blijven is de test.
    const vleugel = grenzen(alleStrengPaden(BD_PUNT_VLEUGEL));
    expect(vleugel.xMin).toBeLessThan(schildRandBij(vleugel.yMin) - 1);
  });

  it("het lint komt náást het schild uit en heeft zijn wortels erachter", () => {
    // Deze laag ligt achter de kaart: een lint dat binnen de schildrand blijft
    // is onzichtbaar. Beide bogen moeten dus links van de rand uitkomen, en
    // hun begin- en eindpunt juist erachter (anders zweeft het lint los).
    for (const streng of [BD_LINT_BOOG, BD_LINT_STAART]) {
      const g = grenzen(alleStrengPaden(streng));
      expect(g.xMin).toBeLessThan(-6);
      const p = punten(streng.omtrek);
      for (const [x, y] of [p[0], p[p.length - 1]])
        expect(x, `wortel op v=${y} steekt uit`).toBeGreaterThan(
          schildRandBij(y),
        );
    }
    // En samen dekken ze de hele onderflank: van de taille tot onder de punt.
    const alles = grenzen([
      ...alleStrengPaden(BD_LINT_BOOG),
      ...alleStrengPaden(BD_LINT_STAART),
    ]);
    expect(alles.yMin).toBeLessThan(60);
    expect(alles.yMax).toBeGreaterThan(139);
  });

  it("de confetti valt volledig buiten het schild", () => {
    // Achter de kaart getekend, dus alles binnen het silhouet is verspild — en
    // wie een vlokje verplaatst, ziet dat hier meteen.
    for (const c of BD_CONFETTI) {
      const g = grenzen([c.d]);
      const buiten =
        g.yMax < 0 ||
        g.yMin > 139 ||
        g.xMax < schildRandBij(g.yMax) ||
        g.xMin > 100 - schildRandBij(g.yMax);
      expect(buiten, `confetti ${c.d} ligt achter de kaart`).toBe(true);
    }
  });

  it("de ballonnen staan rechtsboven, met het touw naar de schouder", () => {
    expect(BD_BALLONNEN).toHaveLength(2);
    for (const b of BD_BALLONNEN) {
      const g = grenzen([b.d]);
      expect(g.xMin, "ballon hoort in de rechterbovenhoek").toBeGreaterThan(90);
      expect(g.yMin).toBeLessThan(0);
      // Het touwtje eindigt achter de kaart, anders hangt de ballon los.
      const touw = punten(b.touw);
      const [tx, ty] = touw[touw.length - 1];
      expect(ty).toBeGreaterThan(0);
      expect(tx).toBeLessThan(100);
      // De doos die de gradient gebruikt beschrijft de ellips; de
      // controlepunten van de peervorm liggen daar een fractie buiten — dat is
      // precies wat een bolle flank doet.
      expect(b.doos.x).toBeLessThanOrEqual(g.xMin + 0.5);
      expect(b.doos.x + b.doos.b).toBeGreaterThanOrEqual(g.xMax - 0.5);
    }
  });

  it("het kroon-watermerk blijft binnen zijn 100×100-viewBox", () => {
    for (const pad of BD_KROON_MOTIEF) {
      // De bolletjes staan als boogpad in het motief; die meet je via de doos
      // van het silhouet niet, dus alleen de M/L/C-paden.
      if (pad.d.includes("A ")) continue;
      const g = grenzen([pad.d]);
      expect(g.xMin).toBeGreaterThanOrEqual(0);
      expect(g.xMax).toBeLessThanOrEqual(100);
      expect(g.yMin).toBeGreaterThanOrEqual(0);
      expect(g.yMax).toBeLessThanOrEqual(100);
    }
    // En het valt binnen het vlak: breedte × positie mogen samen nooit onder
    // de kaartpunt uitkomen (139 units hoog).
    const b = BD_KROON_MOTIEF_BREEDTE * 100;
    expect(BD_KROON_MOTIEF_POSITIE * (139 - b) + b).toBeLessThan(139);
  });
});
