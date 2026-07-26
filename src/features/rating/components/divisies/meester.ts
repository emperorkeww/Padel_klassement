// Divisiekaart "Forever second" (meester) — 1300–1399 — amethist emaille, koel platina en zilver.
//
// De hoogste divisie ónder GOAT, en dat is precies de spanning die dit register
// moet dragen: ceremonieel genoeg om als toptier te lezen, maar met geen enkel
// gouden of nummer-één-signaal. Vandaar de materiaalkeuze uit de referentie
// (#710): amethist emaille voor het vlak, koel platina voor de rand en zilver
// voor élk ornament. Waar El Padelissimo antiekgoud gebruikt en de GOAT rosé,
// blijft deze kaart bewust kleurloos metaal — het verschil tussen eerste en
// tweede zit hier in de tint, niet in de hoeveelheid ornament.
//
// De symboliek zegt hetzelfde: een `II`-crest i.p.v. een kroon, hálve
// lauwertakken die elkaar niet sluiten (een gesloten krans is een
// overwinningskrans), een tweedemedaille in de punt en een finalebracket als
// watermerk waarvan élke lijn bij de laatste wedstrijd uitkomt — de kaart wijst
// naar de finale, niet naar de titel.
//
// Alle geometrie is opgemeten uit de referentie in issue #710 en omgerekend naar
// kaart-units (100 × 139): dat beeld is 918 × 1214 px met de kaart op
// x 45…877 / y 28…1150, dus u = (x − 45)/8,32 en v = (y − 16,6)/8,15. De
// referentie is smaller dan onze schildclip, dus alleen de verhoudingen zijn
// overgenomen — geen enkel getal 1-op-1.

import { bouwStreng, type OrnamentPad } from "../futKaartOrnamenten";
import type { DivisieDeel, DivisieKaart } from "./divisieKaart";

/* ------------------------------ materialen ------------------------------ */

/** Contour van al het zilverwerk: een koele, donkere violetgrijs. Bewust geen
 *  zwart — zwart maakt van geslepen platina een sticker. */
const ZILVER_CONTOUR = "#4a4462";
/** Gravure-lijn ín het zilver (facetten, cannelures, kransring). */
const ZILVER_GRAVURE = "rgba(74, 68, 98, 0.62)";
/** Glans op het zilver: de opstaande kant van een facet. */
const ZILVER_GLANS = "rgba(253, 252, 255, 0.8)";
/** Contour van de amethisten linten. */
const LINT_CONTOUR = "#3a2160";

/* ------------------------------- lauwertak ------------------------------- */
//
// De tak hugt de onderste zijrand: op v≈94 loopt de schildrand tot u≈4,3, dus
// een stengel op u≈4 laat de buitenste blaadjes er nét overheen steken — zoals
// de referentie. De wortel ligt achter de medaille (die wordt ná de tak
// getekend), zodat de tak eruit lijkt te groeien; alle punten blijven links van
// u=48, dus de gespiegelde rechtertak houdt er per constructie een gat van ruim
// 4 units mee: de "twee halve takken die elkaar net niet raken".

type Punt = readonly [number, number];
type Segment = readonly [Punt, Punt, Punt];

const TAK_START: Punt = [45.5, 128.5];
const TAK_SEGMENTEN: readonly Segment[] = [
  [
    [41, 127],
    [35, 124.5],
    [30, 121],
  ],
  [
    [25, 118],
    [19, 114.5],
    [14, 110],
  ],
  [
    [10, 106],
    [6, 100],
    [4, 94],
  ],
  [
    [2.6, 88],
    [1.2, 82],
    [1.2, 77],
  ],
];

export const MEESTER_TAK = bouwStreng({
  start: TAK_START,
  segmenten: TAK_SEGMENTEN,
  dikte: 1.5,
  taper: 2.2,
  punt: 0.3,
  stappen: 60,
});

const rond = (n: number) => Math.round(n * 100) / 100;

