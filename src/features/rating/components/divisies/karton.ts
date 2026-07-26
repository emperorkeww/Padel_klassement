// Divisiekaart "Stofzuiger" (karton) — 600–699 — haverbeige composiet en ruwe vezelplaat.
//
// Waarom deze kaart zo vlak is: de Stofzuiger staat één trede boven de bodem,
// dus wat hogerop gegoten metaal is, is hier gestanst in de plaat. Op de
// referentie (#710) steekt dan ook niets buiten het schildsilhouet — élk
// ornament zit ín de rand gedrukt. Dat is precies wat de kaart "eenvoudiger dan
// Ballenraper" maakt, en het is ook de reden dat dit register geen echo, geen
// stralenkrans en geen shimmer meebrengt: gedempt brons op vezelplaat vangt
// geen specular licht.
//
// Het thema — alle ballen worden blind naar dezelfde speler toegetrokken — zit
// in twee lagen die elkaar aanvullen. De zuiggroeven in de zijrand en het
// aanzuigrooster in de punt zijn de "monden"; het watermerk in het vlak levert
// de luchtstromen en de baltrajecten die er van beide kanten verkeerd naartoe
// convergeren. Alles wat over de speler zélf gaat (rating, subniveau, emoji,
// avatar, naam, divisietitel) blijft gewone UI: deze module tekent enkel decor.
//
// Alles staat in `voor`, niets in `achter`. Bewust: `drawKaartSchild` in
// futKaartCanvas.ts tekent van een divisiekaart alléén de `voor`-laag, dus een
// deel in `achter` zou in de DOM verschijnen en op de deel-poster ontbreken.
// Zolang die canvas-kant er niet is, hoort hier niets in `achter` — en de
// referentie vraagt er ook niets: de kaart is één gestanste plaat.
//
// Coördinaten: kaart-units, 100 breed × 139 hoog, oorsprong linksboven op de
// kaart; het motief heeft zijn eigen viewBox 0 0 100 100.

import type { OrnamentPad } from "../futKaartOrnamenten";
import { bouwStreng } from "../futKaartOrnamenten";
import type { DivisieDeel, DivisieKaart } from "./divisieKaart";

const rond = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------- materiaal -------------------------------- */

// Gedempt brons in drie tonen; de donkerste is óók de liner, zodat een groef in
// de rand en de rand zelf uit hetzelfde blik komen. Vaste hexen (tokenregime
// #710): de deel-poster staat op het lichte palet vastgepind, dus alleen
// literals houden DOM-kaart en poster in béide thema's gelijk.
const BRONS_LICHT = "#e0cfae";
const BRONS_MID = "#b39a6c";
const BRONS_DIEP = "#755c31";
/** Gestanste diepte: de bodem van een groef, een slot of het rooster. */
const BRONS_SCHADUW = "#4a3a22";
/** Opstaande kant van een stans — de enige "glans" die deze kaart heeft. */
const BRONS_GLANS = "rgba(255, 248, 232, 0.5)";

/* ------------------------ zuiggroeven in de zijrand ------------------------ */

// De groeven liggen in de buitenste framestrip (u 0–2,6: de padding van
// .fut-kaart__zijde), precies waar de referentie ze heeft. Ze staan schuin met
// de brede kant naar buiten: lucht komt van buiten binnen en versmalt naar de
// kaart toe. Zeven stuks tussen v=57 en v=82 — boven de schildtaille (v=83,4),
// waar de zijrand nog recht loopt, zodat elke groef dezelfde vorm heeft.
const GROEF_HOOGTES = [57, 60.6, 64.2, 67.8, 71.4, 75, 78.6] as const;

/** Eén getaperde slit; `bouwStreng` maakt van de centerlijn een vorm die van
 *  0,5 breed naar een punt loopt — met de hand blijft dat altijd hoekig. */
