// Ornament- en motiefpaden van de FUT-kaarten (#710): het geëtste watermerk
// ín het vlak en de ornamenten die búiten het schild uitsteken. Eén bron voor
// twee tekenaars: FutKaart.tsx rendert deze paden als inline-SVG,
// futKaartCanvas.ts tekent ze als Path2D op de deel-poster. Omdat beide
// letterlijk dezelfde strings gebruiken, is de CSS↔canvas-pariteit hier by
// construction — dezelfde aanpak als de vezeltegel van de pias (#705).
//
// De zware onderdelen (bokhoorns, baardornament) zijn niet met de hand
// uitgeschreven maar gegenereerd: je geeft een centerlijn en een dikteprofiel,
// en `bouwStreng` levert omtrek, ribbels en highlight. Dat houdt links en
// rechts per constructie identiek (rechts is de spiegeling om x=50), maakt de
// kromming navolgbaar, en voorkomt honderden regels handgeschreven pad-data.
//
// Coördinaten: motieven in een 100×100-viewBox (gecentreerd op het vlak);
// ornamenten in kaart-units (100 breed × 139 hoog) — de enige laag die niet
// door de schildclip gaat.

/** Symmetrische viewBox van de ornamentlaag: ruimte voor de hoorns (tot ~26
 *  units naast en ~34 boven de kaart) en het baardornament onder de punt. */
export const ORNAMENT_VIEWBOX = "-30 -38 160 212";
/** Dezelfde doos als fracties van de kaartmaat, voor de CSS-plaatsing van
 *  .fut-kaart__ornament (kaart = 100 × 139 units). */
export const ORNAMENT_DOOS = {
  links: -30 / 100,
  boven: -38 / 139,
  breedte: 160 / 100,
  hoogte: 212 / 139,
} as const;

/** Eén pad van een motief: een lijn (stroke) of een vlakje (fill). */
export interface OrnamentPad {
  d: string;
  soort: "lijn" | "vlak";
  /** Lijndikte in dezelfde units als het pad; alleen voor soort "lijn". */
  breedte?: number;
  /** Vermenigvuldiger op de laag-alpha (bv. 0.7 voor de ijlere ringbogen). */
  alpha?: number;
}

/* ------------------------- strenggenerator (#710) ------------------------- */

type Punt = readonly [number, number];
/** Eén cubic-segment: twee controlepunten en een eindpunt. De ketting begint
 *  bij `start` van de streng. */
type Segment = readonly [Punt, Punt, Punt];

/** Een getaperde streng: gevulde omtrek, dwarsribbels en glans/schaduw langs
 *  de flanken — samen lezen ze als geribbeld, rond metaal. Elke ribbel komt
 *  als paar (donkere groef + lichte rug ernaast); dát maakt het verschil
 *  tussen een touw met streepjes en een echte bokhoorn. */
export interface Streng {
  /** Gesloten omtrek (heen langs de ene flank, terug langs de andere). */
  omtrek: string;
  /** Donkere groeven dwars over de streng; leeg wanneer `ribbels: 0`. */
  ribbels: readonly string[];
  /** Lichte rug net naast elke groef, richting de punt. */
  ribbelGlans: readonly string[];
  /** Glanslijn net binnen de bolle flank. */
  highlight: string;
  /** Schaduwlijn net binnen de holle flank — geeft de streng rondte. */
  schaduw: string;
  /** Verticale grenzen, voor het kleurverloop op canvas. */
  bbox: { yMin: number; yMax: number };
}

interface StrengOpties {
  start: Punt;
  segmenten: readonly Segment[];
  /** Halve dikte bij de wortel. */
  dikte: number;
  /** Aantal dwarsribbels (0 = glad). */
  ribbels?: number;
  /** Exponent van de taper: hoger = langer dik, korter spits. */
  taper?: number;
  /** Halve dikte bij de punt (0 = scherp). */
  punt?: number;
  /** Aantal samples over de hele lengte. */
  stappen?: number;
}

