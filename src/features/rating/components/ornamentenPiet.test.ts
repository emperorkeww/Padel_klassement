import { describe, it, expect } from "vitest";
import { ORNAMENT_VIEWBOX } from "./futKaartOrnamenten";
import {
  PIET_CREST_DOOS,
  PIET_CREST_GRAVURE,
  PIET_CREST_PION,
  PIET_CREST_PUNT,
  PIET_CREST_RING,
  PIET_CREST_SCHIJF,
  PIET_CREST_VLEUGEL,
  PIET_KETTING,
  PIET_KETTING_DRAAD,
  PIET_LAUWER,
  PIET_LAUWER_RUIT,
  PIET_RAND_CARTOUCHES,
  PIET_RAND_RUIT,
  PIET_RAND_TEKENS,
  PIET_SLUITING,
  PIET_WATERMERK,
  PIET_ZEGEL_BREUK,
  PIET_ZEGEL_DOOS,
  PIET_ZEGEL_DRAAD,
  PIET_ZEGEL_GRAVURE,
  PIET_ZEGEL_HELFT_LINKS,
  PIET_ZEGEL_HELFT_RECHTS,
  PIET_ZEGEL_SCHIJF,
  PIET_ZEGEL_STUKKEN,
  klaverPad,
  pionPad,
  ruitPad,
  schoppenPad,
  type Doos,
} from "./ornamentenPiet";

/** Ankerpunten uit een pad-string. M/L/C leveren hun punten letterlijk; een
 *  boog (A) draagt zijn extremen niet in zijn coördinaten, dus daarvoor nemen
 *  we de volle cirkel om béide mogelijke middelpunten mee. Dat overschat de
 *  omhullende bewust: voor "past dit binnen de viewBox" is een ruimere schatting
 *  veilig, en de exacte maten van de bogen staan in hun Doos. */
function punten(pad: string, alleenAnkers = false): [number, number][] {
  const tokens = pad.replace(/,/g, " ").trim().split(/\s+/);
  const uit: [number, number][] = [];
  let i = 0;
  let cmd = "";
  let hier: [number, number] = [0, 0];
  const getal = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === "Z" || cmd === "z") continue;
    if (cmd === "M" || cmd === "L") {
      hier = [getal(), getal()];
      uit.push(hier);
    } else if (cmd === "C") {
      for (let k = 0; k < 3; k++) {
        hier = [getal(), getal()];
        uit.push(hier);
      }
    } else if (cmd === "A") {
      const rx = getal();
      const ry = getal();
      getal(); // rotatie
      getal(); // large-arc
      getal(); // sweep
      const eind: [number, number] = [getal(), getal()];
      const mx = (hier[0] + eind[0]) / 2;
      const my = (hier[1] + eind[1]) / 2;
      const dx = (eind[0] - hier[0]) / 2;
      const dy = (eind[1] - hier[1]) / 2;
      const h = Math.sqrt(Math.max(0, rx * rx - (dx * dx + dy * dy)));
      const len = Math.hypot(dx, dy) || 1;
      if (!alleenAnkers)
        for (const teken of [1, -1]) {
          const cx = mx + (teken * h * -dy) / len;
          const cy = my + (teken * h * dx) / len;
          for (const sx of [-1, 1])
            for (const sy of [-1, 1]) uit.push([cx + sx * rx, cy + sy * ry]);
        }
      hier = eind;
      uit.push(eind);
    } else {
      throw new Error(`onbekend pad-commando "${cmd}" in ${pad.slice(0, 40)}…`);
    }
  }
  return uit;
}

function grenzen(paden: readonly string[]) {
  const p = paden.flatMap((d) => punten(d));
  return {
    xMin: Math.min(...p.map((q) => q[0])),
    xMax: Math.max(...p.map((q) => q[0])),
    yMin: Math.min(...p.map((q) => q[1])),
    yMax: Math.max(...p.map((q) => q[1])),
  };
}

/** Elk punt van een symmetrisch pad moet zijn spiegelbeeld in hetzelfde pad
 *  hebben — dat vangt een handmatige tik in een gegenereerde vorm. */
function isSymmetrisch(pad: string, as: number): boolean {
  const p = punten(pad);
  return p.every(([x, y]) =>
    p.some(
      (q) => Math.abs(q[0] - (2 * as - x)) < 0.05 && Math.abs(q[1] - y) < 0.05,
    ),
  );
}

