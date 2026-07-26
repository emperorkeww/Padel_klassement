// Ornamenten van de Zwarte Piet-kaart (#710, referentie in issue #710): de
// verzegelde schuldfiche. Zelfde tweedeling als de GOAT-ornamenten in
// futKaartOrnamenten.ts — pad-strings hier, tekenwerk in FutKaart.tsx (DOM) en
// futKaartCanvas.ts (deel-poster) — zodat beide lezers letterlijk dezelfde
// geometrie krijgen en de CSS↔canvas-pariteit by construction klopt.
//
// Bewust een eigen module i.p.v. uitbreiding van futKaartOrnamenten.ts: die
// deelt alleen de generatoren (`bouwStreng`) en het viewBox-contract, en blijft
// zo vrij van de kaart-specifieke maatvoering van drie parallelle #710-kaarten.
//
// Waarom deze motieven: de Piet is een rondgaand schande-token dat je pas
// kwijtraakt door te winnen. Die metafoor zit in drie dingen, en die drie
// dingen zijn dan ook de ornamenten: kettingen die het token aan de drager
// vastleggen, een gebroken zegel in de onderpunt (de fiche ís al eens
// doorgegeven) en — belangrijk — twee geopende sluitingen: het slot kán open.
// De identiteit blijft volledig abstract: speelstukken, kaarttekens, ketting en
// zegel. Geen figuur, geen karikatuur (zie de stijlbeperkingen in #710).
//
// Coördinaten: ornamenten in kaart-units (100 breed × 139 hoog, oorsprong
// linksboven op de kaart), motief in de eigen 100×100-viewBox. De ornamentlaag
// gebruikt dezelfde ORNAMENT_VIEWBOX als de GOAT, dus de CSS-plaatsing van
// .fut-kaart__ornament geldt onveranderd.

import { bouwStreng, type OrnamentPad, type Streng } from "./futKaartOrnamenten";

type Punt = readonly [number, number];
/** Eén cubic-segment: twee controlepunten en een eindpunt. */
type Segment = readonly [Punt, Punt, Punt];

const rond = (n: number) => Math.round(n * 100) / 100;
const P = (x: number, y: number) => `${rond(x)} ${rond(y)}`;

/* ---------------------------- gedeelde vormen ---------------------------- */

/** Cirkel als pad (twee halve bogen) — Path2D en SVG lezen dit identiek, dus
 *  DOM en canvas krijgen dezelfde cirkel zonder een eigen arc-API. */
function cirkel(cx: number, cy: number, r: number): string {
  return `M ${P(cx - r, cy)} A ${rond(r)} ${rond(r)} 0 1 1 ${P(
    cx + r,
    cy,
  )} A ${rond(r)} ${rond(r)} 0 1 1 ${P(cx - r, cy)} Z`;
}

/** Boog van `van` naar `tot` graden (schermhoeken, y omlaag) om (cx, cy).
 *  Gebruikt voor de open sluiting en voor de twee zegelhelften. */
function boog(
  cx: number,
  cy: number,
  r: number,
  van: number,
  tot: number,
): string {
  const p = (g: number): Punt => [
    cx + Math.cos((g * Math.PI) / 180) * r,
    cy + Math.sin((g * Math.PI) / 180) * r,
  ];
  const groot = Math.abs(tot - van) > 180 ? 1 : 0;
  const richting = tot > van ? 1 : 0;
  const a = p(van);
  const b = p(tot);
  return `M ${P(a[0], a[1])} A ${rond(r)} ${rond(
    r,
  )} 0 ${groot} ${richting} ${P(b[0], b[1])}`;
}

/** Geroteerde ellips als pad: de vorm van één kettingschakel. */
function ellips(
  cx: number,
  cy: number,
  a: number,
  b: number,
  graden: number,
): string {
  const t = (graden * Math.PI) / 180;
  const dx = Math.cos(t) * a;
  const dy = Math.sin(t) * a;
  const bogen = `A ${rond(a)} ${rond(b)} ${rond(graden)} 1 1`;
  return `M ${P(cx - dx, cy - dy)} ${bogen} ${P(
    cx + dx,
    cy + dy,
  )} ${bogen} ${P(cx - dx, cy - dy)} Z`;
}

