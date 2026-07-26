import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ORNAMENT_VIEWBOX } from "./futKaartOrnamenten";
import {
  bliksem,
  INFORM_CREST,
  INFORM_MEDAILLON,
  INFORM_MOTIEF,
  INFORM_VIN,
} from "./ornamentenInform";

/** Alle coördinaten uit een pad-string, als [x, y]-paren. Deze module schrijft
 *  alleen M/L met absolute getallen, dus dit dekt élk pad hier. */
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

/** De linkerrand van het schild op hoogte `v`, in kaart-units — de échte
 *  bezier uit FutKaartDefs, niet de rechte benadering. Onder de taille
 *  (v = 0,60 · 139) buigt de rand naar binnen; die curve blijft veel langer
 *  tegen u=0 aan liggen dan een rechte lijn van taille naar punt, en dát is
 *  precies waar de vin op afgestemd is. */
function schildLinkerrand(v: number): number {
  const t = v / 139;
  if (t <= 0.6) return 0;
  // C 0.045 0.795, 0 0.74, 0 0.60 — omgedraaid: van (0, 0.60) naar (0.135, 0.838).
  const bez = (a: number, b: number, c: number, d: number, s: number) => {
    const u = 1 - s;
    return u * u * u * a + 3 * u * u * s * b + 3 * u * s * s * c + s * s * s * d;
  };
  if (t <= 0.838) {
    // s zoeken waarvoor y(s) = t (monotoon, dus bisectie volstaat).
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (bez(0.6, 0.74, 0.795, 0.838, mid) < t) lo = mid;
      else hi = mid;
    }
    return bez(0, 0, 0.045, 0.135, (lo + hi) / 2) * 100;
  }
  if (t <= 0.972) return 13.5 + ((t - 0.838) / 0.134) * 30;
  return 43.5 + ((t - 0.972) / 0.028) * 6.5;
}

const alleVinPaden = [
  INFORM_VIN.omtrek,
  INFORM_VIN.highlight,
  INFORM_VIN.schaduw,
  ...INFORM_VIN.ribbels,
  ...INFORM_VIN.ribbelGlans,
];
const alleInformPaden = [
  ...alleVinPaden,
  INFORM_CREST,
  INFORM_MEDAILLON.bliksem,
];

describe("bliksemglyph (#710)", () => {
  it("is een gesloten pad dat exact de gevraagde doos vult", () => {
    const d = bliksem(50, 20, 10, 16);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const g = grenzen([d]);
    expect(g.xMin).toBeCloseTo(45, 2);
    expect(g.xMax).toBeCloseTo(55, 2);
    expect(g.yMin).toBeCloseTo(12, 2);
    expect(g.yMax).toBeCloseTo(28, 2);
  });

  it("crest en medaillon delen dezelfde glyph, alleen geschaald", () => {
    // Beide bliksems op één kaart moeten hetzelfde teken zijn; dat is de reden
    // dat er één generator is i.p.v. twee handgeschreven paden.
    const genormaliseerd = (pad: string) => {
      const g = grenzen([pad]);
      return punten(pad).map(([x, y]) => [
        (x - g.xMin) / (g.xMax - g.xMin),
        (y - g.yMin) / (g.yMax - g.yMin),
      ]);
    };
    const crest = genormaliseerd(INFORM_CREST);
    const medaillon = genormaliseerd(INFORM_MEDAILLON.bliksem);
    expect(medaillon).toHaveLength(crest.length);
    // Marge voor het afronden op 2 decimalen in kaart-units: op medaillonmaat
    // (7 units breed) is één honderdste al ~0,15% van de doos.
    medaillon.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(crest[i][0], 2);
      expect(y).toBeCloseTo(crest[i][1], 2);
    });
  });
});

