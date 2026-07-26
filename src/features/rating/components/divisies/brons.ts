// Divisiekaart "Bankvuller" (brons) — 800–899 — koper, gelakt hout en zadelbruin leer.
//
// De kaart is een stuk sportmeubilair: een zadelbruin leren zitting in een
// koperen rand, met walnoten latten langs de zijkanten, een stoelcrest in de
// bovenste inkeping en een "gereserveerde zitplaats"-medaillon in de punt. Het
// blijft bewust een reservebank en geen troon: matte materialen, geen
// stralenkrans, geen glimmerbeweging — het duurste aan deze kaart is het koper.
//
// Twee keuzes die de rest van het bestand verklaren:
//
// 1. Vaste hexen i.p.v. var(--bronze). De bronstoken wisselt per thema
//    (#b45f1d licht, #cc8447 donker), terwijl de deel-poster één vastgepinde
//    uitvoer moet geven — hetzelfde tokenregime als de toptiers in #710.
// 2. Leer en stiksels zitten in de deellagen en het motief, niet in een
//    CSS-only ::after. De canvas-tekenaar kent alleen de vier VlakTextuur-
//    weefsels, dus een eigen leerkorrel in de CSS zou de poster laten afwijken
//    van de DOM. Het stiksel is daarom een ornamentdeel (beide tekenaars lezen
//    letterlijk dezelfde streepjes) en de drukplooien zitten in het motief.
//
// Coördinaten: kaart-units (100 × 139), oorsprong linksboven op de kaart; zie
// divisieKaart.ts. De linkerhelften dragen `spiegel: true`, zodat links en
// rechts per constructie niet uit elkaar kunnen lopen.

import type { DivisieKaart } from "./divisieKaart";
import type { OrnamentPad } from "../futKaartOrnamenten";

const rond = (n: number) => Math.round(n * 100) / 100;

/** Cirkel als vier cubics i.p.v. één `A`-boog: de geometrietests (en
 *  `padDoos` voor de canvas-gradients) lezen pad-data als coördinatenparen, en
 *  de zeven getallen van een boogcommando lopen daar niet in mee. */
function cirkel(cx: number, cy: number, r: number): string {
  const k = rond(r * 0.5523);
  const [x0, x1, y0, y1] = [rond(cx - r), rond(cx + r), rond(cy - r), rond(cy + r)];
  return (
    `M ${x0} ${cy} C ${x0} ${rond(cy - k)} ${rond(cx - k)} ${y0} ${cx} ${y0}` +
    ` C ${rond(cx + k)} ${y0} ${x1} ${rond(cy - k)} ${x1} ${cy}` +
    ` C ${x1} ${rond(cy + k)} ${rond(cx + k)} ${y1} ${cx} ${y1}` +
    ` C ${rond(cx - k)} ${y1} ${x0} ${rond(cy + k)} ${x0} ${cy} Z`
  );
}

/** Rechthoekig plankje; de bank en de latten bestaan uit niets anders. */
function blok(x: number, y: number, b: number, h: number): string {
  return `M ${x} ${y} L ${rond(x + b)} ${y} L ${rond(x + b)} ${rond(y + h)} L ${x} ${rond(
    y + h,
  )} Z`;
}

type Punt = readonly [number, number];

/** Stiksel: streepjes langs een polylijn. Met de hand uitgeschreven steken
 *  lopen na elke maatwijziging uit de bocht; zo blijft de steek overal even
 *  lang en volgt hij de schildrand op vaste afstand. Eén pad met losse
 *  M/L-subpaden, dus zowel de SVG- als de canvas-tekenaar zet het in één
 *  stroke neer. */
function stiksel(lijn: readonly Punt[], streep = 2.1, gat = 1.7): string {
  const lengtes = lijn
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - lijn[i][0], p[1] - lijn[i][1]));
  const totaal = lengtes.reduce((a, b) => a + b, 0);
  const op = (s: number): Punt => {
    let rest = Math.min(Math.max(s, 0), totaal);
    for (let i = 0; i < lengtes.length; i++) {
      if (rest > lengtes[i] && i < lengtes.length - 1) {
        rest -= lengtes[i];
        continue;
      }
      const t = lengtes[i] === 0 ? 0 : Math.min(rest / lengtes[i], 1);
      return [
        rond(lijn[i][0] + (lijn[i + 1][0] - lijn[i][0]) * t),
        rond(lijn[i][1] + (lijn[i + 1][1] - lijn[i][1]) * t),
      ];
    }
    return lijn[lijn.length - 1];
  };
  const delen: string[] = [];
  for (let s = 0; s + streep <= totaal; s += streep + gat) {
    const [ax, ay] = op(s);
    const [bx, by] = op(s + streep);
    delen.push(`M ${ax} ${ay} L ${bx} ${by}`);
  }
  return delen.join(" ");
}