/** Eén helft van een symmetrische vorm, uitgeschreven als segmenten links van
 *  de as. `spiegelHalf` sluit de tweede helft er achterstevoren aan vast, zodat
 *  de vorm per constructie symmetrisch is — dezelfde truc als het baardblad
 *  van de GOAT, maar hier op relatieve coördinaten (as = x 0). */
type HalfSegment =
  | { readonly lijn: Punt }
  | { readonly c1: Punt; readonly c2: Punt; readonly p: Punt };

/** Bouwt een gesloten, symmetrisch pad: van `start` op de as langs de
 *  linkerhelft omlaag en gespiegeld weer omhoog. */
function spiegelHalf(
  start: Punt,
  segmenten: readonly HalfSegment[],
  X: (x: number) => number,
  Y: (y: number) => number,
): string {
  const uit = [`M ${P(X(start[0]), Y(start[1]))}`];
  for (const s of segmenten) {
    if ("lijn" in s) uit.push(`L ${P(X(s.lijn[0]), Y(s.lijn[1]))}`);
    else
      uit.push(
        `C ${P(X(s.c1[0]), Y(s.c1[1]))}, ${P(X(s.c2[0]), Y(s.c2[1]))}, ${P(
          X(s.p[0]),
          Y(s.p[1]),
        )}`,
      );
  }
  // Terug omhoog: elk segment omgekeerd, met de x-coördinaten gespiegeld.
  for (let i = segmenten.length - 1; i >= 0; i--) {
    const vorige = i === 0 ? start : eindpunt(segmenten[i - 1]);
    const s = segmenten[i];
    if ("lijn" in s) uit.push(`L ${P(X(-vorige[0]), Y(vorige[1]))}`);
    else
      uit.push(
        `C ${P(X(-s.c2[0]), Y(s.c2[1]))}, ${P(X(-s.c1[0]), Y(s.c1[1]))}, ${P(
          X(-vorige[0]),
          Y(vorige[1]),
        )}`,
      );
  }
  return `${uit.join(" ")} Z`;
}

const eindpunt = (s: HalfSegment): Punt => ("lijn" in s ? s.lijn : s.p);

/** Pion-silhouet: bal, kraag, taps lijf en brede voet, symmetrisch om de as.
 *  Eén generator voor drie maten — de crest bovenaan, de twee stukken in het
 *  zegel en de grote pion in het watermerk dragen dus letterlijk dezelfde
 *  vorm. `hoogte` is de volle hoogte (balbovenkant tot voetzool). */
export function pionPad(cx: number, cy: number, hoogte: number): string {
  // Normaalmaat: 95 hoog (bal op y 0, zool op y 94), 48 breed.
  const s = hoogte / 95;
  const X = (x: number) => cx + x * s;
  const Y = (y: number) => cy - hoogte / 2 + (y + 1) * s;
  const lijf = spiegelHalf(
    [0, 26],
    [
      { c1: [-4, 26], c2: [-6, 30], p: [-7, 33] },
      { c1: [-8, 35], c2: [-11, 36], p: [-13, 39] },
      { lijn: [-11, 43] },
      { c1: [-9, 52], c2: [-8, 62], p: [-11, 70] },
      { c1: [-14, 76], c2: [-18, 80], p: [-21, 84] },
      { lijn: [-24, 89] },
      { lijn: [-24, 94] },
      { lijn: [0, 94] },
    ],
    X,
    Y,
  );
  return `${cirkel(X(0), Y(14), 15 * s)} ${lijf}`;
}

/** Kaartteken als pad, genormaliseerd op een halve hoogte van 1 en
 *  gecentreerd op (cx, cy) — de gravures op de zijranden en de tekens in het
 *  watermerk komen hier allemaal uit. */
