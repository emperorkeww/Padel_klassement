// Divisiekaart "Ballenraper" (hout) — 700–799 — walnoot, versleten leer en netmateriaal.
//
// De kaart is een stuk clubinventaris: een geschuurde walnoten plank in een
// donkere umber rand, met gevlochten netstroken op leren riemen langs de
// flanken, een ballenmand-crest in de bovenrand en een draadmand met één
// tennisbal in de kaartpunt. Het blijft bewust gereedschap en geen trofee: geen
// stralenkrans, geen bewegende glansbaan en geen tweede metaal — het duurste aan
// deze kaart is dat het hout geschuurd is.
//
// Waar deze divisie in de ladder staat, en hoe je dat ziet:
//
//   Stofzuiger (karton, eronder)  gestanste vezelplaat, ornamenten ín de plaat.
//   Ballenraper (hier)            massief hout, ornamenten dóór de rand heen.
//   Bankvuller (brons, erboven)   leer met kóper — een tweede, duur materiaal.
//
// Robuuster dan de plaat eronder (de netstroken komen echt naast de kaart
// vandaan, de mand hangt uit de punt), maar duidelijk lager dan de bank erboven:
// daar zit gepolijst koper in de rand en hier alleen hout, leer en touw.
//
// Twee keuzes die de rest van het bestand verklaren:
//
// 1. Vaste hexen i.p.v. color-mix op var(--tier). De deel-poster staat vast op
//    het lichte palet (#125), dus alleen literalen houden DOM-kaart en poster in
//    béide thema's gelijk — hetzelfde tokenregime als de rest van #710. De
//    synctest in hout.test.ts leest hout.css als tekst in en houdt het register
//    hieronder daaraan gelijk.
// 2. De balbanen, de slijtplekken en de baangrond zitten in het motief (onder de
//    informatielaag), niet in de ornamentlaag. Twee redenen: de ornamentlaag
//    valt búiten de schildclip en dus deels op de app-achtergrond, waar een
//    donkere streepjeslijn in het donkere thema onzichtbaar is; en een textuur
//    hoort per referentie-instructie onder de inkt te blijven. Wat wél in de
//    ornamentlaag staat, is telkens een gevulde vorm met contour — die leest op
//    elke achtergrond.
//
// Coördinaten: kaart-units (100 breed × 139 hoog), oorsprong linksboven op de
// kaart; zie divisieKaart.ts. De netstroken staan alleen als linkerhelft in dit
// bestand en dragen `spiegel: true`, zodat links en rechts per constructie niet
// uit elkaar kunnen lopen. Crest en mand staan óp de as en zijn uit zichzelf
// symmetrisch (de generatoren hieronder rekenen met een halve breedte om x=50).
//
// Bewust geen A-commando's in de paden: de geometrietest leest pad-data als
// platte getallenparen, en de rx/ry/rotatie/vlaggen van een boog zouden daar als
// punten in meelopen. Alle rondingen komen dus uit cubics.

import type { OrnamentPad } from "../futKaartOrnamenten";
import type {
  DivisieDeel,
  DivisieGradient,
  DivisieKaart,
} from "./divisieKaart";

const rond = (n: number) => Math.round(n * 100) / 100;

type Punt = readonly [number, number];

/* ------------------------------- materiaal ------------------------------- */

/** Donkere umber contour: de schaduwkant van elk stuk hout op deze kaart. */
const HOUT_CONTOUR = "#1e1207";
/** Geschuurde walnoot als lijn — de opstaande kant van een lat of manddraad. */
const HOUT_GLANS = "#c39a63";
/** Netkoord: de bovenliggende streng vangt licht, de onderliggende ligt in de
 *  schaduw. Twee tinten i.p.v. één, want dát is het verschil tussen een
 *  gevlochten strook en een ruitjespatroon. */
const KOORD_OVER = "#d3bd97";
const KOORD_ONDER = "#9b7f54";
/** Draad van het stiksel in de leren riemen. */
const DRAAD = "#e0c795";
/** De tennisbal in de mand is het énige verzadigde accent op de kaart: alle
 *  andere losse ballen uit de referentie zijn bewust weggelaten — één bal is een
 *  accent, twee ballen zijn een patroon. Naad in vuilwit, contour in olijf,
 *  zodat de bal niet op de donkere mand gaat zweven. */
