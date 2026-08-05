// Divisiekaart "Glazenwasser" (platina) — 1100–1199 — frosted aqua glas en geoxideerd aluminium.
//
// De referentie (#710) is een architecturale glas-en-staalkaart: de glazen
// achterwand van een padelbaan, in paneelklemmen gevat. Dat is hier
// consequent volgehouden in één materiaalidee — élk ornament is óf glas óf de
// klem die glas vasthoudt: een raamcrest in de bovenste inkeping, smalle
// paneelklemmen met een bout in de zijranden, veegbogen langs de onderste
// zijkanten en een facetvormig glasmedaillon in de kaartpunt.
//
// Twee keuzes verdienen uitleg, omdat ze afwijken van wat je in de referentie
// ziet:
//
// 1. Het silhouet. De referentiekaart heeft een bovenrand die in het midden
//    ománhoog boogt; ónze punt-clip (`fut-schild-punt`, vast voor platina/
//    diamant/meester in FutKaart.css) dúikt daar juist omlaag naar v≈8. De
//    crest is daarom niet 1-op-1 overgenomen maar in díe inkeping gezet: hij
//    hangt met zijn punt tot v≈−10 tussen de twee vleugels door en zakt met
//    zijn onderkant achter de bovenrand weg. Vandaar `voor` en niet `achter`.
//
// 2. De veegbogen. In de referentie liggen ze óp het glas, vlak langs de
//    divisieregel. Met onze smallere kaart (veldmaat 116px) schuurt dat tegen
//    de inkt, en de ornamentlaag kent geen clip om ze binnen te houden. Ze
//    liggen hier dus in `achter` en hun centerlijnen lopen nét búiten de
//    schildrand: wat je ziet is de flank van de veeg die van achter de kaart
//    vandaan komt. Zo kan geen enkele boog ooit over tekst vallen.
//
// Kleuren staan twee keer: hier voor de deel-poster en in platina.css voor de
// DOM. platina.test.ts vergelijkt ze regel voor regel.

import type { DivisieKaart, DivisieDeel } from "./divisieKaart";
import { bouwStreng, type Streng } from "../futKaartOrnamenten";
import type { OrnamentPad } from "../futKaartOrnamenten";

const rond = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------ materialen ------------------------------ */

/** Geoxideerd aluminium: de klemmen, de crest-bezel en de medaillonrand. Eén
 *  diagonale as over de hele kaart, dus alle beslagdelen vangen hetzelfde
 *  licht — en omdat de as in kaart-units staat, kantelt hij netjes mee met de
 *  spiegeling van een `spiegel`-deel. */
const ALU = "url(#fut-div-platina-alu)";
/** Zeegroen frosted glas: de vulling van crest-, medaillon- en veegvlakken. */
const GLAS = "url(#fut-div-platina-glas)";

/** Donkere naad van het beslag — de geoxideerde kant van het aluminium. */
const NAAD = "#123840";
/** Lichte hooglicht-lijn op het beslag. */
const GLANS = "rgba(255, 255, 255, 0.72)";
/** Grafietbout in de paneelklem en de medaillonfittingen. */
const BOUT = "#3d4a4e";
/** Fijne raster- en facetlijn in het glas: de inkt van de kaart, ijl. */
const FACET = "rgba(21, 64, 74, 0.42)";

/* ------------------------------- hulpvormen ------------------------------- */

/** Cirkel als pad — canvas en SVG lezen dezelfde string, dus geen <circle>. */
const cirkel = (cx: number, cy: number, r: number) =>
  `M ${rond(cx - r)} ${rond(cy)} A ${r} ${r} 0 1 1 ${rond(cx + r)} ${rond(cy)} ` +
  `A ${r} ${r} 0 1 1 ${rond(cx - r)} ${rond(cy)} Z`;

/** Zeshoek met platte flanken (spitse boven- en onderpunt), gebouwd uit één
 *  halve breedte en vier hoogtes. Links en rechts komen zo uit hetzelfde
 *  getal: de crest staat óp de as en wordt niet gespiegeld gerenderd, dus die
 *  symmetrie moet uit de constructie komen. */