function cubic(p0: Punt, s: Segment, t: number): Punt {
  const [c1, c2, p3] = s;
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

const rond = (n: number) => Math.round(n * 100) / 100;

/** Sampelt de centerlijn, zet er loodrecht een taperende dikte omheen en
 *  levert omtrek, ribbels en highlight als pad-strings. */
export function bouwStreng({
  start,
  segmenten,
  dikte,
  ribbels = 0,
  taper = 1.6,
  punt = 0.15,
  stappen = 72,
}: StrengOpties): Streng {
  // Centerlijn uitrollen over alle segmenten.
  const punten: Punt[] = [];
  for (let i = 0; i <= stappen; i++) {
    const g = (i / stappen) * segmenten.length;
    const idx = Math.min(Math.floor(g), segmenten.length - 1);
    const lokaal = g - idx;
    const p0 = idx === 0 ? start : segmenten[idx - 1][2];
    punten.push(cubic(p0, segmenten[idx], lokaal));
  }

  // Normaal per punt (uit de lokale richting) en de halve dikte daar.
  const normaal = (i: number): Punt => {
    const a = punten[Math.max(0, i - 1)];
    const b = punten[Math.min(punten.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  };
  const halfDik = (i: number) => {
    const t = i / stappen;
    return punt + (dikte - punt) * (1 - Math.pow(t, taper));
  };

  const links: Punt[] = [];
  const rechts: Punt[] = [];
  for (let i = 0; i < punten.length; i++) {
    const [nx, ny] = normaal(i);
    const h = halfDik(i);
    links.push([punten[i][0] + nx * h, punten[i][1] + ny * h]);
    rechts.push([punten[i][0] - nx * h, punten[i][1] - ny * h]);
  }

  const lijn = (ps: Punt[]) =>
    ps.map((p) => `${rond(p[0])} ${rond(p[1])}`).join(" L ");
  const omtrek = `M ${lijn(links)} L ${lijn([...rechts].reverse())} Z`;

  // Ribbels: groeiringen dwars over de streng, dichter naar de punt toe. Elke
  // ring is een donkere groef met een lichte rug ernaast (één sample verder
  // richting de punt) — dat leest als geribbeld rond metaal i.p.v. streepjes.
  const groeven: string[] = [];
  const ruggen: string[] = [];
  const dwars = (i: number, f: number) => {
    const [nx, ny] = normaal(i);
    const h = halfDik(i) * f;
    return `M ${rond(punten[i][0] + nx * h)} ${rond(
      punten[i][1] + ny * h,
    )} L ${rond(punten[i][0] - nx * h)} ${rond(punten[i][1] - ny * h)}`;
  };
  for (let r = 1; r <= ribbels; r++) {
    const t = Math.pow(r / (ribbels + 1), 0.82);
    const i = Math.round(t * stappen);
    if (i >= punten.length - 3) continue;
    groeven.push(dwars(i, 0.92));
    ruggen.push(dwars(Math.min(i + 1, punten.length - 1), 0.74));
  }

  // Glans binnen de bolle flank, schaduw binnen de holle — samen geven ze de
  // streng rondte. Beide lopen over de eerste ~85%, waar de streng nog dik is.
  const tot = Math.round(stappen * 0.85);
  const glans: Punt[] = [];
  const schaduw: Punt[] = [];
  for (let i = 0; i <= tot; i++) {
    const [nx, ny] = normaal(i);
    const hg = halfDik(i) * 0.5;
    const hs = halfDik(i) * 0.62;
    glans.push([punten[i][0] + nx * hg, punten[i][1] + ny * hg]);
    schaduw.push([punten[i][0] - nx * hs, punten[i][1] - ny * hs]);
  }

  const ys = [...links, ...rechts].map((p) => p[1]);
  return {
    omtrek,
    ribbels: groeven,
    ribbelGlans: ruggen,
    highlight: `M ${lijn(glans)}`,
    schaduw: `M ${lijn(schaduw)}`,
    bbox: { yMin: Math.min(...ys), yMax: Math.max(...ys) },
  };
}

/* ------------------------------ GOAT (#710) ------------------------------ */

/** Linker bokhoorn: komt achter de schouder vandaan, zwiept over de bovenrand
 *  naar buiten, krult langs de zijkant omlaag en eindigt met de punt naar
 *  binnen — de ~270°-krul van de referentie. Rechts is de spiegeling om x=50,
 *  dus links en rechts zijn per constructie identiek. */
export const GOAT_HOORN = bouwStreng({
  // Maten opgemeten uit de referentie (issue #710), in kaart-units met de
  // kaartlinkerrand op u=0 en de bovenrand op v=0: buitenrand tot u≈−17,5 op
  // v≈+2, top van de boog op v≈−16,5, punt rond (−12,5 · +15,5), en een
  // volle dikte van ~6 bij de boogtop die naar de punt toe uitloopt.
  start: [24, 14],
  segmenten: [
    [
      [17, 3],
      [7.5, -8],
      [0, -13.4],
    ],
    [
      [-8, -15.5],
      [-15.5, -9],
      [-15.8, 2],
    ],
    [
      [-16, 7.5],
      [-15, 10],
      [-13.5, 12],
    ],
    [
      [-12.8, 14],
      [-12, 15.6],
      [-11, 16.5],
    ],
  ],
  dikte: 4.2,
  ribbels: 24,
  taper: 1.15,
  punt: 0.15,
});

/** Baardornament onder de schildpunt: een strak, symmetrisch filigraan dat uit
 *  de punt groeit — heraldisch van opbouw, maar met de silhouetlezing van een
 *  gestileerde sik. Vier strengen per helft plus één op de as: twee flicks die
 *  naar buiten-boven wijzen (de "krul" van de baard) en twee die met de punt
 *  meelopen. */
// Baardornament (referentie #710): géén losse strengen maar één massief,
// symmetrisch blad dat uit de schildpunt groeit — met twee kleine lobben op
// de flanken, gegraveerde nerven erin en twee opkrullende flicks op de
// schouders. Envelop opgemeten: halve breedte ~9 units, van v≈132 (verstopt
// achter de punt) tot v≈156. Strak heraldisch, geen harige baard.

/** Halve omtrek van het baardblad: van de as bovenaan, langs de linkerflank
 *  naar de as onderaan. De volle omtrek is deze helft plus zijn spiegeling —
 *  zo is het blad per constructie symmetrisch. */
const BAARD_HALVE_OMTREK = [
  // Snel breed worden onder de flicks: de referentie is het breedst rond
  // v≈140 en loopt daarna strak naar de punt toe.
  "C 46.8 133.2, 43.6 134.8, 42.2 137.6",
  "C 41.2 140.4, 40.8 143.6, 41.2 146.6",
  // Lob: het kleine punt dat opzij uit het blad steekt.
  "L 38.9 145.8",
  "C 39.8 149.6, 42.6 152.9, 46.5 155.8",
  "C 47.6 156.6, 48.7 157.3, 50 158",
].join(" ");

/** Spiegelt een pad-string om x=50 en keert de richting om, zodat hij achter
 *  de originele helft aan sluit tot één gesloten omtrek. Alleen de commando's
 *  die hier voorkomen (C en L, absolute coördinaten). */
function spiegelTerug(halve: string): string {
  const tokens = halve.trim().split(/\s+/);
  const segmenten: { cmd: string; punten: number[] }[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    const aantal = cmd === "C" ? 6 : 2;
    const punten: number[] = [];
    for (let k = 0; k < aantal; k++)
      punten.push(Number(tokens[i++].replace(",", "")));
    segmenten.push({ cmd, punten });
  }
  // Achterstevoren doorlopen: elk segment eindigt waar het vorige begon.
  const uit: string[] = [];
  for (let k = segmenten.length - 1; k >= 0; k--) {
    const { cmd, punten } = segmenten[k];
    const spiegel = (x: number) => rond(100 - x);
    if (cmd === "C") {
      // Eindpunt van het vorige segment is het startpunt hier; de twee
      // controlepunten wisselen van volgorde.
      const vorig = k === 0 ? [50, 132.5] : segmenten[k - 1].punten.slice(-2);
      uit.push(
        `C ${spiegel(punten[2])} ${punten[3]}, ${spiegel(punten[0])} ${
          punten[1]
        }, ${spiegel(vorig[0])} ${vorig[1]}`,
      );
    } else {
      const vorig = k === 0 ? [50, 132.5] : segmenten[k - 1].punten.slice(-2);
      uit.push(`L ${spiegel(vorig[0])} ${vorig[1]}`);
    }
  }
  return uit.join(" ");
}

/** Het gesloten baardblad: van de aspunt bovenaan langs links omlaag, en
 *  gespiegeld weer omhoog. */
export const GOAT_BAARD_BLAD = `M 50 132.5 ${BAARD_HALVE_OMTREK} ${spiegelTerug(
  BAARD_HALVE_OMTREK,
)} Z`;

/** Gegraveerde nerven in het blad: vijf lijnen die met de taper meelopen —
 *  de "haren" van de sik, maar als gravure. Symmetrisch rond de as. */
export const GOAT_BAARD_NERVEN: readonly string[] = [-2, -1, 0, 1, 2].map(
  (k) => {
    const top = 50 + k * 2.3;
    const mid = 50 + k * 2.1;
    const eind = 50 + k * 0.9;
    return `M ${rond(top)} 135 C ${rond(mid)} 141, ${rond(
      mid,
    )} 147, ${rond(eind)} 154`;
  },
);

/** De twee flicks op de schouders van het blad: kleine opkrullende hoorntjes
 *  die naar buiten-boven wijzen. Eén helft; rechts is de spiegeling. */
export const GOAT_BAARD_FLICK = bouwStreng({
  // Bewust láág aangezet (v≈138 → 134,6): hoger langs de schildrand is de
  // kaart nog breed genoeg om de flick op te slokken — de ornamentlaag ligt
  // immers áchter het schild. Op deze hoogte loopt het schild al naar de punt
  // en steekt de krul er vrij naast uit, net als in de referentie.
  start: [46.8, 139.6],
  segmenten: [
    [
      [43.6, 139],
      [40.4, 137.6],
      [38.6, 135],
    ],
    [
      [37.4, 134],
      [36.6, 133.2],
      [36.1, 132.2],
    ],
  ],
  dikte: 1.9,
  ribbels: 5,
  taper: 1.2,
  punt: 0.08,
  stappen: 26,
});

/** Rosé-metaal: verloop van boven naar onder, donkere contour, lichte glans.
 *  Gedeeld door hoorns en baard, en door DOM en canvas. */
export const GOAT_METAAL_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "#f9d3de"],
  [0.35, "#e79ab2"],
  [0.72, "#c2637f"],
  [1, "#8d3b52"],
] as const;
export const GOAT_METAAL_CONTOUR = "#4f1a2b";
export const GOAT_METAAL_GLANS = "rgba(255, 232, 240, 0.75)";
export const GOAT_METAAL_RIBBEL = "rgba(79, 26, 43, 0.5)";
/** Lichte rug naast elke groef, en de schaduw langs de holle flank. */
export const GOAT_METAAL_RIBBELGLANS = "rgba(255, 226, 236, 0.45)";
export const GOAT_METAAL_SCHADUW = "rgba(90, 30, 48, 0.42)";

/** Vlak-motief: geëtst geiten-medaillon — kop met hoorns in een dubbele ring —
 *  plus twee grote trofee-ringbogen (TOTY-taal), als één gegraveerde
 *  lijntekening. ViewBox 0 0 100 100. */
export const GOAT_MEDAILLON: readonly OrnamentPad[] = [
  { d: "M 13 50 A 37 37 0 1 1 87 50 A 37 37 0 1 1 13 50", soort: "lijn", breedte: 1.3 },
  {
    d: "M 16.5 50 A 33.5 33.5 0 1 1 83.5 50 A 33.5 33.5 0 1 1 16.5 50",
    soort: "lijn",
    breedte: 0.6,
    alpha: 0.8,
  },
  { d: "M 50 4 A 46 46 0 0 1 96 50", soort: "lijn", breedte: 0.8, alpha: 0.7 },
  { d: "M 57 9.5 A 41 41 0 0 1 91 43", soort: "lijn", breedte: 0.5, alpha: 0.7 },
  {
    d: "M 43.5 40 C 41 24 27 14 18 21 C 10 27 13 41 24 43 C 17 38 16 28 23 24.5 C 31 20.5 39 28 41.5 41",
    soort: "lijn",
    breedte: 1.3,
  },
  {
    d: "M 56.5 40 C 59 24 73 14 82 21 C 90 27 87 41 76 43 C 83 38 84 28 77 24.5 C 69 20.5 61 28 58.5 41",
    soort: "lijn",
    breedte: 1.3,
  },
  {
    d: "M 43.5 40 C 41.5 49 42.5 57 46 63 L 49 69.5 C 49.7 71 50.3 71 51 69.5 L 54 63 C 57.5 57 58.5 49 56.5 40 C 52 36.5 48 36.5 43.5 40 Z",
    soort: "lijn",
    breedte: 1.3,
  },
  { d: "M 42.5 43 L 35 48.5", soort: "lijn", breedte: 1.3 },
  { d: "M 57.5 43 L 65 48.5", soort: "lijn", breedte: 1.3 },
  { d: "M 50 71 L 50 78", soort: "lijn", breedte: 1.3 },
  { d: "M 44.4 47 A 1.2 1.2 0 1 1 46.8 47 A 1.2 1.2 0 1 1 44.4 47", soort: "vlak" },
  { d: "M 53.2 47 A 1.2 1.2 0 1 1 55.6 47 A 1.2 1.2 0 1 1 53.2 47", soort: "vlak" },
] as const;

/** Etskleur van het medaillon: de GOAT-inkt op lage alpha. */
export const GOAT_MEDAILLON_KLEUR = "rgba(249, 163, 183, 0.16)";
/** Motiefmaat: breedte als fractie van het vlak, en de verticale positie als
 *  background-position-percentage (0.2 ≡ `center 20%`). */
export const GOAT_MEDAILLON_BREEDTE = 0.92;
export const GOAT_MEDAILLON_POSITIE = 0.2;

/* --------------------------- El Padelissimo (#710) --------------------------- */

/** Antiekgoud: warm champagne naar diep brons — bewust geen fel plastic goud
 *  (stijlbeperking uit de referentie-instructies). */
export const DICTATOR_GOUD_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "#f6e6b4"],
  [0.34, "#d9b661"],
  [0.68, "#a8802f"],
  [1, "#6b4d18"],
] as const;
export const DICTATOR_GOUD_CONTOUR = "#3c2a0c";
export const DICTATOR_GOUD_GLANS = "rgba(255, 246, 214, 0.7)";
export const DICTATOR_GOUD_SCHADUW = "rgba(52, 36, 10, 0.5)";
/** Donkerrode edelsteenaccenten in de gouden omlijsting. */
export const DICTATOR_GEM = "#7e1228";
export const DICTATOR_GEM_GLANS = "rgba(255, 170, 190, 0.55)";

