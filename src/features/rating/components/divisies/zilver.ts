// Divisiekaart "Blaaskaak" (zilver) — 900–999 — geborsteld aluminium en blauwgrijs.
//
// Thema uit de referentie (#710): veel lawaai en tactische uitleg, weinig
// resultaat. Dat zit niet in dúre materialen maar in lichte, hólle: een
// aluminium plaat met twee holle buisprofielen langs de flanken, een wind- en
// spraakcrest in de bovenrand, een dof gedeukt resonatormedaillon in de punt en
// een watermerk van tactische pijlen die rondlopen zonder hun doel te bereiken.
//
// Waarom lichter dan Wannabe (goud, de divisie erboven): dat register mag
// duurder ogen. Daarom staat hier géén stralenkrans, geen ribbelframe en geen
// tweede weefsel — alleen een koel, licht metaalverloop met dunne panellijnen.
// Het duurste dat deze kaart doet is licht vangen.
//
// Contrast (WCAG, tegen de dónkerste vlak-stop #bcc3cc, dus de ongunstigste
// plek op het vlak): inkt #2c3440 → 7,07:1 (AAA), inkt-soft #46505f → 4,59:1
// (AA). De hairlines (#6f7f91 op de middenstop #dfe4ea) halen 3,21:1 en blijven
// daarmee boven de 3:1 voor niet-tekstuele elementen.
//
// Coördinaten: kaart-units, 100 breed × 139 hoog. Bewust géén A-commando's in
// de paden — de geometrietest leest de coördinaten als platte getallenparen en
// zou de rx/ry/flags van een boog als punten lezen; alle rondingen komen dus
// uit cubics.

import { bouwStreng } from "../futKaartOrnamenten";
import type { OrnamentPad } from "../futKaartOrnamenten";
import type {
  DivisieDeel,
  DivisieGradient,
  DivisieKaart,
} from "./divisieKaart";

const rond = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------- materiaal ------------------------------- */

// Geborsteld aluminium: koel, licht en met blauwgrijze schaduwen. Vaste hexen,
// geen var(--silver): de deel-poster staat op het lichte palet vastgepind
// (#125), dus alleen literalen houden DOM-kaart en poster in béide thema's
// gelijk — hetzelfde regime als de toptiers sinds #710.
const ALU_CONTOUR = "#454f5c";
const ALU_GLANS = "rgba(255, 255, 255, 0.72)";
const ALU_SCHADUW = "rgba(69, 79, 92, 0.4)";
/** Etskleur van het watermerk: de inkt op zeer lage dekking, zodat de
 *  tactische pijlen achter de tekst blijven i.p.v. ermee te concurreren. */
const TACTIEK_KLEUR = "rgba(44, 52, 64, 0.085)";

/* ---------------------------- vormgereedschap ---------------------------- */

type Punt = readonly [number, number];
/** Eén cubic: twee controlepunten en een eindpunt. */
type Bocht = readonly [Punt, Punt, Punt];

/** Cirkel-benadering met cubics: 0.5523 × r als controlepuntafstand. */
const K = 0.5523;

/** Ellips als vier cubics. Eén gesloten pad zonder bogen, dus de
 *  geometrietest kan er letterlijk de uitersten uit lezen. */
function ellipsPad(cx: number, cy: number, rx: number, ry: number): string {
  const kx = rond(rx * K);
  const ky = rond(ry * K);
  const [l, r, t, b] = [rond(cx - rx), rond(cx + rx), rond(cy - ry), rond(cy + ry)];
  return (
    `M ${l} ${cy} ` +
    `C ${l} ${rond(cy - ky)}, ${rond(cx - kx)} ${t}, ${cx} ${t} ` +
    `C ${rond(cx + kx)} ${t}, ${r} ${rond(cy - ky)}, ${r} ${cy} ` +
    `C ${r} ${rond(cy + ky)}, ${rond(cx + kx)} ${b}, ${cx} ${b} ` +
    `C ${rond(cx - kx)} ${b}, ${l} ${rond(cy + ky)}, ${l} ${cy} Z`
  );
}