function zeshoek(
  halfBreed: number,
  top: number,
  schouderBoven: number,
  schouderOnder: number,
  onder: number,
): string {
  const l = rond(50 - halfBreed);
  const r = rond(50 + halfBreed);
  return (
    `M 50 ${top} L ${l} ${schouderBoven} L ${l} ${schouderOnder} ` +
    `L 50 ${onder} L ${r} ${schouderOnder} L ${r} ${schouderBoven} Z`
  );
}

/** Spitse ovaal (vesica) rond de as: twee cirkelbogen die in de boven- en
 *  onderpunt samenkomen. `halfBreed` is de uitstulping op halve hoogte. */
function vesica(midden: number, halfHoog: number, halfBreed: number): string {
  const R = rond((halfBreed * halfBreed + halfHoog * halfHoog) / (2 * halfBreed));
  const top = rond(midden - halfHoog);
  const onder = rond(midden + halfHoog);
  return (
    `M 50 ${top} A ${R} ${R} 0 0 1 50 ${onder} ` +
    `A ${R} ${R} 0 0 1 50 ${top} Z`
  );
}

/** Halve breedte van een vesica op hoogte `v` — nodig om de ruitverdeling
 *  ín het medaillon precies tot aan de rand te laten lopen. De ornamentlaag
 *  kent geen clip-path, dus elke rasterlijn moet zijn eigen lengte kennen. */
function vesicaHalfBreed(
  v: number,
  midden: number,
  halfHoog: number,
  halfBreed: number,
): number {
  const R = (halfBreed * halfBreed + halfHoog * halfHoog) / (2 * halfBreed);
  const dv = v - midden;
  const binnen = R * R - dv * dv;
  if (binnen <= 0) return 0;
  return Math.sqrt(binnen) - (R - halfBreed);
}

/** Een `bouwStreng`-resultaat als glasveeg: gevuld blad met een donkere naad
 *  en een glanslijn langs de bolle flank. De ribbels blijven ongebruikt — een
 *  veeg is glad, geen geribbeld metaal. */
function veeg(streng: Streng, alpha: number): DivisieDeel[] {
  return [
    {
      d: streng.omtrek,
      vulling: GLAS,
      contour: GLANS,
      contourBreedte: 0.3,
      spiegel: true,
      alpha,
    },
    {
      d: streng.highlight,
      contour: GLANS,
      contourBreedte: 0.45,
      spiegel: true,
      alpha: alpha * 0.9,
    },
  ];
}

/* ------------------------------ raamcrest ------------------------------ */

// Maten opgemeten uit de referentie (issue #710), omgerekend naar kaart-units:
// de crest is daar ~0,20 kaartbreedte breed en ~1,34× zo hoog als breed. Bij
// onze 100-units-breedte wordt dat halfBreed 8,6 en hoogte ~20,4. Hij staat zó
// dat de onderpunt (v≈10,8) achter de bovenrand van het schild wegzakt — die
// duikt op de as tot v≈8,06 — en de bovenpunt (v≈−9,6) tussen de vleugels
// (v≈1,4) door naar buiten komt.
const CREST_BEZEL = zeshoek(8.6, -9.6, -5.9, 5.6, 10.8);
const CREST_BINNENRAND = zeshoek(7.1, -7.7, -4.7, 4.6, 8.9);
const CREST_GLAS = zeshoek(6.0, -6.4, -3.9, 3.9, 7.6);

// Het raam ín de crest: een staand kozijn met één dwarsroede, iets boven het
// midden — de tweedeling van de referentie. Als contour i.p.v. vulling, want
// een gestreken kozijn ís een lijn; zo houden beide tekenaars dezelfde dikte.
const CREST_KOZIJN = "M 46.8 -3.6 L 53.2 -3.6 L 53.2 4.8 L 46.8 4.8 Z";
const CREST_ROEDE = "M 46.8 0.5 L 53.2 0.5";

/* ---------------------------- paneelklemmen ---------------------------- */

// De klem uit de referentie is een smalle beugel die búiten de kaartrand langs
// loopt en met twee lippen over de rand hapt, plus een bredere plaat met een
// bout op halve hoogte. Verhoudingen uit de referentie: beugel over ~0,21 van
// de kaarthoogte (v≈29–58), plaat op ~0,10 daarvan gecentreerd. Alleen de
// linkerhelft; `spiegel` maakt de rechter.
const KLEM_BEUGEL =
  "M -2.4 28.6 L 4.4 28.6 L 4.4 31.2 L 0.2 31.2 L 0.2 56.2 " +
  "L 4.4 56.2 L 4.4 58.8 L -2.4 58.8 Z";