/** Spiegelhulp voor de handgeschreven ornamenten: een polyline-helft (alleen
 *  L-commando's) omgekeerd en gespiegeld om x=50, zodat de tweede helft per
 *  constructie gelijk is aan de eerste. */
function spiegelPolyline(punten: readonly Punt[]): string {
  return [...punten]
    .reverse()
    .map((p) => `L ${rond(100 - p[0])} ${rond(p[1])}`)
    .join(" ");
}

/** Vijfpuntige ceremoniële kroon die in de bovenrand van het schild zit: band
 *  onderaan, vijf punten met bolknoppen, de middelste het hoogst. Alleen de
 *  linkerhelft plus de as staat hier; `spiegelPolyline` maakt de rechterhelft. */
const KROON_HELFT: readonly Punt[] = [
  [23, 1.5],
  [23, -5.5],
  [29.5, -16.5],
  [34.5, -5.5],
  [40, -22.5],
  [45, -7.5],
  [50, -28.5],
];
export const DICTATOR_KROON = `M ${KROON_HELFT.map(
  (p) => `${p[0]} ${p[1]}`,
).join(" L ")} ${spiegelPolyline(KROON_HELFT.slice(0, -1))} Z`;

/** De band onder de kroonpunten — één doorlopend beslag over de bovenrand. */
export const DICTATOR_KROON_BAND =
  "M 21 -1 L 79 -1 L 79 4.5 L 76 6 L 24 6 L 21 4.5 Z";