const BAL_NAAD = "rgba(255, 255, 240, 0.72)";
const BAL_CONTOUR = "#5d6b16";
/** Etskleur van het motief: de kaartinkt op zeer lage dekking. 0,05 is geen
 *  smaakkeuze maar de contrastgrens — zie de meting in hout.css. */
const ETS = "rgba(36, 22, 6, 0.05)";

/* ---------------------------- vormgereedschap ---------------------------- */

/** Cirkel-benadering met cubics: 0,5523 × r als controlepuntafstand. */
const K = 0.5523;

/** Cirkel als vier cubics — de tennisbal. */
function cirkelPad(cx: number, cy: number, r: number): string {
  const k = rond(r * K);
  const [l, re, t, b] = [rond(cx - r), rond(cx + r), rond(cy - r), rond(cy + r)];
  return (
    `M ${l} ${cy} ` +
    `C ${l} ${rond(cy - k)}, ${rond(cx - k)} ${t}, ${cx} ${t} ` +
    `C ${rond(cx + k)} ${t}, ${re} ${rond(cy - k)}, ${re} ${cy} ` +
    `C ${re} ${rond(cy + k)}, ${rond(cx + k)} ${b}, ${cx} ${b} ` +
    `C ${rond(cx - k)} ${b}, ${l} ${rond(cy + k)}, ${l} ${cy} Z`
  );
}

/** Verticale lat met afgeronde búitenhoeken: `xBinnen` verdwijnt onder de kaart,
 *  dus daar hoeft niets afgerond te worden. Gebruikt voor de netstrook en de
 *  twee leren riemen eromheen. */
function lat(
  xBuiten: number,
  xBinnen: number,
  vTop: number,
  vBot: number,
  r: number,
): string {
  const hk = rond(r * K);
  return (
    `M ${xBinnen} ${vTop} L ${rond(xBuiten + r)} ${vTop} ` +
    `C ${rond(xBuiten + r - hk)} ${vTop}, ${xBuiten} ${rond(vTop + r - hk)}, ${xBuiten} ${rond(vTop + r)} ` +
    `L ${xBuiten} ${rond(vBot - r)} ` +
    `C ${xBuiten} ${rond(vBot - r + hk)}, ${rond(xBuiten + r - hk)} ${vBot}, ${rond(xBuiten + r)} ${vBot} ` +
    `L ${xBinnen} ${vBot} Z`
  );
}

/** Symmetrische balk om x=50 met vier afgeronde hoeken — de mandrand. */
function balk(vTop: number, vBot: number, half: number, r: number): string {
  const [l, re] = [rond(50 - half), rond(50 + half)];
  return (
    `M ${rond(l + r)} ${vTop} L ${rond(re - r)} ${vTop} ` +
    `C ${re} ${vTop}, ${re} ${vTop}, ${re} ${rond(vTop + r)} ` +
    `L ${re} ${rond(vBot - r)} ` +
    `C ${re} ${vBot}, ${re} ${vBot}, ${rond(re - r)} ${vBot} ` +
    `L ${rond(l + r)} ${vBot} ` +
    `C ${l} ${vBot}, ${l} ${vBot}, ${l} ${rond(vBot - r)} ` +
    `L ${l} ${rond(vTop + r)} ` +
    `C ${l} ${vTop}, ${l} ${vTop}, ${rond(l + r)} ${vTop} Z`
  );
}

interface MandVorm {
  vTop: number;
  halfTop: number;
  vBot: number;
  halfBot: number;
  /** Afronding van de twee ónderhoeken; de bovenrand loopt onder de mandrand
   *  door en blijft dus recht. */
  r: number;
}

/** Mandsilhouet: een naar onderen toelopende trog om x=50. Zowel de crest in de
 *  bovenrand als het medaillon in de punt is er een — dezelfde vorm op twee
 *  maten, zodat de kaart één mand toont en geen twee losse motieven. Symmetrie
 *  is per constructie: elke x komt uit 50 ± halve breedte. */
function mand({ vTop, halfTop, vBot, halfBot, r }: MandVorm): string {
  // x op hoogte v langs de linkerflank, en het punt waar de afronding begint.
  const flank = (v: number) =>
    rond(50 - halfTop + ((halfTop - halfBot) * (v - vTop)) / (vBot - vTop));
  const vHoek = rond(vBot - r);
  const [xl, xr] = [flank(vHoek), rond(100 - flank(vHoek))];
  const [bl, br] = [rond(50 - halfBot + r), rond(50 + halfBot - r)];
  const [hl, hr] = [rond(50 - halfBot), rond(50 + halfBot)];
  return (
    `M ${rond(50 - halfTop)} ${vTop} L ${xl} ${vHoek} ` +
    `C ${hl} ${vBot}, ${hl} ${vBot}, ${bl} ${vBot} ` +
    `L ${br} ${vBot} ` +
    `C ${hr} ${vBot}, ${hr} ${vBot}, ${xr} ${vHoek} ` +
    `L ${rond(50 + halfTop)} ${vTop} Z`
  );
}