const KLEM_PLAAT =
  "M 0.4 38.2 L 6.2 40.4 L 7.4 43.4 L 7.4 48.4 L 6.2 51.4 L 0.4 53.6 Z";
const KLEM_BOUT_RING = cirkel(4.4, 45.9, 1.75);
const KLEM_BOUT = cirkel(4.4, 45.9, 1.1);

/* ----------------------------- wisserveeg ----------------------------- */

// Drie veegbogen die van achter de onderste zijkant vandaan komen en naar de
// kaartpunt toe uitlopen, elk een stap verder naar buiten: de fan van de
// referentie. De centerlijnen zijn afgeleid van de échte schildrand — de
// onderste bocht van `fut-schild-punt` loopt van (0 · 83,4) via (13,5 · 116,5)
// naar de punt (50 · 139) — en liggen daar 2 tot 7 units búiten. Wat je ziet
// is dus altijd de buitenflank; het binnenstuk zit achter het glas.
const VEEG_BINNEN = bouwStreng({
  start: [1.4, 77.5],
  segmenten: [
    [
      [-1.8, 84],
      [-3.2, 92.5],
      [-2.2, 100.5],
    ],
    [
      [-0.8, 108.5],
      [4, 115.5],
      [11, 122],
    ],
    [
      [18.5, 128.5],
      [26.5, 134],
      [34.5, 138.5],
    ],
  ],
  dikte: 2.7,
  taper: 2.1,
  punt: 0.2,
  ribbels: 0,
  stappen: 64,
});

const VEEG_MIDDEN = bouwStreng({
  start: [0.2, 78.5],
  segmenten: [
    [
      [-4.2, 85.5],
      [-6.2, 94],
      [-5.4, 102],
    ],
    [
      [-4.2, 110],
      [0.4, 117],
      [7.4, 123.5],
    ],
    [
      [13.5, 128.5],
      [20, 132.5],
      [26.5, 135.5],
    ],
  ],
  dikte: 1.9,
  taper: 2.3,
  punt: 0.15,
  ribbels: 0,
  stappen: 60,
});

const VEEG_BUITEN = bouwStreng({
  start: [-1.4, 80],
  segmenten: [
    [
      [-6.6, 87],
      [-9.2, 95.5],
      [-8.6, 103.5],
    ],
    [
      [-7.6, 111],
      [-3.6, 117.5],
      [2.6, 123],
    ],
    [
      [7, 126.5],
      [11.5, 129],
      [16.5, 131],
    ],
  ],
  dikte: 1.25,
  taper: 2.4,
  punt: 0.12,
  ribbels: 0,
  stappen: 56,
});

// De wisserhouder waar de bogen uit komen: een schuine beugel langs de rand,
// met dezelfde twee lippen als de paneelklem — hetzelfde beslag, één maat
// kleiner. Hij staat in `voor`, want zonder die houder lijken de bogen los te
// zweven en juist het aanknopingspunt valt binnen de kaartrand.
const HOUDER =
  "M -2.6 81.6 L 5.6 79.8 L 6.3 82.5 L 0.6 83.8 L 4.2 96.8 " +
  "L 10.4 95.4 L 11.2 98.1 L 2.4 100.1 Z";

/* --------------------------- glasmedaillon --------------------------- */

// Facetvormig glasmedaillon in de kaartpunt: een spitse ovaal met een
// aluminium bezel, ruitverdeling en puntfittingen — de referentie in
// verhoudingen (breedte ~0,22 kaartbreedte, hoogte ~1,45× de breedte). Het
// midden staat op v=126, dus de onderpunt van de bezel komt tot v≈143,5: ruim
// ónder de schildpunt op v=139, waar hij als los glaspaneel onder de kaart uit
// hangt. Daarom `voor`: in `achter` zou de hele bovenhelft wegvallen.
const MED_MIDDEN = 126;
const MED_HALF_HOOG = 16;
const MED_HALF_BREED = 11;