/** Bolknoppen op de kroonpunten (links + as; rechts wordt gespiegeld). */
export const DICTATOR_KROON_BOLLEN: readonly (readonly [
  number,
  number,
  number,
])[] = [
  [29.5, -18.6, 2],
  [40, -24.6, 2.2],
  [50, -30.8, 2.6],
] as const;

/** Edelstenen: twee in de band, één in elke kroonvallei. Ruitvormig, zoals de
 *  referentie — links + as, rechts gespiegeld. */
export const DICTATOR_GEMS: readonly string[] = [
  "M 34.5 -3.4 L 36 -1.6 L 34.5 0.2 L 33 -1.6 Z",
  "M 45 -5.4 L 46.5 -3.6 L 45 -1.8 L 43.5 -3.6 Z",
  "M 50 -1.4 L 52 1 L 50 3.4 L 48 1 Z",
] as const;

/** Epaulet: het schouderstuk dat achter de bovenste zijkant uitsteekt. Eén
 *  gebogen band met een franjerand eronder — links; rechts gespiegeld. */
export const DICTATOR_EPAULET =
  "M 6 32 C -1 32.5, -7.5 34.5, -11.5 38.2 C -12.4 39.1, -12.2 40.4, -11 41 " +
  "C -6.6 43.2, -1 44.4, 6 44.6 Z";
