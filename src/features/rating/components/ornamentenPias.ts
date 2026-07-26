// Ornamenten en motief van de Pias-kaart (#710): de gevállen joker. De pias is
// de speler met de zwaarste terugval van de week, dus alles hier moet
// tragikomisch lezen — ooit feestelijk, nu verweerd. Dat zit in de vórm (een
// narrenkap die slap over de bovenrand hangt, twee linten die als vraagtekens
// naast de punt bengelen, een medaillon met een gebarsten lach) en niet in de
// kleur: het register blijft mat kraftkarton, want glans zou de kaart een
// beloning maken. Geen shimmer, geen wit specular metaal — zie het #705-blok in
// FutKaart.css. Bewust ook géén beweging: een narrenkap die vrolijk meezwaait
// haalt de pijn eruit, en stilstand ís hier de grap.
//
// Eigen bestand naast futKaartOrnamenten.ts (waar `bouwStreng` en de GOAT
// wonen): de generator is gedeeld, de vormtaal niet. Zo blijven de kaarten uit
// #710 los van elkaar te herijken.
//
// Eén bron, twee tekenaars: FutKaart.tsx rendert deze strings als inline-SVG,
// futKaartCanvas.ts tekent ze als Path2D op de deel-poster. Omdat beide
// letterlijk dezelfde strings gebruiken, is de CSS↔canvas-pariteit hier by
// construction.
//
// Coördinaten: ornamenten in kaart-units (100 breed × 139 hoog, oorsprong
// linksboven op de kaart) binnen de ORNAMENT_VIEWBOX; het motief in dezelfde
// units maar als vullende laag ín het vlak (viewBox 0 0 100 139).
//
// Maten opgemeten uit de referentie in issue #710 (kaart 773 px breed, dus
// 7,73 px per unit; de referentiekaart is iets langgerekter dan onze 100×139,
// dus de onderkant-ornamenten zijn naar de schildpunt teruggerekend).

import { bouwStreng, type OrnamentPad, type Streng } from "./futKaartOrnamenten";

const rond = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------- materialen ------------------------------- */

/** Aangetast honinggoud: kap-band, belletjes, medaillon en de bies langs de
 *  stof. Geen witte glanspunt bovenin — dit goud is dof geworden. */
export const PIAS_GOUD_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "#d2b076"],
  [0.34, "#a67f45"],
  [0.7, "#7c5b2c"],
  [1, "#4a3218"],
] as const;
export const PIAS_GOUD_CONTOUR = "#2b1c0b";
export const PIAS_GOUD_GLANS = "rgba(255, 240, 204, 0.62)";
export const PIAS_GOUD_SCHADUW = "rgba(40, 24, 8, 0.45)";
/** Gravures ín het goud (naad van een bel, nerven van het medaillon). */
export const PIAS_GOUD_GRAVURE = "rgba(43, 28, 11, 0.55)";

/** Gedempt bordeauxrood: de stof van de narrenkap en de jokerlinten. */
export const PIAS_STOF_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "#8e4235"],
  [0.42, "#70312a"],
  [0.76, "#54221f"],
  [1, "#381516"],
] as const;
/** Gouden bies langs de stof: de piping die kap en lint omzoomt — het enige
 *  wat nog aan de feestelijke herkomst herinnert. */
export const PIAS_STOF_BIES = "#9b7a3d";
export const PIAS_STOF_GLANS = "rgba(228, 164, 142, 0.34)";
export const PIAS_STOF_SCHADUW = "rgba(26, 9, 9, 0.5)";

/* ------------------------------ de narrenkap ------------------------------ */

/** Zijlob van de narrenkap (linkerhelft; rechts is de spiegeling om x=50): een
 *  slappe punt die uit de bovenrand komt, over de kaart heen naar buiten
 *  zwiept en met de tip weer omlaag hangt. De wortel zit bewust ónder v=0, dus
 *  achter de kaart — de lob komt van achter het schild vandaan en zweeft niet
 *  los boven de rand. Dat werkt op alle vier de schildvormen, want die hebben
 *  hun bovenrand tussen v=0 en v≈8. */
export const PIAS_KAP_ZIJLOB: Streng = bouwStreng({
  start: [47.5, 8],
  segmenten: [
    [
      [45.5, 1],
      [41.5, -7],
      [36, -9.5],
    ],
    [
      [30.5, -12],
      [26.5, -6],
      [29.5, -1.5],
    ],
    [
      [30.8, 0.4],
      [32.6, 1.4],
      [34.4, 1.8],
    ],
  ],
  dikte: 3.8,
  ribbels: 0,
  taper: 1.3,
  punt: 0.4,
  stappen: 52,
});