const MED_BEZEL = vesica(MED_MIDDEN, MED_HALF_HOOG + 1.6, MED_HALF_BREED + 1.4);
const MED_BINNENRAND = vesica(MED_MIDDEN, MED_HALF_HOOG, MED_HALF_BREED);
const MED_GLAS = vesica(MED_MIDDEN, MED_HALF_HOOG - 1.3, MED_HALF_BREED - 1);

/** Ruitverdeling: twee staande roeden en drie liggende, elk precies zo lang
 *  als het glas daar breed is. */
const MED_RASTER: string[] = [
  ...[3.6, -3.6].map((du) => {
    // Hoogte waar het glas nog `|du|` breed is: daar begint en eindigt de roede.
    const R =
      (MED_HALF_BREED * MED_HALF_BREED + MED_HALF_HOOG * MED_HALF_HOOG) /
      (2 * MED_HALF_BREED);
    const x = Math.abs(du) + (R - MED_HALF_BREED);
    const dv = Math.sqrt(Math.max(0, R * R - x * x));
    return `M ${rond(50 + du)} ${rond(MED_MIDDEN - dv)} L ${rond(50 + du)} ${rond(
      MED_MIDDEN + dv,
    )}`;
  }),
  ...[-8, 0, 8].map((dv) => {
    const b =
      vesicaHalfBreed(
        MED_MIDDEN + dv,
        MED_MIDDEN,
        MED_HALF_HOOG,
        MED_HALF_BREED,
      ) - 0.6;
    return `M ${rond(50 - b)} ${rond(MED_MIDDEN + dv)} L ${rond(50 + b)} ${rond(
      MED_MIDDEN + dv,
    )}`;
  }),
];

/** Puntfittingen: kleine vierkantjes op de kruisingen, plus twee grotere
 *  klemblokjes op de flanken — glas hangt aan punten, niet aan een kozijn. */
const MED_FITTINGEN: string[] = [-8, 0, 8].flatMap((dv) =>
  [-3.6, 3.6].map(
    (du) =>
      `M ${rond(50 + du - 0.75)} ${rond(MED_MIDDEN + dv - 0.75)} ` +
      `h 1.5 v 1.5 h -1.5 Z`,
  ),
);
const MED_FLANKKLEM: string[] = [-1, 1].map((zijde) => {
  const u = 50 + zijde * (MED_HALF_BREED - 1.6);
  return (
    `M ${rond(u - 1.7)} ${MED_MIDDEN - 1.7} L ${rond(u + 1.7)} ${MED_MIDDEN - 1.7} ` +
    `L ${rond(u + 1.7)} ${MED_MIDDEN + 1.7} L ${rond(u - 1.7)} ${MED_MIDDEN + 1.7} Z`
  );
});

/* -------------------------- raster-watermerk -------------------------- */

// Het watermerk is de glazen achterwand zelf: een rechthoekig paneelraster in
// licht perspectief (de staande roeden lopen naar het midden toe iets naar
// binnen), met puntfittingen op de kruisingen, twee lange veegbogen erover en
// een handvol druppels. Alles als lijnwerk op lage dekking, want dit ligt
// ónder de inkt en mag die niet beconcurreren. ViewBox 0 0 100 100.
const WAND_ROEDEN: OrnamentPad[] = [12, 34, 56, 78].map((x, i) => {
  // Perspectief: hoe verder naar rechts, hoe sterker de roede naar het
  // vluchtpunt rechtsboven helt — genoeg om diepte te suggereren, te weinig om
  // als scheve lijn op te vallen.
  const helling = 1.6 + i * 1.1;
  return {
    d: `M ${x + helling} 2 L ${x} 98`,
    soort: "lijn",
    breedte: 0.9,
    alpha: 0.85,
  };
});

const WAND_REGELS: OrnamentPad[] = [16, 44, 72].map((y, i) => ({
  // De liggende regels lopen licht op naar rechts — dezelfde vlucht.
  d: `M 2 ${y + 2.4} C 34 ${y + 0.9} 66 ${y - 0.6} 98 ${y - 2.6 - i * 0.6}`,
  soort: "lijn",
  breedte: 0.9,
  alpha: 0.85,
}));