export function schoppenPad(cx: number, cy: number, s: number): string {
  const X = (x: number) => cx + x * s;
  const Y = (y: number) => cy + y * s;
  return spiegelHalf(
    [0, -1],
    [
      { c1: [-0.42, -0.6], c2: [-0.8, -0.28], p: [-0.8, 0.16] },
      { c1: [-0.8, 0.56], c2: [-0.5, 0.78], p: [-0.24, 0.7] },
      { c1: [-0.1, 0.66], c2: [-0.1, 0.86], p: [-0.14, 0.94] },
      { lijn: [-0.34, 1] },
      { lijn: [0, 1] },
    ],
    X,
    Y,
  );
}

export function klaverPad(cx: number, cy: number, s: number): string {
  const X = (x: number) => cx + x * s;
  const Y = (y: number) => cy + y * s;
  const blad = (dx: number, dy: number) =>
    cirkel(X(dx), Y(dy), 0.42 * s);
  const steel = spiegelHalf(
    [0, 0.1],
    [
      { c1: [-0.08, 0.4], c2: [-0.2, 0.72], p: [-0.3, 1] },
      { lijn: [0, 1] },
    ],
    X,
    Y,
  );
  return `${blad(0, -0.56)} ${blad(-0.5, 0.14)} ${blad(0.5, 0.14)} ${steel}`;
}

export function ruitPad(cx: number, cy: number, s: number): string {
  return `M ${P(cx, cy - s)} L ${P(cx + s * 0.6, cy)} L ${P(
    cx,
    cy + s,
  )} L ${P(cx - s * 0.6, cy)} Z`;
}

/* ------------------------- kettingen en sluitingen ------------------------- */

/** Omhullende van één ornament, in kaart-units. De DOM legt zijn verloop met
 *  `objectBoundingBox` over precies deze doos; het canvas heeft geen
 *  bounding-box-API voor een Path2D en krijgt de doos daarom expliciet mee —
 *  zo staat het staalverloop op beide lezers op dezelfde plek. */
export interface Doos {
  x: number;
  y: number;
  w: number;
  h: number;
}

const doosVanCirkel = (cx: number, cy: number, r: number): Doos => ({
  x: rond(cx - r),
  y: rond(cy - r),
  w: rond(r * 2),
  h: rond(r * 2),
});

/** Eén kettingschakel: de ring zelf plus de binnenlijn die er glans op zet.
 *  `hoek` bewaart de richting van de schakel, `doos` zijn omhullende. */
export interface PietSchakel {
  ring: string;
  binnen: string;
  hoek: number;
  doos: Doos;
}

/** Dikte van de kettingdraad in kaart-units (opgemeten uit de referentie:
 *  ~13 px op een kaart van 729 px breed). */
export const PIET_KETTING_DRAAD = 1.75;

/** Sampelt een cubic-keten op gelijke booglengte — kettingschakels moeten
 *  even ver uit elkaar liggen, ook waar de bocht scherper is. */
function opAfstand(
  start: Punt,
  segmenten: readonly Segment[],
  afstand: number,
): { punt: Punt; hoek: number }[] {
  const fijn: Punt[] = [];
  const stappen = 400;
  for (let i = 0; i <= stappen; i++) {
    const g = (i / stappen) * segmenten.length;
    const idx = Math.min(Math.floor(g), segmenten.length - 1);
    const t = g - idx;
    const p0 = idx === 0 ? start : segmenten[idx - 1][2];
    const [c1, c2, p3] = segmenten[idx];
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    fijn.push([
      a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0],
      a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1],
    ]);
  }
  const lengte: number[] = [0];
  for (let i = 1; i < fijn.length; i++)
    lengte.push(
      lengte[i - 1] + Math.hypot(fijn[i][0] - fijn[i - 1][0], fijn[i][1] - fijn[i - 1][1]),
    );
  const totaal = lengte[lengte.length - 1];
  const uit: { punt: Punt; hoek: number }[] = [];
  for (let s = 0; s <= totaal + 0.001; s += afstand) {
    let i = 1;
    while (i < lengte.length - 1 && lengte[i] < s) i++;
    const a = fijn[Math.max(0, i - 1)];
    const b = fijn[Math.min(fijn.length - 1, i + 1)];
    uit.push({
      punt: fijn[i],
      hoek: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
    });
  }
  return uit;
}