const ACHTER = [
  ...PIET_KETTING.flatMap((s) => [s.ring, s.binnen]),
  PIET_SLUITING.beugel,
  PIET_SLUITING.balk,
];
const VOOR_HELFT = [
  PIET_CREST_VLEUGEL.omtrek,
  PIET_CREST_VLEUGEL.highlight,
  PIET_CREST_VLEUGEL.schaduw,
  ...PIET_CREST_VLEUGEL.ribbels,
  ...PIET_CREST_VLEUGEL.ribbelGlans,
  ...PIET_LAUWER.flatMap((b) => [b.blad, b.nerf]),
  ...PIET_RAND_CARTOUCHES,
  ...PIET_RAND_TEKENS,
  PIET_RAND_RUIT,
  PIET_LAUWER_RUIT,
];
const VOOR_AS = [
  PIET_CREST_PUNT,
  PIET_CREST_RING,
  PIET_CREST_SCHIJF,
  ...PIET_CREST_GRAVURE,
  PIET_CREST_PION,
  PIET_ZEGEL_HELFT_LINKS,
  PIET_ZEGEL_HELFT_RECHTS,
  PIET_ZEGEL_SCHIJF,
  ...PIET_ZEGEL_GRAVURE,
  ...PIET_ZEGEL_STUKKEN,
  PIET_ZEGEL_BREUK,
];