/** Het draadwerk ín een mand: vijf draden die met de taps toelopende flanken
 *  meebuigen plus horizontale hoepels op de meegegeven hoogtes. Rekent met
 *  dezelfde maten als de mand zelf, dus een wijziging aan de vorm neemt het
 *  draadwerk mee — anders schuift het draad bij de eerste maatwijziging door de
 *  mandwand heen. */
function manddraad(vorm: MandVorm, hoepels: readonly number[]): string {
  const { vTop, halfTop, vBot, halfBot } = vorm;
  const half = (v: number) =>
    rond(halfTop + ((halfBot - halfTop) * (v - vTop)) / (vBot - vTop));
  const draden = [-0.68, -0.34, 0, 0.34, 0.68].map(
    (f) =>
      `M ${rond(50 + f * halfTop)} ${vTop} L ${rond(50 + f * halfBot)} ${vBot}`,
  );
  const ringen = hoepels.map(
    (v) => `M ${rond(50 - half(v))} ${v} L ${rond(50 + half(v))} ${v}`,
  );
  return [...draden, ...ringen].join(" ");
}

/** Gevlochten strook: twee families diagonalen van 45° over een rechthoek. De
 *  onderliggende familie wordt bij élke kruising onderbroken, en dát maakt het
 *  vlechtwerk — twee families die elkaar ongehinderd kruisen leest als gaas.
 *
 *  Beide families staan als één pad met losse M/L-subpaden, zodat de SVG- en de
 *  canvas-tekenaar er elk één stroke van maken. */
function vlechtwerk(
  x0: number,
  x1: number,
  v0: number,
  v1: number,
  spatie: number,
  gat: number,
): { over: string; onder: string } {
  const stap = spatie * Math.SQRT2;
  // Familie "over": v = x + c. Familie "onder": v = k − x.
  const cs: number[] = [];
  for (let c = Math.ceil((v0 - x1) / stap) * stap; c < v1 - x0; c += stap)
    cs.push(c);
  const ks: number[] = [];
  for (let k = Math.ceil((v0 + x0) / stap) * stap; k < v1 + x1; k += stap)
    ks.push(k);

  const segment = (ax: number, ay: number, bx: number, by: number) =>
    `M ${rond(ax)} ${rond(ay)} L ${rond(bx)} ${rond(by)}`;

  const over = cs
    .map((c) => {
      const xa = Math.max(x0, v0 - c);
      const xb = Math.min(x1, v1 - c);
      return xb - xa > 0.6 ? segment(xa, xa + c, xb, xb + c) : "";
    })
    .filter(Boolean);

  const onder = ks.flatMap((k) => {
    const xa = Math.max(x0, k - v1);
    const xb = Math.min(x1, k - v0);
    if (xb - xa <= 0.6) return [];
    // Kruisingen met de bovenliggende strengen: v = x + c en v = k − x snijden
    // op x = (k − c)/2. Daar valt een gat van `gat` breed in de x-richting.
    const kruisingen = cs
      .map((c) => (k - c) / 2)
      .filter((x) => x > xa + gat && x < xb - gat)
      .sort((a, b) => a - b);
    const stukken: string[] = [];
    let x = xa;
    for (const kruising of kruisingen) {
      stukken.push(segment(x, k - x, kruising - gat / 2, k - kruising + gat / 2));
      x = kruising + gat / 2;
    }
    stukken.push(segment(x, k - x, xb, k - xb));
    return stukken;
  });

  return { over: over.join(" "), onder: onder.join(" ") };
}

/** Streepjesnaad langs een rechte lijn: het stiksel in de leren riemen. */
function stiksel(
  v: number,
  x0: number,
  x1: number,
  streep = 1.5,
  gat = 1.2,
): string {
  const uit: string[] = [];
  for (let x = x0; x + streep <= x1; x += streep + gat)
    uit.push(`M ${rond(x)} ${v} L ${rond(x + streep)} ${v}`);
  return uit.join(" ");
}

