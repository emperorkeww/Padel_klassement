// Ornamenten en motief van de On Fire-editie (#710). Eigen module naast
// futKaartOrnamenten.ts, want On Fire is de eerste *editie* met een ornament:
// de GOAT- en dictator-vormen daar hangen aan de tíer, deze aan de editie. Eén
// bron voor twee tekenaars — FutKaart.tsx rendert de paden als inline-SVG,
// futKaartCanvas.ts tekent ze als Path2D op de deel-poster — dus de
// CSS↔canvas-pariteit is hier by construction, net als bij de tier-ornamenten.
//
// Overlay, geen kaarttype (issue #710): On Fire ligt bóven een willekeurige
// divisie-tier. De editie-skin overschrijft frame, vlak en inkt, maar de
// schíldvorm blijft die van de tier — dus élk ornament hieronder moet werken op
// alle vijf de vormen (vlak, notch, punt, kroon, troon). Dat is de reden voor
// twee ontwerpkeuzes die je aan de vormen zelf niet ziet:
//
// — de vlamcrest ligt vóór de kaart en dékt de bovenrand af (de andere
//   ornamentlagen komen erachter vandaan). Zijn onderste punt zit op v≈14,
//   ruim onder de diepste bovenrand die een schildvorm kan hebben (troon en
//   punt duiken tot v≈8 in het midden), zodat de crest op geen enkele vorm
//   los boven de kaart zweeft;
// — de vinnen, sintels en het medaillon hangen alléén aan de ónderkant van het
//   schild (v > 70), en die is voor alle vijf de vormen identiek — daar kan de
//   tier dus niets aan veranderen.
//
// Coördinaten: kaart-units (100 breed × 139 hoog, oorsprong linksboven op de
// kaart) voor de ornamentlaag; het motief heeft zijn eigen 0 0 100 100-viewBox.
// Maten opgemeten uit de referentie in issue #710 (kaartbreedte 802px in die
// render, dus 1 unit = 8,02px).

import { bouwStreng, type OrnamentPad } from "./futKaartOrnamenten";

const rond = (n: number) => Math.round(n * 100) / 100;

type Punt = readonly [number, number];
/** Eén cubic-segment: twee controlepunten en een eindpunt. */
type Cubic = readonly [Punt, Punt, Punt];

/* ------------------------------ vlamgenerator ------------------------------ */

/** Halve vlam in een genormaliseerd frame: x in breedtes (de vorm reikt tot
 *  ±0,44, dus de volle breedte is 0,88 × `breedte`), y in hoogtes (0 = basis,
 *  1 = punt). Loopt van de basis op de as langs de linkerflank omhoog: geknepen
 *  bij de voet, uitzwellend naar de zijlob, die met zijn punt naar bínnen
 *  haakt, terug in het dal en zo langs de middenlob naar de top.
 *
 *  Dat "geknepen bij de voet, breed in het midden" is wat een vlam van een
 *  drietand of een kroon onderscheidt; een profiel dat onderaan het breedst is
 *  leest onherroepelijk als kroontje. Zes kandidaatprofielen naast elkaar gezet
 *  tegen de referentie — dit is de winnaar.
 *
 *  `bouwVlam` spiegelt deze helft, dus élke vlam is per constructie
 *  symmetrisch. De referentie tekent hem met de hand asymmetrisch (een haak
 *  naar rechts), maar een crest op de as leest gecentreerd beter, en de
 *  ornamentarchitectuur van #710 werkt met gespiegelde helften. */
const VLAM_HALF: readonly Cubic[] = [
  [
    [-0.08, 0.03],
    [-0.22, 0.09],
    [-0.31, 0.2],
  ],
  [
    [-0.42, 0.34],
    [-0.44, 0.52],
    [-0.3, 0.62],
  ],
  [
    [-0.26, 0.5],
    [-0.21, 0.42],
    [-0.155, 0.33],
  ],
  [
    [-0.125, 0.46],
    [-0.185, 0.6],
    [-0.145, 0.72],
  ],
  [
    [-0.12, 0.84],
    [-0.065, 0.93],
    [0, 1],
  ],
];