const groef = (v0: number) =>
  bouwStreng({
    start: [0.35, v0 + 3.1],
    segmenten: [
      [
        [0.6, v0 + 1.7],
        [1.35, v0 + 0.5],
        [2.3, v0],
      ],
    ],
    dikte: 0.5,
    punt: 0.05,
    taper: 1.5,
    stappen: 16,
  }).omtrek;

/** Alle zeven slits als één pad: elke omtrek is een gesloten subpad, dus dit
 *  scheelt zes ornamentdelen zonder de vorm te veranderen. */
const GROEVEN = GROEF_HOOGTES.map(groef).join(" ");

/** De opstaande rug net onder elke slit — zonder die lichte lijn leest de rand
 *  als streepjes in plaats van als geperst reliëf. */
const GROEF_RUGGEN = GROEF_HOOGTES.map(
  (v0) =>
    `M 0.35 ${rond(v0 + 4.85)} C 0.6 ${rond(v0 + 3.45)}, 1.35 ${rond(
      v0 + 2.25,
    )}, 2.3 ${rond(v0 + 1.75)}`,
).join(" ");

/** Bies die de groevengroep afsluit: loopt langs de binnenkant omhoog en buigt
 *  aan beide uiteinden naar de kaartrand — de "haak" van de referentie, die van
 *  een rij slits één paneel maakt. */
const GROEF_BIES =
  "M 0.4 52.4 C 0.4 54.6, 2.5 54.6, 2.5 57.2 " +
  "L 2.5 78.4 C 2.5 81.2, 0.4 81.2, 0.4 83.4";

/* ------------------------------ bezemcrest -------------------------------- */

// De referentie zet de bezem in een inkeping in de bovenrand, maar de
// instapdivisies dragen de vlakke schildvorm (--schild: #fut-schild-vlak in
// FutKaart.css) en die heeft geen inkeping. In plaats van de vorm te forceren
// staat hier een plaatje dat de bovenrand doorsnijdt en erbovenuit komt: de
// crest krijgt zijn eigen inkeping mee. Onderkant op v=4,9 — precies de
// bovenrand van het vlak, dus de naad valt samen met de keyline en de plaat
// blijft ruim boven het eloblok (dat begint rond v=15,6).
const CREST_PLAAT =
  "M 42.6 4.9 L 42.6 -3.2 C 42.6 -7.3, 45.9 -9.9, 50 -9.9 " +
  "C 54.1 -9.9, 57.4 -7.3, 57.4 -3.2 L 57.4 4.9 Z";
/** Binnenbies van de plaat: één maat kleiner, geeft de crest zijn reliëf. */
const CREST_BIES =
  "M 44.1 4.9 L 44.1 -3 C 44.1 -6.4, 46.8 -8.5, 50 -8.5 " +
  "C 53.2 -8.5, 55.9 -6.4, 55.9 -3 L 55.9 4.9";
/** De bezem zelf: steel, band en uitlopende bos. Klein gehouden (11 units
 *  hoog) zoals de referentie vraagt — een crest, geen illustratie. */
const CREST_BEZEM =
  "M 49.4 -7.6 L 50.6 -7.6 L 50.6 -2.2 L 51.7 -2.2 L 51.7 -1 L 53.5 3.1 " +
  "C 52.3 3.8, 47.7 3.8, 46.5 3.1 L 48.3 -1 L 48.3 -2.2 L 49.4 -2.2 Z";
/** Drie sprieten in de bos; met de bos als één silhouet leest hij als een wig. */
const CREST_SPRIETEN =
  "M 49.1 -0.4 L 48.35 2.9 M 50 -0.4 L 50 3.2 M 50.9 -0.4 L 51.65 2.9";

/* --------------------- aanzuigrooster in de kaartpunt --------------------- */

// Het rooster staat op de as in de punt, waar het vlak leeg is (de onderste
// tekstregel eindigt rond v=112,6 door de 24%-bodem van .fut-kaart__vlak).
// Maten zo gekozen dat de buitenste boog binnen de schildpunt blijft: op v=134
// loopt de kaart van u=41,7 tot 58,3, en de boog van 43 tot 57.
const ROOSTER_MIDDEN_Y = 128.6;
const ROOSTER_BUITEN = 7;
const ROOSTER_BINNEN = 5.6;
const ROOSTER_VOET = 132.6;

