import { describe, it, expect } from "vitest";
import {
  bouwStreng,
  DICTATOR_EPAULET,
  DICTATOR_EPAULET_FRANJE,
  DICTATOR_GEMS,
  DICTATOR_KROON,
  DICTATOR_KROON_BAND,
  DICTATOR_LAUWER_BLADEN,
  DICTATOR_LAUWER_STENGEL,
  DICTATOR_ZEGEL,
  GOAT_BAARD_ARM,
  GOAT_BAARD_BLADEN,
  GOAT_BAARD_KRUL,
  GOAT_BAARD_NERVEN,
  GOAT_BAARD_SPEER,
  GOAT_HOORN,
  GOAT_ICOON,
  GOAT_ICOON_VIEWBOX,
  GOAT_WATERMERK,
  ORNAMENT_DOOS,
  ORNAMENT_VIEWBOX,
  type Streng,
} from "./futKaartOrnamenten";

/** Alle coördinaten uit een pad-string, als [x, y]-paren. Alle paden hier
 *  gebruiken absolute commando's; van een A-boog telt alleen het eindpunt mee,
 *  want de vijf getallen ervóór (rx ry rotatie large-arc sweep) zijn vlaggen en
 *  geen coördinaten — die naïef als paar lezen leverde bij de oog-cirkels een
 *  spookpunt op (0, 1). */
function punten(pad: string): [number, number][] {
  const tokens = pad.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g) ?? [];
  const uit: [number, number][] = [];
  let cmd = "M";
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[A-Za-z]/.test(t)) {
      cmd = t.toUpperCase();
      i++;
      continue;
    }
    const groep = cmd === "A" ? 7 : cmd === "C" ? 6 : 2;
    const g = tokens.slice(i, i + groep).map(Number);
    i += groep;
    if (cmd === "A") uit.push([g[5], g[6]]);
    else for (let k = 0; k + 1 < g.length; k += 2) uit.push([g[k], g[k + 1]]);
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

/** De linkerrand van het schild op hoogte `v`, in kaart-units. Volgt de
 *  gedeelde onderkant uit FutKaartDefs: rechte zijkant tot de taille op
 *  v=0.60·139, dan naar (0.135, 0.838) en zo naar de punt op (0.5, 1). Een
 *  ornament is "buiten de kaart" wanneer het links van deze rand ligt. */
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
  s.rug,
  s.schaduw,
  ...s.ribbels,
  ...s.ribbelGlans,
];

/** Alle paden van het baardfiligraan (#772), in de helft waarin ze staan —
 *  de renderers spiegelen arm, krul en bladen om x=50. */
const BAARD_HELFT = [
  ...alleStrengPaden(GOAT_BAARD_ARM),
  ...alleStrengPaden(GOAT_BAARD_KRUL),
  ...GOAT_BAARD_BLADEN,
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
    for (const pad of [...alleStrengPaden(GOAT_HOORN), ...BAARD_HELFT])
      expect(pad, `NaN in ${pad.slice(0, 40)}…`).not.toMatch(/NaN/);
  });

  it("volgt een expliciet dikteprofiel i.p.v. de machtstaper (#772)", () => {
    // Rechte streng langs de x-as, dus de omtrek-y ís de halve dikte. Het
    // profiel doet iets wat geen exponent kan: eerst vlak blijven, dan in één
    // keer inknijpen — precies de bokhoorn van de referentie.
    const streng = bouwStreng({
      start: [0, 0],
      segmenten: [
        [
          [25, 0],
          [75, 0],
          [100, 0],
        ],
      ],
      profiel: [
        [0, 8],
        [0.4, 7.6],
        [0.6, 2.5],
        [1, 0.2],
      ],
      stappen: 100,
    });
    const dik = (x: number) =>
      Math.max(
        ...punten(streng.omtrek)
          .filter((q) => Math.abs(q[0] - x) < 1.5)
          .map((q) => Math.abs(q[1])),
      );
    expect(dik(2)).toBeCloseTo(8, 0);
    expect(dik(40)).toBeCloseTo(7.6, 0);
    expect(dik(60)).toBeLessThan(3.5);
    // En de verhouding die met een machtstaper onhaalbaar is (plafond 2).
    expect(dik(40) / dik(60)).toBeGreaterThan(2.4);
  });

  it("legt de rugband bínnen de omtrek, aan de kant van de glanslijn (#772)", () => {
    // De platina highlight mag niet buiten de hoorn steken; en hij hoort aan
    // de bolle flank te liggen, dezelfde kant als `highlight`.
    const buiten = grenzen([GOAT_HOORN.omtrek]);
    const { rugDoos } = GOAT_HOORN;
    expect(rugDoos.xMin).toBeGreaterThanOrEqual(buiten.xMin);
    expect(rugDoos.xMax).toBeLessThanOrEqual(buiten.xMax);
    expect(rugDoos.yMin).toBeGreaterThanOrEqual(buiten.yMin);
    expect(rugDoos.yMax).toBeLessThanOrEqual(buiten.yMax);
    // Bij de wortel ligt de band links van de centerlijn — net als de
    // glanslijn, en niet aan de holle kant waar de schaduw loopt.
    const rug0 = punten(GOAT_HOORN.rug)[0];
    const glans0 = punten(GOAT_HOORN.highlight)[0];
    const schaduw0 = punten(GOAT_HOORN.schaduw)[0];
    expect(Math.hypot(rug0[0] - glans0[0], rug0[1] - glans0[1])).toBeLessThan(
      Math.hypot(rug0[0] - schaduw0[0], rug0[1] - schaduw0[1]),
    );
  });
});