/** Punt op de takcenterlijn bij parameter t (0 = wortel bij de medaille,
 *  1 = de tip bovenaan). Dezelfde segmentketting als `bouwStreng` leest, zodat
 *  de blaadjes hieronder gegarandeerd óp de tak zitten i.p.v. ernaast — met de
 *  hand geplaatste blaadjes lopen bij elke koerswijziging van de tak los. */
function opTak(t: number): Punt {
  const g = Math.min(Math.max(t, 0), 1) * TAK_SEGMENTEN.length;
  const idx = Math.min(Math.floor(g), TAK_SEGMENTEN.length - 1);
  const lokaal = g - idx;
  const [c1, c2, p3] = TAK_SEGMENTEN[idx];
  const p0 = idx === 0 ? TAK_START : TAK_SEGMENTEN[idx - 1][2];
  const u = 1 - lokaal;
  const a = u * u * u;
  const b = 3 * u * u * lokaal;
  const c = 3 * u * lokaal * lokaal;
  const d = lokaal * lokaal * lokaal;
  return [
    a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0],
    a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1],
  ];
}

/** Richting van de tak bij t, in graden (0 = naar rechts). */
function takHoek(t: number): number {
  const a = opTak(t - 0.012);
  const b = opTak(t + 0.012);
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
}

/** Eén lauwerblad: spitse ovaal met twee bogen, geplaatst op (u, v) en gedraaid
 *  over `hoek` graden. */