function cubic(p0: Punt, c1: Punt, c2: Punt, p3: Punt, t: number): Punt {
  const u = 1 - t;
  const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [
    a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0],
    a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1],
  ];
}

/** Streepjeslijn langs een cubic: korte segmenten met gaten ertussen. De
 *  motieflaag kent geen stroke-dasharray (canvas leest die niet mee), dus het
 *  streepjespatroon zit hier in de geometrie. */
function streepjesBaan(
  p0: Punt,
  c1: Punt,
  c2: Punt,
  p3: Punt,
  aantal: number,
): string[] {
  const uit: string[] = [];
  for (let i = 0; i < aantal; i++) {
    const a = cubic(p0, c1, c2, p3, i / aantal);
    const b = cubic(p0, c1, c2, p3, (i + 0.62) / aantal);
    uit.push(`M ${rond(a[0])} ${rond(a[1])} L ${rond(b[0])} ${rond(b[1])}`);
  }
  return uit;
}

/** Slijtplek: een scheve, gesloten vlek. Bewust geen nette ellips — een
 *  afgesleten plek op een plank heeft geen middelpunt. `scheef` trekt de vier
 *  controlepunten uit balans, dus elke plek is anders zonder dat er vier
 *  handgeschreven paden nodig zijn. */
function slijtplek(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  scheef: number,
): string {
  const kx = rx * K;
  const ky = ry * K;
  const p = (x: number, y: number) => `${rond(x)} ${rond(y)}`;
  return (
    `M ${p(cx - rx, cy)} ` +
    `C ${p(cx - rx, cy - ky * (1 + scheef))}, ${p(cx - kx, cy - ry)}, ${p(cx, cy - ry * (1 - scheef * 0.4))} ` +
    `C ${p(cx + kx * (1 + scheef), cy - ry)}, ${p(cx + rx, cy - ky)}, ${p(cx + rx * (1 + scheef * 0.3), cy)} ` +
    `C ${p(cx + rx, cy + ky)}, ${p(cx + kx, cy + ry * (1 + scheef * 0.5))}, ${p(cx, cy + ry)} ` +
    `C ${p(cx - kx * (1 + scheef), cy + ry)}, ${p(cx - rx, cy + ky)}, ${p(cx - rx, cy)} Z`
  );
}

/* ------------------------------- gradients ------------------------------- */

// Id-prefix `fut-div-hout-`, zodat de acht andere divisies niet botsen. De assen
// staan in kaart-units (userSpaceOnUse): bij een gespiegeld deel kantelt het
// licht mee, waardoor links en rechts elk op hun eigen flank oplichten.
//
// De strook-assen lopen bewust hórizontaal en niet met de strook mee: het
// zichtbare stuk ligt links van de kaartrand (u < 0), en met een verticale as
// zou de bovenste riem een andere tint krijgen dan de onderste terwijl ze uit
// hetzelfde stuk leer komen.
const STROOK_LINKS = -8.8;
const STROOK_RECHTS = 4.6;

const GRADIENTEN: readonly DivisieGradient[] = [
  {
    // Dwars over de netlat: donkere buitenkant, geschuurde rug, dan weg onder
    // de kaart. Dát maakt het verschil tussen een lat en een bruine streep.
    id: "fut-div-hout-walnoot",
    as: [STROOK_LINKS, 0, STROOK_RECHTS, 0],
    stops: [
      [0, "#2c1b0b"],
      [0.3, "#75512a"],
      [0.62, "#432d18"],
      [1, "#20130a"],
    ],
  },
  {
    // Versleten leer: licht op de plek waar de riem over de lat buigt, donker
    // in de vouw ernaast.
    id: "fut-div-hout-leer",
    as: [STROOK_LINKS, 0, STROOK_RECHTS, 0],
    stops: [
      [0, "#5a3a1c"],
      [0.34, "#7d5429"],
      [0.66, "#3d2612"],
      [1, "#241608"],
    ],
  },
  {
    // Crest-mand: geschuurd walnoot van boven naar onder.
    id: "fut-div-hout-crest",
    as: [50, -12.2, 50, 10.4],
    stops: [
      [0, "#8a6132"],
      [0.44, "#5b3d1e"],
      [1, "#2e1d0d"],
    ],
  },
  {
    // De holte ín een mand: bijna zwart, want een mand die licht vangt in zijn
    // opening leest als een dichte plaat.
    id: "fut-div-hout-crest-holte",
    as: [50, -7.2, 50, 8.8],
    stops: [
      [0, "#3a2410"],
      [1, "#1c1107"],
    ],
  },
  {
    id: "fut-div-hout-mand",
    as: [50, 116.4, 50, 136.4],
    stops: [
      [0, "#8a6132"],
      [0.42, "#5b3d1e"],
      [1, "#2b1b0c"],
    ],
  },
  {
    id: "fut-div-hout-mand-holte",
    as: [50, 120.6, 50, 134.8],
    stops: [
      [0, "#382310"],
      [1, "#1b1006"],
    ],
  },
  {
    // Het accent: tennisbalgroen met de lichtval linksboven. Eén bal, één
    // gradient — de rest van de kaart is hout, leer en touw.
    id: "fut-div-hout-bal",
    as: [45, 121.4, 55.5, 132],
    stops: [
      [0, "#dcea70"],
      [0.46, "#c2d34a"],
      [1, "#87a02a"],
    ],
  },
] as const;