/** Spiegelt de segmentketting om x=0 en keert de richting om, zodat hij van de
 *  punt terug naar de basis loopt en de omtrek sluit. */
function spiegelCubics(segmenten: readonly Cubic[]): Cubic[] {
  const spiegel = (p: Punt): Punt => [-p[0], p[1]];
  const uit: Cubic[] = [];
  for (let i = segmenten.length - 1; i >= 0; i--) {
    const [c1, c2] = segmenten[i];
    const vorige: Punt = i === 0 ? [0, 0] : segmenten[i - 1][2];
    // Achterstevoren: de controlepunten wisselen van volgorde en het eindpunt
    // is het startpunt van het originele segment.
    uit.push([spiegel(c2), spiegel(c1), spiegel(vorige)]);
  }
  return uit;
}

/** Gesloten, symmetrisch vlamsilhouet met een middenlob en twee zijlobben:
 *  gestileerd smeedwerk, geen realistische vlam (stijlbeperking uit #710).
 *  `(u, v)` is de basis op de as, `hoogte` de afstand tot de punt (omhoog, dus
 *  aflopende v) en `breedte` de volle breedte. */
export function bouwVlam(
  u: number,
  v: number,
  hoogte: number,
  breedte: number,
): string {
  const X = (nx: number) => rond(u + nx * breedte);
  const Y = (ny: number) => rond(v - ny * hoogte);
  const alles = [...VLAM_HALF, ...spiegelCubics(VLAM_HALF)];
  const uit = [`M ${X(0)} ${Y(0)}`];
  for (const [c1, c2, p3] of alles)
    uit.push(
      `C ${X(c1[0])} ${Y(c1[1])}, ${X(c2[0])} ${Y(c2[1])}, ${X(p3[0])} ${Y(p3[1])}`,
    );
  return `${uit.join(" ")} Z`;
}

/** Gegraveerde nerven ín een vlam: de as plus een lijn langs elke zijlob. Wat
 *  de ribbels voor de bokhoorn doen — het silhouet als gesmeed metaal laten
 *  lezen in plaats van als een silhouetsticker. */
export function bouwVlamNerven(
  u: number,
  v: number,
  hoogte: number,
  breedte: number,
): readonly string[] {
  const X = (nx: number) => rond(u + nx * breedte);
  const Y = (ny: number) => rond(v - ny * hoogte);
  const zijlob = (teken: number) =>
    `M ${X(teken * -0.17)} ${Y(0.26)} C ${X(teken * -0.24)} ${Y(0.34)}, ${X(
      teken * -0.29,
    )} ${Y(0.45)}, ${X(teken * -0.3)} ${Y(0.56)}`;
  return [
    `M ${X(0)} ${Y(0.12)} C ${X(0)} ${Y(0.36)}, ${X(0)} ${Y(0.62)}, ${X(0)} ${Y(0.86)}`,
    zijlob(1),
    zijlob(-1),
  ];
}

/* --------------------------------- materiaal -------------------------------- */

/** Materiaalwaarden van één getaperde streng, zodat `FutStreng` (DOM) en
 *  `strokeStreng` (canvas) hetzelfde metaal in twee kleuren kunnen tekenen: de
 *  rosé GOAT-hoorns en de koperen On Fire-vinnen. Woont hier en niet in
 *  futKaartOrnamenten.ts om samenvoegconflicten met het parallelle werk aan de
 *  tier-ornamenten te vermijden. */
export interface MetaalPalet {
  verloop: readonly (readonly [number, string])[];
  contour: string;
  glans: string;
  ribbel: string;
  ribbelGlans: string;
  schaduw: string;
}

/** Verhit koper met rosébrons: bleke glans bovenaan, verzadigd koper in het
 *  midden, verkoold onderaan. Opgemeten aan het frame van de referentie
 *  (#eddece / #e2a37a / #b75b30 / #2e1408) — bewust bruiner dan het oranje van
 *  het oude On-Fire-frame, want "geen overdreven oranje neon". */