function blad(u: number, v: number, hoek: number, lengte: number): string {
  const r = (hoek * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const breed = lengte * 0.33;
  const P = (langs: number, dwars: number) =>
    `${rond(u + langs * cos - dwars * sin)} ${rond(v + langs * sin + dwars * cos)}`;
  return `M ${P(0, 0)} C ${P(lengte * 0.3, breed)} ${P(
    lengte * 0.72,
    breed * 0.8,
  )} ${P(lengte, 0)} C ${P(lengte * 0.72, -breed * 0.8)} ${P(
    lengte * 0.3,
    -breed,
  )} ${P(0, 0)} Z`;
}

/** De blaadjes van één tak, in twee rijen. `fan` is de hoek t.o.v. de
 *  takrichting: de buitenrij (+) klapt naar de schildrand toe en steekt daar
 *  overheen, de binnenrij (−) legt zich korter over het vlak — samen leest dat
 *  als een krans i.p.v. een rij blaadjes langs een lijn. */
function bladenRij(
  ts: readonly number[],
  fan: number,
  lengte: (t: number) => number,
): readonly string[] {
  return ts.map((t) => {
    const [u, v] = opTak(t);
    return blad(u, v, takHoek(t) + fan, lengte(t));
  });
}

export const MEESTER_BLADEN_BUITEN = bladenRij(
  [0.04, 0.16, 0.28, 0.4, 0.52, 0.64, 0.76, 0.87, 0.96],
  46,
  (t) => 8.6 - t * 1.4,
);
export const MEESTER_BLADEN_BINNEN = bladenRij(
  [0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.82, 0.92],
  -42,
  (t) => 6.2 - t * 1.2,
);

/* --------------------------------- crest --------------------------------- */
//
// Gefacetteerd `II`-schildje in de bovenste inkeping. De schildclip van deze
// divisiegroep (`fut-schild-punt`) duikt in het midden naar v≈8, dus de crest
// heeft daar ruimte voor een echte plaquette: hij komt met zijn top 2,4 units
// bóven de kaart uit en eindigt op v=16,4 — nog boven de eerste inkt (het
// eloblok begint op v≈15,6 met zijn cap-hoogte pas rond v≈19,6).

const CREST_OMTREK =
  "M 50 -2.4 L 39.4 0.6 L 39.4 9.8 C 39.4 11.1, 40.2 12.2, 41.5 13.1 " +
  "L 50 16.4 L 58.5 13.1 C 59.8 12.2, 60.6 11.1, 60.6 9.8 L 60.6 0.6 Z";
const CREST_PANEEL =
  "M 50 0.2 L 41.5 2.6 L 41.5 9.5 C 41.5 10.4, 42.1 11.2, 43.1 11.8 " +
  "L 50 14.5 L 56.9 11.8 C 57.9 11.2, 58.5 10.4, 58.5 9.5 L 58.5 2.6 Z";
/** De twee geschreven `II`-staven met serifs. Vast: dit is het divisieteken,
 *  níet het subniveau — dat blijft de dynamische `tier.subLabel` in het vlak. */
const CREST_II =
  "M 45.3 4 L 49.1 4 L 49.1 5 L 48.05 5 L 48.05 9.6 L 49.1 9.6 L 49.1 10.6 " +
  "L 45.3 10.6 L 45.3 9.6 L 46.35 9.6 L 46.35 5 L 45.3 5 Z " +
  "M 50.9 4 L 54.7 4 L 54.7 5 L 53.65 5 L 53.65 9.6 L 54.7 9.6 L 54.7 10.6 " +
  "L 50.9 10.6 L 50.9 9.6 L 51.95 9.6 L 51.95 5 L 50.9 5 Z";
/** Facetnaden tussen rand en paneel: zes korte lijnen op de hoekpunten. Zonder
 *  deze naden leest de plaquette als een platte sticker i.p.v. geslepen. */
const CREST_FACETTEN =
  "M 39.4 0.6 L 41.5 2.6 M 60.6 0.6 L 58.5 2.6 M 50 -2.4 L 50 0.2 " +
  "M 41.5 13.1 L 43.1 11.8 M 58.5 13.1 L 56.9 11.8 M 50 16.4 L 50 14.5";

/* ------------------------------- zijranden ------------------------------- */
//
// Dubbele kolommen: twee slanke, gecannelleerde schachten met één kapiteel en
// één basis, precies op de rand (u −0,8…8,0 — het kapiteel steekt net over de
// kaartrand, zoals de referentie). De schacht loopt van het kapiteel op v≈21
// tot de basis op v≈80, waar de lauwertak hem overneemt.

const ZUIL_KAPITEEL =
  // Fronton, abacus en halsring — de klassieke opbouw, in drie subpaden.
  "M 3.6 21.2 L 7.9 25.6 L 7.9 26.4 L -0.7 26.4 L -0.7 25.6 Z " +
  "M -0.8 26.8 L 8 26.8 L 8 29 L -0.8 29 Z " +
  "M 0.3 29.4 L 6.9 29.4 L 6.9 31 L 0.3 31 Z";
const ZUIL_SCHACHTEN =
  "M 0.6 31.4 L 3.2 31.4 L 3.3 77.4 L 0.5 77.4 Z " +
  "M 4.1 31.4 L 6.7 31.4 L 6.8 77.4 L 4 77.4 Z";
const ZUIL_CANNELURES =
  "M 1.35 32.8 L 1.4 76 M 2.45 32.8 L 2.5 76 " +
  "M 4.85 32.8 L 4.9 76 M 5.95 32.8 L 6 76";
const ZUIL_BASIS =
  "M -0.8 77.6 L 8 77.6 L 8 79.8 L -0.8 79.8 Z " +
  "M 0.3 80.1 L 6.9 80.1 L 6.9 81.8 L 0.3 81.8 Z";

/** Gepaarde lijnen langs de bovenrand: twee haarlijnen parallel aan de
 *  schuine bovenkant (helling 0,103 — exact die van de schildclip), de ene op
 *  de rand, de andere net op het vlak. */
const PAAR_BOVEN = "M 7.6 4.4 L 39.2 7.65 M 7.6 6.6 L 39.2 9.85";
/** En langs de onderste zijrand, waar de kaart naar de punt loopt. Ze stoppen
 *  vóór de medaille: daar neemt het medaillon de rand over. */
const PAAR_ONDER =
  "M 2.6 84 C 2.6 101.6, 6.6 108.6, 15 114.2 L 33 125.4 " +
  "M 4.4 84 C 4.4 100.6, 8 107.2, 16.4 112.4 L 34.6 123.7";

/* ------------------------------- medaillon ------------------------------- */
//
// Tweedemedaille in de kaartpunt: schijf op (50 · 123,5) met r=8,6. Bewust
// lager dan in de referentie — het vlak van deze kaart eindigt op v≈112,5, dus
// een medaille op referentiehoogte (v≈110) zou de divisieregel afdekken. Hier
// blijft er 2,4 units lucht tussen tekst en zilver.

const MEDAILLE_MIDDEN = [50, 123.5] as const;
const MEDAILLE_RING = 8.6;
const MEDAILLE_VLAK = 7;

/** Cirkel als pad; `A`-bogen omdat `DivisieDeel` alleen paden kent (en Path2D
 *  op canvas ze net zo leest). */
function cirkel(cx: number, cy: number, r: number): string {
  return `M ${rond(cx - r)} ${cy} A ${r} ${r} 0 1 1 ${rond(
    cx + r,
  )} ${cy} A ${r} ${r} 0 1 1 ${rond(cx - r)} ${cy}`;
}

/** Gegraveerde kransboogjes in de medaille — twee spiegelbogen i.p.v. een
 *  volle krans: op de veldmaat (schijf ≈ 10 px) zou een echte lauwerkrans in
 *  modder veranderen. */
const MEDAILLE_KRANS =
  "M 45.6 129.4 C 42 127.4, 41.2 121, 44 116.8 " +
  "M 54.4 129.4 C 58 127.4, 58.8 121, 56 116.8";
/** De `2` op de medaille, als lijn geschreven. */
const MEDAILLE_TWEE =
  "M 46.6 120.8 C 46.7 117.2, 53.4 117, 53.4 120.7 " +
  "C 53.4 123.2, 48.4 124.6, 46.5 127.6 L 54 127.6";

/** Kort amethisten lint onder de medaille, met zwaluwstaart. Blijft links van
 *  u=50, dus de gespiegelde rechterhelft raakt hem net niet — en de staart
 *  steekt onder de schildpunt uit, waar de kaart al smaller is dan het lint. */
const LINT = "M 46 128.4 L 49.8 130.2 L 43.4 142.4 L 41.4 139.2 L 38.6 140.6 Z";
/** Zilveren bies over het lint, zoals de referentie. */
const LINT_BIES = "M 44.6 130.6 L 40 139.4";

/* ------------------------- áchter de kaart (#710) ------------------------- */

/** Platina vleugel achter de crest-schouder: komt van achter de bovenrand
 *  vandaan en geeft de plaquette diepte. Zonder deze vleugel lijkt de crest op
 *  de rand geplakt. */
const VLEUGEL = "M 43 -1.6 L 31 0.8 C 28.8 1.3, 28.4 3.2, 30.4 4.2 L 43 7.6 Z";
/** Tweede rand achter de bovenkant: een platina bies die 1,8 units boven het
 *  frame uitkomt (dezelfde helling 0,103), zodat de rand als gelaagd metaal
 *  leest i.p.v. als één band. */
const RAND_BIES = "M 4.6 -0.3 L 43.8 3.75 L 43.8 6.35 L 4.6 2.3 Z";

/* --------------------------------- motief --------------------------------- */
//
// Watermerk: een finalebracket die vanaf beide zijden naar het midden loopt en
// daar op de tweedemedaille uitkomt. Vier deelnemers per helft → halve finale →
// finale: het hele beeld wijst naar de laatste wedstrijd, en de medaille die
// erop volgt is zilver. Eigen viewBox 0 0 100 100, dus deze coördinaten staan
// los van de kaart-units hierboven.

/** Spiegelt een bracket-lijn om x=50, zodat beide helften per constructie
 *  gelijk zijn. */
const spiegelLijn = (d: string) =>
  d.replace(/([ML]) (-?[\d.]+) (-?[\d.]+)/g, (_, cmd, x, y) =>
    `${cmd} ${rond(100 - Number(x))} ${y}`,
  );

/** Eén bracket-helft: vier plaatsen, twee halve finales, één finalelijn. */
const BRACKET_HELFT = [
  "M 3 22 L 17 22",
  "M 3 34 L 17 34",
  "M 3 62 L 17 62",
  "M 3 74 L 17 74",
  "M 17 22 L 17 34",
  "M 17 62 L 17 74",
  "M 17 28 L 29 28",
  "M 17 68 L 29 68",
  "M 29 28 L 29 68",
  "M 29 48 L 32 48",
];

const MOTIEF_BRACKET: readonly OrnamentPad[] = [
  ...BRACKET_HELFT,
  ...BRACKET_HELFT.map(spiegelLijn),
].map((d) => ({ d, soort: "lijn" as const, breedte: 0.9, alpha: 0.75 }));

const MOTIEF_MEDAILLE: readonly OrnamentPad[] = [
  { d: cirkel(50, 48, 17), soort: "lijn", breedte: 1.4 },
  { d: cirkel(50, 48, 13.5), soort: "lijn", breedte: 0.6, alpha: 0.8 },
  {
    d: "M 41.5 58 C 36.5 54, 36.5 42, 41.5 38",
    soort: "lijn",
    breedte: 0.9,
    alpha: 0.8,
  },
  {
    d: "M 58.5 58 C 63.5 54, 63.5 42, 58.5 38",
    soort: "lijn",
    breedte: 0.9,
    alpha: 0.8,
  },
  {
    d: "M 43.5 42.5 C 44 34, 56.5 33.5, 56.5 42 C 56.5 48, 46 52.5, 43 60 L 57.5 60",
    soort: "lijn",
    breedte: 2.2,
  },
];

/** Etskleur: koel wit op lage dekking. Een lichte ets tíllt het emaille onder
 *  de inkt op i.p.v. het te verduisteren, dus het contrast van de tekst gaat er
 *  alleen op vooruit. */
export const MEESTER_MOTIEF_KLEUR = "rgba(255, 252, 255, 0.32)";
export const MEESTER_MOTIEF_BREEDTE = 0.9;
export const MEESTER_MOTIEF_POSITIE = 0.34;

/* --------------------------------- delen --------------------------------- */

const ZILVER = (d: string, gradient: string, extra?: Partial<DivisieDeel>) =>
  ({
    d,
    vulling: `url(#${gradient})`,
    contour: ZILVER_CONTOUR,
    contourBreedte: 0.45,
    ...extra,
  }) satisfies DivisieDeel;

export const DIVISIE_MEESTER: DivisieKaart = {
  key: "meester",
  naam: "Forever second",

  // Kleurregister — spiegel van het `.fut-kaart--meester`-blok in meester.css.
  // Vaste hexen (tokenregime #710): de deel-poster staat op het lichte palet
  // vastgepind, dus alleen vaste waarden houden DOM-kaart en poster in béide
  // thema's gelijk.
  //
  // Contrast van de inkt op het emaille (WCAG 2.1, srgb): #35266a op de
  // donkerste vlak-stop #b9a6d9 geeft 5,82:1 en op de lichtste #ece4f7 10,39:1
  // — ruim boven AA (4,5:1), op het grootste deel van het vlak zelfs AAA. De
  // zachte inkt #453578 (subniveau en divisieregel, onderaan het vlak waar
  // #b9a6d9 domineert) haalt 4,68:1 en blijft dus ook AA.
  register: {
    frame: [
      [0, "#f4f1fa"],
      [0.42, "#8477ad"],
      [0.68, "#e7e2f3"],
      [1, "#3d3260"],
    ],
    liner: "#2b2049",
    keyline: "#ded4ef",
    vlak: ["#ece4f7", "#d2c2e9", "#b9a6d9"],
    glow: "rgba(255, 255, 255, 0.5)",
    // Bredere, koelere glansbaan dan de basis-sheen (CSS 0,3 over 40/50/60;
    // hier de vaste ~0,875-kalibratie die #664 voor canvas vastlegde).
    sheen: "rgba(255, 255, 255, 0.26)",
    sheenSpreiding: 0.1,
    ink: "#35266a",
    inkSoft: "#453578",
    lijn: "#6f5aa8",
    // De stralenkrans blijft: `meester` staat in het premium-::after-blok van
    // FutKaart.css, en zonder deze vlag zou de poster hem juist verliezen.
    stralen: true,
    echo: [[0.012, 0.016, "rgba(214, 205, 236, 0.7)"]],
    binnenlijn: [
      [1, "rgba(250, 247, 255, 0.8)"],
      [2.5, "rgba(61, 50, 96, 0.75)"],
      [4, "rgba(206, 195, 232, 0.55)"],
    ],
  },

  // Gradients in kaart-units (userSpaceOnUse): zo kantelt het licht mee met de
  // spiegeling van een gespiegeld deel, precies zoals de canvas-spiegel met
  // scale(-1, 1) doet.
  gradienten: [
    {
      id: "fut-div-meester-crest",
      as: [39.4, -2.4, 60.6, 16.4],
      stops: [
        [0, "#fdfcff"],
        [0.3, "#dcd8e9"],
        [0.6, "#a9a3bd"],
        [1, "#6e6885"],
      ],
    },
    {
      // Het paneel loopt van donker naar licht: omgekeerd t.o.v. de rand, want
      // een verdiept vlak vangt het licht aan de ándere kant.
      id: "fut-div-meester-crest-paneel",
      as: [41.5, 0.2, 58.5, 14.5],
      stops: [
        [0, "#a29cb8"],
        [0.45, "#c9c4d8"],
        [1, "#8d87a3"],
      ],
    },
    {
      // Twee cilinders in één gradient: de schachten staan op vaste u-banden
      // (0,5…3,3 en 4,1…6,9 van de as −0,8…8,0), dus hun glansstop kan hier
      // gewoon twee keer voorkomen. Dat scheelt een tweede deel.
      id: "fut-div-meester-zuil",
      as: [-0.8, 0, 8, 0],
      stops: [
        [0, "#6f6987"],
        [0.148, "#6f6987"],
        [0.24, "#efedf6"],
        [0.38, "#b3adc6"],
        [0.466, "#6f6987"],
        [0.557, "#6f6987"],
        [0.65, "#efedf6"],
        [0.79, "#b3adc6"],
        [0.875, "#6f6987"],
        [1, "#6f6987"],
      ],
    },
    {
      id: "fut-div-meester-beslag",
      as: [-0.8, 0, 8, 0],
      stops: [
        [0, "#8b85a1"],
        [0.3, "#f6f4fb"],
        [0.62, "#c2bcd4"],
        [1, "#736d8a"],
      ],
    },
    {
      id: "fut-div-meester-lauwer",
      as: [0, 78, 46, 130],
      stops: [
        [0, "#fbfaff"],
        [0.35, "#dcd8ea"],
        [0.7, "#aca6c1"],
        [1, "#7b7592"],
      ],
    },
    {
      id: "fut-div-meester-medaille",
      as: [41.4, 114.9, 58.6, 132.1],
      stops: [
        [0, "#fcfbff"],
        [0.3, "#dedaeb"],
        [0.62, "#aaa4bf"],
        [1, "#6d677f"],
      ],
    },
    {
      id: "fut-div-meester-medaille-vlak",
      as: [43, 116.5, 57, 130.5],
      stops: [
        [0, "#c5c0d5"],
        [0.5, "#a49eb8"],
        [1, "#cec9dc"],
      ],
    },
    {
      id: "fut-div-meester-lint",
      as: [38.6, 128, 49.8, 142.4],
      stops: [
        [0, "#c3a4e8"],
        [0.4, "#8f63c8"],
        [0.75, "#6b3fa6"],
        [1, "#4b2a7c"],
      ],
    },
    {
      id: "fut-div-meester-vleugel",
      as: [28, -2, 44, 8],
      stops: [
        [0, "#b9b2cf"],
        [0.5, "#7d7597"],
        [1, "#4a4364"],
      ],
    },
    {
      id: "fut-div-meester-bies",
      as: [4.6, -0.3, 43.8, 6.35],
      stops: [
        [0, "#efecf7"],
        [0.5, "#b4aecb"],
        [1, "#847e9c"],
      ],
    },
  ],

  achter: [
    { ...ZILVER(RAND_BIES, "fut-div-meester-bies"), spiegel: true },
    { ...ZILVER(VLEUGEL, "fut-div-meester-vleugel"), spiegel: true },
  ],

  // Volgorde = laagvolgorde: rand en kolommen liggen ónder de lauwertak, de
  // tak onder de medaille, en de crest bovenaan. Zo verdwijnen de takwortels
  // netjes achter de medaille — precies de opbouw van de referentie.
  voor: [
    { d: PAAR_BOVEN, contour: ZILVER_GLANS, contourBreedte: 0.4, alpha: 0.7, spiegel: true },
    { d: PAAR_ONDER, contour: ZILVER_GLANS, contourBreedte: 0.4, alpha: 0.55, spiegel: true },
    { ...ZILVER(ZUIL_SCHACHTEN, "fut-div-meester-zuil"), spiegel: true },
    {
      d: ZUIL_CANNELURES,
      contour: ZILVER_GRAVURE,
      contourBreedte: 0.3,
      spiegel: true,
    },
    { ...ZILVER(ZUIL_KAPITEEL, "fut-div-meester-beslag"), spiegel: true },
    { ...ZILVER(ZUIL_BASIS, "fut-div-meester-beslag"), spiegel: true },
    { ...ZILVER(LINT, "fut-div-meester-lint", { contour: LINT_CONTOUR }), spiegel: true },
    { d: LINT_BIES, contour: ZILVER_GLANS, contourBreedte: 0.7, alpha: 0.85, spiegel: true },
    {
      d: MEESTER_TAK.omtrek,
      vulling: "url(#fut-div-meester-lauwer)",
      contour: ZILVER_CONTOUR,
      contourBreedte: 0.4,
      spiegel: true,
    },
    ...MEESTER_BLADEN_BINNEN.map((d) => ({
      ...ZILVER(d, "fut-div-meester-lauwer", { contourBreedte: 0.35 }),
      spiegel: true,
    })),
    ...MEESTER_BLADEN_BUITEN.map((d) => ({
      ...ZILVER(d, "fut-div-meester-lauwer", { contourBreedte: 0.35 }),
      spiegel: true,
    })),
    ZILVER(cirkel(...MEDAILLE_MIDDEN, MEDAILLE_RING), "fut-div-meester-medaille", {
      contourBreedte: 0.55,
    }),
    ZILVER(
      cirkel(...MEDAILLE_MIDDEN, MEDAILLE_VLAK),
      "fut-div-meester-medaille-vlak",
      { contourBreedte: 0.4 },
    ),
    { d: MEDAILLE_KRANS, contour: ZILVER_GRAVURE, contourBreedte: 0.4 },
    { d: MEDAILLE_TWEE, contour: "#5c5674", contourBreedte: 1.3 },
    ZILVER(CREST_OMTREK, "fut-div-meester-crest", { contourBreedte: 0.5 }),
    ZILVER(CREST_PANEEL, "fut-div-meester-crest-paneel", { contourBreedte: 0.4 }),
    { d: CREST_II, vulling: "#f2f0f8", contour: ZILVER_CONTOUR, contourBreedte: 0.3 },
    { d: CREST_FACETTEN, contour: ZILVER_GLANS, contourBreedte: 0.4 },
  ],

  motief: {
    paden: [...MOTIEF_BRACKET, ...MOTIEF_MEDAILLE],
    kleur: MEESTER_MOTIEF_KLEUR,
    breedte: MEESTER_MOTIEF_BREEDTE,
    positie: MEESTER_MOTIEF_POSITIE,
  },
};