/* -------------------------- netstroken langs de flank -------------------------- */

// De strook ligt in de referentie ín de zijrand, en die rand is bij ons maar
// ~4,7 units breed (3 + 1,5 + 1 px op de veldmaat). Hij schuift daarom naar de
// ornamentlaag áchter het schild: wat rechts van u=0 valt zit achter de kaart en
// houdt de strook vast, de ~8,8 units links ervan zijn het zichtbare netwerk.
const STROOK_LAT = lat(STROOK_LINKS + 0.4, STROOK_RECHTS, 16.4, 85.6, 2.4);
const VLECHT = vlechtwerk(-7.4, 3.6, 21.6, 80.4, 4.2, 1.1);
// Twee leren riemen om de uiteinden: zonder die afsluiting eindigt het
// vlechtwerk in het niets, en ze zijn meteen het "versleten leer" van de brief.
const RIEM_BOVEN = lat(STROOK_LINKS, STROOK_RECHTS, 15.4, 21.6, 1.8);
const RIEM_ONDER = lat(STROOK_LINKS, STROOK_RECHTS, 80.4, 86.6, 1.8);
const RIEM_NAAD = [
  stiksel(18.5, -7.6, 3.6),
  stiksel(83.5, -7.6, 3.6),
].join(" ");

/* --------------------------- crest in de bovenrand --------------------------- */

// Ballenmand in de bovenrand: een mandje dat ~12 units boven de kaart uitkomt,
// met een gevlochten rand erop. Het staat in de `voor`-laag, want áchter het
// schild zou de onderste helft wegvallen. De onderpunt stopt op v=10,4; het vlak
// begint zijn tekst pas rond v=16 (12% bovenpadding op de kaartbreedte), dus de
// crest raakt geen inkt.
const CREST_VORM: MandVorm = {
  vTop: -8.8,
  halfTop: 11.6,
  vBot: 10.4,
  halfBot: 7.2,
  r: 1.8,
};
const CREST_HOLTE: MandVorm = {
  vTop: -7.2,
  halfTop: 10.2,
  vBot: 8.8,
  halfBot: 6.1,
  r: 1.5,
};
const CREST = mand(CREST_VORM);
const CREST_VELD = mand(CREST_HOLTE);
const CREST_DRAAD = manddraad(CREST_HOLTE, [-2.2, 3.6]);
const CREST_RAND = balk(-12.2, -8.6, 13.4, 1.2);

/** Vlechtwerk óver de mandrand: zeven paar strengen die elkaar kruisen. Staat
 *  op de as en wordt dus niet gespiegeld, dus de reeks moet uit zichzelf
 *  symmetrisch zijn — vandaar het bereik 37,4 … 62,6 om x=50. */
const CREST_VLECHT: readonly string[] = Array.from({ length: 7 }, (_, i) => {
  const u = rond(37.4 + i * 3.6);
  const re = rond(u + 3.6);
  return [`M ${u} -9 L ${re} -11.8`, `M ${u} -11.8 L ${re} -9`] as const;
}).flat();

/* -------------------------- medaillon in de kaartpunt -------------------------- */