/** Rechts-openende halve cirkelboog — de geluidsgolf van de crest. */
function golfPad(cx: number, cy: number, r: number): string {
  const k = rond(r * K);
  return (
    `M ${cx} ${rond(cy - r)} ` +
    `C ${rond(cx + k)} ${rond(cy - r)}, ${rond(cx + r)} ${rond(cy - k)}, ${rond(cx + r)} ${cy} ` +
    `C ${rond(cx + r)} ${rond(cy + k)}, ${rond(cx + k)} ${rond(cy + r)}, ${cx} ${rond(cy + r)}`
  );
}

/** Sluit een symmetrische omtrek uit één helft: heen langs de gegeven bochten,
 *  terug langs hun spiegeling om x=50. Zo kan de vorm per constructie niet
 *  asymmetrisch worden, én het blijft één pad — een gespiegeld hálf deel zou
 *  een contournaad op de as achterlaten. Start- en eindpunt liggen op de as. */
function symmetrischPad(start: Punt, bochten: readonly Bocht[]): string {
  const heen = bochten
    .map(([c1, c2, p]) => `C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p[0]} ${p[1]}`)
    .join(" ");
  const sp = (p: Punt): string => `${rond(100 - p[0])} ${p[1]}`;
  const terug: string[] = [];
  for (let i = bochten.length - 1; i >= 0; i--) {
    const [c1, c2] = bochten[i];
    const vorig = i === 0 ? start : bochten[i - 1][2];
    terug.push(`C ${sp(c2)}, ${sp(c1)}, ${sp(vorig)}`);
  }
  return `M ${start[0]} ${start[1]} ${heen} ${terug.join(" ")} Z`;
}

/** Dezelfde bochten, naar een punt toegekrompen — de binnenrand van een
 *  plaquette hoort de buitenrand exact te volgen, niet een tweede keer
 *  uitgeschreven te worden. */
function krimp(
  bochten: readonly Bocht[],
  cx: number,
  cy: number,
  f: number,
): Bocht[] {
  const k = (p: Punt): Punt => [rond(cx + (p[0] - cx) * f), rond(cy + (p[1] - cy) * f)];
  return bochten.map(([c1, c2, p]) => [k(c1), k(c2), k(p)] as Bocht);
}

function cubic(p0: Punt, c1: Punt, c2: Punt, p3: Punt, t: number): Punt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0],
    a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1],
  ];
}

/** Streepjeslijn langs een cubic: korte segmenten met gaten ertussen. De
 *  motief-laag kent geen stroke-dasharray (canvas zou het niet meelezen), dus
 *  het streepjespatroon zit hier in de geometrie. */
function streepjes(
  p0: Punt,
  c1: Punt,
  c2: Punt,
  p3: Punt,
  aantal: number,
): string[] {
  const uit: string[] = [];
  for (let i = 0; i < aantal; i++) {
    const a = cubic(p0, c1, c2, p3, i / aantal);
    const b = cubic(p0, c1, c2, p3, (i + 0.58) / aantal);
    uit.push(`M ${rond(a[0])} ${rond(a[1])} L ${rond(b[0])} ${rond(b[1])}`);
  }
  return uit;
}

/** Pijlpunt op het eind van een cubic, uit de lokale richting daar. */
function pijlpunt(p0: Punt, c1: Punt, c2: Punt, p3: Punt, lengte: number): string {
  const voor = cubic(p0, c1, c2, p3, 0.93);
  const dx = p3[0] - voor[0];
  const dy = p3[1] - voor[1];
  const len = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / len, dy / len];
  const vleugel = (hoek: number): string => {
    const c = Math.cos(hoek);
    const s = Math.sin(hoek);
    return `${rond(p3[0] - (ux * c - uy * s) * lengte)} ${rond(
      p3[1] - (ux * s + uy * c) * lengte,
    )}`;
  };
  return `M ${vleugel(0.42)} L ${p3[0]} ${p3[1]} L ${vleugel(-0.42)}`;
}

/* ------------------------------- gradients ------------------------------- */