/** Behuizing: rechte flanken tot de aslijn, daarboven een halve boog. */
const ROOSTER_HUIS = `M 43 134 L 43 ${ROOSTER_MIDDEN_Y} A ${ROOSTER_BUITEN} ${ROOSTER_BUITEN} 0 0 1 57 ${ROOSTER_MIDDEN_Y} L 57 134 Z`;
/** De uitsparing erin — de donkere holte waar de balken in staan. */
const ROOSTER_HOLTE = `M 44.4 ${ROOSTER_VOET} L 44.4 ${ROOSTER_MIDDEN_Y} A ${ROOSTER_BINNEN} ${ROOSTER_BINNEN} 0 0 1 55.6 ${ROOSTER_MIDDEN_Y} L 55.6 ${ROOSTER_VOET} Z`;

/** Booghoogte op x: de bovenkant van een balk volgt de holte, zodat de
 *  buitenste spleten van zichzelf wigvormig worden — precies het beeld van de
 *  referentie. Buiten de cirkel klemt de wortel op 0, dus nooit een NaN. */
const boogY = (x: number) =>
  rond(
    ROOSTER_MIDDEN_Y -
      Math.sqrt(Math.max(0, ROOSTER_BINNEN ** 2 - (x - 50) ** 2)),
  );

/** Eén verticale balk in de holte, met de boog als bovenkant. */
function roosterBalk(midden: number, half: number): string {
  const l = rond(midden - half);
  const r = rond(midden + half);
  return (
    `M ${l} ${ROOSTER_VOET} L ${l} ${boogY(l)} ` +
    `A ${ROOSTER_BINNEN} ${ROOSTER_BINNEN} 0 0 1 ${r} ${boogY(r)} ` +
    `L ${r} ${ROOSTER_VOET} Z`
  );
}

/** Vier balken laten vijf spleten open: één op de as en twee paar ernaast,
 *  waarvan het buitenste paar door de boog tot een wig wordt afgesneden. */
const ROOSTER_BALKEN = [48.8, 51.2, 46.45, 53.55]
  .map((m) => roosterBalk(m, 0.52))
  .join(" ");

/** Bies langs de binnenkant van de behuizing: de opstaande kant van de stans. */
const ROOSTER_BIES = `M 44 ${ROOSTER_VOET} L 44 ${ROOSTER_MIDDEN_Y} A 6 6 0 0 1 56 ${ROOSTER_MIDDEN_Y} L 56 ${ROOSTER_VOET}`;

/** Bies langs de onderste schildranden, van de rooster-schouder naar buiten —
 *  hij bindt het rooster aan de rand vast, zoals de chevron in de referentie.
 *  Loopt 2,4 units binnen de schildrand, die tussen (13,5 · 116,5) en
 *  (43,5 · 135,1) naar de punt loopt. `spiegel` maakt de rechterhelft. */
const PUNT_BIES = "M 18.4 116.7 L 42.7 131.8";

/* ------------------------- watermerk in het vlak -------------------------- */

// Eigen viewBox 0 0 100 100; met breedte 1 en positie 0,5 vult hij de volle
// vlakbreedte en hangt hij in het midden — zo lopen de banen over het hele
// vlak in plaats van in een postzegel bovenaan.
//
// Alles convergeert op één punt net boven het aanzuigrooster: dat is de grap
// van deze divisie. De banen komen van links én rechts en buigen pas laat af,
// dus ze arriveren allemaal bij dezelfde speler.
const ZUIGPUNT: readonly [number, number] = [52, 92];

/** Eén baltraject van de rand naar het zuigpunt: eerst bijna vlak (de bal
 *  wordt geslagen), dan een late duik (de bal wordt "opgezogen"). */
