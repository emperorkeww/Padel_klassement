// Ornamenten van de Big Daddy-kaart (editie `icon`, #710): de feestelijke
// rosé-laag rondom het schild — kroon in de inkeping, glanzende linten achter
// de onderste zijkanten, edelsteen-ornament in de kaartpunt, twee ballonnen
// rechtsboven, wat gouden confetti — plus het kroon-watermerk ín het vlak.
//
// Eigen bestand naast futKaartOrnamenten.ts (waar de GOAT woont) zodat de twee
// toptier-ornamenten elkaar niet in de weg zitten; de strenggenerator
// `bouwStreng` en de gedeelde ornament-viewBox komen daar wél vandaan — een
// lint, een hoorn en een vleugel zijn allemaal "een taperende streng langs een
// centerlijn", en die wiskunde hoort één keer te bestaan.
//
// Eén bron voor twee tekenaars: FutKaart.tsx rendert deze paden als
// inline-SVG, futKaartCanvas.ts tekent ze als Path2D op de deel-poster. Omdat
// beide letterlijk dezelfde strings gebruiken, is de CSS↔canvas-pariteit hier
// by construction.
//
// Coördinaten: ornamenten in kaart-units (100 breed × 139 hoog, oorsprong
// linksboven op de kaart); het motief in zijn eigen 100×100-viewBox. Maten
// opgemeten uit de referentie in issue #710 — daar staat de kaart 614 × 854 px
// met de linkerbovenhoek op (120, 191,5).

import { bouwStreng, type OrnamentPad, type Streng } from "./futKaartOrnamenten";

const rond = (n: number) => Math.round(n * 100) / 100;

/* ---------------------------- symmetrie-helpers ---------------------------- */

type Punt = readonly [number, number];

/** Eén segment van een halve omtrek: een rechte of een cubic, absoluut. */
export type Cmd =
  | readonly ["L", number, number]
  | readonly ["C", number, number, number, number, number, number];

/** Bouwt een gesloten, om x=50 symmetrische omtrek uit één helft. De helft
 *  begint op de as, loopt langs de linkerflank en eindigt weer op de as; de
 *  terugweg is diezelfde helft achterstevoren met gespiegelde x. Zo kan een
 *  tik in de linkerhelft nooit een asymmetrie opleveren — dezelfde reden
 *  waarom de GOAT zijn hoorns uit één streng plus een <use>-spiegeling bouwt. */
export function symmetrischeOmtrek(
  start: Punt,
  half: readonly Cmd[],
): string {
  const sp = (x: number) => rond(100 - x);
  const eindpunt = (i: number): Punt => {
    if (i < 0) return start;
    const c = half[i];
    return c[0] === "L" ? [c[1], c[2]] : [c[5], c[6]];
  };
  const heen = half.map((c) =>
    c[0] === "L"
      ? `L ${c[1]} ${c[2]}`
      : `C ${c[1]} ${c[2]}, ${c[3]} ${c[4]}, ${c[5]} ${c[6]}`,
  );
  const terug: string[] = [];
  for (let i = half.length - 1; i >= 0; i--) {
    const c = half[i];
    const [vx, vy] = eindpunt(i - 1);
    terug.push(
      c[0] === "L"
        ? `L ${sp(vx)} ${vy}`
        : `C ${sp(c[3])} ${c[4]}, ${sp(c[1])} ${c[2]}, ${sp(vx)} ${vy}`,
    );
  }
  return `M ${start[0]} ${start[1]} ${heen.join(" ")} ${terug.join(" ")} Z`;
}

/** Cirkel als pad-string: <path> en Path2D kennen beide `A`, maar geen
 *  `<circle>`-equivalent dat je in één string kunt delen. */
export function cirkelPad({ cx, cy, r }: Bol): string {
  return `M ${rond(cx - r)} ${cy} A ${r} ${r} 0 1 0 ${rond(
    cx + r,
  )} ${cy} A ${r} ${r} 0 1 0 ${rond(cx - r)} ${cy} Z`;
}

/** Rechthoekige doos in kaart-units. */
export interface Doos {
  x: number;
  y: number;
  b: number;
  h: number;
}