// Id-prefix `fut-div-zilver-`, zodat de acht andere divisies niet botsen. De
// assen staan in kaart-units (userSpaceOnUse): bij een gespiegeld deel kantelt
// het licht dus mee, waardoor links en rechts elk op hun eigen flank oplichten.
const GRADIENTEN: readonly DivisieGradient[] = [
  {
    // Dwars over het buizenpaar: donkere flank, scherpe glansband, dan weg in
    // de schaduw. Dát maakt het verschil tussen een pijp en een streep.
    id: "fut-div-zilver-buis",
    as: [-6.2, 0, 2.4, 0],
    stops: [
      [0, "#69747f"],
      [0.24, "#f6f8fa"],
      [0.5, "#c6ccd4"],
      [0.78, "#8b96a3"],
      [1, "#5b6672"],
    ],
  },
  {
    // De holte in de buismond: bewust bijna zwart, want een buis die licht
    // vangt in zijn opening leest als een dop.
    id: "fut-div-zilver-holte",
    as: [-6, 36, -0.5, 44],
    stops: [
      [0, "#39414b"],
      [1, "#1e242b"],
    ],
  },
  {
    id: "fut-div-zilver-crest",
    as: [50, -5.2, 50, 14.4],
    stops: [
      [0, "#fbfcfd"],
      [0.42, "#d7dee6"],
      [0.78, "#a3aeba"],
      [1, "#7c8794"],
    ],
  },
  {
    id: "fut-div-zilver-veeg",
    as: [-6, 84, 32, 132],
    stops: [
      [0, "#eef1f5"],
      [0.45, "#b7c0ca"],
      [1, "#7b8695"],
    ],
  },
  {
    // Dof i.p.v. spiegelend: het medaillon is gedeukt aluminium, geen medaille.
    id: "fut-div-zilver-medaille",
    as: [50, 114, 50, 135],
    stops: [
      [0, "#dde4eb"],
      [0.5, "#a9b3bf"],
      [1, "#7a8594"],
    ],
  },
  {
    id: "fut-div-zilver-hoorn",
    as: [42, 119, 57, 128],
    stops: [
      [0, "#8d98a5"],
      [0.4, "#e8edf2"],
      [1, "#96a1ae"],
    ],
  },
] as const;

/* --------------------------- holle buisprofielen --------------------------- */

/** Eén holle buis langs de flank: schacht met een afgeronde voet en een
 *  elliptische mond bovenaan. `spiegel` maakt de rechterhelft, dus hier staat
 *  alleen de linker. */
function buis(cx: number, r: number, vTop: number, vBot: number): DivisieDeel[] {
  const ry = rond(r * 0.5);
  const [l, re] = [rond(cx - r), rond(cx + r)];
  const kx = rond(r * K);
  const schacht =
    `M ${l} ${vTop} ` +
    // Mond: de bovenste helft van de ellips, zodat de buis afgesneden lijkt.
    `C ${l} ${rond(vTop - ry * K)}, ${rond(cx - kx)} ${rond(vTop - ry)}, ${cx} ${rond(vTop - ry)} ` +
    `C ${rond(cx + kx)} ${rond(vTop - ry)}, ${re} ${rond(vTop - ry * K)}, ${re} ${vTop} ` +
    `L ${re} ${vBot} ` +
    // Voet: halve cirkel, want een dichte buis heeft geen scherpe hoek.
    `C ${re} ${rond(vBot + r * K)}, ${rond(cx + kx)} ${rond(vBot + r)}, ${cx} ${rond(vBot + r)} ` +
    `C ${rond(cx - kx)} ${rond(vBot + r)}, ${l} ${rond(vBot + r * K)}, ${l} ${vBot} Z`;
  return [
    { d: schacht, vulling: "url(#fut-div-zilver-buis)", contour: ALU_CONTOUR, contourBreedte: 0.3, spiegel: true },
    // De holte iets ónder de mondrand: zo blijft er een rand metaal staan en
    // leest de buis als hol i.p.v. als plat gat.
    {
      d: ellipsPad(cx, rond(vTop - ry * 0.28), rond(r * 0.6), rond(ry * 0.58)),
      vulling: "url(#fut-div-zilver-holte)",
      spiegel: true,
    },
    // Glanslijn binnen de bolle flank — de rondte van de buis.
    {
      d: `M ${rond(cx - r * 0.42)} ${rond(vTop + r * 1.4)} L ${rond(cx - r * 0.42)} ${rond(vBot - r * 0.6)}`,
      contour: ALU_GLANS,
      contourBreedte: rond(r * 0.3),
      spiegel: true,
    },
  ];
}