/** Centerlijn van de linkerketting: begint áchter het schild (u > 0 op deze
 *  hoogte is nog kaart), bolt langs de taille naar buiten en zwenkt daarna
 *  terug naar binnen, waar de sluiting hangt. De ornamentlaag ligt achter de
 *  kaart, dus alleen het stuk buiten de schildrand is zichtbaar — precies de
 *  lus van de referentie. */
const KETTING_START: Punt = [13, 76];
const KETTING_SEGMENTEN: readonly Segment[] = [
  [
    [7.4, 82],
    [0.6, 88],
    [-2.6, 96.5],
  ],
  [
    [-5, 104.5],
    [-1.2, 113],
    [4.6, 119],
  ],
];

/** De schakels van de linkerketting; de rechterhelft is de spiegeling om
 *  x = 50, zodat beide kettingen per constructie identiek zijn. Om en om een
 *  brede en een smalle schakel: dat is hoe een echte ketting leest, waar elke
 *  tweede schakel een kwartslag gedraaid staat. */
export const PIET_KETTING: readonly PietSchakel[] = opAfstand(
  KETTING_START,
  KETTING_SEGMENTEN,
  6.3,
).map(({ punt, hoek }, i) => {
  const lang = 3.6;
  const breed = i % 2 === 0 ? 2.6 : 1.5;
  const t = (hoek * Math.PI) / 180;
  const halfB = Math.hypot(lang * Math.cos(t), breed * Math.sin(t));
  const halfH = Math.hypot(lang * Math.sin(t), breed * Math.cos(t));
  return {
    ring: ellips(punt[0], punt[1], lang, breed, hoek),
    binnen: ellips(punt[0], punt[1], lang - 0.6, Math.max(0.35, breed - 0.6), hoek),
    hoek: rond(hoek),
    doos: {
      x: rond(punt[0] - halfB),
      y: rond(punt[1] - halfH),
      w: rond(halfB * 2),
      h: rond(halfH * 2),
    },
  };
});

/** De geopende sluiting aan het eind van de ketting: een dikke, halfopen beugel
 *  met een vlakke kop waar de laatste schakel door valt. Het gat wijst naar de
 *  kaart toe — het slot is verbroken, niet gesloten. Dát is de belofte van de
 *  Piet: één overwinning en je bent hem kwijt. */
const SLUITING_C: Punt = [8, 128.2];
export const PIET_SLUITING = {
  /** Beugel: 250°-boog met de opening naar de kaart toe. */
  beugel: boog(SLUITING_C[0], SLUITING_C[1], 4.7, 55, 305),
  /** Vlakke kop bovenop de beugel — daar loopt de laatste schakel door. Loopt
   *  bewust een fractie scheef: een pad met een hoogte van precies 0 heeft een
   *  lege bounding box, en dan weigert SVG een objectBoundingBox-verloop te
   *  tekenen (de balk zou onzichtbaar zijn). */
  balk: `M ${P(SLUITING_C[0] - 4.4, SLUITING_C[1] - 6)} L ${P(
    SLUITING_C[0] + 3.6,
    SLUITING_C[1] - 5.6,
  )}`,
  draad: 2.3,
  /** Beugel en balk samen — één verloop over de hele sluiting. */
  doos: {
    x: rond(SLUITING_C[0] - 4.7),
    y: rond(SLUITING_C[1] - 6.2),
    w: 9.4,
    h: rond(6.2 + 4.7),
  } satisfies Doos,
} as const;

/* --------------------------- crest: de pion-fiche -------------------------- */

const CREST: Punt = [50, 3.2];
/** Buitenmaat van de crest-fiche (opgemeten: r ≈ 9,4 units in de referentie). */
export const PIET_CREST_RING = cirkel(CREST[0], CREST[1], 8.6);
export const PIET_CREST_DOOS = doosVanCirkel(CREST[0], CREST[1], 8.6);
export const PIET_CREST_SCHIJF = cirkel(CREST[0], CREST[1], 7.5);
/** Twee ijle gravureringen ín de fiche, zoals het geslagen oppervlak van een
 *  speelfiche. */