/** Middenlob: hoger dan de zijlobben en met de tip naar rechts omgeslagen —
 *  een narrenkap zit nooit recht. Staat niet op de as maar leunt bewust
 *  scheef, dus deze lob wordt níet gespiegeld (zoals het GOAT-baardblad). */
export const PIAS_KAP_MIDDENLOB: Streng = bouwStreng({
  start: [50, 9],
  segmenten: [
    [
      [50.6, 1],
      [51.6, -8],
      [53.4, -13.5],
    ],
    [
      [55.2, -18.6],
      [60.6, -18.2],
      [61.2, -13.4],
    ],
    [
      [61.5, -11],
      [60.4, -9.2],
      [58.8, -8.2],
    ],
  ],
  dikte: 4.6,
  ribbels: 0,
  taper: 1.4,
  punt: 0.45,
  stappen: 60,
});

/** Kapband: de gouden kraag waarmee de kap in de bovenrand vastzit. Ligt
 *  daarom in de vóór-laag, over frame en keyline heen — dát is wat de kap
 *  "geïntegreerd in de bovenrand" maakt in plaats van erop geplakt. */
export const PIAS_KAP_BAND =
  "M 38.4 0.6 C 42.4 -0.7, 57.6 -0.7, 61.6 0.6 L 59.2 7.4 C 55.8 6.3, 44.2 6.3, 40.8 7.4 Z";
/** Onderrand van de kraag: een iets bredere ring, zoals de omgeslagen zoom van
 *  een echte kap. Reikt tot v≈10,5 — nog boven de eerste tekstregel van het
 *  vlak (die begint rond v≈17), dus de kraag legt niets over de inkt. */
export const PIAS_KAP_ZOOM =
  "M 39.8 6.8 C 43.4 5.5, 56.6 5.5, 60.2 6.8 L 59.4 10.5 C 55.9 9.2, 44.1 9.2, 40.6 10.5 Z";
/** Gravure over de kraag: twee horizontale nerven. */
export const PIAS_KAP_NERVEN: readonly string[] = [
  "M 39.6 2.6 C 43.4 1.5, 56.6 1.5, 60.4 2.6",
  "M 40.4 4.9 C 44 3.9, 56 3.9, 59.6 4.9",
];

/* ------------------------------- belletjes ------------------------------- */