// Draadmand met één tennisbal in de punt. De rand staat op v=116,4 en dus ~1,4
// units onder de onderkant van de divisieregel (het vlak eindigt zijn tekst op
// v≈115 bij 24% bodempadding). Onder een editie zakt die tekst lager, maar dan
// tekent de divisie zijn ornamentlaag helemaal niet — de editie wint
// (FutKaart.tsx).
const MAND_VORM: MandVorm = {
  vTop: 119.2,
  halfTop: 11.9,
  vBot: 136.4,
  halfBot: 9.2,
  r: 2.2,
};
const MAND_HOLTE: MandVorm = {
  vTop: 120.6,
  halfTop: 10.6,
  vBot: 134.8,
  halfBot: 8,
  r: 1.8,
};
const MAND = mand(MAND_VORM);
const MAND_VELD = mand(MAND_HOLTE);
const MAND_DRAAD = manddraad(MAND_HOLTE, [125, 130.5]);
const MAND_RAND = balk(116.4, 119.8, 12.8, 1.3);

// De bal: middelpunt (50 · 126,6) met straal 5,7, dus hij zit tot aan zijn
// bovenrand in de mand en blijft ruim onder de divisieregel.
const BAL = cirkelPad(50, 126.6, 5.7);
/** Eén naad, links van de as en gespiegeld getekend: de dubbele boog van een
 *  tennisbal. Blijft met zijn controlepunten op u≤47,6 en kruist de as dus
 *  niet — anders liep de naad door zijn eigen spiegelbeeld. */
const BAL_NAAD_PAD = "M 44.9 123.4 C 47.6 125.2, 47.6 128, 44.9 129.8";
/** Lichtvang bovenop de bal. Symmetrisch om x=50, want de delen die niet
 *  gespiegeld worden staan op de as. */
const BAL_GLANS = "M 45.8 123.8 C 47.6 121.9, 52.4 121.9, 54.2 123.8";

/* ------------------------ motief: het binnenvlak ------------------------ */

// Het geëtste watermerk in het vlak, in zijn eigen viewBox 0 0 100 100 (zie
// FutKaartMotief), dus deze maten staan los van de kaart-units. Vier lagen, in
// de volgorde waarin ze onderaan dit bestand ook gestapeld staan: de houtnerf
// van de plank, de slijtplekken erop, de gebogen balbanen die naar beneden en
// naar de mand toe lopen, en de baangrond als bovenste laagje.

/** Nerf van de plank: lange, nauwelijks gebogen lijnen over de volle hoogte. */
const NERF: readonly string[] = [
  "M 13 0 C 17 26, 11 56, 16 100",
  "M 41 0 C 45 30, 39 62, 43 100",
  "M 69 0 C 65 28, 72 60, 67 100",
  "M 92 0 C 95 32, 89 66, 93 100",
] as const;

/** Vier balbanen die naar de mand toe buigen. Ze eindigen allemaal onderin het
 *  midden — precies waar ónder het vlak het mand-medaillon hangt. Een baan die
 *  ergens anders eindigt, maakt er een decoratieve waaier van; de test bewaakt
 *  dus dat elk eindpunt in dat kleine venster valt. */
// Elke baan buigt in zijn laatste kwart naar bínnen en komt bijna verticaal
// onderin het midden aan: het tweede controlepunt ligt dicht bij het eindpunt en
// erboven. Zou de baan schuin het venster in lopen, dan wijst hij langs de mand
// heen i.p.v. erin.
const BANEN: readonly (readonly [Punt, Punt, Punt, Punt, number])[] = [
  [[6, 18], [2, 48], [36, 76], [47, 93], 9],
  [[94, 10], [92, 44], [64, 76], [53, 93], 9],
  [[30, 3], [26, 36], [40, 72], [49, 92], 8],
  [[71, 33], [69, 58], [60, 80], [51.5, 92], 6],
] as const;

/** Baangrond: fijne korrels zand op het binnenvlak. Deterministisch verstrooid
 *  met een kleine generator i.p.v. een handgeschreven lijst — een raster van
 *  korrels leest als patroon, en tweeëntwintig met de hand gekozen punten leest
 *  als een handgeschreven lijst van tweeëntwintig punten. De seed staat vast, dus
 *  DOM en poster strooien identiek.
 *
 *  Bewust de Lehmer-generator (×48271 mod 2³¹−1) en niet de klassieke
 *  glibc-LCG: die vermenigvuldigt met 1103515245 en loopt daarmee buiten
 *  Number.MAX_SAFE_INTEGER, waar de reeks stil zijn periode kwijtraakt. Hier
 *  blijft het product onder 2⁵³ en is elke stap exact. */
