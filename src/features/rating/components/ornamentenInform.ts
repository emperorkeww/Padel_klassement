// Ornamenten en motief van de In-Form-editie (#710). Eigen module naast
// futKaartOrnamenten.ts, omdat In-Form geen tier maar een *editie* is: de
// vormen hieronder moeten bovenop élke schildvorm kunnen liggen (vlak, notch,
// punt, kroon, troon) en mogen dus niets aannemen over de bovenrand van de
// kaart. Eén bron voor twee tekenaars, net als bij de toptiers: FutKaart.tsx
// rendert de paden als inline-SVG, futKaartCanvas.ts tekent ze met Path2D op
// de deel-poster — letterlijk dezelfde strings, dus pariteit by construction.
//
// Coördinaten: ornamenten in kaart-units (100 breed × 139 hoog, oorsprong
// linksboven op de kaart, dezelfde ORNAMENT_VIEWBOX als de toptiers); het
// motief in zijn eigen 100×100-viewBox.
//
// Ontwerplijn uit de referentie (#710): zwart-titanium met champagnegoud, en
// alles smal — een editie is tijdelijk nieuws, geen monument. Waar de GOAT
// zijn hoorns rondom de kaart legt en El Padelissimo een kroon opzet, houdt
// In-Form het bij drie slanke accenten (crest, vinnen, medaillon) die het
// schildsilhouet intact laten.

import { bouwStreng, type OrnamentPad, type Streng } from "./futKaartOrnamenten";

const rond = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------ materiaal ------------------------------ */

/** Champagnegoud: dezelfde familie als het In-Form-frame (#f7dfa0 → #4c390a in
 *  FutKaart.css), maar met een lichtere top zodat een ornament op een donkere
 *  ondergrond nog leest. Bewust géén antiekgoud (dat is El Padelissimo) en
 *  géén koper (dat is On-Fire — expliciete stijlbeperking uit de referentie).
 *  Vaste hexen: de deel-poster staat op het lichte palet vastgepind (#125). */
export const INFORM_GOUD_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "#fff2cc"],
  [0.34, "#f2cf7d"],
  [0.68, "#a8802a"],
  [1, "#4c390a"],
] as const;
export const INFORM_GOUD_CONTOUR = "#241a05";
export const INFORM_GOUD_GLANS = "rgba(255, 250, 226, 0.8)";
/** Groef en flankschaduw van de vinnen: de dwarssneden tussen de bladen. */
export const INFORM_GOUD_GROEF = "rgba(36, 26, 5, 0.55)";
export const INFORM_GOUD_SCHADUW = "rgba(30, 22, 4, 0.45)";
/** Bijna-zwart van het medaillonvlak — de titaniumkern uit de referentie. */
export const INFORM_TITAAN = "#0d1018";

/* ------------------------------ bliksemglyph ------------------------------ */

/** Eén bliksemglyph in een genormaliseerde 0..1-doos (x naar rechts, y naar
 *  onder). Chunky en hoekig, zoals de referentie: een dunne bliksem zou op de
 *  veldmaat (96px kaart) verdwijnen. Crest en medaillon delen deze punten, dus
 *  de twee bliksems op één kaart zijn per constructie hetzelfde teken. */
const BLIKSEM: readonly (readonly [number, number])[] = [
  [0.58, 0],
  [0.35, 0.22],
  [0.16, 0.42],
  [0.0, 0.54],
  [0.42, 0.54],
  [0.36, 0.78],
  [0.42, 1],
  [0.65, 0.72],
  [0.84, 0.56],
  [1.0, 0.44],
  [0.55, 0.44],
  [0.66, 0.18],
] as const;

/** De bliksemglyph als gesloten pad, gecentreerd op (cx, cy). */
export function bliksem(
  cx: number,
  cy: number,
  breedte: number,
  hoogte: number,
): string {
  const x0 = cx - breedte / 2;
  const y0 = cy - hoogte / 2;
  return `M ${BLIKSEM.map(
    ([u, v]) => `${rond(x0 + u * breedte)} ${rond(y0 + v * hoogte)}`,
  ).join(" L ")} Z`;
}

/* --------------------------- crest (achter, as) --------------------------- */

/** Compacte bliksemcrest op de as, in de bovenste inkeping.
 *
 *  Overlay-gedrag (de reden dat dit een editie is en geen tier): de crest zit
 *  bijna volledig bóven v=0, niet ín de notch. De Siliconen-vormen hebben
 *  namelijk een heel verschillende bovenrand op de as — `vlak` en `kroon`
 *  lopen daar tot v=0, `notch` duikt tot v≈3, `punt` en `troon` tot v≈8. Een
 *  crest die de notch opvult zou op `vlak` halverwege afgesneden worden. Zo
 *  staat hij op élke vorm heel: op `vlak`/`kroon` zit alleen de onderste punt
 *  achter de rand (hij lijkt erin geplant), op `notch` net vrij, en op
 *  `punt`/`troon` nestelt hij precies boven de V. */