// Twee buizen naast elkaar, de binnenste een stuk lager afgesneden — precies de
// getrapte mondjes van de referentie. De assen liggen links van de kaartrand
// (u=0), want de ornamentlaag ligt áchter het schild: wat binnen de rand valt,
// slokt de kaart op. De binnenste buis mag daarom net over de rand hangen; hij
// leest dan als een profiel dat achter de plaat door loopt.
const BUIS_BUITEN = buis(-3.5, 2.2, 39, 100);
const BUIS_BINNEN = buis(-0.6, 1.8, 48.5, 96.5);

/* ----------------------------- onderste veeg ----------------------------- */

// Gestileerde windveeg langs de onderste zijkanten: volgt de taille van het
// schild en loopt met de punt mee naar het medaillon. Uit `bouwStreng`, want een
// getaperde baan met glans en schaduw met de hand uitschrijven is vragen om
// links-rechtsverschillen — en de spiegeling doet de rechterhelft.
const VEEG = bouwStreng({
  // De centerlijn hugt de schildrand net aan de búitenkant: op v≈86 loopt de
  // kaart tot u≈0, bij de taille buigt hij naar binnen, en vanaf v≈117 loopt de
  // rand met 1,6 u per v naar de punt. Blijft de baan daar links van, dan komt
  // hij van achter de plaat vandaan i.p.v. eronder te verdwijnen.
  start: [-3.4, 86],
  segmenten: [
    [
      [-2.8, 95],
      [-1.4, 103],
      [1.4, 109.5],
    ],
    [
      [4.2, 115],
      [9.3, 120],
      [15.8, 124],
    ],
    [
      [20.3, 126.6],
      [24.8, 128.4],
      [29.2, 129.6],
    ],
  ],
  dikte: 2.5,
  taper: 2.6,
  punt: 0.4,
  stappen: 60,
});

/** Dunne windlijn nét buiten de veeg — de tweede, ijlere baan uit de
 *  referentie, waar de plaat in lagen naar de punt toe loopt. */
const VEEG_ECHO =
  "M -5.4 89 C -4.4 99, -2.4 108, 2.2 115 C 6.8 122, 14 127.4, 22.6 131";

/* --------------------------------- crest --------------------------------- */

// Wind- en spraakcrest in de bovenste inkeping: een plaquette met cusp-flanken
// die de notch afdekt en er ~5 units bovenuit komt. Vóór de kaart (de `voor`-
// laag), want áchter het schild zou de onderste helft wegvallen. De onderpunt
// stopt op v=13,4; het vlak begint zijn tekst pas rond v=15,6 (12% padding op
// een vlak van ~90 units breed), dus de crest raakt geen inkt.
const CREST_HELFT: readonly Bocht[] = [
  [
    [46.4, -5.2],
    [43.6, -3.9],
    [42.4, -1.2],
  ],
  [
    [41.8, 0.1],
    [40.2, 0.3],
    [39.4, 1.8],
  ],
  [
    [38.3, 3.7],
    [38.9, 6.3],
    [40.6, 7.9],
  ],
  [
    [42.8, 9.8],
    [45.2, 10.9],
    [47.0, 11.7],
  ],
  [
    [48.4, 12.3],
    [49.2, 12.9],
    [50, 13.4],
  ],
];
const CREST = symmetrischPad([50, -5.2], CREST_HELFT);
const CREST_BINNEN = symmetrischPad(
  [50, rond(4.1 + (-5.2 - 4.1) * 0.82)],
  krimp(CREST_HELFT, 50, 4.1, 0.82),
);