const KORRELS: readonly string[] = (() => {
  let zaad = 20250726;
  const willekeur = () => {
    zaad = (zaad * 48271) % 2147483647;
    return zaad / 2147483647;
  };
  return Array.from({ length: 22 }, () => {
    const x = 6 + willekeur() * 88;
    // Zand zakt: twee derde van de korrels komt in de onderste helft terecht.
    const y = 18 + Math.pow(willekeur(), 0.62) * 76;
    const hoek = willekeur() * Math.PI;
    const l = 0.7 + willekeur() * 1.3;
    return `M ${rond(x)} ${rond(y)} L ${rond(x + Math.cos(hoek) * l)} ${rond(
      y + Math.sin(hoek) * l,
    )}`;
  });
})();

const MOTIEF: readonly OrnamentPad[] = [
  // Nerf op 1,2 units breed (~1,4 px op de veldmaat) en 45% van de laagsterkte:
  // dikker dan de balbanen mag hij niet worden, want dan gaat de plank strepen.
  ...NERF.map((d): OrnamentPad => ({ d, soort: "lijn", breedte: 1.2, alpha: 0.45 })),
  // Slijtplekken: vier afgesleten plekken waar de bal telkens neerkomt. Alpha
  // 0,55 is de contrastgrens: een plek plus een baan erover mag de inkt niet
  // onder AA duwen (zie de meting in hout.css).
  { d: slijtplek(24, 58, 9.4, 4.6, 0.22), soort: "vlak", alpha: 0.55 },
  { d: slijtplek(72, 47, 7.6, 3.8, -0.18), soort: "vlak", alpha: 0.5 },
  { d: slijtplek(47, 79, 10.2, 4.2, 0.14), soort: "vlak", alpha: 0.5 },
  { d: slijtplek(58, 27, 6, 3.2, -0.24), soort: "vlak", alpha: 0.45 },
  ...BANEN.flatMap(([p0, c1, c2, p3, aantal]) =>
    streepjesBaan(p0, c1, c2, p3, aantal).map(
      (d): OrnamentPad => ({ d, soort: "lijn", breedte: 1.3 }),
    ),
  ),
  ...KORRELS.map(
    (d): OrnamentPad => ({ d, soort: "lijn", breedte: 0.9, alpha: 0.8 }),
  ),
] as const;

/* ------------------------------ de divisie ------------------------------ */