export const INFORM_CREST = bliksem(50, -5.2, 14, 18);

/* ---------------------------- vinnen (achter) ---------------------------- */

/** Aerodynamisch goudaccent langs de onderste zijrand — de linkerhelft; de
 *  rechter is de spiegeling om x=50, dus links en rechts zijn per constructie
 *  gelijk. De onderkant van het schild (taille → punt) is bij álle vijf de
 *  vormen identiek, dus dit ornament is vormonafhankelijk: precies waarom de
 *  vinnen laag zitten en de crest hoog.
 *
 *  Richting: wortel (dik) achter de kaart bij de taille, punt (dun) naar
 *  buiten-boven — een naar achter gepijlde vin, zoals de referentie. De twee
 *  `ribbels` zijn de dwarssneden die het blad in drie plaatjes verdelen. */
export const INFORM_VIN: Streng = bouwStreng({
  // Uitgemeten tegen de échte onderrand van het schild, níet tegen een rechte
  // lijn van taille naar punt: die rand is een bezier die veel langer tegen
  // u=0 aan blijft liggen dan je zou denken (v=83→u=0, v=96→u=0,8, v=105→u=3,4,
  // v=111→u=7). Een vin die met een rechte schuinte meeloopt verdwijnt daardoor
  // vanaf v≈95 achter het frame — precies wat een eerdere opzet deed. Deze
  // centerlijn hugt de bezier van net buiten: wortel op (3,6 · 111), punt op
  // (−7,8 · 74), en overal daartussen ligt de buitenste flank vrij.
  start: [3.6, 111],
  segmenten: [
    [
      [2.8, 102],
      [0.8, 93],
      [-1.8, 86],
    ],
    [
      [-3.8, 81],
      [-5.8, 77.5],
      [-7.8, 74],
    ],
  ],
  // Aerodynamische en vloeiende taper (3.6 -> 2.2 -> 1.0) voor een snel en
  // bliksemachtig effect.
  dikte: 3.6,
  ribbels: 3,
  taper: 2.2,
  punt: 1.0,
  stappen: 40,
});

/* -------------------------- medaillon (vóór) -------------------------- */

/** Bliksemmedaillon in de kaartpunt: gouden ring, donkere spouw, tweede ring,
 *  titaniumvlak en de bliksem erin. Ligt vóór de kaart (zoals het lakzegel van
 *  El Padelissimo) omdat het over het schild heen moet vallen; het zit in de
 *  lege punt onder de editie-regel, dus het dekt geen tekst af. De punt op
 *  (50, 139) is bij álle schildvormen dezelfde, dus ook dit is
 *  vormonafhankelijk. */
export const INFORM_MEDAILLON = {
  midden: [50, 126] as const,
  /** Buitenste gouden ring. */
  ring: 7.8,
  /** Donkere spouw daarbinnen. */
  spouw: 7,
  /** Tweede gouden ring. */
  binnenring: 6.3,
  /** Titaniumvlak waarin de bliksem staat. */
  vlak: 5.5,
  /** De bliksem zelf — dezelfde glyph als de crest, op medaillonmaat. */
  bliksem: bliksem(50, 126, 7.2, 9.2),
} as const;

/* ------------------------------- motief ------------------------------- */

/** Deterministische pseudo-ruis (som van drie sinussen). Nooit Math.random:
 *  DOM, canvas én de geometrietest moeten letterlijk hetzelfde pad krijgen. */
function ruis(i: number): number {
  return (
    (Math.sin(i * 12.9898) +
      Math.sin(i * 5.2331) * 0.6 +
      Math.sin(i * 27.113) * 0.35) /
    1.95
  );
}

/** Eén boog van de pulse-ring als polyline met een onregelmatige straal — dat
 *  onregelmatige is wat een gladde cirkel van een elektrische ontlading
 *  scheidt. Hoeken in graden, 0° = rechts, kloksgewijs (y naar onder). */
function bliksemBoog({
  cx,
  cy,
  r,
  van,
  tot,
  jitter,
  fase = 0,
  stappen = 40,
}: {
  cx: number;
  cy: number;
  r: number;
  van: number;
  tot: number;
  jitter: number;
  fase?: number;
  stappen?: number;
}): string {
  const punten: string[] = [];
  for (let i = 0; i <= stappen; i++) {
    const t = i / stappen;
    const hoek = ((van + (tot - van) * t) * Math.PI) / 180;
    // De uitslag dooft naar beide uiteinden uit, zodat de boog niet met een
    // knik begint maar uit het niets komt aanzetten.
    const demping = Math.sin(Math.PI * t);
    const straal = r + jitter * demping * ruis(i + fase);
    punten.push(
      `${rond(cx + Math.cos(hoek) * straal)} ${rond(cy + Math.sin(hoek) * straal)}`,
    );
  }
  return `M ${punten.join(" L ")}`;
}