/** Puntfittingen op de rasterkruisingen: kleine vierkantjes, zoals de
 *  spider-fittings van een echte glaswand. */
const WAND_FITTINGEN: OrnamentPad[] = [12, 34, 56, 78].flatMap((x, i) =>
  [16, 44, 72].map((y) => {
    const helling = 1.6 + i * 1.1;
    const px = x + helling * (1 - y / 100);
    return {
      d: `M ${rond(px - 1.1)} ${y - 1.1} h 2.2 v 2.2 h -2.2 Z`,
      soort: "lijn" as const,
      breedte: 0.7,
      alpha: 0.9,
    };
  }),
);

/** Veegbogen en condens: twee lange, flauwe bogen over de wand — het spoor
 *  van de trekker — met een paar druppels op de onderrand van de bovenste. */
const WAND_VEEG: OrnamentPad[] = [
  {
    d: "M 4 30 C 30 12 62 14 96 34",
    soort: "lijn",
    breedte: 1.3,
    alpha: 0.65,
  },
  {
    d: "M 6 44 C 32 27 64 29 94 47",
    soort: "lijn",
    breedte: 0.8,
    alpha: 0.45,
  },
  {
    d: "M 8 82 C 34 66 66 68 92 86",
    soort: "lijn",
    breedte: 1.1,
    alpha: 0.55,
  },
];

const WAND_DRUPPELS: OrnamentPad[] = (
  [
    [22, 38, 1.5],
    [45, 30, 1.1],
    [63, 33, 1.7],
    [80, 44, 1.2],
    [33, 62, 1.3],
    [70, 60, 1],
    [52, 90, 1.4],
  ] as const
).map(([cx, cy, r]) => ({
  d: cirkel(cx, cy, r),
  soort: "vlak" as const,
  alpha: 0.5,
}));

/* ------------------------------- register ------------------------------- */