describe("Piet-ornamenten (#710)", () => {
  it("bevat nergens een NaN", () => {
    // Alle vormen zijn gegenereerd; één deling door nul en er staat stil niets
    // meer op de kaart (een pad met NaN wordt in zijn geheel overgeslagen).
    for (const pad of [...ACHTER, ...VOOR_HELFT, ...VOOR_AS, ...PIET_WATERMERK.map((p) => p.d)])
      expect(pad, `NaN in ${pad.slice(0, 40)}…`).not.toMatch(/NaN/);
  });

  it("past met spiegeling en al binnen de ornament-viewBox", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; wat buiten de
    // viewBox loopt, snijdt de browser stil af. De strokes tellen mee: een
    // kettingdraad van 1,75 breed steekt er een halve dikte buiten.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const marge = Math.max(PIET_KETTING_DRAAD, PIET_ZEGEL_DRAAD, PIET_SLUITING.draad);
    const g = grenzen([...ACHTER, ...VOOR_HELFT, ...VOOR_AS]);
    expect(Math.min(g.xMin, 100 - g.xMax) - marge).toBeGreaterThan(vx);
    expect(Math.max(g.xMax, 100 - g.xMin) + marge).toBeLessThan(vx + vw);
    expect(g.yMin - marge).toBeGreaterThan(vy);
    expect(g.yMax + marge).toBeLessThan(vy + vh);
  });

  it("de ketting komt van achter de flank en bolt náást de kaart", () => {
    // De laag ligt achter het schild: de wortel hóórt onzichtbaar te zijn
    // (schakel 1 zit ruim binnen de kaartrand, u > 0) en het midden van de lus
    // hóórt buiten de kaart te vallen, anders zie je geen ketting.
    expect(PIET_KETTING.length).toBeGreaterThan(6);
    expect(PIET_KETTING[0].doos.x).toBeGreaterThan(4);
    expect(PIET_KETTING[0].doos.y).toBeLessThan(83);
    const g = grenzen(PIET_KETTING.map((s) => s.ring));
    expect(g.xMin).toBeLessThan(-3);
    // En hij loopt van boven naar onder: elke schakel ligt lager dan de vorige.
    for (let i = 1; i < PIET_KETTING.length; i++)
      expect(PIET_KETTING[i].doos.y).toBeGreaterThan(PIET_KETTING[i - 1].doos.y);
  });

  it("de sluiting is open en hangt vrij naast de smalle onderkant", () => {
    // Kern van de metafoor (#710): een geopende sluiting. De beugel is dus een
    // boog met een gat, geen gesloten ring.
    expect(PIET_SLUITING.beugel).not.toMatch(/[Zz]/);
    const punt = PIET_SLUITING.beugel.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const start: [number, number] = [punt[0], punt[1]];
    const eind: [number, number] = [punt[7], punt[8]];
    expect(Math.hypot(eind[0] - start[0], eind[1] - start[1])).toBeGreaterThan(5);
    // Op deze hoogte loopt het schild al naar de punt; de sluiting moet links
    // van die rand blijven, anders verdwijnt hij erachter.
    const schildRandBij = (v: number) => {
      const t = v / 139;
      if (t <= 0.838) return 13.5;
      if (t <= 0.972) return 13.5 + ((t - 0.838) / 0.134) * 30;
      return 43.5 + ((t - 0.972) / 0.028) * 6.5;
    };
    const doos = PIET_SLUITING.doos;
    expect(doos.x + doos.w).toBeLessThan(schildRandBij(doos.y));
  });

  it("het zegel zit in de onderpunt, onder de tekst en boven de schildpunt", () => {
    // Het vlak houdt onderaan ~18 units padding (padding-bottom 20% mét
    // editie-regel), dus de inkt eindigt rond v ≈ 116: daar moet het zegel
    // onder blijven. En de punt van het schild ligt op v = 139.
    const doos = PIET_ZEGEL_DOOS;
    expect(doos.y - PIET_ZEGEL_DRAAD / 2).toBeGreaterThan(116.5);
    expect(doos.y + doos.h + PIET_ZEGEL_DRAAD / 2).toBeLessThan(139);
    // Symmetrisch om de as gecentreerd, maar de twee helften verspringen —
    // anders is het zegel gebarsten in plaats van gebroken.
    expect(doos.x + doos.w / 2).toBeCloseTo(50, 5);
    const links = punten(PIET_ZEGEL_HELFT_LINKS)[0];
    const rechts = punten(PIET_ZEGEL_HELFT_RECHTS)[0];
    expect(links[1]).not.toBeCloseTo(rechts[1], 2);
  });

  it("houdt de vormen op de as symmetrisch", () => {
    for (const pad of [
      PIET_CREST_PUNT,
      PIET_CREST_RING,
      PIET_CREST_SCHIJF,
      PIET_CREST_PION,
      PIET_ZEGEL_SCHIJF,
    ])
      expect(isSymmetrisch(pad, 50), `${pad.slice(0, 30)}… niet symmetrisch`).toBe(
        true,
      );
    // En de gegenereerde kaarttekens rond hun eigen middelpunt.
    expect(isSymmetrisch(schoppenPad(10, 0, 4), 10)).toBe(true);
    expect(isSymmetrisch(klaverPad(10, 0, 4), 10)).toBe(true);
    expect(isSymmetrisch(ruitPad(10, 0, 4), 10)).toBe(true);
    expect(isSymmetrisch(pionPad(10, 0, 20), 10)).toBe(true);
  });

  it("de crest overlapt de bovenrand zonder de eloregel te raken", () => {
    // De crest ligt vóór de kaart: hij moet de rand halen (v < 5 bovenaan, waar
    // de vier schildvormen hun bovenrand hebben) maar boven de inkt blijven —
    // het vlak begint zijn content rond v ≈ 15,6.
    expect(PIET_CREST_DOOS.y).toBeLessThan(-3);
    const g = grenzen([PIET_CREST_PUNT, PIET_CREST_RING]);
    expect(g.yMax).toBeLessThan(15);
    expect(PIET_CREST_DOOS.x + PIET_CREST_DOOS.w / 2).toBeCloseTo(50, 5);
  });

  it("de randgravures liggen op het lakframe, niet midden op het ivoor", () => {
    // Het frame is 5,5 CSS-px van de kaartbreedte (~4,7 units op de veldmaat):
    // de cartouches en de ruit mogen daar een fractie buiten vallen, maar niet
    // het vlak in schuiven.
    const g = grenzen([...PIET_RAND_CARTOUCHES, ...PIET_RAND_TEKENS, PIET_RAND_RUIT]);
    expect(g.xMin).toBeGreaterThan(0);
    expect(g.xMax).toBeLessThan(7);
    // De lauwerband volgt de onderste schildrand van taille naar punt.
    const loof = grenzen(PIET_LAUWER.map((b) => b.blad));
    expect(loof.xMin).toBeGreaterThan(12);
    expect(loof.yMin).toBeGreaterThan(112);
    expect(loof.yMax).toBeLessThan(134);
  });

  it("het watermerk blijft binnen zijn 100×100-viewBox", () => {
    const g = grenzen(PIET_WATERMERK.map((p) => p.d));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(100);
    // Pion, ringen, zegel en kaarttekens: het watermerk is een compositie, geen
    // enkel motiefje (zie #710).
    expect(PIET_WATERMERK.filter((p) => p.soort === "lijn").length).toBeGreaterThan(3);
    expect(PIET_WATERMERK.filter((p) => p.soort === "vlak").length).toBeGreaterThan(3);
  });

  it("de dozen omsluiten de bogen waar ze het verloop voor plaatsen", () => {
    // Het canvas heeft geen bounding-box-API voor een Path2D en krijgt de doos
    // daarom mee; loopt die uit de pas met het pad, dan staat het staalverloop
    // op de poster ergens anders dan in de DOM.
    // Alleen de échte ankerpunten van het pad: de synthetische boog-hoeken van
    // de parser hierboven zijn een ruime schatting en zouden hier vals alarm
    // geven.
    const omsluit = (doos: Doos, pad: string) => {
      for (const [x, y] of punten(pad, true)) {
        expect(x).toBeGreaterThanOrEqual(doos.x - 0.05);
        expect(x).toBeLessThanOrEqual(doos.x + doos.w + 0.05);
        expect(y).toBeGreaterThanOrEqual(doos.y - 0.05);
        expect(y).toBeLessThanOrEqual(doos.y + doos.h + 0.05);
      }
    };
    // De twee schijven zijn cirkels, dus hun doos is vierkant.
    expect(PIET_CREST_DOOS.w).toBe(PIET_CREST_DOOS.h);
    expect(PIET_ZEGEL_DOOS.w).toBe(PIET_ZEGEL_DOOS.h);
    omsluit(PIET_CREST_DOOS, PIET_CREST_RING);
    omsluit(PIET_ZEGEL_DOOS, PIET_ZEGEL_SCHIJF);
    for (const s of PIET_KETTING) omsluit(s.doos, s.ring);
  });
});