export const ONFIRE_KOPER: MetaalPalet = {
  verloop: [
    [0, "#ffe3c4"],
    [0.34, "#e8a874"],
    [0.7, "#b56a3f"],
    [1, "#6b2f14"],
  ],
  contour: "#2e1006",
  glans: "rgba(255, 236, 214, 0.75)",
  ribbel: "rgba(46, 16, 6, 0.5)",
  ribbelGlans: "rgba(255, 226, 198, 0.45)",
  schaduw: "rgba(74, 26, 10, 0.45)",
};

/** Verkoold staal voor de crest-plaat: de donkere wig waarin de vlam staat.
 *  Zonder dat contrast verdwijnt koper op koper in de bovenrand. */
export const ONFIRE_STAAL_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "#6f625a"],
  [0.42, "#3b2b23"],
  [1, "#150d08"],
] as const;

/** Gloeiend hart van het medaillon: het énige punt op de kaart waar het vuur
 *  écht heet mag zijn (de rest is metaal dat de hitte weerkaatst). */
export const ONFIRE_GLOED_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "#ffeeb0"],
  [0.44, "#ffab48"],
  [1, "#d2470f"],
] as const;

/** Donkere binnenkant van het medaillon, zodat de gloed licht geeft i.p.v. een
 *  koperen schijf te zijn. */
export const ONFIRE_MEDAILLON_DIEP = "#26100a";

/* ---------------------- achtergrond buiten het schild --------------------- */

/** Hitte-/rookverloop achter de flanken (#834). Bovenin begint het als gedempt
 *  pruim (de secundaire kleur uit het nieuwe frame), via koper naar amber bij
 *  de wortel. De laatste stop is transparant: de massa lijkt uit het frame te
 *  groeien en eindigt niet als een los gekleurd vlak. */
export const ONFIRE_PLUIM_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "rgba(110, 49, 67, 0.1)"],
  [0.42, "rgba(181, 106, 63, 0.18)"],
  [0.76, "rgba(255, 143, 62, 0.14)"],
  [1, "rgba(46, 16, 6, 0)"],
] as const;

/** Vier organisch verdeelde achtervlammen over de volle kaart (#834). Bewust
 *  géén spiegelset: links zit de grootste pluim hoger, rechts groeit de brede
 *  massa lager uit het frame. De wortels liggen binnen de kaart (0 < x < 100)
 *  en worden door frame/vlak bedekt; alleen de onregelmatige buiken blijven
 *  buiten de contour zichtbaar. */
export const ONFIRE_PLUIMEN: readonly string[] = [
  "M 14 87 C 7 80 -6 78 -10 68 C -14 58 -11 47 -5 37 C -1 30 1 25 0 19 C 7 31 5 42 1 51 C -2 58 2 63 6 58 C 9 54 10 49 9 44 C 15 55 11 66 8 72 C 6 77 11 82 16 83 Z",
  "M 11 120 C 5 117 -4 112 -5 104 C -6 95 -2 87 4 79 C 2 89 7 94 5 101 C 3 107 6 113 13 118 Z",
  "M 91 70 C 98 64 105 59 104 50 C 104 43 101 37 98 31 C 98 27 99 24 101 21 C 104 34 109 42 106 51 C 104 58 99 64 91 68 Z",
  "M 87 114 C 96 108 111 103 114 91 C 117 80 111 70 104 63 C 101 59 100 55 101 51 C 108 60 112 69 108 77 C 106 82 108 87 112 84 C 112 97 102 105 91 111 Z",
] as const;

/** Verzadigder vuur voor de laag die daadwerkelijk óver de kaartrand loopt.
 *  Anders dan de zachte pluim is deze laag bijna opaak: koper aan de wortel,
 *  een heet amberhart en een pruimkleurige rookpunt die het nieuwe frame-accent
 *  oppikt. */