function baan(sx: number, sy: number): string {
  const [cx, cy] = ZUIGPUNT;
  const c1x = rond(sx + (cx - sx) * 0.55);
  const c1y = rond(sy + (cy - sy) * 0.06);
  const c2x = rond(cx - (cx - sx) * 0.12);
  const c2y = rond(cy - (cy - sy) * 0.5);
  return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${cx} ${cy}`;
}

/** Boogsegment rond een punt, in graden (0° = naar rechts). Handmatig een
 *  A-commando uitrekenen is vragen om een verkeerde sweep-vlag. */
function boog(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number): [number, number] => [
    rond(cx + Math.cos((a * Math.PI) / 180) * r),
    rond(cy + Math.sin((a * Math.PI) / 180) * r),
  ];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${
    Math.abs(a1 - a0) > 180 ? 1 : 0
  } ${a1 > a0 ? 1 : 0} ${x1} ${y1}`;
}

const KARTON_MOTIEF: readonly OrnamentPad[] = [
  // Luchtstromen: drie ijle ringen rond het zuigpunt. Ze lopen niet rond maar
  // van flank tot flank, zodat het vlak niet in een schietschijf verandert.
  { d: boog(...ZUIGPUNT, 26, 196, 344), soort: "lijn", breedte: 0.7, alpha: 0.6 },
  { d: boog(...ZUIGPUNT, 37, 196, 344), soort: "lijn", breedte: 0.6, alpha: 0.5 },
  { d: boog(...ZUIGPUNT, 48, 198, 342), soort: "lijn", breedte: 0.5, alpha: 0.4 },
  // Baltrajecten van links en rechts. Links vier, rechts drie: een perfect
  // symmetrische bundel leest als een decoratieve fan, niet als banen die per
  // ongeluk allemaal dezelfde kant op gaan.
  { d: baan(0, 6), soort: "lijn", breedte: 0.85 },
  { d: baan(0, 22), soort: "lijn", breedte: 0.85 },
  { d: baan(0, 38), soort: "lijn", breedte: 0.75, alpha: 0.85 },
  { d: baan(0, 54), soort: "lijn", breedte: 0.65, alpha: 0.7 },
  { d: baan(100, 12), soort: "lijn", breedte: 0.85 },
  { d: baan(100, 30), soort: "lijn", breedte: 0.75, alpha: 0.85 },
  { d: baan(100, 48), soort: "lijn", breedte: 0.65, alpha: 0.7 },
  // Stof- en baansporen: drie korte vegen dwars op de banen, zodat het vlak
  // gebruikt lijkt zonder een stofwolk te worden.
  { d: "M 14 66 C 22 63, 30 62, 37 63", soort: "lijn", breedte: 1.1, alpha: 0.45 },
  { d: "M 62 34 C 69 32, 76 32, 82 34", soort: "lijn", breedte: 0.9, alpha: 0.4 },
  { d: "M 26 84 C 33 82, 40 81, 46 82", soort: "lijn", breedte: 0.8, alpha: 0.35 },
] as const;

/* ------------------------------ ornamentlaag ------------------------------ */

