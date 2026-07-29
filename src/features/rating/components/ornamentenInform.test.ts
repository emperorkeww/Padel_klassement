import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ORNAMENT_VIEWBOX } from "./futKaartOrnamenten";
import {
  bliksem,
  INFORM_CREST,
  INFORM_MEDAILLON,
  INFORM_MOTIEF,
  INFORM_STORM_ACHTER,
  INFORM_STORM_BINNEN,
  INFORM_STORM_VOOR,
  INFORM_VIN,
  INFORM_VINNEN,
  wolk,
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
    expect(INFORM_VINNEN).toHaveLength(2);
    expect(INFORM_VINNEN[1].ribbels).toHaveLength(2);
    expect(INFORM_VINNEN[1].bbox.yMin).toBeGreaterThan(INFORM_VIN.bbox.yMin);
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
    expect(wolk({ cx: 50, cy: 50, rx: 10, ry: 8, fase: 1 })).toBe(
      wolk({ cx: 50, cy: 50, rx: 10, ry: 8, fase: 1 }),
    );
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

describe("stormlagen (#834)", () => {
  const vlakken = (paden: typeof INFORM_STORM_ACHTER) =>
    paden.filter((p) => p.soort === "vlak");
  const lijnen = (paden: typeof INFORM_STORM_ACHTER) =>
    paden.filter((p) => p.soort === "lijn");
  const zwaartepunt = (d: string) => {
    const p = punten(d);
    return p.reduce((som, [x]) => som + x, 0) / p.length;
  };

  it("wolk() sluit glad: een gesloten pad rond het gevraagde middelpunt", () => {
    const d = wolk({ cx: 40, cy: 60, rx: 10, ry: 8, fase: 2 });
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const g = grenzen([d]);
    // De harmonischen golven de straal maximaal factor 1,32 op en neer.
    expect(g.xMin).toBeGreaterThan(40 - 10 * 1.32);
    expect(g.xMax).toBeLessThan(40 + 10 * 1.32);
    expect(g.yMin).toBeGreaterThan(60 - 8 * 1.32);
    expect(g.yMax).toBeLessThan(60 + 8 * 1.32);
  });

  it("de achterlaag past in de ornament-viewBox en breekt rechts uit", () => {
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const g = grenzen(INFORM_STORM_ACHTER.map((p) => p.d));
    expect(g.xMin).toBeGreaterThan(vx);
    expect(g.xMax).toBeLessThan(vx + vw);
    expect(g.yMin).toBeGreaterThan(vy);
    expect(g.yMax).toBeLessThan(vy + vh);
    // De massa breekt duidelijk buiten de rechterkaartrand (x=100) uit.
    expect(g.xMax).toBeGreaterThan(115);
    for (const p of INFORM_STORM_ACHTER)
      expect(p.d, `NaN in ${p.d.slice(0, 40)}…`).not.toMatch(/NaN/);
  });

  it("de compositie is asymmetrisch met de massa rechts", () => {
    // Compositie-eis uit de referentie: rechts dominant, links hooguit een
    // subtiel secundair effect. Gemeten aan de zwaartepunten van de
    // wolkenvlakken: ruim de meeste horen rechts van de kaart thuis.
    const zwaartepunten = vlakken(INFORM_STORM_ACHTER).map((p) =>
      zwaartepunt(p.d),
    );
    const rechts = zwaartepunten.filter((x) => x > 100).length;
    const links = zwaartepunten.filter((x) => x < 50).length;
    expect(links).toBeGreaterThan(0);
    expect(rechts).toBeGreaterThan(links * 3);
  });

  it("de hoofdwolk kruist de rechterrand i.p.v. ernaast te staan", () => {
    // Dé eis uit de instructies: geen losse wolk náást de kaart, maar een
    // massa die de rand kruist — deels achter het frame (x < 100, achter de
    // kaart dus onzichtbaar), deels erbuiten.
    const kruisend = vlakken(INFORM_STORM_ACHTER).filter((p) => {
      const g = grenzen([p.d]);
      return g.xMin < 95 && g.xMax > 105;
    });
    expect(kruisend.length).toBeGreaterThanOrEqual(2);
  });

  it("bliksems verbinden het kaartvlak met de uitgebroken wolk", () => {
    // Achterlaag: de hoofdbliksem weeft om x=100 heen.
    const achterKruisend = lijnen(INFORM_STORM_ACHTER).filter((p) => {
      const g = grenzen([p.d]);
      return g.xMin < 100 && g.xMax > 100;
    });
    expect(achterKruisend.length).toBeGreaterThan(0);
    // Voorlaag: minstens één segment loopt plaatselijk óver het frame.
    const voorKruisend = lijnen(INFORM_STORM_VOOR).filter((p) => {
      const g = grenzen([p.d]);
      return g.xMin < 100 && g.xMax > 100;
    });
    expect(voorKruisend.length).toBeGreaterThan(0);
    // En de binnenlaag heeft eigen filamenten die naar de rechterrand trekken.
    expect(lijnen(INFORM_STORM_BINNEN).length).toBeGreaterThan(0);
  });

  it("de voorlaag dekt de kaartinformatie niet af", () => {
    // De tekstband (naamplaat, divisieregel, editie-regel) leeft grofweg op
    // x 18–82 × v 74–112; de voorste wolkendelen horen in de framezone langs
    // de rechterrand plus één pufje over de linkeronderrand.
    const inTekstband = INFORM_STORM_VOOR.flatMap((p) => punten(p.d)).filter(
      ([x, y]) => x > 18 && x < 82 && y > 74 && y < 112,
    );
    expect(inTekstband).toHaveLength(0);
    // En de viewBox-grens geldt ook hier.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const g = grenzen(INFORM_STORM_VOOR.map((p) => p.d));
    expect(g.xMin).toBeGreaterThan(vx);
    expect(g.xMax).toBeLessThan(vx + vw);
    expect(g.yMin).toBeGreaterThan(vy);
    expect(g.yMax).toBeLessThan(vy + vh);
  });

  it("de binnenlaag begint ín het kaartvlak en loopt naar de rand", () => {
    // De wolk moet zichtbaar ín de rechterbovenhoek van het vlak beginnen:
    // een flink deel van de punten ligt binnen x<100, en de puffen mogen door
    // x=100 heen (schildclip en canvas-clip snijden identiek af).
    const alle = INFORM_STORM_BINNEN.flatMap((p) => punten(p.d));
    const binnen = alle.filter(([x]) => x < 100).length;
    expect(binnen / alle.length).toBeGreaterThan(0.4);
    // Bovenste helft van het vlak: de storm komt uit de rechterbovenkant.
    const g = grenzen(INFORM_STORM_BINNEN.map((p) => p.d));
    expect(g.yMin).toBeLessThan(10);
    expect(g.yMax).toBeLessThan(75);
    // En hij blijft uit de linkerhelft, waar het eloblok leeft.
    expect(g.xMin).toBeGreaterThan(55);
    for (const p of INFORM_STORM_BINNEN)
      expect(p.d, `NaN in ${p.d.slice(0, 40)}…`).not.toMatch(/NaN/);
  });
});