export const ONFIRE_RANDVLAM_VERLOOP: readonly (
  readonly [number, string]
)[] = [
  [0, "rgba(110, 49, 67, 0.82)"],
  [0.34, "rgba(207, 86, 34, 0.9)"],
  [0.68, "rgba(255, 171, 72, 0.92)"],
  [1, "rgba(107, 47, 20, 0.78)"],
] as const;

/** Vier kleinere voorvlammen op verschillende hoogtes. Ook deze zijn
 *  asymmetrisch en full-card-coördinaten: ze kruisen lokaal frame/liner/
 *  keyline, maar vormen nergens een doorlopende verticale vuurkolom. */
export const ONFIRE_RANDVLAMMEN: readonly string[] = [
  "M 9 81 C 6 77 0 74 -3 69 C -6 64 -5 58 -2 53 C 1 49 4 45 5 39 C 8 48 5 55 3 60 C 1 65 4 68 7 64 C 10 61 10 56 9 52 C 14 61 10 69 8 73 C 7 76 9 78 11 79 Z",
  "M 11 118 C 7 115 1 112 -1 107 C -3 101 -1 95 3 90 C 5 87 6 84 6 81 C 10 89 7 96 6 100 C 5 104 8 108 11 110 C 13 113 13 116 11 118 Z",
  "M 91 69 C 95 66 101 62 103 57 C 105 52 103 47 100 43 C 98 40 97 37 98 34 C 93 42 95 48 97 52 C 99 56 97 60 94 57 C 92 61 92 65 91 69 Z",
  "M 90 113 C 96 109 105 105 108 98 C 111 91 107 84 102 79 C 99 76 98 73 99 70 C 93 78 95 85 98 89 C 101 94 98 99 94 96 C 91 101 91 107 90 113 Z",
] as const;

/** Hete binnenkernen: smallere vlammen die dezelfde rand nogmaals kruisen.
 *  Ze gebruiken het geel-oranje gloedverloop van het medaillon en voorkomen
 *  dat de brede koperen omtrekken als bladeren of linten lezen. */
export const ONFIRE_RANDVLAM_HARTEN: readonly string[] = [
  "M 7 72 C 3.5 69 0 65 1 60 C 2 55 4.5 52 5 47 C 7 54 5 59 4 62 C 3 66 5.5 68 7 66 C 8 68 8 70 7 72 Z",
  "M 8 109 C 4.5 106 2 102 3 98 C 4 94 5.5 91 6 87 C 8 93 6.5 98 6 101 C 5.5 104 7 106 8 109 Z",
  "M 94 61 C 98 58 101 54 100 50 C 99 46 98 43 98.5 40 C 96 45 96 49 97.5 52 C 99 55 96.5 58 94 56 C 93 58 93 60 94 61 Z",
  "M 95 102 C 100 99 104 95 104 90 C 104 86 101 82 99.5 78 C 98 84 99 88 100 91 C 101 95 98 98 95 96 C 94 98 94 100 95 102 Z",
] as const;

/* ---------------------------------- crest ---------------------------------- */

/** Vlamcrest bij de bovenrand — de "compacte metalen vlamcrest bij de bovenste
 *  inkeping" uit #710, hier als plaat die de bovenrand áfdekt in plaats van
 *  eruit te groeien: alleen zo werkt hij op alle vijf de schildvormen (zie de
 *  kop van dit bestand). Vleugelpunten op u≈35 en u≈65, onderste punt op v≈13.
 *  Symmetrisch uitgeschreven: de crest staat op de as en wordt níet gespiegeld
 *  gerenderd, dus hij moet zélf symmetrisch zijn. */
export const ONFIRE_CREST_PLAAT =
  "M 50 0.2 C 47 0 43.5 -0.5 40 0.3 " +
  "C 38.5 0.7 37.1 1.4 35.8 2.2 " +
  "C 37.6 3.6 39.8 5 42 6.1 " +
  "C 44.6 7.4 47.6 9.6 50 12 " +
  "C 52.4 9.6 55.4 7.4 58 6.1 " +
  "C 60.2 5 62.4 3.6 64.2 2.2 " +
  "C 62.9 1.4 61.5 0.7 60 0.3 " +
  "C 56.5 -0.5 53 0 50 0.2 Z";