/** Eén hoekige snelheidslijn: een lange, flauwe zigzag die naar rechts-onder
 *  wegloopt. Hoekig en niet gebogen — dat is wat "snelheid" van "sierlijst"
 *  scheidt; de knik in het midden geeft de streek de bliksemtoon van de
 *  editie zonder een tweede bliksem op de kaart te zetten. */
function snelheidslijn(x: number, y: number, lengte: number): string {
  // Helling 0,42 (≈23° omlaag) en een knik van 2,6 units omhoog halverwege:
  // steil genoeg om als streek te lezen, vlak genoeg om niet met de
  // scheidingslijnen van het kaartvlak te concurreren.
  const helling = 0.42;
  return `M ${rond(x)} ${rond(y)} L ${rond(x + lengte * 0.46)} ${rond(
    y + lengte * helling * 0.46 - 2.6,
  )} L ${rond(x + lengte)} ${rond(y + lengte * helling)}`;
}

/** Middelpunt en straal van de pulse-ring, in motief-units. Ligt achter de
 *  bovenste kaartinhoud (avatar rechts, eloblok links): met breedte 1 en
 *  positie 0 valt de 100×100-doos precies op het bovenste vierkant van het
 *  vlak, dus deze coördinaten zijn ~kaart-units. */
const PULS = { cx: 70, cy: 40, r: 29 } as const;

/** Geëtst motief ín het vlak: de elektrische pulse-ring achter de bovenste
 *  kaartinhoud plus twee clusters nauwelijks zichtbare snelheidslijnen in de
 *  middenband. Beide horen bij het vlak-register (niet bij de ornamentlaag),
 *  dus ze vallen netjes binnen de schildclip en werken daarmee op élke vorm.
 *  De ring loopt van linksboven om de avatar heen naar rechtsonder en laat de
 *  rechterbovenkant open — een ontlading, geen sluitende cirkel. */
export const INFORM_MOTIEF: readonly OrnamentPad[] = [
  // Halo: dezelfde boog iets ruimer en ijler — geeft de ontlading diepte
  // zonder een tweede zichtbare lijn te worden.
  {
    d: bliksemBoog({
      ...PULS,
      r: PULS.r + 2.6,
      van: 232,
      tot: 58,
      jitter: 2.2,
      fase: 11,
    }),
    soort: "lijn",
    breedte: 2.6,
    alpha: 0.4,
  },
  // Hoofdfilament.
  {
    d: bliksemBoog({ ...PULS, van: 226, tot: 52, jitter: 1.9 }),
    soort: "lijn",
    breedte: 1.2,
  },
  // Korte staart over de bovenkant: het stuk dat de hoofdboog openlaat, zodat
  // de ring als onderbroken ontlading leest i.p.v. als sluitende cirkel.
  {
    d: bliksemBoog({
      ...PULS,
      van: 242,
      tot: 300,
      jitter: 1.4,
      fase: 23,
      stappen: 16,
    }),
    soort: "lijn",
    breedte: 0.7,
    alpha: 0.6,
  },
  // Snelheidslijnen: drie streken die naar rechts-onder wegtrekken, in de band
  // tússen de bovenste kaartinhoud (eloblok, avatar) en de naamplaat — bewust
  // ijl (alpha 0.4): het is textuur, geen teken.
  ...[
    [8, 54, 34],
    [19, 62, 41],
    [33, 71, 33],
  ].map(([x, y, lengte]) => ({
    d: snelheidslijn(x, y, lengte),
    soort: "lijn" as const,
    breedte: 2.2,
    alpha: 0.4,
  })),
] as const;

/** Etskleur van het motief. Bewust laag: het motief ligt ónder de inkt, dus
 *  elke oplichting van het vlak knabbelt aan het contrast van de champagne
 *  inkt (#f2cf7d, L≈0,652). Op 0.12 tilt de zwaarste lijn het navy (#141826,
 *  L≈0,0097) naar L≈0,030 — contrast ≈ 8,8:1, dus nog ruim AAA; op 0.20 zakte
 *  dat naar ~6:1 en daarmee onder het niveau dat de kaart nu heeft. */
export const INFORM_MOTIEF_KLEUR = "rgba(255, 226, 150, 0.12)";
/** Volle vlakbreedte op positie 0: de 100×100-doos valt op het bovenste
 *  vierkant van het vlak, waar de pulse-ring en de snelheidslijnen horen. */
export const INFORM_MOTIEF_BREEDTE = 1;
export const INFORM_MOTIEF_POSITIE = 0;