const VOOR: readonly DivisieDeel[] = [
  // Crest: plaat eerst, dan de bies, dan de bezem erin gestanst.
  {
    d: CREST_PLAAT,
    vulling: "url(#fut-div-karton-crest)",
    contour: BRONS_SCHADUW,
    contourBreedte: 0.5,
  },
  { d: CREST_BIES, contour: BRONS_GLANS, contourBreedte: 0.35 },
  { d: CREST_BEZEM, vulling: BRONS_SCHADUW, alpha: 0.9 },
  { d: CREST_SPRIETEN, contour: BRONS_LICHT, contourBreedte: 0.3, alpha: 0.55 },
  // Zuiggroeven: één deel per rol (slit, rug, bies), elk gespiegeld.
  { d: GROEVEN, vulling: BRONS_SCHADUW, alpha: 0.55, spiegel: true },
  {
    d: GROEF_RUGGEN,
    contour: BRONS_GLANS,
    contourBreedte: 0.3,
    spiegel: true,
  },
  { d: GROEF_BIES, contour: BRONS_DIEP, contourBreedte: 0.4, alpha: 0.7, spiegel: true },
  // Punt: eerst de bies langs de rand, dan het rooster erop.
  { d: PUNT_BIES, contour: BRONS_DIEP, contourBreedte: 0.55, alpha: 0.6, spiegel: true },
  {
    d: ROOSTER_HUIS,
    vulling: "url(#fut-div-karton-rooster)",
    contour: BRONS_SCHADUW,
    contourBreedte: 0.5,
  },
  { d: ROOSTER_HOLTE, vulling: BRONS_SCHADUW, alpha: 0.92 },
  { d: ROOSTER_BALKEN, vulling: "url(#fut-div-karton-balk)" },
  { d: ROOSTER_BIES, contour: BRONS_GLANS, contourBreedte: 0.3 },
] as const;

export const DIVISIE_KARTON: DivisieKaart = {
  key: "karton",
  naam: "Stofzuiger",
  // Register: de canvas-spiegel van .fut-kaart--karton in karton.css. Contrast
  // op de plek waar de tekst écht staat: ink #3c2d19 op de vlakgradient is
  // 10,4:1 bij het eloblok en 8,6:1 op de naamplaat; inkSoft #584526 onder de
  // divisieregel (waar de gradient al naar #bfaa88 zakt) haalt 5,0:1. Alles dus
  // ruim boven AA.
  register: {
    frame: [
      [0, "#d9c7a4"],
      [0.38, "#a5895c"],
      [0.66, "#cdb994"],
      [1, "#6b5330"],
    ],
    liner: BRONS_SCHADUW,
    vlak: ["#efe6d4", "#ded1b8", "#bfaa88"],
    // Vezelplaat heeft geen witte specular-baan: een warme, brede waas op 8%
    // (spreiding 0,22) i.p.v. de 28% van het metaalregister. Zelfde reden voor
    // de zachte topgloed en het lage satijn — en dus geen stralenkrans.
    glow: "rgba(255, 248, 232, 0.34)",
    sheen: "rgba(255, 246, 226, 0.08)",
    sheenSpreiding: 0.22,
    satijnAlpha: 0.045,
    stralen: false,
    ink: "#3c2d19",
    inkSoft: "#584526",
    lijn: "#9c855f",
    // Eén donkere haarlijn langs het vlak: de gestanste kant tussen keyline en
    // vlak. Geen dubbele of drievoudige binnenlijn — dat is het register van de
    // prestige-kaarten.
    binnenlijn: [[1.2, "rgba(74, 58, 34, 0.3)"]],
  },
  // Gradients in kaart-units: elk ornament heeft zijn eigen as, want een
  // gedeelde as over 145 units hoogte geeft de crest en het rooster ver
  // uiteenlopende tinten. De balken staan een tint lichter dan de behuizing,
  // anders verdwijnen ze in hun eigen holte.
  gradienten: [
    {
      id: "fut-div-karton-crest",
      as: [43, -10, 57, 5],
      stops: [
        [0, BRONS_LICHT],
        [0.45, BRONS_MID],
        [1, BRONS_DIEP],
      ],
    },
    {
      id: "fut-div-karton-rooster",
      as: [43, 120.5, 57, 134.5],
      stops: [
        [0, BRONS_LICHT],
        [0.5, BRONS_MID],
        [1, BRONS_DIEP],
      ],
    },
    {
      id: "fut-div-karton-balk",
      as: [44, 122, 56, 133],
      stops: [
        [0, "#f0e3c6"],
        [0.6, BRONS_LICHT],
        [1, BRONS_MID],
      ],
    },
  ],
  voor: VOOR,
  motief: {
    paden: KARTON_MOTIEF,
    kleur: "rgba(74, 58, 34, 0.13)",
    breedte: 1,
    positie: 0.5,
  },
};
