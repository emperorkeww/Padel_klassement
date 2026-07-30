// Divisiekaart "Wannabe" (goud) — 1000–1099.
//
// Twee registers in één bestand, en dat is met opzet:
//
// * het `register` (vlakkleuren, lijst, inkt) is in #834 omgezet naar verweerd
//   karton met een walnoten lijst, gelijk met `goud.css` en met de
//   referentiegestuurde breakout in `wannabe/WannabeEffect.css`. Dát is wat de
//   live kaart en de poster laten zien;
// * de ornamenten en het motief hieronder — folieranden, crest, medaillon,
//   racketwatermerk — worden op de live kaart niet meer gemonteerd
//   (`divisieLive` in FutKaart.tsx zet ze uit voor de goud-divisie zonder
//   editie). Ze blijven staan voor de canvas-/posterfallback, precies zoals de
//   pias-, Piet- en GOAT-vectoren dat doen.
//
// Het oude thema van die ornamenten was overtuigende imitatie-luxe: op afstand
// een dure gouden kaart, van dichtbij verguld messing. Dat vraagt om twéé
// materialen die net niet bij elkaar horen — lichte champagnefolie over dof
// mosterdmessing — en om één eerlijk detail dat de illusie verraadt: het hoekje
// folie dat rechts loskomt. Dáárom is dat losse hoekje het enige asymmetrische
// deel van de kaart: symmetrie leest als afgewerkt, en juist de afwijking maakt
// van "goud" een imitatie.
//
// Waarom de ornamenten vooral in de `voor`-laag staan: de referentie legt zijn
// folieranden, crest en medaillon *in* de rand van de kaart, niet erachter. Onze
// randband is smaller dan die van de referentie (frame + liner + keyline ≈ 4,7
// units), dus een ornament áchter het schild zou er vrijwel volledig achter
// verdwijnen. De `achter`-laag draagt daarom alleen de dofmessing onderfolie:
// die steekt een streepje verder naar buiten dan de folierand erboven, zodat de
// rand als een strip leest die om de kaartrand heen vouwt — twee lagen, precies
// het punt van deze divisie.
//
// Vormen zijn hier gegenereerd i.p.v. uitgeschreven: `bouwRacket`,
// `prijskaartje`, `ovaal` en `blad` leveren polylijnen, en de lauwertak komt uit
// `bouwStreng` (dezelfde generator als de GOAT-hoorn). Dat houdt het racket in de
// crest, in het medaillon en in het watermerk letterlijk hetzelfde racket, en het
// houdt de padstrings vrij van boog-commando's — handig, want de geometrietest
// leest de coördinaten als platte x/y-paren.
//
// Coördinaten: kaart-units (100 breed × 139 hoog), motief in zijn eigen
// 0 0 100 100. Zie divisieKaart.ts voor het contract.

import type {
  DivisieDeel,
  DivisieGradient,
  DivisieKaart,
} from "./divisieKaart";
import type { OrnamentPad } from "../futKaartOrnamenten";
import { bouwStreng } from "../futKaartOrnamenten";

/* --------------------------------- palet --------------------------------- */

// Champagnefolie: de lichte, dunne laag die de kaart duur laat lijken. Bewust
// niet wit-goud maar crèmegeel — folie heeft een papierachtige toon.
const FOLIE_HI = "#fdf4d4";
const FOLIE_MID = "#e0c07a";
const FOLIE_LO = "#bd9740";
const FOLIE_DIEP = "#8a6a27";
// Mosterdmessing: wat er ónder de folie zit. Groener en doffer dan de folie,
// zodat de twee lagen op de kaart van elkaar te onderscheiden blijven.
const MESSING_HI = "#9d7b34";
const MESSING_LO = "#6b501a";
const MESSING_DIEP = "#543e12";
const CONTOUR = "#4a3510";
const GLANS = "rgba(255, 250, 224, 0.72)";
/** Schaduwlijn in de verdiepte delen (crest-nis, medaillonvlak, greep). */
const SCHADUW = "rgba(58, 41, 12, 0.45)";

/* ---------------------------- vormgeneratoren ---------------------------- */

type Punt = readonly [number, number];

const rond = (n: number) => Math.round(n * 100) / 100;

