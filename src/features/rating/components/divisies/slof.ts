// Divisiekaart "Sletje van de baan" (slof) — tot 599 — betongrijs, taupe, dof zink; de eenvoudigste kaart van de ladder.
//
// Waarom deze kaart minder doet dan álle andere: hij is de bodem van de ladder,
// dus élk middel dat "zeldzaam" leest hoort hier niet. Dat is geen luiheid maar
// het register: twee vlakke zinktonen in het frame i.p.v. de vier van de
// metaalladder (dus geen enkel glanspunt), geen eigen keyline, geen binnenlijn,
// geen echo-contour, geen stralenkrans en geen beweging. Wat overblijft is warm
// betongrijs met taupe schaduw, dof zink in de rand en versleten rubber — de
// materialen van de referentie (#710 §9).
//
// Het thema — een instapspeler die door de rest van de club als makkelijke
// overwinning wordt gebruikt — zit in de sporen die anderen achterlaten, niet in
// een persoon: fletse baanlijnen met remsporen en doelcirkels in het watermerk,
// een trainingskegel als crest, rubberen stootstrips langs de onderste zijkanten
// en een gedeukt oefendoel met één inslag buiten het midden in de punt. Alles
// wat over de speler zélf gaat (rating, subniveau, emotie-icoon, avatar, naam,
// divisietitel) blijft gewone UI; deze module tekent uitsluitend decor en
// hardcodeert dus geen enkele voorbeeldwaarde.
//
// Alles staat in `voor`, niets in `achter`. Bewust: `drawKaartOrnamentVoor` in
// futKaartCanvas.ts tekent van een divisiekaart alléén de `voor`-laag, dus een
// deel in `achter` zou in de DOM verschijnen en op de deel-poster ontbreken.
// Dezelfde keuze als bij de Stofzuiger (karton.ts) één trede hoger.
//
// Coördinaten: kaart-units, 100 breed × 139 hoog, oorsprong linksboven op de
// kaart; het motief heeft zijn eigen viewBox 0 0 100 100. Bewust géén
// A-commando's: alle rondingen komen uit cubics, zodat de geometrietest de
// paden kan bemonsteren zonder de rx/ry/vlaggen van een boog als punten te
// lezen.

import { bouwStreng } from "../futKaartOrnamenten";
import type { OrnamentPad } from "../futKaartOrnamenten";
import type { DivisieDeel, DivisieKaart } from "./divisieKaart";

const rond = (n: number) => Math.round(n * 100) / 100;

/* -------------------------------- materiaal ------------------------------- */

// Vaste hexen i.p.v. color-mix op --tier (tokenregime #710): de deel-poster
// staat vastgepind op het lichte palet (#125), dus alleen literals houden
// DOM-kaart en poster in béide thema's gelijk.
/** Dof zink, licht: de opstaande kant van een gestanste plaat. */
const ZINK_LICHT = "#cfc9bb";
const ZINK_MID = "#9c968a";
const ZINK_DIEP = "#6b6559";
/** Bodem van een deuk of een inslag — de donkerste toon van de kaart. */
const ZINK_DEUK = "#4a463d";
/** Versleten rubber: warm, mat en zonder enige reflectie. */
const RUBBER = "#4f4a44";
/** Schuurplek op het rubber: waar de strip stuk is gestoten, niet een glans. */
const RUBBER_SLIJT = "#8a8377";
/** De énige lichtvang die deze kaart heeft, en dan nog op een crest van 13
 *  units hoog. Beton en rubber leveren geen specular licht. */
const BETON_GLANS = "rgba(255, 252, 244, 0.4)";
/** Etskleur van het watermerk: de inkt op ~9,5% — de "fletse" baanlijnen van de
 *  referentie, en het ijlste watermerk van de ladder (karton zit op 13%). */
const SPOOR_KLEUR = "rgba(43, 40, 35, 0.095)";

/* ------------------------------ vormgereedschap ---------------------------- */

/** Cirkel-benadering met cubics: 0,5523 × r als controlepuntafstand. */
const K = 0.5523;

/** Ellips als vier cubics — één gesloten pad zonder bogen, zodat de
 *  geometrietest er letterlijk de uitersten uit kan lezen. */