export const PIET_CREST_GRAVURE: readonly string[] = [
  cirkel(CREST[0], CREST[1], 6.4),
  cirkel(CREST[0], CREST[1], 4.6),
];
/** De pion zelf: het enige "speelstuk" dat de kaarttitel uitbeeldt. */
export const PIET_CREST_PION = pionPad(CREST[0], CREST[1] + 0.2, 12.4);

/** Vleugel langs de bovenrand: een taperende swash die uit de fiche komt en
 *  over de kaartrand naar buiten loopt. `bouwStreng` levert de vorm — één
 *  helft, de rechterkant is de spiegeling. */
export const PIET_CREST_VLEUGEL: Streng = bouwStreng({
  // Bewust vlak en lang (tot u ≈ 30): een korte dikke swash naast de fiche
  // leest als een hoorn, terwijl de referentie een band langs de bovenrand
  // toont die in een fijne punt naar buiten uitloopt.
  // Hoogte v ≈ 5: dat is de enige band die op álle vier de schildvormen langs
  // de bovenrand valt (de vlakke en de notch-rand liggen op v 0–4,7, de spitse
  // en de kroon-crest op v 4,9–5,6) — hoger zweeft de vleugel los, lager valt
  // hij midden op het ivoor.
  start: [43.2, 4.4],
  segmenten: [
    [
      [40, 5.6],
      [36.6, 6],
      [34, 6],
    ],
    [
      [32.6, 6],
      [31.6, 6.6],
      [30.9, 7.9],
    ],
  ],
  dikte: 2.2,
  ribbels: 5,
  taper: 1.5,
  punt: 0.08,
  stappen: 34,
});

/** Punt onder de fiche: het lakzegel-achtige uiteinde dat in het vlak hangt.
 *  Blijft bóven de eloregel (die begint rond v ≈ 15,6). */
export const PIET_CREST_PUNT = spiegelHalf(
  [0, 0],
  [
    { c1: [-2.6, 0.9], c2: [-4.6, 2], p: [-5.2, 3.4] },
    { c1: [-3.6, 4.7], c2: [-1.8, 6.1], p: [0, 7.9] },
  ],
  (x) => CREST[0] + x,
  (y) => CREST[1] + 3.4 + y,
);

/* --------------------- zegel in de onderpunt (gebroken) -------------------- */

const ZEGEL: Punt = [50, 126.8];
/** Straal van de zegelring (hartlijn) en de dikte van het lak-omhulsel. */
const ZEGEL_R = 7.4;
export const PIET_ZEGEL_DRAAD = 2.4;
/** Verspringing van de twee helften: de bovenste helft van de breuk schuift
 *  omhoog, de onderste omlaag. Dát maakt het zegel gebroken en niet gebarsten. */
const ZEGEL_SCHUIF = 0.55;
/** Linkerhelft van de ring, iets omhoog geschoven. */
export const PIET_ZEGEL_HELFT_LINKS = boog(
  ZEGEL[0] - ZEGEL_SCHUIF,
  ZEGEL[1] - ZEGEL_SCHUIF,
  ZEGEL_R,
  90,
  270,
);
/** Rechterhelft, evenveel omlaag. */
export const PIET_ZEGEL_HELFT_RECHTS = boog(
  ZEGEL[0] + ZEGEL_SCHUIF,
  ZEGEL[1] + ZEGEL_SCHUIF,
  ZEGEL_R,
  -90,
  90,
);
export const PIET_ZEGEL_SCHIJF = cirkel(ZEGEL[0], ZEGEL[1], 6.6);
export const PIET_ZEGEL_DOOS = doosVanCirkel(ZEGEL[0], ZEGEL[1], ZEGEL_R);
/** Gegraveerde binnenring plus de grondlijn waarop de twee stukken staan. */
export const PIET_ZEGEL_GRAVURE: readonly string[] = [
  cirkel(ZEGEL[0], ZEGEL[1], 5.2),
  `M ${P(ZEGEL[0] - 4.4, ZEGEL[1] + 3.1)} L ${P(ZEGEL[0] + 4.4, ZEGEL[1] + 3.1)}`,
];
/** Twee pionnen in het zegel: de fiche gaat van de één naar de ander. */
export const PIET_ZEGEL_STUKKEN: readonly string[] = [
  pionPad(ZEGEL[0] - 2.5, ZEGEL[1] - 0.4, 6.8),
  pionPad(ZEGEL[0] + 2.5, ZEGEL[1] - 0.4, 6.8),
];
/** De breuk: een grillige lijn dwars door het zegel, met de verspringing van
 *  de twee helften erin. Geen rechte snede — lak breekt scheef. */