/** Franjekwasten onder de epaulet: korte, iets waaierende strengen. */
export const DICTATOR_EPAULET_FRANJE: readonly string[] = [
  -10.2, -7.6, -5, -2.4, 0.2, 2.8,
].map((u, i) => {
  const lengte = 11 - Math.abs(i - 2.5) * 1.1;
  return `M ${rond(u)} 43.6 C ${rond(u - 0.6)} ${rond(43.6 + lengte * 0.5)}, ${rond(
    u - 0.9,
  )} ${rond(43.6 + lengte * 0.8)}, ${rond(u - 1.1)} ${rond(43.6 + lengte)}`;
});

/** Lauwerkrans: de tak loopt vanaf de kaartpunt langs de zijkant omhoog. De
 *  stengel komt uit `bouwStreng` (zelfde generator als de GOAT-hoorn), de
 *  blaadjes staan er als losse spitse vormen langs. */
export const DICTATOR_LAUWER_STENGEL = bouwStreng({
  // De tak hugt de schildrand: op v≈84 loopt de kaart tot u=0, dus een stengel
  // op u≈4 laat de buitenste blaadjes er nét overheen steken — precies wat de
  // referentie doet. Verder naar binnen leest de krans als los ornament.
  start: [47, 141],
  segmenten: [
    [
      [37, 138],
      [25, 131],
      [16, 120],
    ],
    [
      [9, 110],
      [4, 97],
      [4, 83],
    ],
    [
      [4, 75],
      [5, 68],
      [6.5, 62],
    ],
  ],
  dikte: 1.6,
  taper: 2.2,
  punt: 0.35,
  stappen: 60,
});