/* --------------------------- materialen (#710) --------------------------- */

const KOPER_CONTOUR = "#4d2a11";
const LEER_CONTOUR = "#23120 7".replace(" ", ""); // #231207
const DRAAD = "#e3c08a";

/* ------------------------- zijkant: houten latten ------------------------- */

// De latten liggen in de referentie ín de koperen rand, en die rand is bij ons
// maar ~4,7 units breed (3 + 1,5 + 1 px op de veldmaat). Ze schuiven daarom
// naar de ornamentlaag áchter het schild: wat rechts van u=0 valt zit achter de
// kaart en houdt de lat vast, de ~6 units links ervan zijn het zichtbare hout.
const LAT = `M 6 22 L -3 22 C -5.2 22 -6.4 23.4 -6.4 25.6 L -6.4 74.4 C -6.4 76.6 -5.2 78 -3 78 L 6 78 Z`;
const LAT_GROEVEN = [33.2, 44.4, 55.6, 66.8]
  .map((v) => `M -6.4 ${v} L 6 ${v}`)
  .join(" ");
// Koperen klem over het bovenste latteneind: zonder die afsluiting eindigt het
// hout in het niets (het onderste eind verdwijnt onder de leren tab).
const LAT_KLEM = `M 6 18.4 L -3.2 18.4 C -5.4 18.4 -6.6 19.8 -6.6 22 L -6.6 24.2 L 6 24.2 Z`;

/* ------------------------ stiksel langs de schildrand ------------------------ */

// Op ~6 units binnen de schildrand: langs de bovenrand, de rechte flank, de
// taille en de schuine onderkant naar de punt. Stopt op u=44, zodat de
// gespiegelde helft de as niet kruist en er in de punt een V-opening blijft.
const NAAD: readonly Punt[] = [
  [40.5, 6],
  [16, 6],
  [11.6, 6.8],
  [8, 9.4],
  [6.6, 14],
  [6.6, 78],
  [6.8, 96],
  [8.9, 102.6],
  [12, 107.5],
  [16.7, 111.4],
  [44, 128.3],
];

/* --------------------------- leren tab op de taille --------------------------- */

// Gestikte tab over de onderste zijkant: hij begint op de rechte flank en hangt
// door de taille heen naar buiten, dus onderaan komt hij écht naast het schild
// uit — dat is precies de "uitstekende tab" uit de acceptatie.
const TAB = `M 8.6 68 L 0.4 68 C -3.1 68 -4.6 70 -4.6 73.2 L -4.6 84.8 C -4.6 88 -3.1 90 0.4 90 L 8.6 90 Z`;
const TAB_NAAD: readonly Punt[] = [
  [7.2, 70.4],
  [0.6, 70.4],
  [-1.8, 71.2],
  [-2.8, 73.6],
  [-2.8, 84.4],
  [-1.8, 86.8],
  [0.6, 87.6],
  [7.2, 87.6],
];

/* ------------------------- crest in de bovenrand ------------------------- */

// Klein schild in de inkeping, met de punt naar beneden. Staat op de as en
// wordt dus niet gespiegeld: het schild is zelf symmetrisch (de test bewaakt
// dat), maar de stoel erin is een zijaanzicht en mág asymmetrisch zijn.
const CREST = `M 38 -1 C 38 -6.6 40.2 -6.6 44 -6.6 L 56 -6.6 C 59.8 -6.6 62 -6.6 62 -1 L 62 3.2 C 62 7.6 57.6 9.6 50 11.6 C 42.4 9.6 38 7.6 38 3.2 Z`;
const CREST_VELD = `M 40.2 -0.9 C 40.2 -4.6 41.6 -4.6 44.6 -4.6 L 55.4 -4.6 C 58.4 -4.6 59.8 -4.6 59.8 -0.9 L 59.8 2.9 C 59.8 6.3 56 8 50 9.6 C 44 8 40.2 6.3 40.2 2.9 Z`;
// Stoel van opzij: rugleuning met twee stijlen, zitting, voor- en achterpoot.
const CREST_STOEL =
  "M 46.6 -2.2 L 50.6 -2.2 M 47.4 -2.2 L 47.4 7.8 M 49.8 -2.2 L 49.8 3.4 " +
  "M 46.2 3.6 L 54 3.6 M 53 3.6 L 53 7.8";

/* ---------------------- medaillon in de kaartpunt ---------------------- */