/** Abstracte luchtstreken: drie horizontale stromen die in een krul eindigen.
 *  Bewust geen mond en geen gezicht — de stijlbeperking uit de referentie. */
const CREST_WIND: readonly string[] = [
  "M 42.6 2.4 L 47.8 2.4 C 49.4 2.4, 49.9 1, 48.8 0.5 C 48 0.14, 47.4 0.7, 47.6 1.3",
  "M 41.8 4.9 L 48.8 4.9 C 50.5 4.9, 51 6.4, 49.8 6.9 C 49 7.24, 48.4 6.7, 48.6 6.1",
  "M 43.4 7.3 L 46.8 7.3",
] as const;

/** Drie geluidsgolven rechts van de luchtstreken: het "veel lawaai" van deze
 *  divisie, als abstracte golf i.p.v. een megafoon. */
const CREST_GOLVEN: readonly string[] = [2.6, 4, 5.4].map((r) =>
  golfPad(51, 4.2, r),
);

/* ------------------------------- medaillon ------------------------------- */

// Dof, licht gedeukt resonatormedaillon in de kaartpunt. Middelpunt (50 · 124,6)
// met straal 9,4: de bovenrand blijft op v=115,2 en dus ~2,7 units onder de
// onderkant van de divisieregel (het vlak eindigt zijn tekst op v≈112,5 bij 24%
// bodempadding). Onder een editie zakt die tekst lager, maar dan tekent de
// divisie zijn ornamentlaag helemaal niet — de editie wint (FutKaart.tsx).
const MED = { x: 50, y: 124.6, r: 9.4 } as const;

/** De ring, met één ingedeukte flank: de controlepunten van de linksboven-boog
 *  liggen naar binnen getrokken, zodat de cirkel daar zichtbaar plat slaat. Een
 *  gaaf gepolijste ring zou te duur ogen voor deze divisie. */
const MED_RING =
  "M 40.6 124.6 C 41.3 120.1, 45.3 116.3, 50 115.2 " +
  "C 55.19 115.2, 59.4 119.41, 59.4 124.6 " +
  "C 59.4 129.79, 55.19 134, 50 134 " +
  "C 44.81 134, 40.6 129.79, 40.6 124.6 Z";

const MED_VLAK = ellipsPad(50, 124.8, 7.7, 7.7);

/** Abstracte resonator: een getaperde kegel met twee ribben en een holle
 *  mondplaat. Geometrisch en vlak gehouden — geen realistische megafoon. */
const MED_HOORN =
  "M 44.2 123.4 C 47.2 123.7, 49.8 122.4, 52.6 120.8 " +
  "C 53.5 120.3, 54.6 120.9, 54.6 121.9 L 54.6 127.3 " +
  "C 54.6 128.3, 53.5 128.9, 52.6 128.4 C 49.8 126.8, 47.2 125.5, 44.2 125.8 Z";
const MED_MOND = ellipsPad(54.6, 124.6, 1.5, 3.4);
const MED_ROMP = "M 42.9 123.5 L 44.4 123.5 L 44.4 125.9 L 42.9 125.9 Z";
const MED_RIBBEN: readonly string[] = [
  "M 48.2 123 L 48.2 126.2",
  "M 51.2 121.8 L 51.2 127.5",
] as const;

/** Korte schreeuwstreepjes die van het medaillon wegstralen. Eén helft; de
 *  spiegeling doet rechts. Ze blijven onder v=116,9 en dus onder de
 *  divisieregel, en ruim links van de as (max u≈40). */
const MED_STRALEN: readonly string[] = [183, 192, 201, 210].map((graden, i) => {
  const h = (graden * Math.PI) / 180;
  const buiten = 15.4 - i * 0.1;
  const p = (rad: number): string =>
    `${rond(MED.x + Math.cos(h) * rad)} ${rond(MED.y + Math.sin(h) * rad)}`;
  return `M ${p(11.2)} L ${p(buiten)}`;
});

/* -------------------------------- watermerk -------------------------------- */