/** Koperen chevron langs de onderkant van de plaat: de V-band die in de
 *  referentie de bovenrand van de kaart naar binnen trekt. Steekt bewust een
 *  fractie onder de plaat uit (punt op v=12,6 tegen v=10,6), zodat de band de
 *  buitenste contour van de crest is. Blijft ruim boven de eerste inkt: het
 *  vlak begint pas rond v=17 met het eloblok. */
export const ONFIRE_CREST_BAND =
  "M 35.4 2.6 C 37.6 4.4 40.2 5.8 42.4 6.8 C 45 8 47.4 9.6 50 11.6 " +
  "C 52.6 9.6 55 8 57.6 6.8 C 59.8 5.8 62.4 4.4 64.6 2.6 " +
  "L 64.6 4.6 C 62.4 6.4 59.8 7.8 57.6 8.8 C 55 10 52.6 11.6 50 13.6 " +
  "C 47.4 11.6 45 10 42.4 8.8 C 40.2 7.8 37.6 6.4 35.4 4.6 Z";

/** De vlam in de crest: basis op de plaat, punt ~6 units boven de kaart. Bijna
 *  even breed als hoog (15 × 15,9 units, opgemeten in de referentie) — een
 *  gesmede crest is stevig, geen spitse punt; en hij blijft binnen de
 *  vleugelpunten (u 42,5–57,5), dus de crest leest als één stuk. */
export const ONFIRE_CREST_VLAM = bouwVlam(50, 9.6, 15.9, 17);
export const ONFIRE_CREST_NERVEN = bouwVlamNerven(50, 9.6, 15.9, 17);

/* -------------------------------- medaillon -------------------------------- */

/** Gloeiend vlammedaillon over de onderste kaartpunt: koperen ring, donkere
 *  binnenschijf, gloeiende vlam. Gecentreerd op (50, 137) met straal 9,4 —
 *  precies zoals de referentie valt hij dus óver de schildpunt op (50, 139),
 *  wat hem tegelijk de dekplaat maakt voor de wortels van de vlamvinnen. Als
 *  cirkelmaten i.p.v. pad-strings, net als DICTATOR_ZEGEL: DOM en canvas
 *  tekenen er allebei een echte cirkel van, dus geen afrondingsverschil. */
export const ONFIRE_MEDAILLON = {
  midden: [50, 137] as const,
  ring: 9.4,
  vlak: 7.4,
} as const;

export const ONFIRE_MEDAILLON_VLAM = bouwVlam(50, 143.8, 13.4, 12.5);
export const ONFIRE_MEDAILLON_NERVEN = bouwVlamNerven(50, 143.8, 13.4, 12.5);

/* ---------------------------------- vinnen --------------------------------- */

// Drie slanke, naar achter gebogen koperen vlamvinnen per kant (#710): een
// bundel geneste bogen die allemaal op de as beginnen, net onder de schildpunt,
// en langs de onderste zijkant omhoog zwiepen met de punt schuin naar achter.
//
// Twee dingen bepalen de vorm:
//
// — De ornamentlaag ligt áchter de kaart, dus alleen wat búiten de schildrand
//   valt is te zien. Die rand loopt van u=0 bij de taille (v=83,4) via
//   (13,5 · 116,5) naar de punt (50 · 139), dus een vin die "langs de kaart"
//   loopt moet in het onderste stuk 5–15 units naar buiten liggen. De
//   centerlijnen zijn daarop opgemeten in de referentie: bij v=125 liggen de
//   drie op u≈17 / 10 / 4 en de bundel steekt maximaal ~6,5 units naast de
//   kaart uit, rond v≈85.
// — De wortels liggen op de as (u≈50) omdat de gespiegelde helften daar op
//   elkaar aansluiten: de twee onderste vinnen vormen zo de geneste V-banden
//   die de referentie ónder de kaartpunt laat zien, en de bovenste wortel
//   verdwijnt achter het medaillon. Ze steken bewust een fractie over de as
//   (u=51,5) zodat de vlakken overlappen en de V-punt dicht is.
//
// `ribbels: 0` (de standaard): een vin is een geslagen blad, geen geribbelde
// hoorn — glans en schaduw uit `bouwStreng` geven hem zijn rondte.