export const PIET_ZEGEL_BREUK = [
  `M ${P(ZEGEL[0] + 0.9, ZEGEL[1] - 9.2)}`,
  `L ${P(ZEGEL[0] - 0.5, ZEGEL[1] - 5.6)}`,
  `L ${P(ZEGEL[0] + 1.1, ZEGEL[1] - 2.2)}`,
  `L ${P(ZEGEL[0] - 0.9, ZEGEL[1] + 1.4)}`,
  `L ${P(ZEGEL[0] + 0.8, ZEGEL[1] + 4.8)}`,
  `L ${P(ZEGEL[0] - 0.7, ZEGEL[1] + 7.4)}`,
  `L ${P(ZEGEL[0] + 0.4, ZEGEL[1] + 9.4)}`,
].join(" ");

/* ------------------- kaarttekens en lauwer op de randen ------------------- */

/** Gegraveerde cartouche op de zijrand: een spitse ovaal (het inlegwerk van
 *  het lakframe) met een kaartteken erin. Twee posities per zijde — klaver
 *  boven, schoppen onder, net als in de referentie. Het hart en de ruit zitten
 *  al in het speelkaart-weefsel van het vlak (#645), dus de rand krijgt de
 *  twee zwarte tekens; de ruit komt terug als het rode accent. */
const RAND_X = 3.5;
function cartouche(cy: number): string {
  return spiegelHalf(
    [0, -5.6],
    [{ c1: [-2.4, -3.3], c2: [-2.4, 3.3], p: [0, 5.6] }],
    (x) => RAND_X + x,
    (y) => cy + y,
  );
}

export const PIET_RAND_CARTOUCHES: readonly string[] = [
  cartouche(41),
  cartouche(78),
];
export const PIET_RAND_TEKENS: readonly string[] = [
  klaverPad(RAND_X, 41, 2.1),
  schoppenPad(RAND_X, 78, 2.4),
];
/** Het enige kleuraccent op de rand: één donkerrode ruit tussen de tekens. */
export const PIET_RAND_RUIT = ruitPad(RAND_X, 61.5, 1.9);

/** Lauwerband langs de onderste schildrand: kleine taperende blaadjes langs de
 *  diagonaal van taille naar punt, plus een tweede rode ruit. De band ligt op
 *  de schildrand die álle vier de schildvormen delen (van de taille op
 *  (13,5 · 116,5) naar de punt), een stukje naar binnen zodat hij op het
 *  lakframe valt en niet naast de kaart zweeft. */
const LAUWER_RAND_VAN: Punt = [13.5, 116.5];
const LAUWER_RAND_TOT: Punt = [43.5, 135.1];
/** Richting van die rand en de normaal die de kaart in wijst. */
const LAUWER_LENGTE = Math.hypot(
  LAUWER_RAND_TOT[0] - LAUWER_RAND_VAN[0],
  LAUWER_RAND_TOT[1] - LAUWER_RAND_VAN[1],
);
const LAUWER_DIR: Punt = [
  (LAUWER_RAND_TOT[0] - LAUWER_RAND_VAN[0]) / LAUWER_LENGTE,
  (LAUWER_RAND_TOT[1] - LAUWER_RAND_VAN[1]) / LAUWER_LENGTE,
];
/** De normaal die de kaart ín wijst (de rand loopt naar rechtsonder, de
 *  kaart ligt er rechtsboven van). */