const MED_M: Punt = [50, 118.5];
const MED_R = 10.4;
const MEDAILLON = cirkel(MED_M[0], MED_M[1], MED_R);
const MEDAILLON_RING = cirkel(MED_M[0], MED_M[1], 9.3);
const MEDAILLON_VELD = cirkel(MED_M[0], MED_M[1], 8.3);
// Boutje op 9 uur; de spiegeling levert die op 3 uur, zoals de referentie.
const MEDAILLON_BOUT = cirkel(39.6, MED_M[1], 1.9);
// Bankje: rugpaneel, zitplank, twee poten en een dwarslat. Alles blijft binnen
// r=8,3 van het midden, dus het bankje raakt de ring nergens.
const BANK = [
  blok(44.6, 113, 10.8, 4.2),
  blok(43.6, 117.4, 12.8, 2),
  blok(45.4, 119.4, 1.6, 5),
  blok(53, 119.4, 1.6, 5),
  blok(45.4, 121.8, 9.2, 1),
].join(" ");
const BANK_PLANKEN = [47.3, 50, 52.7]
  .map((u) => `M ${u} 113.4 L ${u} 116.8`)
  .join(" ");

/* ------------------------- motief: het lege zitvlak ------------------------- */

// Geëtste stoel van opzij plus drie drukplooien — "niemand heeft hier gezeten,
// en tóch is het leer ingezakt". Eigen viewBox 0 0 100 100 (zie
// FutKaartMotief), dus deze maten staan los van de kaart-units.
const ZITVLAK: readonly OrnamentPad[] = [
  { d: "M 24 8 L 46 8", soort: "lijn", breedte: 3.2, alpha: 0.55 },
  { d: "M 28 9 L 28 88", soort: "lijn", breedte: 3.2, alpha: 0.55 },
  { d: "M 42 9 L 42 44", soort: "lijn", breedte: 2.6, alpha: 0.45 },
  { d: "M 22 44 L 78 44", soort: "lijn", breedte: 3.6, alpha: 0.6 },
  { d: "M 24 50 L 76 50", soort: "lijn", breedte: 2.2, alpha: 0.4 },
  { d: "M 72 48 L 72 88", soort: "lijn", breedte: 3.2, alpha: 0.55 },
  { d: "M 30 70 L 70 70", soort: "lijn", breedte: 2.2, alpha: 0.4 },
  // Drukplooien: lange, bijna horizontale vouwen over het leer.
  { d: "M 0 2 L 100 5", soort: "lijn", breedte: 1.8, alpha: 0.3 },
  { d: "M 0 61 L 100 58", soort: "lijn", breedte: 1.8, alpha: 0.3 },
  { d: "M 0 96 L 100 93", soort: "lijn", breedte: 1.8, alpha: 0.3 },
];