/** Binnenste boog: hugt de kaartrand en reikt het hoogst (punt op v≈72, ruim
 *  boven de taille). Zijn wortel zit achter het medaillon. */
export const ONFIRE_VIN_HOOG = bouwStreng({
  start: [50.5, 145],
  segmenten: [
    [
      [47.5, 143.2],
      [43.5, 140.8],
      [37, 138],
    ],
    [
      [31.5, 135.4],
      [25.5, 131.8],
      [20, 128],
    ],
    [
      [15, 124],
      [9.5, 118.5],
      [6, 112],
    ],
    [
      [2.5, 105],
      [-0.5, 98],
      [-2.5, 92],
    ],
    [
      [-4, 85],
      [-5.2, 79],
      [-6.2, 71.5],
    ],
  ],
  dikte: 2.2,
  taper: 1.5,
  punt: 0.08,
  stappen: 100,
});

/** Middelste boog: punt net onder de taille (v≈100), wortel als binnenste
 *  V-band onder de kaartpunt. */
export const ONFIRE_VIN_MIDDEN = bouwStreng({
  start: [51.5, 150],
  segmenten: [
    [
      [47, 147.5],
      [42.5, 144.5],
      [37, 141],
    ],
    [
      [31, 137],
      [25, 133],
      [19, 128.5],
    ],
    [
      [13.5, 124],
      [8, 119],
      [3.5, 113],
    ],
    [
      [1, 108.5],
      [-2, 104.5],
      [-5.2, 100.5],
    ],
  ],
  dikte: 2,
  taper: 1.5,
  punt: 0.07,
  stappen: 80,
});

/** Buitenste boog: de wijdste en kortste, punt op v≈117 — hij geeft de bundel
 *  zijn spreiding en vormt de buitenste V-band onder de punt. */
export const ONFIRE_VIN_WIJD = bouwStreng({
  start: [51.5, 153.4],
  segmenten: [
    [
      [47.5, 151.4],
      [43.5, 149],
      [38, 145.6],
    ],
    [
      [32.5, 142.2],
      [27, 138.8],
      [21, 135],
    ],
    [
      [15, 131],
      [9.5, 127],
      [4.5, 122.5],
    ],
    [
      [2, 120.5],
      [-1, 118.6],
      [-3.8, 117],
    ],
  ],
  dikte: 1.8,
  taper: 1.5,
  punt: 0.06,
  stappen: 72,
});

/** De drie vinnen van de linkerhelft, in tekenvolgorde: wijdste eerst, zodat de
 *  boog die de kaart hugt eroverheen komt — dat leest als een bundel i.p.v. een
 *  raster. */
export const ONFIRE_VINNEN = [
  ONFIRE_VIN_WIJD,
  ONFIRE_VIN_MIDDEN,
  ONFIRE_VIN_HOOG,
] as const;

/* --------------------------------- sintels --------------------------------- */

/** Zes sintelaccenten langs de buitenrand van de linkerhelft, als
 *  `[u, v, straal]`; rechts is de spiegeling. Vaste literals i.p.v. een
 *  PRNG-wolk: "slechts enkele kleine sintelaccenten" uit #710, en zo staan
 *  DOM-kaart en poster gegarandeerd op dezelfde plek. Bewust allemaal in de
 *  marge bij de onderste zijkant (u ≤ 7, v ≥ 76): daar loopt geen inkt, dus ze
 *  bedekken nooit tekst — en ze hangen aan de gedeelde onderkant van het
 *  schild, dus ze zitten op elke schildvorm goed. Ze staan stil: geanimeerde
 *  sintels kosten per kaart een laag en het klassement toont er tientallen. */