describe("In-Form-ornament (#710)", () => {
  it("past binnen de ornament-viewBox, ook gespiegeld", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const g = grenzen(alleInformPaden);
    expect(Math.min(g.xMin, 100 - g.xMax)).toBeGreaterThan(vx);
    expect(Math.max(g.xMax, 100 - g.xMin)).toBeLessThan(vx + vw);
    expect(g.yMin).toBeGreaterThan(vy);
    expect(g.yMax).toBeLessThan(vy + vh);
    // Geen enkele NaN: één tik in een centerlijn en `bouwStreng` levert stil
    // een pad dat de browser gewoon niet tekent.
    for (const pad of alleInformPaden)
      expect(pad, `NaN in ${pad.slice(0, 40)}…`).not.toMatch(/NaN/);
  });

  it("de crest staat op de as en werkt op élke schildvorm", () => {
    // Overlay-eis: In-Form ligt bovenop élke tier, dus de crest mag niet van
    // één bovenrand afhangen. Hij staat symmetrisch om x=50 en vrijwel volledig
    // bóven v=0 — het hoogste punt dat een schildvorm op de as bereikt. Zo is
    // hij ook op `vlak` en `kroon` (bovenrand op v=0) heel te zien; bij `punt`
    // en `troon` (notch tot v≈8) nestelt hij bóven de V.
    const g = grenzen([INFORM_CREST]);
    expect(50 - g.xMin).toBeCloseTo(g.xMax - 50, 2);
    expect(g.yMin).toBeLessThan(-12);
    // Hooguit een paar units achter de bovenrand: meer en de bliksem zou op een
    // vlakke bovenrand halverwege afgesneden worden.
    expect(g.yMax).toBeGreaterThan(0);
    expect(g.yMax).toBeLessThan(4);
    // En smal genoeg om het schildsilhouet te laten lezen (< 1/6 kaartbreedte).
    expect(g.xMax - g.xMin).toBeLessThan(17);
  });

  it("de vin loopt láángs de onderste zijrand en blijft er buiten", () => {
    // De ornamentlaag ligt achter de kaart: een vin die binnen de schildrand
    // valt, is onzichtbaar. Deze rand (taille → punt) is bij álle vijf de
    // schildvormen identiek, en dáárom kan dit ornament een editie zijn.
    const p = punten(INFORM_VIN.omtrek);
    const buiten = p.filter(([x, y]) => x < schildLinkerrand(y));
    expect(buiten.length / p.length).toBeGreaterThan(0.5);
    // Hij steekt een paar units naast het schild uit — genoeg om te zien, te
    // weinig om het silhouet te verstoren.
    const uitsteek = Math.min(...p.map(([x, y]) => x - schildLinkerrand(y)));
    expect(uitsteek).toBeLessThan(-4);
    expect(uitsteek).toBeGreaterThan(-11);
    // En hij zit onder de taille (v > 0,60 · 139 ≈ 83) tot in de punt: boven de
    // taille zou hij met de bovenrand van de tier gaan botsen.
    const g = grenzen(alleVinPaden);
    expect(g.yMin).toBeGreaterThan(68);
    expect(g.yMax).toBeLessThan(120);
    // Vier plaatjes: drie dwarssneden, met evenveel lichte ruggen.
    expect(INFORM_VIN.ribbels).toHaveLength(3);
    expect(INFORM_VIN.ribbelGlans).toHaveLength(INFORM_VIN.ribbels.length);
  });

  it("het medaillon zit in de lege kaartpunt, onder de editie-regel", () => {
    // De punt op (50, 139) is bij alle vormen dezelfde; het vlak heeft daar
    // 24% bodempadding, dus tot v≈106 staat er tekst en daaronder niets.
    const [mx, my] = INFORM_MEDAILLON.midden;
    expect(mx).toBe(50);
    expect(my).toBeGreaterThan(115);
    expect(my + INFORM_MEDAILLON.ring).toBeLessThan(139);
    // Ringen van buiten naar binnen, zodat het reliëf niet omklapt.
    expect(INFORM_MEDAILLON.ring).toBeGreaterThan(INFORM_MEDAILLON.spouw);
    expect(INFORM_MEDAILLON.spouw).toBeGreaterThan(INFORM_MEDAILLON.binnenring);
    expect(INFORM_MEDAILLON.binnenring).toBeGreaterThan(INFORM_MEDAILLON.vlak);
    // En de bliksem past ín het vlak.
    const g = grenzen([INFORM_MEDAILLON.bliksem]);
    expect(g.xMax - mx).toBeLessThan(INFORM_MEDAILLON.vlak);
    expect(g.yMax - my).toBeLessThan(INFORM_MEDAILLON.vlak);
  });

  it("het motief blijft binnen zijn 100×100-viewBox", () => {
    // De svg clipt op zijn viewport, dus een pad dat erbuiten loopt zou in de
    // DOM afgesneden worden en op canvas (waar niet geclipt wordt) niet — de
    // pariteit tussen kaart en deel-poster hangt hieraan.
    const g = grenzen(INFORM_MOTIEF.map((p) => p.d));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(100);
    for (const p of INFORM_MOTIEF)
      expect(p.d, `NaN in ${p.d.slice(0, 40)}…`).not.toMatch(/NaN/);
  });

  it("de pulse-ring is een onderbroken ring rond de bovenste kaartinhoud", () => {
    // De ring hoort achter avatar en eloblok te liggen (bovenste helft van het
    // vlak) en mag geen sluitende cirkel zijn — dat is het verschil tussen een
    // ontlading en een lijst.
    const bogen = INFORM_MOTIEF.filter((p) => (p.breedte ?? 0) < 3).slice(0, 3);
    expect(bogen.length).toBeGreaterThanOrEqual(3);
    const g = grenzen(bogen.map((p) => p.d));
    expect(g.yMax).toBeLessThan(75);
    // Onderbroken: de hoofdboog begint en eindigt niet op hetzelfde punt.
    const p = punten(INFORM_MOTIEF[1].d);
    const [x0, y0] = p[0];
    const [x1, y1] = p[p.length - 1];
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(10);
  });

  it("is deterministisch: geen toeval in de ornamentpaden", () => {
    // De onregelmatige straal van de pulse-ring komt uit sinussen, niet uit
    // Math.random — anders zouden DOM-kaart, deel-poster en deze test elk een
    // andere boog krijgen. Dezelfde eis als bij de vezelkorrel van de pias
    // (#705), daar met een geseede PRNG.
    // Pad vanaf de projectroot: vitest draait daar, en import.meta.url is in de
    // jsdom-omgeving geen file:-URL.
    const bron = readFileSync(
      "src/features/rating/components/ornamentenInform.ts",
      "utf8",
    );
    // Zonder commentaar, want daarin staat juist uitgelegd waarom Math.random
    // hier niet mag staan.
    const code = bron.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    expect(code).not.toMatch(/Math\.random/);
    expect(bliksem(50, 20, 10, 16)).toBe(bliksem(50, 20, 10, 16));
  });
});