function ellipsPad(cx: number, cy: number, r: number): string {
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

/* ------------------------ trainingskegel in de crest ---------------------- */

// De referentie zet de crest in een inkeping in de bovenrand, maar de drie
// instapdivisies dragen de vlakke schildvorm (--schild: #fut-schild-vlak in
// FutKaart.css) en die heeft er geen. In plaats van de schildvorm te forceren
// snijdt het plaatje de bovenrand door en komt het er ~8 units bovenuit: de
// crest brengt zijn eigen inkeping mee. Zelfde middel als de bezemcrest van de
// Stofzuiger, maar dan met rechte flanken en zonder ronding — dit is de
// simpelste crest van de negen. Onderkant op v=4,9 (de bovenrand van het vlak),
// dus de naad valt samen met de keyline en de crest blijft ruim boven het
// eloblok, dat pas rond v=16,2 begint.
const CREST_PLAAT = "M 43.6 4.9 L 44.9 -8.2 L 55.1 -8.2 L 56.4 4.9 Z";
/** Binnenbies: dezelfde vorm één maat kleiner, open aan de onderkant — het
 *  enige reliëf dat de plaat krijgt. */
const CREST_BIES = "M 45.2 4.9 L 46.3 -6.7 L 53.7 -6.7 L 54.8 4.9";
/** De kegel: een afgeknotte punt op een voetplaatje, als twee subpaden in één
 *  deel. Abstract en vlak gehouden — een trainingskegel is een merkteken op de
 *  baan, geen illustratie. */
const CREST_KEGEL =
  "M 48.7 -6 L 51.3 -6 L 53.3 1.1 L 46.7 1.1 Z " +
  "M 45.5 1.1 L 54.5 1.1 L 54.5 2.6 L 45.5 2.6 Z";
/** De band om de kegel: één streepje, want dát is wat een kegel leesbaar maakt
 *  op een crest van ~15 px breed (12,8 units op de veldmaat). */
const CREST_BAND = "M 48 -2.4 L 52 -2.4";

/* ------------------- rubberen stootstrips langs de flanken ----------------- */

// De strips lopen langs de onderste zijkanten mee, van net onder de schildtaille
// (v=83,4) tot waar de rand naar de punt afbuigt. De centerlijn hugt de
// schildrand op een vaste ~1,6–1,9 units afstand: dichter erop en de omtrek valt
// erbuiten, verder erin en de strip komt op het vlak te liggen. Hij blijft
// daarmee ook links van de tekstkolom, die op u=13,5 begint (5,5 units randstapel
// + 8 units vlakpadding) — de strip kan dus geen inkt raken.
//
// Uit `bouwStreng` met een vlák profiel (constante halve dikte 1,1): een
// stootstrip is een geëxtrudeerd rubberprofiel, dus hij tapert niet. De
// generator levert bovendien de dwarsribbels en de flanklijn, waardoor de
// gebruikssporen exact op de strip liggen i.p.v. ernaast. `spiegel` maakt de
// rechterhelft, dus links en rechts kunnen per constructie niet uit elkaar lopen.
const STRIP = bouwStreng({
  start: [1.7, 86.5],
  segmenten: [
    [
      [1.7, 98],
      [4.5, 106],
      [10.5, 112],
    ],
  ],
  profiel: [
    [0, 1.1],
    [1, 1.1],
  ],
  ribbels: 3,
  stappen: 48,
});

/* ------------------- gedeukt oefendoel in de kaartpunt --------------------- */

// Het doel staat in de punt, waar het vlak leeg is (de onderste tekstregel
// eindigt rond v=112). Maten zo gekozen dat de posten binnen de schildpunt
// blijven: op v=131,4 loopt de kaart van u=37,5 tot 62,5 en het doel van 41,8
// tot 58,2.
//
// Bewust níet symmetrisch, en dat is het hele ornament: de bovenlat zakt één
// unit door aan de kánt waar de bal insloeg, en die inslag zit náást de as. Eén
// slag, buiten het midden — precies wat de referentie vraagt. Een gecentreerde
// inslag zou een mikpunt zijn i.p.v. een gebruiksspoor.
const DOEL_FRAME =
  "M 41.8 131.4 L 41.8 122.4 L 49.4 122.4 L 52.6 123.4 L 55.8 122.6 L 58.2 122.6 " +
  "L 58.2 131.4 L 56.4 131.4 L 56.4 124.2 L 52.6 125.1 L 49 124 " +
  "L 43.6 124 L 43.6 131.4 Z";
/** De knik zelf, als donkere vouwlijn in de deuk: zonder die lijn leest de
 *  doorzakkende lat als slordig getekend i.p.v. als ingeslagen. Bewust maar één
 *  unit diep — een diepe V wordt een uitgezaagde hap, geen deuk. */
const DOEL_DEUK = "M 49.4 122.4 L 52.6 123.4 L 55.8 122.6";
/** Het enige lichtstreepje op het doel: de gave helft van de lat. */
const DOEL_GLANS = "M 44 122.9 L 48 122.9";
/** Net: twee staanders en twee dwarslijnen, dus negen ruiten. Grover dan grof —
 *  een fijn net wordt op de veldmaat één grijs vlekje, en dit is de kaart die
 *  van élk ornament de simpelste variant draagt. De inslag valt in de
 *  rechterbovenruit, waar hij vrij ligt. */
const DOEL_NET: readonly string[] = [
  "M 46.6 125.4 L 46.6 130.6",
  "M 50.5 125.4 L 50.5 130.6",
  "M 43.9 127.4 L 56.1 127.4",
  "M 43.9 129.6 L 56.1 129.6",
] as const;
/** De inslag: de bal in het net, 4,4 units rechts van de as. */
const INSLAG = { x: 54.4, y: 128.2, r: 1.6 } as const;
const DOEL_INSLAG = ellipsPad(INSLAG.x, INSLAG.y, INSLAG.r);
/** Vier korte streepjes rondom: de klap, niet de bal. Uit de hoek gerekend,
 *  zodat ze per constructie rond het middelpunt liggen. */
const DOEL_INSLAG_STER: readonly string[] = [35, 125, 215, 305].map((graden) => {
  const h = (graden * Math.PI) / 180;
  const p = (rad: number): string =>
    `${rond(INSLAG.x + Math.cos(h) * rad)} ${rond(INSLAG.y + Math.sin(h) * rad)}`;
  return `M ${p(2.2)} L ${p(3.5)}`;
});

/* --------------------------- watermerk in het vlak ------------------------- */

// Eigen viewBox 0 0 100 100; met breedte 1 en positie 0,5 is de doos zo breed
// als het vlak (~90 kaart-units) en hangt hij daarin gecentreerd: van v≈24 tot
// v≈114. Alle etsing blijft binnen y≤72 en dus boven v≈89 — net bóven de
// naamplaat, die rond v=93 begint. Dat is geen toeval: de reden dat deze kaart
// nog aan de beurt was, is dat de divisietitel grijs-op-grijs stond, en een
// baanlijn die onder die regel doorloopt maakt het contrast daar opnieuw
// onvoorspelbaar.
//
// De baan van bovenaf, in verhouding 2:1 zoals een echte padelbaan (20 × 10 m,
// dus 4,5 units per meter): buitenlijn, net op de as, twee servicelijnen op 3 m
// van de achterwand en de middenlijn tussen servicelijn en achterwand.
const BAAN_L = 5;
const BAAN_R = 95;
const BAAN_BOVEN = 27;
const BAAN_ONDER = 72;
/** 3 m van de achterwand, in unit-maat: 3 × 4,5. */
const SERVICE = 13.5;
const BAAN_MIDDEN = rond((BAAN_BOVEN + BAAN_ONDER) / 2);

/** Eén balinslag in het watermerk: een klein vlakje met twee schuine streepjes
 *  eromheen — de afdruk, niet de bal. */
const inslag = (x: number, y: number): OrnamentPad[] => [
  { d: ellipsPad(x, y, 1.1), soort: "vlak", alpha: 0.7 },
  {
    d: `M ${rond(x - 2.6)} ${rond(y - 2.6)} L ${rond(x - 1.5)} ${rond(y - 1.5)}`,
    soort: "lijn",
    breedte: 0.7,
    alpha: 0.5,
  },
  {
    d: `M ${rond(x + 2.6)} ${rond(y + 2.6)} L ${rond(x + 1.5)} ${rond(y + 1.5)}`,
    soort: "lijn",
    breedte: 0.7,
    alpha: 0.5,
  },
];

const SLOF_MOTIEF: readonly OrnamentPad[] = [
  // Baanlijnen: fletst van alles, want ze liggen er al jaren.
  {
    d: `M ${BAAN_L} ${BAAN_BOVEN} L ${BAAN_R} ${BAAN_BOVEN} L ${BAAN_R} ${BAAN_ONDER} L ${BAAN_L} ${BAAN_ONDER} Z`,
    soort: "lijn",
    breedte: 0.9,
  },
  { d: `M 50 ${BAAN_BOVEN} L 50 ${BAAN_ONDER}`, soort: "lijn", breedte: 1.1 },
  {
    d: `M ${BAAN_L + SERVICE} ${BAAN_BOVEN} L ${BAAN_L + SERVICE} ${BAAN_ONDER}`,
    soort: "lijn",
    breedte: 0.8,
  },
  {
    d: `M ${BAAN_R - SERVICE} ${BAAN_BOVEN} L ${BAAN_R - SERVICE} ${BAAN_ONDER}`,
    soort: "lijn",
    breedte: 0.8,
  },
  {
    d: `M ${BAAN_L} ${BAAN_MIDDEN} L ${BAAN_L + SERVICE} ${BAAN_MIDDEN}`,
    soort: "lijn",
    breedte: 0.7,
  },
  {
    d: `M ${BAAN_R - SERVICE} ${BAAN_MIDDEN} L ${BAAN_R} ${BAAN_MIDDEN}`,
    soort: "lijn",
    breedte: 0.7,
  },
  // Doelcirkels: waar de rest van de club op mikt. Buiten het midden, want een
  // gecentreerde schietschijf maakt van het vlak een logo.
  { d: ellipsPad(68, 60, 8), soort: "lijn", breedte: 0.9, alpha: 0.75 },
  { d: ellipsPad(68, 60, 4), soort: "lijn", breedte: 0.9, alpha: 0.9 },
  { d: ellipsPad(68, 60, 1.2), soort: "vlak", alpha: 0.8 },
  { d: ellipsPad(27, 37, 5.5), soort: "lijn", breedte: 0.8, alpha: 0.6 },
  // Remsporen: korte vegen dwars op de baan — geslipte schoenen, geen wolken.
  {
    d: "M 23 65.5 C 28 67.5, 34 68.2, 40 67.2",
    soort: "lijn",
    breedte: 1.5,
    alpha: 0.55,
  },
  {
    d: "M 58 33.5 C 63 31.8, 68 31.4, 73 32.4",
    soort: "lijn",
    breedte: 1.3,
    alpha: 0.5,
  },
  {
    d: "M 32 44 C 36 42.4, 40 42, 44 42.6",
    soort: "lijn",
    breedte: 1.1,
    alpha: 0.45,
  },
  // Balinslagen: drie stuks, verspreid over beide helften.
  ...inslag(44.5, 57),
  ...inslag(76, 44),
  ...inslag(57.5, 67),
  // Gebruikssporen: twee schuurstreken in de hoeken van het vlak.
  { d: "M 9 31.5 L 17 34.5", soort: "lijn", breedte: 0.9, alpha: 0.35 },
  { d: "M 91 68 L 83 65.5", soort: "lijn", breedte: 0.9, alpha: 0.35 },
] as const;

/* ------------------------------ ornamentlaag ------------------------------ */

const VOOR: readonly DivisieDeel[] = [
  // Stootstrips eerst: ze liggen tegen de rand en alles wat erna komt, komt
  // eroverheen.
  { d: STRIP.omtrek, vulling: RUBBER, spiegel: true },
  {
    d: STRIP.highlight,
    contour: RUBBER_SLIJT,
    contourBreedte: 0.45,
    alpha: 0.7,
    spiegel: true,
  },
  ...STRIP.ribbels.map(
    (d): DivisieDeel => ({
      d,
      contour: ZINK_DEUK,
      contourBreedte: 0.3,
      alpha: 0.5,
      spiegel: true,
    }),
  ),
  ...STRIP.ribbelGlans.map(
    (d): DivisieDeel => ({
      d,
      contour: RUBBER_SLIJT,
      contourBreedte: 0.3,
      alpha: 0.6,
      spiegel: true,
    }),
  ),
  // Crest: plaat, bies, kegel, band.
  {
    d: CREST_PLAAT,
    vulling: "url(#fut-div-slof-crest)",
    contour: ZINK_DIEP,
    contourBreedte: 0.45,
  },
  { d: CREST_BIES, contour: BETON_GLANS, contourBreedte: 0.35 },
  { d: CREST_KEGEL, vulling: ZINK_DEUK, alpha: 0.9 },
  { d: CREST_BAND, contour: ZINK_LICHT, contourBreedte: 0.5, alpha: 0.6 },
  // Oefendoel: frame, net, deuk, glans, inslag.
  {
    d: DOEL_FRAME,
    vulling: "url(#fut-div-slof-doel)",
    contour: ZINK_DEUK,
    contourBreedte: 0.45,
  },
  ...DOEL_NET.map(
    (d): DivisieDeel => ({
      d,
      contour: ZINK_DIEP,
      contourBreedte: 0.3,
      alpha: 0.6,
    }),
  ),
  { d: DOEL_DEUK, contour: ZINK_DEUK, contourBreedte: 0.4, alpha: 0.55 },
  { d: DOEL_GLANS, contour: BETON_GLANS, contourBreedte: 0.3 },
  { d: DOEL_INSLAG, vulling: ZINK_DEUK, alpha: 0.85 },
  ...DOEL_INSLAG_STER.map(
    (d): DivisieDeel => ({
      d,
      contour: ZINK_DEUK,
      contourBreedte: 0.4,
      alpha: 0.7,
    }),
  ),
] as const;

/* -------------------------------- de divisie ------------------------------- */

export const DIVISIE_SLOF: DivisieKaart = {
  key: "slof",
  // Zichtbare productnaam uit de bestaande data (TIER_BANDEN in tiers.ts); de
  // kaart zelf zet de titel dynamisch uit `tier.label`.
  naam: "Sletje van de baan",

  // Register: de canvas-spiegel van .fut-kaart--slof in slof.css; de synctest in
  // slof.test.ts leest die stylesheet in en houdt de twee gelijk. Contrast
  // (WCAG, tegen de dónkerste vlak-stop #c0baac — de ongunstigste plek op het
  // vlak): ink #2b2823 → 7,59:1 (AAA), inkSoft #4a453e → 4,91:1 (AA). Zie het
  // CSS-commentaar voor de meting op de hoogtes waar de inkt écht staat.
  register: {
    // Twee vlakke zinktonen op de gedeelde frame-as (160°): licht naar dof, in
    // één richting. Álle andere divisies hebben er vier met minstens één
    // glanspunt; dit is dus letterlijk de simpelste omlijsting van de ladder.
    frame: [
      [0, "#c5bfb1"],
      [1, "#7c766a"],
    ],
    // Liner dicht op de donkere framestop: rand en liner lezen als één vlakke
    // strip i.p.v. als een gelaagde metaalrand. Zonder eigen keyline (die valt
    // terug op de gedeelde mix van --kaart-lijn), zonder binnenlijn en zonder
    // echo — geen enkele extra contour op deze kaart.
    liner: "#6b6559",
    vlak: ["#ece9e2", "#dad6cb", "#c0baac"],
    // Beton reflecteert diffuus: een zwakke warme waas i.p.v. de koele
    // topgloed van de metaalladder (0,50) of het composiet van de Stofzuiger
    // (0,34), en de breedste, zwakste sheen-baan van de negen.
    glow: "rgba(255, 252, 244, 0.24)",
    sheen: "rgba(255, 252, 244, 0.06)",
    sheenSpreiding: 0.24,
    satijnAlpha: 0.03,
    stralen: false,
    ink: "#2b2823",
    inkSoft: "#4a453e",
    lijn: "#6f6a5c",
  },

  // Twee gradients, de crest en het doel; het rubber is een platte vulling,
  // want een mat profiel heeft geen verloop. Id-prefix `fut-div-slof-`, zodat de
  // andere acht divisies niet botsen.
  gradienten: [
    {
      id: "fut-div-slof-crest",
      as: [43.6, -8.2, 56.4, 4.9],
      stops: [
        [0, ZINK_LICHT],
        [0.52, ZINK_MID],
        [1, ZINK_DIEP],
      ],
    },
    {
      id: "fut-div-slof-doel",
      as: [42, 121.5, 58, 131.4],
      stops: [
        [0, ZINK_MID],
        [1, ZINK_DIEP],
      ],
    },
  ],

  voor: VOOR,

  motief: {
    paden: SLOF_MOTIEF,
    kleur: SPOOR_KLEUR,
    // Volle vlakbreedte en in het midden: de baan hoort over de hele kaart te
    // liggen, niet als postzegel bovenaan.
    breedte: 1,
    positie: 0.5,
  },
};