export const DIVISIE_HOUT: DivisieKaart = {
  key: "hout",
  naam: "Ballenraper",

  // Spiegel van het `.fut-kaart--hout`-register in hout.css; de synctest in
  // hout.test.ts houdt de twee gelijk. Contrast (WCAG 2.1, sRGB) tegen de
  // dónkerste vlak-stop #b59870, dus de ongunstigste plek op het vlak: inkt
  // #241606 → 6,45:1 en inkt-soft #3d2712 → 5,14:1, beide boven AA. Zie
  // hout.css voor de volledige meting, inclusief het motief eroverheen.
  register: {
    // Vier houttonen op de gedeelde frame-as (160°), met de geschuurde ruggen
    // op 0% en 66%: donker umber met twee lichte kanten, en nergens wit — dat
    // is het verschil met het gepolijste koper van Bankvuller erboven.
    frame: [
      [0, "#a97c47"],
      [0.38, "#472c14"],
      [0.66, "#8d6737"],
      [1, "#22140a"],
    ],
    liner: "#1e1208",
    keyline: "#b58a58",
    vlak: ["#e2cba8", "#cdaf85", "#b59870"],
    // Hout weerkaatst diffuus: een warme waas op 22% i.p.v. het koele wit op
    // 50% van de basiskaart, en een brede flauwe glansbaan i.p.v. een smalle
    // specular streep. Geschuurd hout geeft nooit een puntreflectie.
    glow: "rgba(255, 240, 214, 0.22)",
    sheen: "rgba(255, 245, 224, 0.12)",
    sheenSpreiding: 0.2,
    // Iets ijler satijn dan de basiskaart (0,07): de houtnerf zit in het
    // motief, en een weefsel op volle sterkte legt daar een tweede structuur
    // overheen.
    satijnAlpha: 0.05,
    ink: "#241606",
    inkSoft: "#3d2712",
    lijn: "#6a461f",
    // Donkere echo recht ónder het schild (dx = 0): dit is de dikte van een
    // plank die plat op de ondergrond ligt, niet de scheve slagschaduw van een
    // losgekomen foliehoekje.
    echo: [[0, 0.009, "rgba(30, 18, 8, 0.8)"]],
    // Geschuurde kant met een groef erachter: de dubbele binnenrand van de
    // referentie, zonder extra DOM-laag (inset-schaduwen worden mee-geclipt).
    binnenlijn: [
      [1, "rgba(236, 213, 178, 0.5)"],
      [3, "rgba(34, 20, 9, 0.6)"],
    ],
    // Geen stralenkrans: die hoort bij de premium-divisies, vier treden hoger.
    stralen: false,
  },

  gradienten: GRADIENTEN,

  // Áchter het schild: de netstroken. Ze horen constructief in de zijrand, en
  // van achter de kaart vandaan komen ze er als een echt ingelegde strook uit
  // i.p.v. als opgeplakte sticker.
  achter: [
    {
      d: STROOK_LAT,
      vulling: "url(#fut-div-hout-walnoot)",
      contour: HOUT_CONTOUR,
      contourBreedte: 0.45,
      spiegel: true,
    },
    { d: VLECHT.onder, contour: KOORD_ONDER, contourBreedte: 0.85, spiegel: true },
    { d: VLECHT.over, contour: KOORD_OVER, contourBreedte: 0.9, spiegel: true },
    {
      d: RIEM_BOVEN,
      vulling: "url(#fut-div-hout-leer)",
      contour: HOUT_CONTOUR,
      contourBreedte: 0.45,
      spiegel: true,
    },
    {
      d: RIEM_ONDER,
      vulling: "url(#fut-div-hout-leer)",
      contour: HOUT_CONTOUR,
      contourBreedte: 0.45,
      spiegel: true,
    },
    {
      d: RIEM_NAAD,
      contour: DRAAD,
      contourBreedte: 0.5,
      alpha: 0.75,
      spiegel: true,
    },
  ],

  // Vóór het schild: crest en medaillon liggen in de bovenrand respectievelijk
  // de punt en zouden er anders half achter verdwijnen. Volgorde = laagvolgorde:
  // mand, holte, draadwerk, dan de rand met zijn vlechtwerk erover.
  voor: [
    {
      d: CREST,
      vulling: "url(#fut-div-hout-crest)",
      contour: HOUT_CONTOUR,
      contourBreedte: 0.5,
    },
    {
      d: CREST_VELD,
      vulling: "url(#fut-div-hout-crest-holte)",
      contour: HOUT_CONTOUR,
      contourBreedte: 0.3,
    },
    { d: CREST_DRAAD, contour: HOUT_GLANS, contourBreedte: 0.5, alpha: 0.85 },
    {
      d: CREST_RAND,
      vulling: "url(#fut-div-hout-crest)",
      contour: HOUT_CONTOUR,
      contourBreedte: 0.45,
    },
    ...CREST_VLECHT.map((d, i): DivisieDeel => ({
      d,
      // De even strengen liggen boven, de oneven eronder — zelfde afspraak als
      // in `vlechtwerk` langs de flank.
      contour: i % 2 === 0 ? KOORD_ONDER : KOORD_OVER,
      contourBreedte: i % 2 === 0 ? 0.45 : 0.5,
    })),
    {
      d: MAND,
      vulling: "url(#fut-div-hout-mand)",
      contour: HOUT_CONTOUR,
      contourBreedte: 0.5,
    },
    {
      d: MAND_VELD,
      vulling: "url(#fut-div-hout-mand-holte)",
      contour: HOUT_CONTOUR,
      contourBreedte: 0.3,
    },
    { d: MAND_DRAAD, contour: HOUT_GLANS, contourBreedte: 0.5, alpha: 0.85 },
    {
      d: BAL,
      vulling: "url(#fut-div-hout-bal)",
      contour: BAL_CONTOUR,
      contourBreedte: 0.4,
    },
    { d: BAL_NAAD_PAD, contour: BAL_NAAD, contourBreedte: 0.5, spiegel: true },
    { d: BAL_GLANS, contour: "rgba(255, 255, 240, 0.45)", contourBreedte: 0.6 },
    {
      d: MAND_RAND,
      vulling: "url(#fut-div-hout-mand)",
      contour: HOUT_CONTOUR,
      contourBreedte: 0.45,
    },
  ],

  motief: {
    paden: MOTIEF,
    kleur: ETS,
    breedte: 0.9,
    // Iets lager dan het GOAT-medaillon: de banen horen achter avatar,
    // hairlines en naamplaat te lopen en onderaan naar de mand te wijzen, niet
    // achter het eloblok — daar staat het grootste cijfer.
    positie: 0.32,
  },
};