export const ONFIRE_SINTELS: readonly (readonly [number, number, number])[] = [
  [-3.2, 76.5, 0.62],
  [-6.6, 86.4, 0.44],
  [-1.4, 93.8, 0.55],
  [1.8, 104.5, 0.4],
  [-4.2, 111.2, 0.36],
  [6.8, 121.5, 0.5],
] as const;

export const ONFIRE_SINTEL_KERN = "#ffe6a8";
export const ONFIRE_SINTEL_GLOED = "rgba(255, 138, 52, 0.85)";

/* ---------------------------------- motief ---------------------------------- */

/** Vlam-watermerk mét thermische ringen, in de eigen 0 0 100 100-viewBox van
 *  het motief. Twee dingen uit de referentie in één laag: het "zeer
 *  transparante vlamsilhouet" en de "subtiele concentrische thermische
 *  ringen". Ze zitten samen in het motief omdat dat één DOM-element is dat de
 *  CSS heel langzaam kan laten ademen (schaal + dekking) — precies de beweging
 *  die #710 voor de ringen vraagt, zonder een extra laag per kaart. */
export const ONFIRE_WATERMARK: readonly OrnamentPad[] = [
  { d: bouwVlam(50, 92, 74, 54), soort: "vlak" },
  { d: "M 26 56 A 24 24 0 1 1 74 56 A 24 24 0 1 1 26 56", soort: "lijn", breedte: 1.1, alpha: 0.75 },
  { d: "M 18 56 A 32 32 0 1 1 82 56 A 32 32 0 1 1 18 56", soort: "lijn", breedte: 0.8, alpha: 0.6 },
  { d: "M 10 56 A 40 40 0 1 1 90 56 A 40 40 0 1 1 10 56", soort: "lijn", breedte: 0.6, alpha: 0.45 },
];

/** Ember op lage dekking: warm genoeg om te voelen, ijl genoeg om de inkt
 *  (AAA op het sintelvlak) niet te raken. */
export const ONFIRE_WATERMARK_KLEUR = "rgba(255, 168, 104, 0.085)";
export const ONFIRE_WATERMARK_BREEDTE = 0.86;
export const ONFIRE_WATERMARK_POSITIE = 0.4;

/* ------------------------------ ornamentkeuze ------------------------------ */

export type OrnamentSoort = "goat" | "dictator" | "onfire";

/**
 * Wie levert de ornamentlaag: de editie of de tier?
 *
 * Vastgelegde regel (#710): **de editie wint van de tier**, precies zoals de
 * editie-skin het vlak van het special-register wint. Een GOAT die On Fire is,
 * draagt dus vlamvinnen en géén bokhoorns — twee volledige metaaloverlays
 * stapelen is expliciet verboden in de issue, en het silhouet van hoorns plus
 * crest wordt onleesbaar. Zodra de winstreek eindigt valt de kaart terug op het
 * tier-ornament; er is geen state die dat onthoudt.
 *
 * Het mótief volgt een andere regel (zie FutKaart.tsx / kaartSkin): dat hoort
 * bij het vlak-register, dus een editie zonder eigen motief laat het watermerk
 * van de tier gewoon vallen.
 *
 * Losse string-parameters i.p.v. `TierKey`/`KaartEditie`: die types wonen in
 * modules die deze ornamentmodule zélf importeren, en een cyclus daartussen is
 * het niet waard. De twee aanroepers geven hun eigen unions door, die
 * toewijsbaar zijn aan `string`.
 */
export function kiesOrnament(
  tierKey: string | undefined,
  editie: string | null,
): OrnamentSoort | null {
  if (editie === "onfire") return "onfire";
  // De overige vijf edities brengen (nog) geen ornament mee en laten dat van de
  // divisie dus gewoon staan.
  if (tierKey === "legende") return "goat";
  if (tierKey === "dictator") return "dictator";
  return null;
}
