import { describe, it, expect } from "vitest";
import { ORNAMENT_VIEWBOX, type Streng } from "./futKaartOrnamenten";
import {
  belPaden,
  PIAS_KAP_BAND,
  PIAS_KAP_BELLEN,
  PIAS_KAP_MIDDENLOB,
  PIAS_KAP_NERVEN,
  PIAS_KAP_ZIJLOB,
  PIAS_KAP_ZOOM,
  PIAS_LINT,
  PIAS_LINT_BEL,
  PIAS_LINT_HALS,
  PIAS_MED_BARST,
  PIAS_MED_HAARLIJN,
  PIAS_MED_MASKER,
  PIAS_MED_RING,
  PIAS_MED_TRAAN,
  PIAS_MED_TREKKEN,
  PIAS_MED_VLAK,
  PIAS_MED_VOLUTE,
  PIAS_STROOK,
  PIAS_MOTIEF,
  PIAS_MOTIEF_INK,
  PIAS_MOTIEF_VIEWBOX,
} from "./ornamentenPias";

/** Alle coördinaten uit een pad-string, als [x, y]-paren. De ornamenten
 *  gebruiken alleen M/L/C/A/Z met absolute getallen; bij een A-boog zijn de
 *  eerste getallen de radii, dus die paren zijn geen punten — daarom worden de
 *  ellipsen hieronder los getoetst en niet via deze helper. */
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

/** Omhullende van een belletje. Bewust niet via `punten`: een bel-pad bestaat
 *  uit A-bogen, en daar zijn de eerste twee getallen de radii — naïef paren
 *  levert dan spookcoördinaten op. */
const belDoos = (b: { cx: number; cy: number; r: number }) => ({
  xMin: b.cx - b.r,
  xMax: b.cx + b.r,
  yMin: b.cy - b.r,
  yMax: b.cy + b.r,
});

/** Linkerrand van het schild op hoogte v (kaart-units). Volgt de onderkant van
 *  de vier clipPaths in FutKaartDefs, die daar identiek zijn: recht tot 60%,
 *  dan via de taille (13,5 op 83,8%) naar de punt. */
function schildRandBij(v: number): number {
  const t = v / 139;
  if (t <= 0.6) return 0;
  if (t <= 0.838) return ((t - 0.6) / 0.238) * 13.5;
  if (t <= 0.972) return 13.5 + ((t - 0.838) / 0.134) * 30;
  return 43.5 + ((t - 0.972) / 0.028) * 6.5;
}