describe("GOAT-ornament (#710, #772)", () => {
  it("past binnen de ornament-viewBox, met de CSS-doos in dezelfde maten", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const g = grenzen([
      ...alleStrengPaden(GOAT_HOORN),
      ...BAARD_HELFT,
      GOAT_BAARD_SPEER,
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
    // Opgemeten uit de referentie van #772 (schaal 7,33 px per kaart-unit):
    // buitenrand tot u≈−20 en de boogtop tot v≈−25. Ruime marges: dit bewaakt
    // de leesbaarheid van het silhouet, niet de exacte kromming.
    const g = grenzen(alleStrengPaden(GOAT_HOORN));
    expect(g.xMin).toBeLessThan(-18);
    expect(g.xMin).toBeGreaterThan(-26);
    expect(g.yMin).toBeLessThan(-22);
    expect(g.yMin).toBeGreaterThan(-32);
    // De punt krult terug naar binnen en eindigt naast de kaart, niet erboven.
    expect(g.yMax).toBeGreaterThan(20);
    // De wortel zit áchter de kaart (rechts van de linkerrand, onder de
    // bovenrand van de kroon-crest op v≈4,9), anders zweeft de hoorn los.
    const [wortelX, wortelY] = punten(GOAT_HOORN.omtrek)[0];
    expect(wortelX).toBeGreaterThan(15);
    expect(wortelY).toBeGreaterThan(6);
  });

  it("de hoorn heeft een zware basis die pas bij de krul inknijpt (#772)", () => {
    // Kern van de herijking: waar #710 een gelijkmatige taper had, moet de
    // boogtop nu ruim twee keer zo dik zijn als de dalende flank.
    // Bij de boogtop loopt de hoorn horizontaal, dus daar meet je de dikte
    // verticaal; op de dalende flank loopt hij verticaal en meet je hem
    // horizontaal. In beide gevallen alleen dát deel van de omtrek pakken —
    // de wortel loopt door de kaart en zou elke meting verdubbelen.
    const alle = punten(GOAT_HOORN.omtrek);
    const spanY = (u: number) => {
      const p = alle.filter((q) => Math.abs(q[0] - u) < 1.2 && q[1] < 0);
      return Math.max(...p.map((q) => q[1])) - Math.min(...p.map((q) => q[1]));
    };
    const spanX = (v: number) => {
      const p = alle.filter((q) => Math.abs(q[1] - v) < 1.2 && q[0] < 0);
      return Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0]));
    };
    // Boogtop (u≈4): ~19 units dik, ruim een vijfde van de kaartbreedte.
    expect(spanY(4)).toBeGreaterThan(16);
    // Dalende flank (v≈8): nog geen helft daarvan.
    expect(spanX(8)).toBeLessThan(11);
    expect(spanY(4) / spanX(8)).toBeGreaterThan(1.8);
  });

  it("de speerpunt is symmetrisch rond de as en groeit uit de kaartpunt", () => {
    const p = punten(GOAT_BAARD_SPEER);
    const g = grenzen([GOAT_BAARD_SPEER]);
    // Even ver naar links als naar rechts van x=50.
    expect(50 - g.xMin).toBeCloseTo(g.xMax - 50, 1);
    // Begint ín de kaart (v<139) en steekt onder de schildpunt uit.
    expect(g.yMin).toBeLessThan(125);
    expect(g.yMax).toBeGreaterThan(139);
    expect(g.yMax).toBeLessThan(150);
    // Elk punt heeft zijn spiegelbeeld in het pad — `bouwAsVorm` legt de
    // rechterflank aan uit dezelfde knopen, dus dit vangt een handmatige tik.
    for (const [x, y] of p) {
      const spiegel = p.some(
        (q) => Math.abs(q[0] - (100 - x)) < 0.2 && Math.abs(q[1] - y) < 0.2,
      );
      expect(spiegel, `(${x}, ${y}) heeft geen spiegelbeeld`).toBe(true);
    }
  });

  it("het baardfiligraan blijft onder de divisieregel GOAT (#772)", () => {
    // Het vlak heeft `padding: 12% 9% 24%`, dus de laatste tekstregel eindigt
    // op v≈115 (139 − 24). Het ornament ligt sinds #772 vóór de kaart en zou
    // daar dus écht overheen vallen: geen enkel pad mag hoger komen.
    const g = grenzen([...BAARD_HELFT, GOAT_BAARD_SPEER, ...GOAT_BAARD_NERVEN]);
    expect(g.yMin).toBeGreaterThan(115.5);
    // En het blijft compact: hooguit ~21 units naast de as, zoals de
    // referentie (306 px op een kaart van 733 px breed).
    expect(50 - g.xMin).toBeLessThan(22);
    expect(50 - g.xMin).toBeGreaterThan(17);
  });

  it("de onderkrul steekt náást het schild uit, de haarbladen erbinnen", () => {
    // De krul hoort "uit de kaartomlijsting te groeien": op zijn hoogte loopt
    // het schild al naar de punt, dus hij moet er links van uitkomen.
    const krul = grenzen(alleStrengPaden(GOAT_BAARD_KRUL));
    expect(krul.xMin).toBeLessThan(schildLinkerrand(krul.yMax));
    // De haarbladen liggen juist óp het vlak — ze mogen de rand naderen maar
    // er niet overheen hangen, anders zweven ze los naast de kaart.
    // De haarwaaier ligt óp het vlak. Kleinste afstand tot de schildrand, op
    // dezelfde hoogte gemeten: hij mag de omlijsting een paar units overlappen
    // (dat doet hij in de referentie ook) maar er niet los naast hangen, en
    // hij moet er wél tot vlakbij komen — een waaier die in het midden blijft
    // steken doet geen silhouetwerk.
    const speling = Math.min(
      ...GOAT_BAARD_BLADEN.flatMap((d) =>
        punten(d).map(([x, y]) => x - schildLinkerrand(y)),
      ),
    );
    expect(speling).toBeGreaterThan(-3);
    expect(speling).toBeLessThan(4);
  });

  it("het watermerk en het divisie-icoon blijven in hun eigen viewBox", () => {
    const w = grenzen(GOAT_WATERMERK.map((p) => p.d));
    expect(w.xMin).toBeGreaterThanOrEqual(0);
    expect(w.xMax).toBeLessThanOrEqual(100);
    expect(w.yMin).toBeGreaterThanOrEqual(0);
    expect(w.yMax).toBeLessThanOrEqual(100);

    const [, , iw, ih] = GOAT_ICOON_VIEWBOX.split(" ").map(Number);
    const i = grenzen(GOAT_ICOON.map((p) => p.d));
    // Ruimte voor de lijndikte (1,6) laten: een pad exact op de rand wordt
    // half weggeknipt.
    expect(i.xMin).toBeGreaterThan(0.8);
    expect(i.xMax).toBeLessThan(iw - 0.8);
    expect(i.yMin).toBeGreaterThan(0.5);
    expect(i.yMax).toBeLessThan(ih - 0.5);
  });

  it("de dictator-ornamenten passen in de viewBox en zijn symmetrisch", () => {
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const alles = [
      DICTATOR_KROON,
      DICTATOR_KROON_BAND,
      DICTATOR_EPAULET,
      ...DICTATOR_EPAULET_FRANJE,
      ...DICTATOR_GEMS,
      DICTATOR_LAUWER_STENGEL.omtrek,
      ...DICTATOR_LAUWER_BLADEN,
      DICTATOR_ZEGEL.ster,
    ];
    const g = grenzen(alles);
    expect(Math.min(g.xMin, 100 - g.xMax)).toBeGreaterThan(vx);
    expect(Math.max(g.xMax, 100 - g.xMin)).toBeLessThan(vx + vw);
    expect(g.yMin).toBeGreaterThan(vy);
    expect(g.yMax).toBeLessThan(vy + vh);
    // Kroon en zegelster staan op de as en moeten dus zélf symmetrisch zijn
    // (ze worden niet gespiegeld gerenderd).
    for (const pad of [DICTATOR_KROON, DICTATOR_KROON_BAND, DICTATOR_ZEGEL.ster]) {
      const p = punten(pad);
      for (const [x, y] of p) {
        const spiegel = p.some(
          (q) => Math.abs(q[0] - (100 - x)) < 0.25 && Math.abs(q[1] - y) < 0.25,
        );
        expect(spiegel, `${pad.slice(0, 24)}…: (${x}, ${y}) mist spiegelbeeld`).toBe(
          true,
        );
      }
    }
  });

  it("de kroon steekt bóven de kaart uit en de lauwerkrans erbuiten", () => {
    // De kroon moet echt boven de bovenrand komen en de lauwerkrans over de
    // zijrand heen — anders slokt de kaart ze op, want beide liggen onder het
    // schild. De kroon meten we tegen v=0, de krans tegen de échte schildrand:
    // onder de taille buigt die naar binnen, dus daar is "buiten de kaart"
    // iets anders dan u<0.
    const kroon = grenzen([DICTATOR_KROON, DICTATOR_KROON_BAND]);
    expect(kroon.yMin).toBeLessThan(-20);

    const bladen = DICTATOR_LAUWER_BLADEN.flatMap((d) => punten(d));
    const buiten = bladen.filter(([x, y]) => x < schildLinkerrand(y));
    // Een handvol punten volstaat: het gaat erom dát de krans over de rand
    // valt, niet hoeveel blad er precies buiten hangt.
    expect(buiten.length).toBeGreaterThan(8);
    // En het lakzegel zit in de punt, onder de naamplaat.
    expect(DICTATOR_ZEGEL.midden[1]).toBeGreaterThan(115);
  });

});