// Tactische pijlen die rondlopen zonder hun doel te bereiken: elke baan buigt
// terug of stopt vlak voor de X. Dát is de grap van deze divisie, en als
// watermerk (onder de inkt, ~8,5% dekking) mag hij letterlijk zijn.
function tactischePijl(
  p0: Punt,
  c1: Punt,
  c2: Punt,
  p3: Punt,
  aantal: number,
  breedte: number,
): OrnamentPad[] {
  return [
    ...streepjes(p0, c1, c2, p3, aantal).map(
      (d): OrnamentPad => ({ d, soort: "lijn", breedte }),
    ),
    { d: pijlpunt(p0, c1, c2, p3, 4.2), soort: "lijn", breedte },
  ];
}

/** Kruisje: de tegenstander die nooit bereikt wordt. */
const kruis = (x: number, y: number, r: number): OrnamentPad[] => [
  { d: `M ${x - r} ${y - r} L ${x + r} ${y + r}`, soort: "lijn", breedte: 1.4 },
  { d: `M ${x + r} ${y - r} L ${x - r} ${y + r}`, soort: "lijn", breedte: 1.4 },
];

const MOTIEF: readonly OrnamentPad[] = [
  // Baan 1: zwiept naar rechtsboven en draait dan terug naar waar hij begon.
  ...tactischePijl([15, 82], [4, 54], [26, 30], [52, 36], 7, 1.2),
  ...tactischePijl([52, 36], [66, 41], [60, 59], [41, 55], 5, 1.2),
  // Baan 2: komt van rechts, curlt naar binnen en eindigt naast zijn doel.
  ...tactischePijl([88, 28], [70, 18], [46, 22], [35, 35], 6, 1.2),
  ...tactischePijl([35, 35], [27, 44], [34, 56], [47, 53], 4, 1.2),
  // Baan 3: stopt halverwege — het advies is nooit afgemaakt.
  ...tactischePijl([22, 66], [33, 61], [43, 65], [51, 71], 4, 1.2),
  // Doelen die niemand haalt, en twee posities die niemand inneemt.
  ...kruis(68, 19, 3.2),
  ...kruis(57, 77, 3),
  { d: ellipsPad(31, 47, 3, 3), soort: "lijn", breedte: 1.2 },
  { d: ellipsPad(70, 59, 2.6, 2.6), soort: "lijn", breedte: 1.2 },
  // Geluidsgolven achter het eloblok, en twee windkrullen: de achtergrondlijnen
  // van de referentie, op lage dekking zodat ze de inkt niet hinderen.
  { d: golfPad(2, 30, 16), soort: "lijn", breedte: 1, alpha: 0.7 },
  { d: golfPad(2, 30, 22), soort: "lijn", breedte: 1, alpha: 0.55 },
  { d: golfPad(2, 30, 28), soort: "lijn", breedte: 1, alpha: 0.4 },
  {
    d: "M 6 88 C 15 83, 23 89, 17 94 C 13 97, 8.5 94, 11 90.5",
    soort: "lijn",
    breedte: 1.2,
    alpha: 0.8,
  },
  {
    d: "M 94 84 C 85 79, 77 85, 83 90 C 87 93, 91.5 90, 89 86.5",
    soort: "lijn",
    breedte: 1.2,
    alpha: 0.8,
  },
] as const;

/* ------------------------------ de divisie ------------------------------ */