describe("Pias-ornament (#710)", () => {
  it("past binnen de ornament-viewBox, ook gespiegeld", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const dozen = [
      grenzen([
        ...alleStrengPaden(PIAS_KAP_ZIJLOB),
        ...alleStrengPaden(PIAS_KAP_MIDDENLOB),
        ...alleStrengPaden(PIAS_LINT),
        PIAS_LINT_HALS,
        PIAS_KAP_BAND,
        PIAS_KAP_ZOOM,
        ...PIAS_KAP_NERVEN,
        ...PIAS_MED_VOLUTE,
        PIAS_MED_MASKER,
        PIAS_MED_BARST,
        PIAS_MED_TRAAN,
        ...PIAS_MED_TREKKEN,
      ]),
      belDoos(PIAS_LINT_BEL),
      ...PIAS_KAP_BELLEN.map(belDoos),
    ];
    const g = {
      xMin: Math.min(...dozen.map((d) => d.xMin)),
      xMax: Math.max(...dozen.map((d) => d.xMax)),
      yMin: Math.min(...dozen.map((d) => d.yMin)),
      yMax: Math.max(...dozen.map((d) => d.yMax)),
    };
    // De halve linten en lobben worden gespiegeld (x → 100 − x), dus beide
    // kanten moeten passen.
    expect(Math.min(g.xMin, 100 - g.xMax)).toBeGreaterThan(vx);
    expect(Math.max(g.xMax, 100 - g.xMin)).toBeLessThan(vx + vw);
    expect(g.yMin).toBeGreaterThan(vy);
    expect(g.yMax).toBeLessThan(vy + vh);
  });

  it("levert geen enkele NaN op", () => {
    const alles = [
      ...alleStrengPaden(PIAS_KAP_ZIJLOB),
      ...alleStrengPaden(PIAS_KAP_MIDDENLOB),
      ...alleStrengPaden(PIAS_LINT),
      PIAS_MED_RING,
      PIAS_MED_VLAK,
      PIAS_MED_HAARLIJN,
      ...Object.values(belPaden(PIAS_LINT_BEL)),
      ...PIAS_KAP_BELLEN.flatMap((b) => Object.values(belPaden(b))),
      ...PIAS_MOTIEF.map((p) => p.d),
    ];
    for (const pad of alles)
      expect(pad, `NaN in ${pad.slice(0, 40)}…`).not.toMatch(/NaN/);
  });

  it("de narrenkap steekt bóven de kaart uit en heeft zijn wortels erachter", () => {
    // Onze bovenrand loopt vlak tot licht ingekeept (v tussen 0 en ~8), dus een
    // kap die niet ruim boven v=0 uitkomt is onzichtbaar. De middenlob is de
    // hoogste punt; de zijlobben mogen lager blijven maar moeten óók boven de
    // rand komen.
    const midden = grenzen(alleStrengPaden(PIAS_KAP_MIDDENLOB));
    const zij = grenzen(alleStrengPaden(PIAS_KAP_ZIJLOB));
    expect(midden.yMin).toBeLessThan(-14);
    expect(zij.yMin).toBeLessThan(-8);
    // Wortels áchter de kaart: beide lobben beginnen onder de bovenrand, anders
    // zweeft de kap los boven het schild (de laag ligt erachter).
    expect(punten(PIAS_KAP_MIDDENLOB.omtrek)[0][1]).toBeGreaterThan(3);
    expect(punten(PIAS_KAP_ZIJLOB.omtrek)[0][1]).toBeGreaterThan(3);
    // En de kap blijft binnen de kaartbreedte: een lob die naast het schild
    // hangt leest als een hoorn, niet als een kap.
    expect(zij.xMin).toBeGreaterThan(6);
  });

  it("de drie kap-belletjes zijn bewust ongelijk", () => {
    // Vastgelegd ontwerp: "kleine asymmetrische belletjes". Zou iemand ze
    // gelijk trekken of meespiegelen, dan valt dat hier op.
    expect(PIAS_KAP_BELLEN).toHaveLength(3);
    const stralen = PIAS_KAP_BELLEN.map((b) => b.r);
    expect(new Set(stralen).size).toBe(3);
    const [links, rechts] = PIAS_KAP_BELLEN;
    expect(Math.abs(50 - links.cx)).not.toBeCloseTo(
      Math.abs(rechts.cx - 50),
      1,
    );
  });

  it("het jokerlint komt achter de kaart vandaan en steekt er dan naast uit", () => {
    // Beide eisen tegelijk: de wortel moet áchter het schild zitten (anders
    // zweeft het lint los) en het lint moet verder naar buiten reiken dan de
    // schildrand op zijn hoogte (anders is het onzichtbaar).
    const wortel = punten(PIAS_LINT.omtrek)[0];
    expect(wortel[0]).toBeGreaterThan(schildRandBij(wortel[1]) + 3);
    const g = grenzen(alleStrengPaden(PIAS_LINT));
    expect(g.xMin).toBeLessThan(-4);
    // Het belletje hangt vrij náást de punt, niet erachter.
    expect(PIAS_LINT_BEL.cx + PIAS_LINT_BEL.r).toBeLessThan(
      schildRandBij(PIAS_LINT_BEL.cy) - 2,
    );
  });

  it("het maskermedaillon zit tussen de editie-regel en de schildpunt", () => {
    // Verticaal ingeklemd: de tekststapel eindigt bij een vol vlak rond v≈118
    // (padding-bottom 17,5–20% van #661) en de punt ligt op v=139. Een groter
    // of hoger medaillon raakt dus de Pias-regel of loopt de kaart uit.
    const ring = /A (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/.exec(PIAS_MED_RING);
    expect(ring).not.toBeNull();
    const [rx, ry] = [Number(ring![1]), Number(ring![2])];
    const cy = punten(PIAS_MED_RING)[0][1];
    expect(cy - ry).toBeGreaterThan(115);
    expect(cy + ry).toBeLessThan(139);
    // Horizontaal binnen het schild op zijn breedste hoogte.
    expect(50 - rx).toBeGreaterThan(schildRandBij(cy));
    // Ring, haarlijn en binnenvlak zijn concentrisch en lopen van buiten naar
    // binnen — anders verdwijnt een van de drie onder de andere.
    const radii = [PIAS_MED_RING, PIAS_MED_HAARLIJN, PIAS_MED_VLAK].map(
      (d) => Number(/A (\d+(?:\.\d+)?)/.exec(d)![1]),
    );
    expect(radii[0]).toBeGreaterThan(radii[1]);
    expect(radii[1]).toBeGreaterThan(radii[2]);
    for (const d of [PIAS_MED_RING, PIAS_MED_HAARLIJN, PIAS_MED_VLAK])
      expect(punten(d)[0][0] + Number(/A (\d+(?:\.\d+)?)/.exec(d)![1])).toBe(50);
  });

  it("het gebarsten masker blijft binnen het medaillonvlak", () => {
    // De barst loopt van kruin tot kin: begint en eindigt dus op de omtrek van
    // het masker, en het masker zelf past in het bordeaux binnenvlak.
    const masker = grenzen([PIAS_MED_MASKER]);
    const rx = Number(/A (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/.exec(PIAS_MED_VLAK)![1]);
    const ry = Number(/A (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/.exec(PIAS_MED_VLAK)![2]);
    const cy = punten(PIAS_MED_VLAK)[0][1];
    expect(masker.xMin).toBeGreaterThanOrEqual(50 - rx);
    expect(masker.xMax).toBeLessThanOrEqual(50 + rx);
    expect(masker.yMin).toBeGreaterThanOrEqual(cy - ry);
    expect(masker.yMax).toBeLessThanOrEqual(cy + ry);
    // Twee gezichten: alle trekken plus de traan liggen ín het masker.
    const trekken = grenzen([...PIAS_MED_TREKKEN, PIAS_MED_TRAAN]);
    expect(trekken.xMin).toBeGreaterThan(masker.xMin);
    expect(trekken.xMax).toBeLessThan(masker.xMax);
    expect(trekken.yMin).toBeGreaterThan(masker.yMin);
    expect(trekken.yMax).toBeLessThan(masker.yMax);
    // De barst raakt kruin én kin — een barst die halverwege stopt is een kras.
    const barst = punten(PIAS_MED_BARST);
    expect(barst[0][1]).toBeCloseTo(masker.yMin, 1);
    expect(barst[barst.length - 1][1]).toBeGreaterThan(masker.yMax - 1);
  });

  it("de kap-kraag ligt over de bovenrand zonder de tekst te raken", () => {
    // De kraag zit in de vóór-laag, dus hij mag de frame-banden bedekken (~4,7
    // units) maar moet boven de eerste tekstregel blijven; die begint met de
    // 12%-padding van het vlak rond v≈17.
    const g = grenzen([PIAS_KAP_BAND, PIAS_KAP_ZOOM, ...PIAS_KAP_NERVEN]);
    expect(g.yMin).toBeLessThan(2);
    expect(g.yMax).toBeGreaterThan(5);
    expect(g.yMax).toBeLessThan(16);
    // Symmetrisch rond de as: de kraag staat op de as en wordt niet gespiegeld,
    // dus een tikfout aan één kant zou anders onopgemerkt blijven.
    expect(50 - g.xMin).toBeCloseTo(g.xMax - 50, 1);
  });
});

describe("Pias-verloopstroken (#710)", () => {
  it("omsluit elk gouden pad, zodat de poster niet vlak wordt", () => {
    // De canvas-spiegel krijgt de y-strook van elk pad los aangeleverd (de DOM
    // laat objectBoundingBox dat zelf doen). Ligt een pad búiten zijn strook,
    // dan klemt canvas het verloop op één stop vast en wordt dat ornament
    // egaal donker — de bug die deze tabel bestaat om te voorkomen.
    const paren: ReadonlyArray<[string, readonly [number, number]]> = [
      [PIAS_KAP_BAND, PIAS_STROOK.kapBand],
      [PIAS_KAP_ZOOM, PIAS_STROOK.kapZoom],
      [PIAS_LINT_HALS, PIAS_STROOK.lintHals],
      [PIAS_MED_MASKER, PIAS_STROOK.medMasker],
      [PIAS_MED_VOLUTE[0], PIAS_STROOK.volute[0]],
      [PIAS_MED_VOLUTE[1], PIAS_STROOK.volute[1]],
    ];
    for (const [pad, [yMin, yMax]] of paren) {
      const g = grenzen([pad]);
      expect(g.yMin, `strook te laag voor ${pad.slice(0, 22)}…`).toBeGreaterThanOrEqual(yMin);
      expect(g.yMax, `strook te hoog voor ${pad.slice(0, 22)}…`).toBeLessThanOrEqual(yMax);
      // Én strak: een strook die twee keer zo hoog is als het pad geeft een
      // verloop dat nauwelijks nog verloopt.
      expect(yMax - yMin).toBeLessThan((g.yMax - g.yMin) * 1.6 + 1);
    }
    // De twee ellipsen: hun strook is per definitie cy ± ry.
    for (const [pad, strook] of [
      [PIAS_MED_RING, PIAS_STROOK.medRing],
      [PIAS_MED_VLAK, PIAS_STROOK.medVlak],
    ] as const) {
      const ry = Number(/A [\d.]+ ([\d.]+)/.exec(pad)![1]);
      const cy = punten(pad)[0][1];
      expect(strook).toEqual([cy - ry, cy + ry]);
    }
  });
});

describe("Pias-motief (#710)", () => {
  it("rekent in kaart-units en dekt het hele vlak", () => {
    const [, , vw, vh] = PIAS_MOTIEF_VIEWBOX.split(" ").map(Number);
    expect([vw, vh]).toEqual([100, 139]);
    // De harlekijnruiten moeten dóór de rand bloeden, anders zie je de tegel
    // ophouden vlak voor de schildclip.
    const ruiten = grenzen(PIAS_MOTIEF.slice(0, 2).map((p) => p.d));
    expect(ruiten.xMin).toBeLessThan(0);
    expect(ruiten.xMax).toBeGreaterThan(100);
    expect(ruiten.yMin).toBeLessThan(0);
    expect(ruiten.yMax).toBeGreaterThan(139);
  });

  it("houdt het maskerwatermerk, de chevrons en de snippers ín het vlak", () => {
    // Alles ná de twee ruit-paden is decoratie die niet mag worden afgesneden:
    // een halve chevron of een half masker leest als een tekenfout.
    const g = grenzen(PIAS_MOTIEF.slice(2).map((p) => p.d));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(139);
  });

  it("blijft ondergeschikt aan de inkt: ruiten en watermerk ijl, markeringen mogen", () => {
    // De hele laag ligt achter de inkt (z-index −1). Twee regimes: de
    // vlakvullende lagen (ruiten, maskerwatermerk) moeten "nauwelijks
    // zichtbaar" blijven, de losse markeringen (chevrons, snippers) zijn
    // gedrukte inkt en mogen wél opvallen — maar geen van beide mag de kaart
    // van premium naar druk kantelen. Zonder deze grenzen schuift dat stil op
    // bij het bijstellen.
    const alpha = (kleur: string) => Number(/([\d.]+)\)$/.exec(kleur)![1]);
    for (const pad of PIAS_MOTIEF) {
      const kleur = pad.kleur ?? PIAS_MOTIEF_INK;
      const dekking = alpha(kleur) * (pad.alpha ?? 1);
      // Bordeauxrood = markering, bruin/crème = vlakvulling of watermerk.
      const markering = kleur.startsWith("rgba(140");
      expect(dekking, `te dekkend: ${kleur}`).toBeLessThan(
        markering ? 0.35 : 0.18,
      );
    }
    // En het watermerk blijft ijler dan de barstjes: slijtage mag je zien, het
    // masker moet je pas ontdekken.
    expect(alpha(PIAS_MOTIEF_INK)).toBeLessThan(0.1);
  });

  it("draagt de chevrons naar benéden: de daling, letterlijk", () => {
    // De chevron-laag is één pad met tien pijlpunten (vijf plekken × twee).
    // Elke punt moet lager liggen dan zijn twee schouders, anders wijst de
    // kaart de verkeerde kant op.
    const chevrons = PIAS_MOTIEF.find(
      (p) => p.soort === "lijn" && p.d.split("M").length === 11,
    );
    expect(chevrons, "chevron-pad niet gevonden").toBeDefined();
    for (const stuk of chevrons!.d.split("M").slice(1)) {
      const [l, punt, r] = punten(`M${stuk}`);
      expect(punt[1]).toBeGreaterThan(l[1]);
      expect(punt[1]).toBeGreaterThan(r[1]);
      expect(punt[0]).toBeCloseTo((l[0] + r[0]) / 2, 5);
    }
  });
});