export const DIVISIE_BRONS: DivisieKaart = {
  key: "brons",
  naam: "Bankvuller",
  // Register — spiegel van het `.fut-kaart--brons`-blok in brons.css.
  // Contrast van de inkt op het vlak (sRGB, WCAG 2.1): #f9ecd2 op de lichtste
  // plek van het leer (--kaart-hi mét topgloed én glansbaan, #7e5836) = 5,4:1;
  // met de satijnlijn erover (0,035 wit) nog 5,0:1. De zachte inkt #f2e3c0
  // haalt daar 5,0:1 respectievelijk 4,6:1 — beide dus boven AA (4,5:1). Op het
  // donkere onderdeel van het vlak loopt dat op tot 14:1.
  register: {
    frame: [
      [0, "#eab884"],
      [0.38, "#a2622f"],
      [0.64, "#f0c391"],
      [1, "#5c3115"],
    ],
    liner: "#2a1608",
    keyline: "#e0a86a",
    vlak: ["#68401f", "#4f2d17", "#301708"],
    // Leer glimt niet: topgloed en glansbaan staan een stuk lager dan de
    // generieke ladder (0,5 respectievelijk 0,32 wit), en het satijnweefsel is
    // gehalveerd. Dat houdt de inkt bovendien ruim boven AA.
    glow: "rgba(255, 226, 178, 0.08)",
    sheen: "rgba(255, 236, 200, 0.07)",
    satijnAlpha: 0.03,
    ink: "#f9ecd2",
    inkSoft: "#f2e3c0",
    lijn: "#c98a4c",
    // Koperen haarlijn met een donkere leerschaduw erachter: de dubbele
    // binnenrand van de referentie, zonder extra laag.
    echo: [[0, 0.012, "rgba(35, 18, 7, 0.85)"]],
    binnenlijn: [
      [1, "rgba(240, 197, 143, 0.5)"],
      [3, "rgba(38, 20, 8, 0.7)"],
    ],
  },
  gradienten: [
    {
      id: "fut-div-brons-koper-crest",
      as: [40, -6.6, 60, 11.6],
      stops: [
        [0, "#f2c592"],
        [0.42, "#bc7c40"],
        [1, "#6b3a17"],
      ],
    },
    {
      id: "fut-div-brons-leer-crest",
      as: [42, -4.6, 58, 9.6],
      stops: [
        [0, "#43240f"],
        [1, "#211006"],
      ],
    },
    {
      // Horizontaal over de lat, met de glans net buiten de kaartrand: zo
      // leest het zichtbare deel als een rond geschuurde walnoten lat.
      id: "fut-div-brons-hout",
      as: [-6.4, 0, 6, 0],
      stops: [
        [0, "#3a2110"],
        [0.28, "#8a5a30"],
        [0.62, "#5b3719"],
        [1, "#2d1a0b"],
      ],
    },
    {
      id: "fut-div-brons-koper-klem",
      as: [-6.6, 18.4, 6, 24.2],
      stops: [
        [0, "#c98b4e"],
        [0.5, "#eab884"],
        [1, "#7d4620"],
      ],
    },
    {
      id: "fut-div-brons-leer-tab",
      as: [-4.6, 68, 8.6, 90],
      stops: [
        [0, "#5e3519"],
        [0.55, "#43240f"],
        [1, "#2a1509"],
      ],
    },
    {
      id: "fut-div-brons-koper-ring",
      as: [40, 108.1, 60, 128.9],
      stops: [
        [0, "#f2c592"],
        [0.45, "#b9793f"],
        [1, "#6a3a17"],
      ],
    },
    {
      id: "fut-div-brons-leer-ring",
      as: [42, 110.5, 58, 126.5],
      stops: [
        [0, "#43240f"],
        [1, "#1e0f05"],
      ],
    },
    {
      id: "fut-div-brons-hout-bank",
      as: [44, 113, 56, 124.4],
      stops: [
        [0, "#a06a3a"],
        [0.5, "#7d4c26"],
        [1, "#4e2c13"],
      ],
    },
  ],
  // Áchter het schild: het houtwerk. De latten horen constructief onder het
  // leer en het koper te liggen, en van achter de kaart vandaan komen ze er als
  // een zijkant van het meubel uit i.p.v. als opgeplakte strip.
  achter: [
    { d: LAT, vulling: "url(#fut-div-brons-hout)", contour: LEER_CONTOUR, contourBreedte: 0.5, spiegel: true },
    { d: LAT_GROEVEN, contour: "rgba(24, 12, 5, 0.85)", contourBreedte: 0.6, spiegel: true },
    { d: LAT_KLEM, vulling: "url(#fut-div-brons-koper-klem)", contour: KOPER_CONTOUR, contourBreedte: 0.45, spiegel: true },
  ],
  // En vóór het schild: alles wat op het leer ligt. Zonder deze laag zouden de
  // crest (die boven de bovenrand uitkomt), de tabs en het medaillon half
  // achter het schild verdwijnen. Volgorde = laagvolgorde: naad, dan tab, dan
  // crest en medaillon eroverheen.
  voor: [
    { d: stiksel(NAAD), contour: DRAAD, contourBreedte: 0.7, alpha: 0.7, spiegel: true },
    { d: TAB, vulling: "url(#fut-div-brons-leer-tab)", contour: LEER_CONTOUR, contourBreedte: 0.55, spiegel: true },
    { d: stiksel(TAB_NAAD, 1.5, 1.3), contour: DRAAD, contourBreedte: 0.65, alpha: 0.8, spiegel: true },
    { d: CREST, vulling: "url(#fut-div-brons-koper-crest)", contour: KOPER_CONTOUR, contourBreedte: 0.55 },
    { d: CREST_VELD, vulling: "url(#fut-div-brons-leer-crest)", contour: KOPER_CONTOUR, contourBreedte: 0.35 },
    { d: CREST_STOEL, contour: "#e0a86a", contourBreedte: 1.15 },
    { d: MEDAILLON, vulling: "url(#fut-div-brons-koper-ring)", contour: KOPER_CONTOUR, contourBreedte: 0.55 },
    { d: MEDAILLON_VELD, vulling: "url(#fut-div-brons-leer-ring)", contour: KOPER_CONTOUR, contourBreedte: 0.4 },
    { d: MEDAILLON_RING, contour: "rgba(242, 197, 146, 0.55)", contourBreedte: 0.4 },
    { d: MEDAILLON_BOUT, vulling: "url(#fut-div-brons-koper-ring)", contour: KOPER_CONTOUR, contourBreedte: 0.4, spiegel: true },
    { d: BANK, vulling: "url(#fut-div-brons-hout-bank)", contour: LEER_CONTOUR, contourBreedte: 0.4 },
    { d: BANK_PLANKEN, contour: "rgba(36, 18, 7, 0.7)", contourBreedte: 0.35 },
  ],
  motief: {
    paden: ZITVLAK,
    kleur: "rgba(255, 226, 178, 0.17)",
    breedte: 0.76,
    positie: 0.28,
  },
};