export const DIVISIE_ZILVER: DivisieKaart = {
  key: "zilver",
  naam: "Blaaskaak",

  // Spiegel van het `.fut-kaart--zilver`-register in zilver.css; de synctest in
  // zilver.test.ts houdt de twee gelijk.
  register: {
    frame: [
      [0, "#fdfefe"],
      [0.4, "#a6b0bc"],
      [0.66, "#eef1f5"],
      [1, "#6d7783"],
    ],
    liner: "#414b57",
    keyline: "#dde4ec",
    vlak: ["#f7f9fb", "#dfe4ea", "#bcc3cc"],
    glow: "rgba(255, 255, 255, 0.58)",
    // Bredere, koelere glansbaan dan de basis-sheen: een aluminium plaat vangt
    // licht over een brede strook. CSS zet 0.4 over 38/50/62; hier de vaste
    // ~0,875-kalibratie van #664 (canvas leest een kortere as en dus feller).
    sheen: "rgba(240, 247, 255, 0.35)",
    sheenSpreiding: 0.12,
    ink: "#2c3440",
    inkSoft: "#46505f",
    lijn: "#6f7f91",
    // Bleke echo rechtsonder: de lichtrand van een dunne plaat, niet de
    // gekleurde slagschaduw van de toptiers.
    echo: [[0.008, 0.011, "rgba(190, 202, 214, 0.75)"]],
    // Gestapelde panellijnen: lichte kern, donkere spouw, tweede lichte lijn —
    // het gezette blik van de referentie zonder extra DOM-laag.
    binnenlijn: [
      [1, "rgba(250, 252, 254, 0.8)"],
      [2.5, "rgba(91, 102, 114, 0.45)"],
      [4, "rgba(222, 230, 238, 0.5)"],
    ],
  },

  gradienten: GRADIENTEN,

  // Áchter het schild: de buisprofielen en de onderste veeg komen van achter de
  // plaat vandaan.
  achter: [
    ...BUIS_BUITEN,
    ...BUIS_BINNEN,
    {
      d: VEEG.omtrek,
      vulling: "url(#fut-div-zilver-veeg)",
      contour: ALU_CONTOUR,
      contourBreedte: 0.3,
      spiegel: true,
    },
    { d: VEEG.highlight, contour: ALU_GLANS, contourBreedte: 0.5, spiegel: true },
    { d: VEEG.schaduw, contour: ALU_SCHADUW, contourBreedte: 0.45, spiegel: true },
    {
      d: VEEG_ECHO,
      contour: "rgba(226, 233, 240, 0.7)",
      contourBreedte: 0.55,
      spiegel: true,
    },
  ],

  // Vóór het schild: crest en medaillon liggen in de rand respectievelijk de
  // punt en zouden er anders half achter verdwijnen.
  voor: [
    { d: CREST, vulling: "url(#fut-div-zilver-crest)", contour: ALU_CONTOUR, contourBreedte: 0.45 },
    { d: CREST_BINNEN, contour: "rgba(255, 255, 255, 0.6)", contourBreedte: 0.4 },
    ...CREST_WIND.map(
      (d): DivisieDeel => ({ d, contour: "#5b6672", contourBreedte: 0.85 }),
    ),
    ...CREST_GOLVEN.map(
      (d): DivisieDeel => ({ d, contour: "#6f7f91", contourBreedte: 0.65 }),
    ),
    { d: MED_RING, vulling: "url(#fut-div-zilver-medaille)", contour: ALU_CONTOUR, contourBreedte: 0.4 },
    { d: MED_VLAK, vulling: "#b3bcc7", contour: "rgba(69, 79, 92, 0.5)", contourBreedte: 0.35 },
    { d: MED_HOORN, vulling: "url(#fut-div-zilver-hoorn)", contour: ALU_CONTOUR, contourBreedte: 0.3 },
    { d: MED_MOND, vulling: "url(#fut-div-zilver-holte)", contour: ALU_CONTOUR, contourBreedte: 0.25 },
    { d: MED_ROMP, vulling: "url(#fut-div-zilver-hoorn)", contour: ALU_CONTOUR, contourBreedte: 0.25 },
    ...MED_RIBBEN.map(
      (d): DivisieDeel => ({ d, contour: ALU_SCHADUW, contourBreedte: 0.35 }),
    ),
    ...MED_STRALEN.map(
      (d): DivisieDeel => ({
        d,
        contour: "rgba(69, 79, 92, 0.45)",
        contourBreedte: 0.6,
        spiegel: true,
      }),
    ),
  ],

  motief: {
    paden: MOTIEF,
    kleur: TACTIEK_KLEUR,
    breedte: 0.88,
    // Lager dan het GOAT-medaillon: de pijlen horen achter avatar, hairlines en
    // naamplaat, niet achter het eloblok — daar staat het grootste cijfer.
    positie: 0.36,
  },
};