export const DIVISIE_PLATINA: DivisieKaart = {
  key: "platina",
  naam: "Glazenwasser — frosted aqua glas, zeegroen en geoxideerd aluminium",

  // Spiegel van het `.fut-kaart--platina`-blok in platina.css.
  // Leesbaarheid: de inkt (#15404a) haalt 7,3:1 op de naamplaat-achtergrond en
  // 5,9:1 op de donkerste vlak-stop; de zachte inkt (#2a545e) van sub-niveau
  // en divisieregel haalt 5,0:1 daar waar die regel staat (~76% hoogte). Beide
  // ruim boven de 4,5:1 van AA voor kleine tekst.
  register: {
    // Vier stops met twee glanspunten: geoxideerd aluminium met een frosted
    // hooglicht — hetzelfde ritme als de metaalladder, in zeegroen.
    frame: [
      [0, "#f7fbff"],
      [0.42, "#0c3154"],
      [0.68, "#7fdcf1"],
      [1, "#041b35"],
    ],
    liner: "#082a4b",
    keyline: "#bcefff",
    vlak: ["#d8edf7", "#e8f5fa", "#b5d8e7"],
    glow: "rgba(255, 255, 255, 0.5)",
    // Brede, zachte sheen i.p.v. de smalle metaalstreep: over frosted glas
    // loopt licht uit, het spiegelt niet in één baan.
    sheenSpreiding: 0.12,
    ink: "#0d315b",
    inkSoft: "#137f98",
    lijn: "#65b7d8",
    // Transparantie-illusie (#710): het schildsilhouet nog eens, een fractie
    // verschoven in ijl aqua — de tweede glaslaag achter de eerste.
    echo: [[0.018, 0.022, "rgba(163, 214, 219, 0.6)"]],
    // En dezelfde gelaagdheid langs de binnenrand: witte glasrand, donkere
    // sponning, lichte tweede ruit.
    binnenlijn: [
      [1, "rgba(255, 255, 255, 0.6)"],
      [3, "rgba(30, 74, 84, 0.45)"],
      [4.5, "rgba(206, 235, 238, 0.35)"],
    ],
    // Geen stralenkrans (het gedeelde premium-blok in FutKaart.css zet die wél
    // voor platina; platina.css overschrijft dat). Een zonnestraal hoort bij
    // edelmetaal, niet bij een glaswand — het raster ís hier de textuur.
    stralen: false,
    satijnAlpha: 0.044,
  },

  gradienten: [
    {
      // Aluminium: diagonaal over de kaart, zodat klem, crest en medaillon
      // ieder een ander stuk van dezelfde bevel pakken.
      id: "fut-div-platina-alu",
      as: [26, -12, 74, 146],
      stops: [
        [0, "#f4fcfc"],
        [0.22, "#a9ced3"],
        [0.42, "#f0f9fa"],
        [0.62, "#456f78"],
        [0.82, "#cfe6e9"],
        [1, "#1e4a54"],
      ],
    },
    {
      // Glas: van bijna-wit frost bovenaan naar dieper zeegroen bij de punt,
      // zodat het medaillon voller leest dan de crest.
      id: "fut-div-platina-glas",
      as: [50, -12, 50, 146],
      stops: [
        [0, "#f2fbfb"],
        [0.34, "#cfe6e7"],
        [0.72, "#8fb3b6"],
        [1, "#5d868c"],
      ],
    },
  ],

  achter: [
    ...veeg(VEEG_BUITEN, 0.72),
    ...veeg(VEEG_MIDDEN, 0.82),
    ...veeg(VEEG_BINNEN, 0.92),
  ],

  voor: [
    // Wisserhouder eerst: de veegbogen komen er van achter de kaart uit.
    { d: HOUDER, vulling: ALU, contour: NAAD, contourBreedte: 0.4, spiegel: true },

    // Paneelklem: beugel, plaat, bout.
    {
      d: KLEM_BEUGEL,
      vulling: ALU,
      contour: NAAD,
      contourBreedte: 0.4,
      spiegel: true,
    },
    {
      d: KLEM_PLAAT,
      vulling: ALU,
      contour: NAAD,
      contourBreedte: 0.4,
      spiegel: true,
    },
    { d: KLEM_BOUT_RING, vulling: GLANS, spiegel: true, alpha: 0.8 },
    { d: KLEM_BOUT, vulling: BOUT, contour: NAAD, contourBreedte: 0.25, spiegel: true },

    // Raamcrest in de bovenste inkeping.
    { d: CREST_BEZEL, vulling: ALU, contour: NAAD, contourBreedte: 0.5 },
    { d: CREST_BINNENRAND, vulling: NAAD, alpha: 0.55 },
    { d: CREST_GLAS, vulling: GLAS, contour: GLANS, contourBreedte: 0.3, alpha: 0.92 },
    { d: CREST_KOZIJN, contour: NAAD, contourBreedte: 0.85 },
    { d: CREST_ROEDE, contour: NAAD, contourBreedte: 0.75 },

    // Glasmedaillon in de kaartpunt.
    { d: MED_BEZEL, vulling: ALU, contour: NAAD, contourBreedte: 0.5 },
    { d: MED_BINNENRAND, vulling: NAAD, alpha: 0.5 },
    { d: MED_GLAS, vulling: GLAS, contour: GLANS, contourBreedte: 0.3, alpha: 0.9 },
    ...MED_RASTER.map((d) => ({
      d,
      contour: FACET,
      contourBreedte: 0.4,
    })),
    ...MED_FITTINGEN.map((d) => ({
      d,
      vulling: ALU,
      contour: NAAD,
      contourBreedte: 0.2,
    })),
    ...MED_FLANKKLEM.map((d) => ({
      d,
      vulling: ALU,
      contour: NAAD,
      contourBreedte: 0.35,
    })),
    ...MED_FLANKKLEM.map((_, i) => ({
      d: cirkel(50 + (i === 0 ? -1 : 1) * (MED_HALF_BREED - 1.6), MED_MIDDEN, 0.85),
      vulling: BOUT,
    })),
  ],

  motief: {
    paden: [
      ...WAND_ROEDEN,
      ...WAND_REGELS,
      ...WAND_FITTINGEN,
      ...WAND_VEEG,
      ...WAND_DRUPPELS,
    ],
    kleur: "rgba(21, 64, 74, 0.11)",
    // Bijna de volle vlakbreedte, iets boven het midden: de wand loopt achter
    // eloblok en avatar door en dooft uit vóór de naamplaat.
    breedte: 0.96,
    positie: 0.28,
  },
};