/** Eén lauwerblad: spitse ovaal met een nerf, geplaatst en gedraaid langs de
 *  tak. `[u, v, hoek, lengte]` — hoek in graden, 0 = naar rechts. */
const LAUWER_BLADEN: readonly (readonly [number, number, number, number])[] = [
  // Buitenste rij: elk blad staat ~40° van de takrichting af en steekt zo over
  // de schildrand heen — een krans, geen rij blaadjes langs een lijn.
  [42.5, 139.5, 200, 9],
  [34, 135.5, 205, 9.6],
  [26, 130.5, 212, 10.4],
  [19, 124, 220, 10.6],
  [12.5, 115.5, 228, 10.8],
  [7.5, 106, 234, 10.8],
  [4, 96, 238, 10.6],
  [2.5, 85.5, 242, 10.2],
  [2.5, 75.5, 246, 9.6],
  [4, 66.5, 250, 9],
  // Binnenste rij: korter, tegen de tak aan, over de kaart.
  [32, 132, 160, 6.4],
  [23, 126.5, 172, 6.6],
  [15, 118.5, 186, 6.6],
  [10, 108.5, 198, 6.4],
  [7.5, 97.5, 208, 6],
  [7, 86.5, 214, 5.6],
] as const;

/** Bouwt één blad als gesloten pad met twee bogen (spitse ovaal). */
function lauwerBlad(u: number, v: number, hoek: number, lengte: number): string {
  const r = (hoek * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const breed = lengte * 0.34;
  const P = (langs: number, dwars: number) =>
    `${rond(u + langs * cos - dwars * sin)} ${rond(v + langs * sin + dwars * cos)}`;
  return `M ${P(0, 0)} C ${P(lengte * 0.3, breed)} ${P(lengte * 0.72, breed * 0.8)} ${P(
    lengte,
    0,
  )} C ${P(lengte * 0.72, -breed * 0.8)} ${P(lengte * 0.3, -breed)} ${P(0, 0)} Z`;
}

export const DICTATOR_LAUWER_BLADEN: readonly string[] = LAUWER_BLADEN.map(
  ([u, v, hoek, lengte]) => lauwerBlad(u, v, hoek, lengte),
);

/** Lakzegel-medaillon in de kaartpunt: ring, zegelvlak en een ster. */
export const DICTATOR_ZEGEL = {
  midden: [50, 124] as const,
  ring: 9.4,
  vlak: 7.2,
  /** Vijfpuntige ster, gecentreerd op het zegel. */
  ster: (() => {
    const punten: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 4.4 : 1.9;
      const hoek = (-90 + i * 36) * (Math.PI / 180);
      punten.push(
        `${rond(50 + Math.cos(hoek) * r)} ${rond(124 + Math.sin(hoek) * r)}`,
      );
    }
    return `M ${punten.join(" L ")} Z`;
  })(),
  /** Drie kleine bollen onder het zegel, in de punt van het schild. */
  bollen: [
    [50, 135.5, 2.1],
    [44.6, 133, 1.5],
    [55.4, 133, 1.5],
  ] as const,
} as const;