/** Draait een lokaal punt `hoek` graden met de klok mee (y loopt omlaag) en
 *  schuift het naar `(x, y)`. Eén plek voor de rotatiewiskunde, zodat racket,
 *  prijskaartje en blad dezelfde oriëntatie-afspraak delen. */
function draai(x: number, y: number, hoek: number) {
  const r = (hoek * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return (lx: number, ly: number): Punt => [
    x + lx * cos - ly * sin,
    y + lx * sin + ly * cos,
  ];
}

const plaats = (t: (lx: number, ly: number) => Punt, lx: number, ly: number) => {
  const p = t(lx, ly);
  return `${rond(p[0])} ${rond(p[1])}`;
};

const polylijn = (punten: readonly Punt[]) =>
  `M ${punten.map((p) => `${rond(p[0])} ${rond(p[1])}`).join(" L ")} Z`;

/** Gesloten ovaal als polylijn. Bewust geen A-commando: een boog draagt naast
 *  coördinaten ook radii en vlaggen, en dan leest een test die de padstring als
 *  x/y-paren parseert onzin. */
function ovaal(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  hoek = 0,
  stappen = 44,
): string {
  const t = draai(cx, cy, hoek);
  const punten: Punt[] = [];
  for (let i = 0; i < stappen; i++) {
    const a = (i / stappen) * Math.PI * 2;
    punten.push(t(rx * Math.sin(a), -ry * Math.cos(a)));
  }
  return polylijn(punten);
}

const cirkel = (cx: number, cy: number, r: number, stappen = 32) =>
  ovaal(cx, cy, r, r, 0, stappen);

interface RacketOpties {
  cx: number;
  cy: number;
  /** Halve breedte en halve lengte van de kop. */
  rx: number;
  ry: number;
  /** Kanteling in graden; positief = kop naar rechtsboven, greep naar
   *  linksonder — de stand uit de referentie. */
  hoek: number;
  /** Aantal snaren per richting. */
  snaren?: number;
  /** Lengte van hals + greep, als fractie van `ry`. */
  steel?: number;
}

/** Eén racket: kopframe, snaarbed, snaren en steel, elk als losse padstring.
 *  Zo tekenen de crest, het medaillon en het watermerk hetzelfde racket in drie
 *  maten — en blijft het silhouet van de divisie herkenbaar. */
function bouwRacket({
  cx,
  cy,
  rx,
  ry,
  hoek,
  snaren = 7,
  steel = 1.05,
}: RacketOpties) {
  const t = draai(cx, cy, hoek);
  // Snaarbed: de binnenrand van het frame. De snaren lopen exact tot deze ovaal,
  // dus hun koorden komen uit dezelfde radii — geen snaar steekt buiten het bed.
  const bx = rx * 0.72;
  const by = ry * 0.72;
  const koorden: string[] = [];
  for (let i = 1; i < snaren; i++) {
    const f = -1 + (2 * i) / snaren;
    const h = Math.sqrt(Math.max(0, 1 - f * f));
    koorden.push(`M ${plaats(t, f * bx, -by * h)} L ${plaats(t, f * bx, by * h)}`);
    koorden.push(`M ${plaats(t, -bx * h, f * by)} L ${plaats(t, bx * h, f * by)}`);
  }
  // Steel: V-hals die op de kopschouders aanzet en in een iets bredere greep
  // eindigt — zonder die knik leest een racket als een spiegel op een stok.
  const lang = ry * steel;
  const hals = rx * 0.2;
  const greep = rx * 0.26;
  const stok: Punt[] = [
    t(-rx * 0.58, ry * 0.8),
    t(-hals, ry + lang * 0.28),
    t(-greep, ry + lang),
    t(greep, ry + lang),
    t(hals, ry + lang * 0.28),
    t(rx * 0.58, ry * 0.8),
    t(rx * 0.3, ry * 0.96),
    t(hals * 0.55, ry + lang * 0.24),
    t(-hals * 0.55, ry + lang * 0.24),
    t(-rx * 0.3, ry * 0.96),
  ];
  return {
    kop: ovaal(cx, cy, rx, ry, hoek),
    bed: ovaal(cx, cy, bx, by, hoek),
    snaren: koorden.join(" "),
    steel: polylijn(stok),
    /** Ribbel op de greep — genoeg om hem als greep te lezen. */
    greepband: `M ${plaats(t, -greep * 0.9, ry + lang * 0.66)} L ${plaats(
      t,
      greep * 0.9,
      ry + lang * 0.66,
    )}`,
  };
}

/** Prijskaartje: geschuinde bovenkant met een gaatje, rechthoekig lijf. Het
 *  handelsmerk van deze divisie — het label dat nooit van de aankoop af gaat. */
function prijskaartje(x: number, y: number, b: number, h: number, hoek: number) {
  const t = draai(x, y, hoek);
  const rand: Punt[] = [
    t(-b * 0.2, 0),
    t(b * 0.2, 0),
    t(b * 0.5, b * 0.42),
    t(b * 0.5, h - b * 0.18),
    t(b * 0.32, h),
    t(-b * 0.32, h),
    t(-b * 0.5, h - b * 0.18),
    t(-b * 0.5, b * 0.42),
  ];
  const gat: Punt[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    gat.push(t(Math.sin(a) * b * 0.14, b * 0.34 - Math.cos(a) * b * 0.14));
  }
  return { rand: polylijn(rand), gat: polylijn(gat) };
}

/** Eén lauwerblad: spitse ovaal die vanaf `(x, y)` weg wijst. `hoek` in graden,
 *  0 = naar rechts — dezelfde afspraak als de dictator-krans. */
function blad(x: number, y: number, hoek: number, lengte: number): string {
  const t = draai(x, y, hoek);
  const breed = lengte * 0.32;
  const wortel = plaats(t, 0, 0);
  return (
    `M ${wortel} C ${plaats(t, lengte * 0.3, breed)} ` +
    `${plaats(t, lengte * 0.72, breed * 0.8)} ${plaats(t, lengte, 0)} ` +
    `C ${plaats(t, lengte * 0.72, -breed * 0.8)} ` +
    `${plaats(t, lengte * 0.3, -breed)} ${wortel} Z`
  );
}

/* ------------------------------- gradients ------------------------------- */

// Gradients staan in kaart-units (userSpaceOnUse) en dus per zone: één verloop
// over de hele kaart zou binnen een ornament van 20 units nauwelijks verlopen.
// De zij-gradient loopt bewust diagonaal — een gespiegeld deel spiegelt zijn
// verloop mee, dus links en rechts vangen het licht van dezelfde kant. De
// gradients op de as (crest, medaillon) staan juist strikt verticaal: een
// horizontale component zou daar op x=50 een zichtbare naad geven.
const GRADIENTEN: readonly DivisieGradient[] = [
  {
    id: "fut-div-goud-folie-boven",
    as: [0, -10, 0, 20],
    stops: [
      [0, FOLIE_HI],
      [0.38, FOLIE_MID],
      [0.72, FOLIE_LO],
      [1, FOLIE_DIEP],
    ],
  },
  {
    id: "fut-div-goud-messing-boven",
    as: [0, -6, 0, 18],
    stops: [
      [0, MESSING_DIEP],
      [0.55, MESSING_HI],
      [1, MESSING_LO],
    ],
  },
  {
    id: "fut-div-goud-folie-zij",
    as: [5, 33, -3, 82],
    stops: [
      [0, FOLIE_HI],
      [0.34, FOLIE_MID],
      [0.74, FOLIE_LO],
      [1, FOLIE_DIEP],
    ],
  },
  {
    id: "fut-div-goud-messing-zij",
    as: [5, 33, -3, 82],
    stops: [
      [0, MESSING_HI],
      [1, MESSING_DIEP],
    ],
  },
  {
    id: "fut-div-goud-folie-punt",
    as: [0, 105, 0, 148],
    stops: [
      [0, FOLIE_HI],
      [0.34, FOLIE_MID],
      [0.7, FOLIE_LO],
      [1, FOLIE_DIEP],
    ],
  },
  {
    id: "fut-div-goud-messing-punt",
    as: [0, 108, 0, 132],
    stops: [
      [0, MESSING_DIEP],
      [0.6, MESSING_HI],
      [1, MESSING_LO],
    ],
  },
  {
    // Losgekomen folie: het lichtste van de kaart op de vouw (daar staat het
    // folie recht in het licht), dof aan de teruggeslagen achterzijde.
    id: "fut-div-goud-flap",
    as: [101, 60, 89, 86],
    stops: [
      [0, FOLIE_LO],
      [0.42, FOLIE_HI],
      [1, "#a8863a"],
    ],
  },
] as const;

/* --------------------------------- crest --------------------------------- */

// De crest zit in de bovenste inkeping: het schild dipt daar 3 units in, en deze
// plaat vult die dip en steekt ~7 units boven de kaart uit. Alleen de
// linkerhelft staat hier; `spiegel: true` maakt de rechterhelft, dus de plaat kan
// per constructie niet scheef staan. Het racket erin is juist wél asymmetrisch:
// een racket dat recht vooruit staat leest als een spiegel.
const CREST_PLAAT =
  "M 50 -6.8 C 44.4 -6.8, 40 -4.5, 37.4 -0.2 " +
  "C 36.2 1.9, 36 4.7, 36.6 7.4 C 38 12.4, 42.6 16, 50 17.4 Z";
const CREST_NIS =
  "M 50 -4.4 C 45.4 -4.4, 41.8 -2.5, 39.6 1.1 " +
  "C 38.6 2.9, 38.5 5.1, 39 7.3 C 40.2 11.4, 43.9 14.5, 50 15.5 Z";

// Opgemeten uit de referentie en omgerekend naar kaart-units: kop ±4 breed en
// ±4,9 lang rond (49,3 · 2,2), kanteling ~20°, het kaartje aan de rechterschouder.
const CREST_RACKET = bouwRacket({
  cx: 49.3,
  cy: 2.2,
  rx: 4,
  ry: 4.9,
  hoek: 20,
  snaren: 6,
  steel: 1.1,
});
const CREST_RING = cirkel(52.8, 6.4, 1.05, 16);
const CREST_KAARTJE = prijskaartje(54.3, 7.4, 6.2, 7.8, 14);

/* ----------------------------- folieranden ------------------------------ */

// Folierand: een aan beide kanten spitse strip over de zijrand van de kaart, met
// een streepje eroverheen naar buiten. De strip loopt van v≈36 tot v≈78 — boven
// de taille (v=83,4), want daaronder buigt het schild naar binnen en zou de
// rechte strip los van de rand komen te liggen.
const RAND_AS = 1.5;
const RAND_TOP = 35.6;
const RAND_ONDER = 78.4;
const FOLIERAND =
  `M ${RAND_AS} ${RAND_TOP} C 4.8 42, 4.9 50, 4.9 57 ` +
  `C 4.9 65, 4.6 72, ${RAND_AS} ${RAND_ONDER} ` +
  `C -1.6 72, -1.9 65, -1.9 57 C -1.9 50, -1.8 42, ${RAND_AS} ${RAND_TOP} Z`;
// Onderfolie (`achter`-laag): dezelfde lens, 1,6 units ruimer. Daardoor blijft er
// náást de kaart een dofmessing zoom zichtbaar en leest de folie als een strip
// die om de rand heen vouwt.
const FOLIERAND_ONDER =
  "M 0.4 34 C 3.6 41, 3.7 50, 3.7 57 C 3.7 65.5, 3.4 72.8, 0.4 80 " +
  "C -3.2 72.8, -3.5 65.5, -3.5 57 C -3.5 50, -3.4 41, 0.4 34 Z";

/** Diagonale ribbels in de folierand — geperst folie, geen vlakke strip. De
 *  halve breedte volgt de lens, zodat geen ribbel buiten de strip valt. */
const FOLIERAND_RIBBELS = (() => {
  const midden = (RAND_TOP + RAND_ONDER) / 2;
  const halve = (RAND_ONDER - RAND_TOP) / 2;
  const uit: string[] = [];
  for (let v = RAND_TOP + 3.6; v < RAND_ONDER - 3.4; v += 4.4) {
    const f = (v - midden) / halve;
    const hw = 3.3 * Math.sqrt(Math.max(0, 1 - f * f)) * 0.78;
    uit.push(
      `M ${rond(RAND_AS - hw)} ${rond(v + 1.5)} L ${rond(RAND_AS + hw)} ${rond(
        v - 1.5,
      )}`,
    );
  }
  return uit.join(" ");
})();
const FOLIERAND_GLANS = "M 3.7 43.5 C 4.5 50, 4.5 64, 3.5 70.5";

// Het losgekomen hoekje: rechts, op de rechte zijrand boven de taille. Bewust
// niet gespiegeld — één plek, precies zoals de referentie vraagt. Drie delen: de
// donkere scheur langs de rand (wat eronder zit), het teruggeslagen folie met
// zijn oprolling, en de glanslijn op de vouw.
const FLAP_SCHEUR =
  "M 100.6 60 C 100.2 68.6, 99.5 76.6, 98.7 84.2 L 96.2 82.2 " +
  "C 97.3 75, 98.3 67.2, 98.9 59.8 Z";
const FLAP =
  "M 100.6 60 C 98.4 67.2, 95.2 73.2, 91.2 77 " +
  "C 89.9 78.2, 90.1 80.1, 91.9 80.7 " +
  "C 94.6 81.6, 96.9 82.6, 98.7 84.2 Z";
const FLAP_VOUW = "M 99.8 63.4 C 97.6 70, 94.9 75.2, 91.6 78.6";

/* ------------------------------- medaillon ------------------------------- */

// Medaillon in de kaartpunt: folieren ring, verzonken messingvlak, racket erin en
// twee halve lauwertakjes ernaast. De ring begint op v≈108 — net onder de
// divisieregel, die op de volste zetting tot ±v=110 komt; hij ligt in de
// `voor`-laag en zou tekst anders bedekken. Het kaartje hangt aan een kettinkje
// onder de schildpunt (v=139) door en steekt dus écht buiten de kaart uit.
const MEDAILLE_MIDDEN: Punt = [50, 119.5];
const MEDAILLE_RING = cirkel(MEDAILLE_MIDDEN[0], MEDAILLE_MIDDEN[1], 11.4, 40);
const MEDAILLE_VLAK = cirkel(MEDAILLE_MIDDEN[0], MEDAILLE_MIDDEN[1], 9.5, 36);
const MEDAILLE_RACKET = bouwRacket({
  cx: 50.6,
  cy: 117.6,
  rx: 4.4,
  ry: 5.6,
  hoek: 18,
  snaren: 7,
  steel: 1,
});

/** Lauwertakje naast het medaillon; `bouwStreng` levert de getaperde stengel. */
const MEDAILLE_TAK = bouwStreng({
  start: [41.8, 126.4],
  segmenten: [
    [
      [39.2, 124.6],
      [36.4, 122],
      [34.6, 118.4],
    ],
    [
      [34, 117.2],
      [33.6, 116.2],
      [33.4, 115],
    ],
  ],
  dikte: 0.85,
  taper: 1.5,
  punt: 0.1,
  stappen: 24,
});
const MEDAILLE_BLADEN = (
  [
    [40.2, 124.6, 236, 5.4],
    [37.7, 121.6, 232, 5.8],
    [35.6, 118.4, 226, 5.6],
    [34.2, 115.8, 220, 5],
    [39.5, 125.6, 200, 4.2],
    [37, 122.6, 196, 4.4],
  ] as const
)
  .map(([x, y, hoek, lengte]) => blad(x, y, hoek, lengte))
  .join(" ");

/** Kettinkje van het medaillon naar het kaartje: drie schakels. */
const MEDAILLE_KETTING = [
  ovaal(51.9, 129.4, 0.85, 1.25, 20, 14),
  ovaal(53, 131.4, 0.85, 1.25, 20, 14),
  ovaal(54.1, 133.4, 0.85, 1.25, 20, 14),
].join(" ");
const MEDAILLE_KAARTJE = prijskaartje(55.4, 134.4, 8.2, 11.2, 12);

/* --------------------------------- lagen --------------------------------- */

const ACHTER: readonly DivisieDeel[] = [
  {
    d: FOLIERAND_ONDER,
    vulling: "url(#fut-div-goud-messing-zij)",
    contour: CONTOUR,
    contourBreedte: 0.35,
    spiegel: true,
  },
] as const;

const VOOR: readonly DivisieDeel[] = [
  // Folieranden langs beide zijden.
  {
    d: FOLIERAND,
    vulling: "url(#fut-div-goud-folie-zij)",
    contour: CONTOUR,
    contourBreedte: 0.35,
    spiegel: true,
  },
  { d: FOLIERAND_RIBBELS, contour: SCHADUW, contourBreedte: 0.3, spiegel: true },
  { d: FOLIERAND_GLANS, contour: GLANS, contourBreedte: 0.45, spiegel: true },
  // Het losgekomen hoekje (alleen rechts).
  { d: FLAP_SCHEUR, vulling: MESSING_DIEP, alpha: 0.9 },
  {
    d: FLAP,
    vulling: "url(#fut-div-goud-flap)",
    contour: CONTOUR,
    contourBreedte: 0.3,
  },
  { d: FLAP_VOUW, contour: GLANS, contourBreedte: 0.4 },
  // Crest in de bovenste inkeping.
  {
    d: CREST_PLAAT,
    vulling: "url(#fut-div-goud-folie-boven)",
    contour: CONTOUR,
    contourBreedte: 0.4,
    spiegel: true,
  },
  {
    d: CREST_NIS,
    vulling: "url(#fut-div-goud-messing-boven)",
    contour: GLANS,
    contourBreedte: 0.3,
    spiegel: true,
  },
  {
    d: CREST_RACKET.kop,
    vulling: "url(#fut-div-goud-folie-boven)",
    contour: CONTOUR,
    contourBreedte: 0.35,
  },
  { d: CREST_RACKET.bed, vulling: MESSING_LO, alpha: 0.85 },
  { d: CREST_RACKET.snaren, contour: FOLIE_MID, contourBreedte: 0.22 },
  {
    d: CREST_RACKET.steel,
    vulling: "url(#fut-div-goud-folie-boven)",
    contour: CONTOUR,
    contourBreedte: 0.3,
  },
  { d: CREST_RACKET.greepband, contour: SCHADUW, contourBreedte: 0.3 },
  { d: CREST_RING, contour: FOLIE_HI, contourBreedte: 0.45 },
  {
    d: CREST_KAARTJE.rand,
    vulling: "url(#fut-div-goud-folie-boven)",
    contour: CONTOUR,
    contourBreedte: 0.35,
  },
  { d: CREST_KAARTJE.gat, vulling: MESSING_DIEP, alpha: 0.85 },
  // Medaillon in de kaartpunt.
  {
    d: MEDAILLE_TAK.omtrek,
    vulling: "url(#fut-div-goud-folie-punt)",
    contour: CONTOUR,
    contourBreedte: 0.25,
    spiegel: true,
  },
  {
    d: MEDAILLE_BLADEN,
    vulling: "url(#fut-div-goud-folie-punt)",
    contour: CONTOUR,
    contourBreedte: 0.25,
    spiegel: true,
  },
  {
    d: MEDAILLE_RING,
    vulling: "url(#fut-div-goud-folie-punt)",
    contour: CONTOUR,
    contourBreedte: 0.4,
  },
  {
    d: MEDAILLE_VLAK,
    vulling: "url(#fut-div-goud-messing-punt)",
    contour: GLANS,
    contourBreedte: 0.3,
  },
  {
    d: MEDAILLE_RACKET.kop,
    vulling: "url(#fut-div-goud-folie-punt)",
    contour: CONTOUR,
    contourBreedte: 0.35,
  },
  { d: MEDAILLE_RACKET.bed, vulling: MESSING_LO, alpha: 0.85 },
  { d: MEDAILLE_RACKET.snaren, contour: FOLIE_MID, contourBreedte: 0.24 },
  {
    d: MEDAILLE_RACKET.steel,
    vulling: "url(#fut-div-goud-folie-punt)",
    contour: CONTOUR,
    contourBreedte: 0.3,
  },
  { d: MEDAILLE_RACKET.greepband, contour: SCHADUW, contourBreedte: 0.3 },
  {
    d: MEDAILLE_KETTING,
    vulling: "url(#fut-div-goud-folie-punt)",
    contour: CONTOUR,
    contourBreedte: 0.25,
  },
  {
    d: MEDAILLE_KAARTJE.rand,
    vulling: "url(#fut-div-goud-folie-punt)",
    contour: CONTOUR,
    contourBreedte: 0.4,
  },
  { d: MEDAILLE_KAARTJE.gat, vulling: MESSING_DIEP, alpha: 0.85 },
] as const;

/* --------------------------------- motief -------------------------------- */

// Watermerk: het snaarbed van een racket met een prijskaartje eraan, geëtst over
// het vlak. De referentie legt een fijn snarengrid over de kaart; als motief
// blijft dat één gedeelde bron voor DOM én poster — een extra CSS-achtergrondlaag
// zou de poster niet meekrijgen. Het is hetzelfde racket als in de crest en het
// medaillon, alleen groter, dus de kaart herhaalt één motief in drie maten.
const MOTIEF_RACKET = bouwRacket({
  cx: 50,
  cy: 40,
  rx: 26,
  ry: 31,
  hoek: 16,
  snaren: 10,
  steel: 1.15,
});
const MOTIEF_KAARTJE = prijskaartje(63, 70, 17, 22, 14);

const MOTIEF: readonly OrnamentPad[] = [
  { d: MOTIEF_RACKET.kop, soort: "lijn", breedte: 1.5 },
  { d: MOTIEF_RACKET.bed, soort: "lijn", breedte: 0.7, alpha: 0.8 },
  { d: MOTIEF_RACKET.snaren, soort: "lijn", breedte: 0.7, alpha: 0.65 },
  { d: MOTIEF_RACKET.steel, soort: "lijn", breedte: 1.2 },
  { d: MOTIEF_KAARTJE.rand, soort: "lijn", breedte: 1.1, alpha: 0.85 },
  { d: MOTIEF_KAARTJE.gat, soort: "lijn", breedte: 0.7, alpha: 0.7 },
] as const;

/* -------------------------------- register ------------------------------- */

export const DIVISIE_GOUD: DivisieKaart = {
  key: "goud",
  naam: "Wannabe",
  // Spiegel van het `.fut-kaart--goud`-blok in goud.css. Beide zijn in #834
  // omgezet van champagnefolie naar verweerd karton met een walnoten lijst; zie
  // de kop van goud.css voor waarom.
  //
  // Contrast (WCAG, berekend op de lichtste én de donkerste vlak-stop):
  // ink #3c2b1a op #ece5d7 = 10,79:1 en op #c9bfae = 7,44:1; op de hoogte van de
  // divisieregel (~78% van het vlak, dus ±#d4cab9) 8,34:1. inkSoft #5a4530 haalt
  // 7,20:1 / 4,96:1 / 5,56:1 — ook de zwakste combinatie blijft dus boven AA
  // (4,5:1) voor kleine tekst. De divisieregel zelf staat op zijn tanne strook
  // (#4a3520 op ±#d8bf99 = 6,50:1); die strook staat in goud.css.
  register: {
    frame: [
      [0, "#6d5539"],
      [0.32, "#3c2b1c"],
      [0.6, "#6a5236"],
      [1, "#241a11"],
    ],
    liner: "#e8dfce",
    keyline: "#f2ead8",
    vlak: ["#ece5d7", "#dfd6c6", "#c9bfae"],
    // Randdiktes: de walnoten band is op de referentie ±2,9% van de
    // kaartbreedte met een crème binnenband van 1,7% en een donkere haarlijn van
    // 0,4%. Spiegel van de drie `--kaart-*-dikte`-clamps in goud.css.
    randDiktes: [0.029, 0.017, 0.004],
    // Flauwe lichtkern linksboven i.p.v. de gedeelde topgloed: de referentie
    // licht op in de hoek waar de plaat in het licht hing.
    glow: "rgba(255, 253, 244, 0.28)",
    // Eén brede, bijna kleurloze streep. De iriserende folieband van vóór #834
    // is weg: karton kantelt niet mee, en de referentie heeft geen glans maar
    // slijtage.
    sheen: "rgba(255, 252, 242, 0.16)",
    sheenSpreiding: 0.2,
    ink: "#3c2b1a",
    inkSoft: "#5a4530",
    lijn: "#8f7752",
    // De plaat is dik en werpt schaduw op zijn eigen ondergrond.
    echo: [[0.012, 0.016, "rgba(52, 38, 22, 0.62)"]],
    // De donkere haarlijn tussen crème band en kaartvlak zit hier en niet in de
    // keyline: die is per definitie licht (#666) en de canvasrenderer heeft daar
    // een invariant op.
    binnenlijn: [
      [2, "rgba(74, 53, 30, 0.58)"],
      [3, "rgba(255, 250, 236, 0.4)"],
    ],
    // Geen stralenkrans: de referentie is een matte kartonplaat. Het vuil komt
    // op de live kaart uit wannabe-master.webp; de poster houdt het bij de
    // vlekwerking van `glow` en `echo`.
    stralen: false,
  },
  gradienten: GRADIENTEN,
  achter: ACHTER,
  voor: VOOR,
  motief: {
    paden: MOTIEF,
    kleur: "rgba(122, 92, 30, 0.11)",
    breedte: 0.86,
    positie: 0.24,
  },
};