export interface PiasBel {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

/** De vier paden van één belletje: bol, naad, klepelgat en glans. Eén functie
 *  voor DOM en canvas, dus de strings zijn per definitie gelijk. */
export function belPaden(b: PiasBel): {
  bol: string;
  naad: string;
  gat: string;
  glans: string;
} {
  const { cx, cy, r } = b;
  const g = rond(r * 0.24);
  return {
    // Twee halve bogen: zo sluit de cirkel ook als Path2D.
    bol: `M ${rond(cx - r)} ${cy} A ${r} ${r} 0 1 1 ${rond(cx + r)} ${cy} A ${r} ${r} 0 1 1 ${rond(cx - r)} ${cy} Z`,
    naad: `M ${cx} ${rond(cy + r * 0.16)} L ${cx} ${rond(cy + r * 0.92)}`,
    gat: `M ${rond(cx - g)} ${rond(cy + r * 0.52)} A ${g} ${g} 0 1 1 ${rond(cx + g)} ${rond(cy + r * 0.52)} A ${g} ${g} 0 1 1 ${rond(cx - g)} ${rond(cy + r * 0.52)} Z`,
    glans: `M ${rond(cx - r * 0.62)} ${rond(cy - r * 0.24)} A ${rond(r * 0.68)} ${rond(r * 0.68)} 0 0 1 ${rond(cx - r * 0.06)} ${rond(cy - r * 0.66)}`,
  };
}

/** De drie kap-belletjes, bewust asymmetrisch (de referentie heeft ze dat ook):
 *  links het kleinste, rechts een maat groter en lager, en één aan de
 *  omgeslagen middenlob. Ze staan expliciet in plaats van meegespiegeld — een
 *  gespiegelde bel is per constructie symmetrisch en dat is precies wat een
 *  narrenkap niet is. In de vóór-laag: onze bovenrand loopt vlak (v≈0) waar de
 *  referentie een diepe inkeping heeft, dus een bel áchter de kaart zou er
 *  half achter wegvallen. */
export const PIAS_KAP_BELLEN: readonly PiasBel[] = [
  { cx: 33.8, cy: 4.2, r: 2.3 },
  { cx: 66.6, cy: 4.8, r: 2.65 },
  { cx: 59.2, cy: -6.2, r: 2.9 },
] as const;

/* ----------------------------- jokerlinten ----------------------------- */

/** Jokerlint (linkerhelft; rechts is de spiegeling): een brede stoffen band die
 *  achter de onderste zijkant vandaan komt, naar buiten zwelt en met een krul
 *  terug omhoog eindigt — het vraagteken-silhouet van de referentie. De wortel
 *  ligt op v≈95, waar het schild nog op volle breedte is, dus de band komt
 *  écht van achter de kaart. */
export const PIAS_LINT: Streng = bouwStreng({
  start: [12, 95],
  segmenten: [
    [
      [7, 99],
      [0, 103],
      [-3.5, 109],
    ],
    [
      [-7, 115.5],
      [-3.5, 122.5],
      [2, 123],
    ],
    [
      [5.5, 123.3],
      [7.6, 121.6],
      [8, 119],
    ],
  ],
  dikte: 5.8,
  ribbels: 0,
  taper: 1.6,
  punt: 0.4,
  stappen: 72,
});

/** Het belletje onder de krul, met een kort halsje naar de band toe. Hangt
 *  ruim buiten de schildrand (op v≈123 loopt die al naar de punt), dus hier mag
 *  het wél in de áchter-laag. */
export const PIAS_LINT_BEL: PiasBel = { cx: 0.6, cy: 128.4, r: 3.4 };
export const PIAS_LINT_HALS =
  "M -0.6 123.4 L 2.4 123.8 L 2 126.4 L -1 126 Z";

/* --------------------------- maskermedaillon --------------------------- */

/** Rond medaillon op de schildpunt, in de vóór-laag: het "keerzijde"-zegel van
 *  de kaart. Ligt bewust ónder de editie-regel en over de frame-lagen heen —
 *  precies zoals de referentie. */
// Verticaal ingeklemd: bóven het medaillon eindigt de editie-regel (bij een vol
// vlak rond v≈114, zie de `padding-bottom: 20%` van #661) en ónder houdt de
// schildpunt op bij v=139. Vandaar cy≈127 met een straal van ~10,4 — groter kan
// niet zonder de Pias-regel te raken of de punt uit te lopen.
const MED_CX = 50;
const MED_CY = 126.8;

/** Buitenring, binnenvlak en haarlijn van het medaillon. Ellipsen (rx≠ry): de
 *  referentie is een fractie hoger dan breed, wat het zegel de schildpunt in
 *  laat volgen. */
export const PIAS_MED_RING = `M ${MED_CX - 10.2} ${MED_CY} A 10.2 9.8 0 1 1 ${MED_CX + 10.2} ${MED_CY} A 10.2 9.8 0 1 1 ${MED_CX - 10.2} ${MED_CY} Z`;
export const PIAS_MED_VLAK = `M ${MED_CX - 7.9} ${MED_CY} A 7.9 8.3 0 1 1 ${MED_CX + 7.9} ${MED_CY} A 7.9 8.3 0 1 1 ${MED_CX - 7.9} ${MED_CY} Z`;
export const PIAS_MED_HAARLIJN = `M ${MED_CX - 9} ${MED_CY} A 9 9.4 0 1 1 ${MED_CX + 9} ${MED_CY} A 9 9.4 0 1 1 ${MED_CX - 9} ${MED_CY} Z`;

/** Het masker zelf: één toneelmasker dat middendoor gebarsten is. Links de
 *  komedie (lachende ooghoek, opgetrokken brauw), rechts de tragedie (hangende
 *  brauw, traan) — twee gezichten in één vorm, want de pias is beide tegelijk. */
export const PIAS_MED_MASKER =
  "M 50 118.9 C 44.9 118.9, 42.5 121.3, 42.5 124.7 C 42.5 129.3, 45.7 133.6, 50 135 C 54.3 133.6, 57.5 129.3, 57.5 124.7 C 57.5 121.3, 55.1 118.9, 50 118.9 Z";
/** De barst: een bliksemlijn van kruin tot kin, de scheidslijn tussen de twee
 *  gezichten en tegelijk de slijtage die van "feestelijk" "gevallen" maakt. */
export const PIAS_MED_BARST =
  "M 50 118.9 L 48.6 122.4 L 51.4 124.5 L 48.5 127.8 L 50.8 130.3 L 49.6 134.9";
/** Gelaatsdetails, in tekenvolgorde: brauwen, ogen, mond. */
export const PIAS_MED_TREKKEN: readonly string[] = [
  // Brauwen: links opgetrokken (lach), rechts hangend (verdriet).
  "M 44.2 122.4 C 45.3 121.1, 47.4 121.1, 48.4 122.3",
  "M 51.6 122.1 C 52.7 123.1, 54.8 123.2, 55.8 122.3",
  // Ogen: links een lachende boog, rechts een neergeslagen boog.
  "M 44.6 124.9 C 45.5 123.5, 47.1 123.5, 48 124.9",
  "M 52 123.9 C 52.9 125.3, 54.5 125.3, 55.4 123.9",
  // Mond: een brede grijns die aan de rechterkant al wegzakt.
  "M 44.9 129 C 46.7 132.4, 53.2 132.3, 55 129.2",
];
/** Traan onder het rechteroog — het enige gevulde detail. */
export const PIAS_MED_TRAAN =
  "M 53.6 127.2 C 52.9 128.6, 53.1 129.6, 53.8 129.6 C 54.5 129.6, 54.7 128.6, 54 127.2 Z";

/** Volute naast het medaillon (linkerhelft; rechts is de spiegeling): een
 *  klein gouden krulletje dat het zegel aan de schildrand vastzet, zodat het
 *  medaillon bij de kaart hoort en er niet op ligt. */
export const PIAS_MED_VOLUTE: readonly string[] = [
  "M 43.2 120.6 C 40.6 119.9, 38.3 121.3, 38.3 123.5 C 38.3 125, 39.5 125.9, 40.7 125.6 C 41.7 125.4, 42.2 124.3, 41.6 123.6 C 41.2 123, 40.2 123.1, 40.1 123.9",
  "M 41.5 126.8 C 40.3 127.9, 39.7 129.2, 40 130.6",
];

/** Verticale strook van elk los gouden/stoffen pad. De DOM laat
 *  `gradientUnits="objectBoundingBox"` dit per pad zelf uitrekenen; canvas kent
 *  geen paint-servers, dus daar moet de strook meegegeven worden. Omdat de
 *  pias-verlopen recht van boven naar onder lopen (x1 = x2 = 0) is de y-strook
 *  het enige wat nodig is — en dát is precies waarom die def verticaal staat.
 *  De waarden zijn de omhullende van de controlepunten (een fractie ruimer dan
 *  de echte curve-doos, onmeetbaar op deze maten); de geometrietest toetst dat
 *  elk pad erin past. */
export const PIAS_STROOK: Record<
  "kapBand" | "kapZoom" | "lintHals" | "medRing" | "medVlak" | "medMasker",
  readonly [number, number]
> & { volute: readonly (readonly [number, number])[] } = {
  kapBand: [-0.7, 7.4],
  kapZoom: [5.5, 10.5],
  lintHals: [123.4, 126.4],
  volute: [
    [119.9, 125.9],
    [126.8, 130.6],
  ],
  medRing: [MED_CY - 9.8, MED_CY + 9.8],
  medVlak: [MED_CY - 8.3, MED_CY + 8.3],
  medMasker: [118.9, 135],
};

/* ------------------------- motief ín het vlak ------------------------- */

/** Harlekijnruit: de ruit is 13,6 × 23,2 units (opgemeten uit de referentie —
 *  bewust langgerekt, dat maakt het patroon een harlekijn en geen schaakbord).
 *  Ruiten met even index dragen de donkere tint, de tussenliggende de lichte;
 *  samen betegelen ze het hele vlak. Twee paden i.p.v. 144 losse ruiten houdt
 *  de laag betaalbaar in DOM én Path2D. */
const RUIT_A = 6.8;
const RUIT_B = 11.6;

function ruitLattice(offsetX: number, offsetY: number): string {
  const delen: string[] = [];
  for (let i = -1; i <= 7; i++) {
    for (let j = -1; j <= 6; j++) {
      const cx = i * RUIT_A * 2 + offsetX;
      const cy = j * RUIT_B * 2 + offsetY;
      delen.push(
        `M ${rond(cx)} ${rond(cy - RUIT_B)} L ${rond(cx + RUIT_A)} ${rond(cy)} L ${rond(cx)} ${rond(cy + RUIT_B)} L ${rond(cx - RUIT_A)} ${rond(cy)} Z`,
      );
    }
  }
  return delen.join(" ");
}

/** De twee tegenover elkaar liggende ruit-families. De offsets zetten een
 *  ruitpunt op de kaartas (x=50), zodat het patroon symmetrisch onder de
 *  gecentreerde tekst doorloopt. */
const HARLEKIJN_DONKER = ruitLattice(9.2, 0);
const HARLEKIJN_LICHT = ruitLattice(9.2 + RUIT_A, RUIT_B);

/** Slijtage: fijne barstjes en krasjes over het karton. Handmatig geplaatst,
 *  niet random — een barst hoort van rand naar rand te lopen en niet in het
 *  midden te beginnen. */
const BARSTJES: readonly string[] = [
  "M 6 12 L 12 26 L 9.5 33 L 15 47 L 12 56",
  "M 92 8 L 88 21 L 91 30 L 86 44",
  "M 0 63 L 9 66 L 14 64 L 24 68",
  "M 100 88 L 91 92 L 86 90 L 76 95",
  "M 20 132 L 27 121 L 25 113",
  "M 78 130 L 72 120 L 74 112 L 70 104",
  "M 34 4 L 40 14 L 37 22",
];
/** Losse krasjes: korter, ondieper, andere richting. */
const KRASJES: readonly string[] = [
  "M 24 38 L 33 34",
  "M 63 51 L 71 46",
  "M 30 92 L 41 89",
  "M 58 106 L 67 103",
  "M 16 74 L 21 70",
  "M 80 66 L 87 62",
];

/** Neerwaartse chevrons: dubbele pijlpunten die naar de punt van de kaart
 *  wijzen — de daling, letterlijk. Bewust asymmetrisch verdeeld (drie rechts,
 *  twee links, zoals de referentie): een net raster zou decoratief worden. */
const CHEVRON_PLEKKEN: readonly (readonly [number, number])[] = [
  [12, 52],
  [12, 76],
  [88, 14],
  [88, 46],
  [88, 63],
] as const;

function chevrons(): string {
  const delen: string[] = [];
  for (const [x, y] of CHEVRON_PLEKKEN) {
    for (const dy of [0, 2.6]) {
      delen.push(
        `M ${x - 2.1} ${rond(y + dy)} L ${x} ${rond(y + dy + 2.3)} L ${x + 2.1} ${rond(y + dy)}`,
      );
    }
  }
  return delen.join(" ");
}

/** Confettisnippers: hoekige papiertjes, geen ronde stipjes — de referentie
 *  heeft geknipte slierten. Vijf stuks, laag en langs de randen: het feest is
 *  voorbij, dit is wat er is blijven liggen. */
const SNIPPERS: readonly string[] = [
  "M 7.5 21 L 10.4 22.4 L 9.2 25.2 L 6.6 23.6 Z",
  "M 11 41 L 13.6 40 L 14.4 43 L 11.8 44.2 Z",
  "M 87 19 L 90 20.8 L 88.4 23.4 L 85.8 21.6 Z",
  "M 89.5 72 L 92 73.6 L 90.4 76.2 L 88 74.4 Z",
  "M 13 96 L 15.8 96.8 L 15 99.8 L 12.2 98.8 Z",
] as const;

/** Groot maskerwatermerk: twee tragikomische maskers die elkaar overlappen,
 *  als nauwelijks zichtbare gravure achter de inkt. Het grote masker staat
 *  gecentreerd onder het elo-blok, het tweede schuift er half achter weg —
 *  twee gezichten, één speler. */
function maskerSilhouet(
  cx: number,
  cy: number,
  w: number,
  h: number,
): string {
  const hw = w / 2;
  return [
    `M ${rond(cx - hw)} ${rond(cy - h * 0.16)}`,
    `C ${rond(cx - hw * 1.04)} ${rond(cy - h * 0.52)}, ${rond(cx + hw * 1.04)} ${rond(cy - h * 0.52)}, ${rond(cx + hw)} ${rond(cy - h * 0.16)}`,
    `C ${rond(cx + hw * 0.96)} ${rond(cy + h * 0.2)}, ${rond(cx + hw * 0.46)} ${rond(cy + h * 0.48)}, ${cx} ${rond(cy + h * 0.5)}`,
    `C ${rond(cx - hw * 0.46)} ${rond(cy + h * 0.48)}, ${rond(cx - hw * 0.96)} ${rond(cy + h * 0.2)}, ${rond(cx - hw)} ${rond(cy - h * 0.16)}`,
    "Z",
  ].join(" ");
}

const WATERMERK_GROOT = maskerSilhouet(44, 57, 56, 62);
const WATERMERK_KLEIN = maskerSilhouet(67, 65, 40, 46);
/** Gelaatsopeningen van het grote masker: brauwen, twee amandelvormige
 *  oogholtes en een brede mondboog. De holtes zijn gevuld en niet gestreept —
 *  dat is wat een gegraveerd masker leesbaar maakt op 116 px, waar een dunne
 *  lijn wegvalt. */
const WATERMERK_TREKKEN: readonly string[] = [
  // Brauwen: links opgetrokken, rechts hangend — komedie en tragedie in één kop.
  "M 24.5 42 C 28 38.5, 36 38.5, 39.5 42.5 C 36 40.5, 28 40.5, 24.5 44 Z",
  "M 48.5 42.5 C 52 38.5, 60 38.5, 63.5 42 C 60 40.5, 52 40.5, 48.5 44.5 Z",
  // Oogholtes.
  "M 24 50 C 27.5 45.5, 36 45.5, 39.5 50 C 36 53.5, 27.5 53.5, 24 50 Z",
  "M 48.5 50 C 52 45.5, 60.5 45.5, 64 50 C 60.5 53.5, 52 53.5, 48.5 50 Z",
  // Mond: de brede grijns van een narrenmasker.
  "M 27 66 C 33.5 76.5, 54.5 76.5, 61 66 C 54.5 71, 33.5 71, 27 66 Z",
];

/** Inkten van het motief: alles rekent tegen --kaart-ink (#3a250c) en
 *  --editie-kleur (#8c2a17) van het pias-register, zodat de laag bij het
 *  karton hoort en niet als sticker leest. */
export const PIAS_MOTIEF_INK = "rgba(58, 37, 12, 0.075)";
const RUIT_DONKER = "rgba(58, 37, 12, 0.055)";
const RUIT_LICHT = "rgba(255, 246, 222, 0.05)";
const MASKER_LIJN = "rgba(58, 37, 12, 0.15)";
const BARST_INK = "rgba(58, 37, 12, 0.17)";
const KRAS_INK = "rgba(255, 246, 222, 0.16)";
const CHEVRON_INK = "rgba(140, 42, 23, 0.3)";
const SNIPPER_INK = "rgba(140, 42, 23, 0.26)";

/** Het volledige vlak-motief, in tekenvolgorde (de laagvolgorde uit #710):
 *  harlekijnruiten → slijtage → maskerwatermerk → chevrons en snippers. Alles
 *  in kaart-units, dus deze laag vult het hele vlak (viewBox 0 0 100 139) i.p.v.
 *  de vierkante 100×100-doos van de GOAT — het ruitpatroon moet tot in de punt
 *  doorlopen. */
export const PIAS_MOTIEF: readonly OrnamentPad[] = [
  { d: HARLEKIJN_DONKER, soort: "vlak", kleur: RUIT_DONKER },
  { d: HARLEKIJN_LICHT, soort: "vlak", kleur: RUIT_LICHT },
  { d: WATERMERK_KLEIN, soort: "lijn", breedte: 1, kleur: MASKER_LIJN, alpha: 0.8 },
  { d: WATERMERK_GROOT, soort: "vlak" },
  { d: WATERMERK_GROOT, soort: "lijn", breedte: 1.2, kleur: MASKER_LIJN },
  ...WATERMERK_TREKKEN.map(
    (d): OrnamentPad => ({ d, soort: "vlak", kleur: MASKER_LIJN }),
  ),
  ...BARSTJES.map(
    (d): OrnamentPad => ({ d, soort: "lijn", breedte: 0.5, kleur: BARST_INK }),
  ),
  ...KRASJES.map(
    (d): OrnamentPad => ({ d, soort: "lijn", breedte: 0.4, kleur: KRAS_INK }),
  ),
  { d: chevrons(), soort: "lijn", breedte: 0.85, kleur: CHEVRON_INK },
  ...SNIPPERS.map(
    (d): OrnamentPad => ({ d, soort: "vlak", kleur: SNIPPER_INK }),
  ),
] as const;

/** Motiefmaat: de pias-laag vult het vlak, dus geen breedte-/positie-truc zoals
 *  bij het GOAT-medaillon — de viewBox ís de kaart. */
export const PIAS_MOTIEF_VIEWBOX = "0 0 100 139";