/** Watermark achter de spelerinformatie: een nauwelijks zichtbare kroon met
 *  lauwertakken — de "troon-crest" uit de referentie. ViewBox 0 0 100 100. */
export const DICTATOR_WATERMARK: readonly OrnamentPad[] = [
  // Kroonsilhouet.
  {
    d: "M 30 62 L 30 44 L 39 55 L 50 36 L 61 55 L 70 44 L 70 62 Z",
    soort: "lijn",
    breedte: 1.6,
  },
  { d: "M 31 67 L 69 67 L 68 73 L 32 73 Z", soort: "lijn", breedte: 1.6 },
  { d: "M 28 41 A 2.6 2.6 0 1 1 33.2 41 A 2.6 2.6 0 1 1 28 41", soort: "vlak" },
  { d: "M 47.4 32 A 2.8 2.8 0 1 1 53 32 A 2.8 2.8 0 1 1 47.4 32", soort: "vlak" },
  { d: "M 66.8 41 A 2.6 2.6 0 1 1 72 41 A 2.6 2.6 0 1 1 66.8 41", soort: "vlak" },
  // Lauwertakken eromheen.
  { d: "M 50 92 C 30 86 17 70 18 50", soort: "lijn", breedte: 1.2 },
  { d: "M 50 92 C 70 86 83 70 82 50", soort: "lijn", breedte: 1.2 },
] as const;

export const DICTATOR_WATERMARK_KLEUR = "rgba(240, 199, 102, 0.09)";
export const DICTATOR_WATERMARK_BREEDTE = 0.78;
export const DICTATOR_WATERMARK_POSITIE = 0.42;