/** Omhullende van een pad dat alleen M/L/C met absolute coördinaten gebruikt.
 *  Nodig omdat canvas geen `objectBoundingBox` kent: waar de DOM een gradient
 *  gewoon aan de vorm hangt, moet de poster de as zelf uitrekenen. De
 *  controlepunten tellen mee, dus de doos is iets ruim — voor een kleurverloop
 *  maakt dat niets uit. Niet geschikt voor de boogpaden uit `cirkelPad`. */
export function padDoos(d: string): Doos {
  const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) {
    xs.push(n[i]);
    ys.push(n[i + 1]);
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, b: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Een bolletje (kroonknop, ballon-glans): als data i.p.v. als pad, zodat de
 *  geometrietest zijn omhullende kan uitrekenen zonder booggetallen te
 *  moeten interpreteren. */
export interface Bol {
  cx: number;
  cy: number;
  r: number;
}

/* ------------------------------- materialen ------------------------------- */

/** Alles wat één getaperde streng aan kleur nodig heeft. De GOAT had deze
 *  waarden nog als losse constanten; met een tweede ornament in huis moeten
 *  FutStreng en strokeStreng kunnen wisselen van materiaal. */
export interface StrengMateriaal {
  /** id van de SVG-gradient in FutKaartDefs; canvas bouwt hem uit `verloop`. */
  gradientId: string;
  verloop: ReadonlyArray<readonly [number, string]>;
  /** Vaste verticale gradient-as in kaart-units [v1, v2] i.p.v. de omhullende
   *  van de streng zelf. Nodig zodra méér dan één streng samen één voorwerp
   *  vormt: het lint bestaat uit twee bogen, en met een as per boog zou de
   *  onderste boog integraal de gouden staart van het verloop krijgen — een
   *  gouden hoorn i.p.v. een doorlopend lint. */
  as?: readonly [number, number];
  contour: string;
  glans: string;
  ribbel: string;
  ribbelGlans: string;
  schaduw: string;
}

/** Roségoud/champagne: het metaal van kroon, punt-ornament en confetti. Warm
 *  maar niet geel — goud blijft accent, zoals de issue vraagt. */
export const BD_ROSEGOUD: ReadonlyArray<readonly [number, string]> = [
  [0, "#fdf1e3"],
  [0.32, "#f2cda6"],
  [0.66, "#d99a7c"],
  [1, "#a2545a"],
] as const;
/** Satijnlint: rozé voorzijde bovenaan die halverwege naar de champagne-gouden
 *  achterzijde draait en onderin weer rozé wordt — de ene draai die je in de
 *  referentie ziet, uitgedrukt als verloop over de kaarthoogte i.p.v. per
 *  streng (zie `as` hieronder). */
export const BD_LINT_VERLOOP: ReadonlyArray<readonly [number, string]> = [
  [0, "#fbd3e2"],
  [0.16, "#e07fa8"],
  [0.36, "#ad4470"],
  [0.54, "#d9a267"],
  [0.7, "#efd39a"],
  [0.86, "#c9789f"],
  [1, "#8e3a5e"],
] as const;
/** Donker framboos: de contour die alle rosé-onderdelen leesbaar houdt op de
 *  lichte kaart én op de donkere posterachtergrond. */
export const BD_CONTOUR = "#5e2038";
export const BD_GLANS = "rgba(255, 246, 250, 0.82)";
export const BD_SCHADUW = "rgba(94, 32, 56, 0.4)";
export const BD_RIBBEL = "rgba(94, 32, 56, 0.42)";
export const BD_RIBBELGLANS = "rgba(255, 240, 246, 0.45)";

export const BD_METAAL_MATERIAAL: StrengMateriaal = {
  gradientId: "fut-orn-bd-metaal",
  verloop: BD_ROSEGOUD,
  contour: BD_CONTOUR,
  glans: BD_GLANS,
  ribbel: BD_RIBBEL,
  ribbelGlans: BD_RIBBELGLANS,
  schaduw: BD_SCHADUW,
};
/** Gradient-as van het lint: van net onder de schouder tot onder de punt. */
export const BD_LINT_AS: readonly [number, number] = [50, 142];

export const BD_LINT_MATERIAAL: StrengMateriaal = {
  gradientId: "fut-orn-bd-lint",
  verloop: BD_LINT_VERLOOP,
  as: BD_LINT_AS,
  contour: BD_CONTOUR,
  glans: BD_GLANS,
  ribbel: BD_RIBBEL,
  ribbelGlans: BD_RIBBELGLANS,
  schaduw: BD_SCHADUW,
};

/** Edelsteen: framboos met een lichte tafel — dezelfde steen in de kroon
 *  bovenaan en in het ornament in de punt, zodat de twee bij elkaar horen. */
export const BD_STEEN_VERLOOP: ReadonlyArray<readonly [number, string]> = [
  [0, "#ffd9e8"],
  [0.42, "#ef7aa9"],
  [1, "#a41f57"],
] as const;
export const BD_STEEN_FACET = "rgba(255, 236, 244, 0.7)";

/* --------------------------- kroon in de inkeping -------------------------- */

// De kroon zit in de bovenrand, niet erboven: haar voet loopt bewust tot v=9,4
// door, dieper dan de laagste bovenrand die een divisie kan meebrengen (de
// spitse vleugels dippen in het midden tot v=8,1). Anders zou er onder een
// deel van de kroon een streepje achtergrond doorschijnen, want deze laag
// ligt vóór de kaart. Opgemeten in de referentie: u 42,0–57,5, top v≈−10,5.

/** Silhouet van de kroon: drie slanke punten met holle flanken op een
 *  voetband. De dalen lopen bewust diep door (v≈4,4) — met vlakke dalen leest
 *  het silhouet als een gezaagd blokje i.p.v. als een kroon. */
export const BD_KROON = symmetrischeOmtrek([50, -9.4], [
  // Middenpunt omlaag naar het linkerdal.
  ["C", 48.2, -5.2, 46.8, -0.6, 45.8, 4.4],
  // Dal omhoog naar de linkerpunt.
  ["C", 45.3, 1.2, 44.2, -1.8, 43.2, -4.2],
  // Linkerpunt omlaag langs de buitenflank naar de voet.
  ["C", 41.7, -1.4, 40.7, 2.6, 40.4, 6.4],
  ["L", 40.4, 9.4],
  ["L", 48, 9.4],
  // Klein puntje midden onder de voet, zoals in de referentie.
  ["L", 50, 11],
] as const);

/** Knoppen op de drie punten. De rechter is de gespiegelde linker, dus de
 *  kroon blijft symmetrisch ook als de linker verschuift. */
export const BD_KROON_BOLLEN: readonly Bol[] = (() => {
  const links: Bol = { cx: 43.2, cy: -5.4, r: 1.6 };
  return [
    links,
    { cx: 50, cy: -10.8, r: 2 },
    { cx: rond(100 - links.cx), cy: links.cy, r: links.r },
  ];
})();

/** Steen in de voetband, plus twee facetlijnen die de tafel aangeven. */
export const BD_KROON_STEEN = symmetrischeOmtrek([50, 2.4], [
  ["C", 49, 2.4, 48.1, 3.2, 47.8, 4.4],
  ["L", 47.4, 6.3],
  ["C", 47.4, 7.6, 48.7, 8.8, 50, 10],
] as const);
export const BD_KROON_STEEN_FACETTEN: readonly string[] = [
  "M 47.4 6.3 L 52.6 6.3",
  "M 47.8 4.4 L 52.2 4.4",
];
/** Groef en glans langs de voetband: zonder die twee lijnen leest de band als
 *  één plat vlak i.p.v. als gebogen metaal. De glans staat in twee stukken
 *  náást de steen — eroverheen zou hij de facetten platslaan. */
export const BD_KROON_BAND: readonly string[] = ["M 40.9 8.7 L 59.1 8.7"];
export const BD_KROON_BANDGLANS: readonly string[] = [
  "M 41.5 5.9 L 46.8 5.9",
  "M 53.2 5.9 L 58.5 5.9",
];

/* ---------------------- linten achter de onderste zijden ------------------- */

// Twee brede, langgerekte bogen per helft. Beide beginnen en eindigen áchter
// de kaart, dus wat je ziet zijn twee lintstukken die langs de flank naar
// buiten welven — de "gewoven" lezing van de referentie, terwijl deze hele
// laag achter de kaart ligt. Bewust langgerekt en niet rond: de kromming moet
// ruim boven de halve lintbreedte blijven, anders klapt de binnenflank van de
// omtrek door zichzelf heen (een bouwStreng offset een centerlijn, dus een
// bocht met een radius kleiner dan de dikte vouwt om). Nagenoeg geen taper
// (punt ≈ 0,55 × dikte): een lint houdt zijn breedte, anders leest het als een
// touw. Ribbels staan uit — de glans- en schaduwlijn doen het satijnwerk.
// Opgemeten: het lint komt tot u≈−12 en de staart tot v≈140.

/** Bovenste lintboog: welft langs de rechte flank naar buiten en duikt onder
 *  de taille weer achter de kaart. */
export const BD_LINT_BOOG = bouwStreng({
  start: [11, 57],
  segmenten: [
    [
      [1, 64],
      [-7.4, 74],
      [-8, 86],
    ],
    [
      [-8.6, 97],
      [1, 101],
      [10, 103],
    ],
  ],
  // Bandbreedte ~6,4 units, opgemeten uit de referentie. Met de dubbele dikte
  // die de eerste opzet had, las het lint als een handvat naast de kaart in
  // plaats van als satijn.
  dikte: 3.2,
  ribbels: 0,
  taper: 3.2,
  punt: 2.6,
  stappen: 84,
});

/** Onderste lintboog met de geknipte staart: volgt de schuine onderrand en
 *  eindigt vrij onder de kaart. Begint waar de bovenste boog verdwijnt, zodat
 *  de twee als één doorlopend lint lezen. */
export const BD_LINT_STAART = bouwStreng({
  start: [13, 106],
  segmenten: [
    [
      [3, 114],
      [-5, 123],
      [-5.2, 131],
    ],
    [
      [-5.4, 137],
      [4, 141.5],
      [13, 139],
    ],
  ],
  dikte: 3.1,
  ribbels: 0,
  taper: 2.8,
  punt: 2.2,
  stappen: 72,
});

/* --------------------- edelsteen-ornament in de kaartpunt ------------------ */

// Compact en symmetrisch rond de as: een steen in een gouden zetting met twee
// naar buiten krullende voluten, een speerpunt eronder, en twee lange dunne
// vleugels die vanaf de punt naar buiten-boven uitwaaieren. Opgemeten: het
// ornament reikt tot u≈36,5/63,5 en tot v≈151.

/** Zetting rond de steen plus de speerpunt eronder: één gesloten silhouet dat
 *  achter de schildpunt begint (v=136, dus onzichtbaar deel) en er onder
 *  uitkomt. */
export const BD_PUNT_ZETTING = symmetrischeOmtrek([50, 134.8], [
  ["C", 48, 135.8, 46.6, 137.4, 46.1, 139.6],
  // Volute: krult naar buiten-boven en weer terug — de "kroon"-lezing van het
  // ornament zonder dat er een tweede kroontje bij komt.
  ["C", 45.1, 137.8, 42.8, 137.2, 41.9, 139],
  ["C", 41, 140.8, 42.6, 142.6, 44.6, 141.9],
  ["C", 43.4, 143.2, 44.1, 144.6, 45.8, 145],
  ["C", 46.9, 146.9, 48.3, 149.2, 50, 152],
] as const);

/** Steen in de zetting: dezelfde ruit als in de kroon, hier iets langer. */
export const BD_PUNT_STEEN = symmetrischeOmtrek([50, 136.6], [
  ["C", 49.2, 136.6, 48.7, 137.3, 48.5, 138.3],
  ["L", 48.0, 139.6],
  ["C", 48.0, 141.0, 48.9, 142.9, 50, 144.6],
] as const);
export const BD_PUNT_STEEN_FACETTEN: readonly string[] = [
  "M 48 139.6 L 52 139.6",
  "M 48.5 138.3 L 51.5 138.3",
];

/** Vleugel: dunne, lange uitwaaiering vanaf de punt naar buiten-boven. Wortel
 *  dik bij de as, punt scherp aan de buitenkant. */
export const BD_PUNT_VLEUGEL = bouwStreng({
  start: [48.8, 149.8],
  segmenten: [
    [
      [46, 148],
      [42, 145.2],
      [39.2, 142.2],
    ],
    [
      [37.8, 140.8],
      [36.6, 139.9],
      [35.4, 139.2],
    ],
  ],
  dikte: 2.6,
  ribbels: 0,
  taper: 1.5,
  punt: 0.1,
  stappen: 40,
});

/* ------------------------- ballonnen en confetti --------------------------- */

/** Eén ballon: peervorm met een knoop en een touwtje dat achter de kaart
 *  verdwijnt. Bewust maar twee, en alleen rechtsboven: het feestaccent moet
 *  ondergeschikt blijven aan de kaart. */
export interface Ballon {
  id: string;
  /** Peervormige omtrek. */
  d: string;
  knoop: string;
  touw: string;
  /** Specular-veeg linksboven. */
  glans: Bol;
  verloop: ReadonlyArray<readonly [number, string]>;
  /** Omhullende, voor de gradient-as in DOM (objectBoundingBox) en canvas. */
  doos: { x: number; y: number; b: number; h: number };
}

/** Peervorm: een ellips die onderaan naar de knoop toe knijpt. */
function ballonPad(cx: number, cy: number, rx: number, ry: number): string {
  return [
    `M ${rond(cx)} ${rond(cy - ry)}`,
    `C ${rond(cx + rx * 1.05)} ${rond(cy - ry)} ${rond(cx + rx)} ${rond(
      cy + ry * 0.45,
    )} ${rond(cx + rx * 0.34)} ${rond(cy + ry * 0.93)}`,
    `C ${rond(cx + rx * 0.16)} ${rond(cy + ry)} ${rond(cx - rx * 0.16)} ${rond(
      cy + ry,
    )} ${rond(cx - rx * 0.34)} ${rond(cy + ry * 0.93)}`,
    `C ${rond(cx - rx)} ${rond(cy + ry * 0.45)} ${rond(cx - rx * 1.05)} ${rond(
      cy - ry,
    )} ${rond(cx)} ${rond(cy - ry)}`,
    "Z",
  ].join(" ");
}

function ballon(
  id: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  verloop: ReadonlyArray<readonly [number, string]>,
  touw: string,
): Ballon {
  const voet = cy + ry * 0.95;
  return {
    id,
    d: ballonPad(cx, cy, rx, ry),
    knoop: `M ${rond(cx - 1.1)} ${rond(voet)} L ${rond(cx + 1.1)} ${rond(
      voet,
    )} L ${rond(cx)} ${rond(voet + 2)} Z`,
    touw,
    glans: { cx: rond(cx - rx * 0.34), cy: rond(cy - ry * 0.38), r: rx * 0.26 },
    verloop,
    doos: {
      x: rond(cx - rx),
      y: rond(cy - ry),
      b: rond(rx * 2),
      h: rond(ry * 2 + 2),
    },
  };
}

/** Framboos achter, champagnegoud ervoor — dezelfde twee tinten als het frame,
 *  zodat de ballonnen bij de kaart horen i.p.v. erop geplakt lijken. */
export const BD_BALLON_ROZE: ReadonlyArray<readonly [number, string]> = [
  [0, "#f7aecb"],
  [0.42, "#cc4c82"],
  [1, "#8b2450"],
] as const;
export const BD_BALLON_GOUD: ReadonlyArray<readonly [number, string]> = [
  [0, "#f8e3ad"],
  [0.42, "#dab35f"],
  [1, "#8e6a2e"],
] as const;
export const BD_BALLON_TOUW = "rgba(200, 156, 96, 0.85)";
export const BD_BALLON_GLANS = "rgba(255, 252, 250, 0.55)";

export const BD_BALLONNEN: readonly Ballon[] = [
  ballon(
    "roze",
    100,
    -12,
    6.8,
    7.6,
    BD_BALLON_ROZE,
    "M 100 -2.6 C 99.4 3, 97.2 8.4, 93.6 14.4",
  ),
  ballon(
    "goud",
    104.4,
    -1.6,
    5.9,
    7.4,
    BD_BALLON_GOUD,
    "M 104.4 7.4 C 103.6 13.4, 101.4 19, 98 24.6",
  ),
];

/** Confetti: kleine gouden vlokjes, alleen buiten het schild — deze laag ligt
 *  achter de kaart, dus wat binnen het silhouet valt is toch onzichtbaar.
 *  Bewust een vaste, met de hand uitgebalanceerde lijst i.p.v. random: de
 *  deel-poster moet bij elke export dezelfde pixels geven. */
const CONFETTI_PLAATSING: ReadonlyArray<
  readonly [number, number, number, number, number]
> = [
  // [u, v, maat, hoek in graden, tint-index]
  [-9.5, 9, 2.6, 24, 0],
  [-15, 25, 2.2, -38, 1],
  [-21.5, 47, 2.9, 12, 0],
  [-13.5, 63, 2.1, 55, 1],
  [-19, 88, 2.6, -22, 0],
  [-11, 111, 2.3, 40, 1],
  [4, 131, 2.5, -14, 0],
  [26, 149, 2.1, 32, 1],
  [72, 151, 2.4, -28, 0],
  [92, 128, 2.2, 18, 1],
  [107, 104, 2.7, -44, 0],
  [117, 80, 2.3, 30, 1],
  [111, 56, 2.6, -10, 0],
  [119, 33, 2.1, 48, 1],
  [33, -13, 2.4, -34, 1],
  [63, -16, 2.2, 20, 0],
];

/** Twee tinten: champagne en een dieper goud, zodat de vlokjes niet als één
 *  vlakke sticker-set lezen. */
export const BD_CONFETTI_TINTEN = ["#f0d494", "#c79a4c"] as const;

export interface Confetti {
  d: string;
  kleur: string;
}

/** Een vlokje is een geroteerd, licht geperspectiveerd rechthoekje: de korte
 *  zijde half zo lang als de lange, plus een schuine schuiving — zo leest het
 *  als een tuimelend stukje folie i.p.v. als een blokje. */
export const BD_CONFETTI: readonly Confetti[] = CONFETTI_PLAATSING.map(
  ([u, v, maat, hoek, tint]) => {
    const rad = (hoek * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const hb = maat / 2;
    const hh = maat / 4;
    const hoeken: Punt[] = [
      [-hb, -hh],
      [hb - hh * 0.5, -hh],
      [hb, hh],
      [-hb + hh * 0.5, hh],
    ];
    const d = hoeken
      .map(([px, py], i) => {
        const x = rond(u + px * cos - py * sin);
        const y = rond(v + px * sin + py * cos);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
    return { d: `${d} Z`, kleur: BD_CONFETTI_TINTEN[tint] };
  },
);

/* --------------------------- kroon-watermerk (vlak) ----------------------- */

/** Watermerk ín het vlak: één grote kroon met vijf punten op een brede band,
 *  als gevulde vorm op zeer lage dekking. Geen lijntekening zoals het
 *  GOAT-medaillon: op het lichte parelroze vlak verdwijnt een dunne gravure,
 *  terwijl een vlak silhouet juist de "koninklijke" leesbaarheid van de
 *  referentie geeft. Eigen viewBox 0 0 100 100. */
// Twee vormen i.p.v. één silhouet: de punten als vulling, de voetband als
// omlijning. Als vulling werd die band een witte rechthoek achter de inkt —
// als hollow band leest hij als een gegraveerde kroonvoet en houdt het
// watermerk lucht.
const WATERMERK_PUNTEN = symmetrischeOmtrek([50, 4], [
  ["C", 47.6, 24, 44.6, 44, 43.2, 59],
  ["C", 40.8, 44, 36.6, 26, 32.4, 13],
  ["C", 29.8, 30, 27, 47, 25.6, 60],
  ["C", 21.4, 45, 15.8, 32, 10.4, 21],
  ["C", 9.4, 36, 8.8, 50, 8.8, 61],
  ["L", 50, 61],
] as const);

const WATERMERK_BAND = symmetrischeOmtrek([50, 61], [
  ["L", 8.8, 61],
  ["L", 8.2, 72],
  // Zachte hoek: een kroonband met een haakse hoek leest als een rechthoek.
  ["C", 8.2, 75, 9.6, 76.5, 12.6, 76.5],
  ["L", 50, 76.5],
] as const);

/** Drie stenen in de band — dezelfde plaatsing als op een echte kroonvoet, en
 *  net genoeg detail om het watermerk niet als silhouet te laten lezen. */
const WATERMERK_STENEN: readonly Bol[] = (() => {
  const links: Bol = { cx: 30, cy: 68.8, r: 2.1 };
  return [
    links,
    { cx: 50, cy: 68.8, r: 2.1 },
    { cx: rond(100 - links.cx), cy: links.cy, r: links.r },
  ];
})();

const WATERMERK_BOLLEN: readonly Bol[] = (() => {
  const buiten: Bol = { cx: 10.4, cy: 21, r: 2.6 };
  const binnen: Bol = { cx: 32.4, cy: 13, r: 2.8 };
  return [
    buiten,
    binnen,
    { cx: 50, cy: 4, r: 3.2 },
    { cx: rond(100 - binnen.cx), cy: binnen.cy, r: binnen.r },
    { cx: rond(100 - buiten.cx), cy: buiten.cy, r: buiten.r },
  ];
})();

export const BD_KROON_MOTIEF: readonly OrnamentPad[] = [
  { d: WATERMERK_PUNTEN, soort: "vlak", alpha: 0.7 },
  ...WATERMERK_BOLLEN.map(
    (b): OrnamentPad => ({ d: cirkelPad(b), soort: "vlak", alpha: 0.7 }),
  ),
  { d: WATERMERK_BAND, soort: "lijn", breedte: 1.6, alpha: 0.62 },
  ...WATERMERK_STENEN.map(
    (b): OrnamentPad => ({ d: cirkelPad(b), soort: "vlak", alpha: 0.5 }),
  ),
];

/** Parelwit op lage dekking: de kaart is lícht, dus een donker watermerk zou
 *  als vlek lezen. Wit tilt het vlak juist op waar de kroon staat. Effectief
 *  ~0,5 alpha over de vulling — genoeg om de vorm te lezen (op de lichtste
 *  bovenhelft van het vlak verdwijnt minder alpha volledig), te weinig om de
 *  inkt te storen; de sheen loopt er nog eens over. */
export const BD_KROON_MOTIEF_KLEUR = "rgba(255, 251, 253, 0.72)";
/** Motiefmaat: breedte als fractie van het vlak, positie als
 *  background-position-fractie (0.42 ≡ `center 42%`). Zo landt de kroon tussen
 *  de twee scheidingslijnen — in de referentie loopt hij van v≈34 tot v≈73 —
 *  en niet achter het eloblok, waar hij het getal zou storen. */
export const BD_KROON_MOTIEF_BREEDTE = 0.56;
export const BD_KROON_MOTIEF_POSITIE = 0.42;

/* ------------------------------ verzamelingen ----------------------------- */

/** Gradient-dozen van de gevulde ornamentvormen: de canvas-tegenhanger van
 *  `objectBoundingBox` in de DOM-defs. */
export const BD_KROON_DOOS = padDoos(BD_KROON);
export const BD_KROON_STEEN_DOOS = padDoos(BD_KROON_STEEN);
export const BD_PUNT_ZETTING_DOOS = padDoos(BD_PUNT_ZETTING);
export const BD_PUNT_STEEN_DOOS = padDoos(BD_PUNT_STEEN);

/** Alles wat áchter de kaart hoort en gespiegeld wordt (het lint). */
export const BD_ACHTER_STRENGEN: readonly Streng[] = [
  BD_LINT_BOOG,
  BD_LINT_STAART,
];
/** Alles wat vóór de kaart hoort en gespiegeld wordt (punt-vleugels). */
export const BD_VOOR_STRENGEN: readonly Streng[] = [BD_PUNT_VLEUGEL];