const LAUWER_NORMAAL: Punt = [LAUWER_DIR[1], -LAUWER_DIR[0]];
/** Hartlijn van de band: het midden van het lakframe (~2,6 units naar binnen). */
const LAUWER_INZET = 2.6;
const opBand = (t: number): Punt => [
  LAUWER_RAND_VAN[0] + LAUWER_DIR[0] * t * LAUWER_LENGTE + LAUWER_NORMAAL[0] * LAUWER_INZET,
  LAUWER_RAND_VAN[1] + LAUWER_DIR[1] * t * LAUWER_LENGTE + LAUWER_NORMAAL[1] * LAUWER_INZET,
];

/** Eén lauwerblad: een amandel om (cx, cy), gedraaid over `graden`. Bewust
 *  géén `bouwStreng`: die tapert van een vólle wortel naar een punt (een
 *  hoorn), terwijl een blad aan twéé kanten spits is — met een streng werden
 *  het driehoekjes die als zaagtandjes lazen. */
function bladPad(
  cx: number,
  cy: number,
  graden: number,
  lang: number,
  breed: number,
): { blad: string; nerf: string } {
  const t = (graden * Math.PI) / 180;
  const d: Punt = [Math.cos(t), Math.sin(t)];
  const n: Punt = [-d[1], d[0]];
  const punt = (k: number): Punt => [cx + d[0] * lang * k, cy + d[1] * lang * k];
  const zij = (k: number, b: number): Punt => [
    cx + d[0] * lang * k + n[0] * breed * b,
    cy + d[1] * lang * k + n[1] * breed * b,
  ];
  const a = punt(1);
  const b = punt(-1);
  return {
    blad: `M ${P(a[0], a[1])} C ${P(...zij(0.45, 1.15))}, ${P(
      ...zij(-0.45, 1.15),
    )}, ${P(b[0], b[1])} C ${P(...zij(-0.45, -1.15))}, ${P(
      ...zij(0.45, -1.15),
    )}, ${P(a[0], a[1])} Z`,
    nerf: `M ${P(a[0], a[1])} L ${P(b[0], b[1])}`,
  };
}

/** De blaadjes van de band: allemaal dezelfde kant op (naar de taille) en 16°
 *  van de band af gekanteld — plat in de band leest het als een streep. */
export const PIET_LAUWER: readonly { blad: string; nerf: string }[] = [
  0, 1, 2, 3, 4,
].map((i) => {
  const [bx, by] = opBand(0.1 + i * 0.19);
  const bandHoek = (Math.atan2(LAUWER_DIR[1], LAUWER_DIR[0]) * 180) / Math.PI;
  // Het blad ligt met zijn hartlijn ín de band, dus de amandel wordt om het
  // punt op de band gecentreerd; de kanteling wijst de punt naar de taille.
  return bladPad(bx, by, bandHoek + 180 + 16, 1.8, 0.62);
});
const LAUWER_RUIT_C = opBand(0.5);
export const PIET_LAUWER_RUIT = ruitPad(LAUWER_RUIT_C[0], LAUWER_RUIT_C[1], 1.7);

/* ------------------------------ materiaal ------------------------------ */

/** Geoxideerd zilver / gunmetal: de referentie is mat, dus het verloop loopt
 *  van bleek staal naar bijna-zwart zonder specular piek. Schande glimt niet
 *  (#705), maar metaal moet wel rond lezen — daar zijn de glans- en
 *  schaduwlijnen van `bouwStreng` voor. */
export const PIET_STAAL_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "#d8d4c9"],
  [0.34, "#a09b93"],
  [0.68, "#6d6963"],
  [1, "#3b3934"],
] as const;
export const PIET_STAAL_CONTOUR = "#14130f";
export const PIET_STAAL_GLANS = "rgba(240, 237, 227, 0.5)";
export const PIET_STAAL_SCHADUW = "rgba(10, 9, 8, 0.45)";
export const PIET_STAAL_RIBBEL = "rgba(16, 15, 13, 0.42)";
export const PIET_STAAL_RIBBELGLANS = "rgba(226, 222, 210, 0.28)";
/** Matzwart lak van de fiche- en zegelschijven. */
export const PIET_LAK = "#191713";
/** Geoxideerde zilverrand om de schijven. */
export const PIET_LAK_RAND = "rgba(197, 192, 178, 0.72)";
/** Gravure ín het lak: net licht genoeg om te zien dat er iets staat. */
export const PIET_GRAVURE = "rgba(203, 197, 181, 0.42)";
/** Lauwerblad: vlakke geoxideerde zilvertint i.p.v. het staalverloop. Het
 *  lakframe is bijna zwart, dus een verloop dat naar zwart zakt slokt de
 *  blaadjes op — gravure moet lichter zijn dan zijn ondergrond. */
export const PIET_LOOF = "rgba(151, 145, 128, 0.6)";
export const PIET_LOOF_NERF = "rgba(232, 227, 212, 0.28)";
/** De donkerrode ruitaccenten — het enige kleurdetail (#8e2318 ligt naast de
 *  --editie-kleur #a8271b van de kaart, maar een tint dieper: op het zwarte
 *  lak leest hetzelfde rood anders dan op ivoor). */
export const PIET_ROOD = "#8e2318";
export const PIET_ROOD_RAND = "rgba(214, 200, 176, 0.35)";
/** De breuklijn: donkere spleet met een bleke opstaande rand ernaast. */
export const PIET_BREUK = "rgba(8, 7, 6, 0.85)";
export const PIET_BREUK_GLANS = "rgba(226, 220, 204, 0.5)";

/* ------------------------- watermerk ín het vlak ------------------------- */

/** Concentrische doorgeefringen: het token gaat rond, dus de ringen lopen als
 *  een rimpel naar buiten. De gestippelde ring is de "klik"-ring — evenveel
 *  stippen als er ringen zijn ronden. */
function stippenRing(r: number, aantal: number): string {
  const uit: string[] = [];
  for (let i = 0; i < aantal; i++) {
    const g = (i / aantal) * Math.PI * 2;
    uit.push(cirkel(50 + Math.cos(g) * r, 50 + Math.sin(g) * r, 0.95));
  }
  return uit.join(" ");
}

/** Het watermerk: grote pion, concentrische doorgeefringen, het ronde zegel en
 *  drie kaarttekens. Groot en nauwelijks zichtbaar — het moet de gegevens
 *  dragen, niet beconcurreren. ViewBox 0 0 100 100. */
export const PIET_WATERMERK: readonly OrnamentPad[] = [
  { d: cirkel(50, 50, 47), soort: "lijn", breedte: 0.7, alpha: 0.5 },
  { d: cirkel(50, 50, 40.5), soort: "lijn", breedte: 1, alpha: 0.85 },
  { d: stippenRing(35.5, 30), soort: "vlak", alpha: 0.8 },
  { d: cirkel(50, 50, 30.5), soort: "lijn", breedte: 0.6, alpha: 0.7 },
  // Het zegel: dubbele ring rond de pion, zoals het zegel in de onderpunt.
  { d: cirkel(50, 50, 24), soort: "lijn", breedte: 1.4, alpha: 0.9 },
  { d: cirkel(50, 50, 21.5), soort: "lijn", breedte: 0.5, alpha: 0.6 },
  { d: pionPad(50, 51, 52), soort: "vlak" },
  { d: schoppenPad(19.5, 48, 9), soort: "vlak", alpha: 0.9 },
  { d: ruitPad(79, 40, 9), soort: "vlak", alpha: 0.9 },
  { d: klaverPad(77.5, 62, 8.5), soort: "vlak", alpha: 0.9 },
] as const;

/** Etskleur: warme houtskool op ivoor, op de dekking van een watermerk. */
export const PIET_WATERMERK_KLEUR = "rgba(58, 48, 32, 0.1)";
/** Motiefmaat: breedte als fractie van het vlak, plus de verticale positie als
 *  background-position-fractie (0.36 ≡ `center 36%`) — het watermerk zit achter
 *  de gegevens, met het midden net onder de emotie-icoon. */
export const PIET_WATERMERK_BREEDTE = 0.8;
export const PIET_WATERMERK_POSITIE = 0.36;
