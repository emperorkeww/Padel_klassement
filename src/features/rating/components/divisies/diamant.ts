// Divisiekaart "Eeuwige belofte" (diamant) — 1200–1299 — ijsblauw, kobalt en geborsteld aluminium.
//
// Thema uit #710: onvoltooid potentieel. Dat is hier geen plaatje maar een
// constructieprincipe — élk ornament stopt net te vroeg. De aluminium boog
// boven de zandlopercrest is een halve ring die nergens op rust, de zijrails
// bestaan uit twee losse stukken met een gat waar de derde had moeten zitten
// (plus een stomp die er net náást ligt), en de kroon in het watermerk is links
// dichtgetrokken en rechts nog een streepjeslijn.
//
// Materiaalkeuze: ijsblauw vlak met kobalt als accent, niet omgekeerd. De
// referentie loopt van ijs bovenaan naar diep marine onderaan en wisselt
// daarbij van donkere naar lichte inkt; de kaart heeft één inktkleur, dus zo'n
// ramp zou onderaan of bovenaan onder AA duiken. Het vlak blijft daarom licht
// (de basisdivisies zijn "fysieke" lichte kaartjes; alleen de toptiers zijn
// donker) en het kobalt zit in frame, crest, medaillon en watermerk.
//
// Vaste hexen, geen tier-tokens: de deel-poster staat op het lichte palet
// vastgepind (#125), dus alleen literals houden DOM-kaart en poster in béide
// thema's gelijk — dezelfde afweging als bij GOAT en El Padelissimo.
//
// Contrast (berekend, sRGB-relatieve luminantie): inkt #132f6e op de donkerste
// vlak-stop #a2c1e8 = 6,74:1, en op het vlak achter het watermerk (≈#b0c5e3)
// 7,16:1; de zachte inkt #274785 van sub-niveau en divisieregel haalt 4,81:1 op
// diezelfde donkerste stop. Beide dus boven AA (4,5:1) op het slechtste punt.
//
// Coördinaten: kaart-units (100 × 139, oorsprong linksboven op de kaart); het
// watermerk heeft zijn eigen 100 × 100-doos. Zie divisieKaart.ts.

import { bouwStreng, type OrnamentPad, type Streng } from "../futKaartOrnamenten";
import type { DivisieDeel, DivisieGradient, DivisieKaart } from "./divisieKaart";

/* ------------------------------ hulpmiddelen ------------------------------ */

const rond = (n: number) => Math.round(n * 100) / 100;

/** Cubic-benadering van een cirkelboog; graden met 0° op +x, kloksgewijs in
 *  schermrichting (y omlaag). Bewust cubics en geen A-commando: beide tekenaars
 *  slikken A wel, maar dan is een pad niet meer als reeks coördinaatparen te
 *  lezen — en dáárop rust de geometrietest. */
function boog(
  cx: number,
  cy: number,
  r: number,
  van: number,
  tot: number,
  stukken = Math.max(1, Math.ceil(Math.abs(tot - van) / 90)),
): string {
  const rad = (g: number) => (g * Math.PI) / 180;
  const opBoog = (g: number): [number, number] => [
    cx + r * Math.cos(rad(g)),
    cy + r * Math.sin(rad(g)),
  ];
  const stap = (tot - van) / stukken;
  // k = 4/3·tan(θ/4)·r — de standaard-controleafstand van één cubic-boog.
  const k = (4 / 3) * Math.tan(rad(stap) / 4) * r;
  const [x0, y0] = opBoog(van);
  let d = `M ${rond(x0)} ${rond(y0)}`;
  for (let i = 0; i < stukken; i++) {
    const a = van + i * stap;
    const b = a + stap;
    const [ax, ay] = opBoog(a);
    const [bx, by] = opBoog(b);
    d +=
      ` C ${rond(ax - k * Math.sin(rad(a)))} ${rond(ay + k * Math.cos(rad(a)))}` +
      ` ${rond(bx + k * Math.sin(rad(b)))} ${rond(by - k * Math.cos(rad(b)))}` +
      ` ${rond(bx)} ${rond(by)}`;
  }
  return d;
}

/** Gesloten band tussen twee concentrische bogen: heen langs de buitenboog,
 *  terug langs de binnenboog. De uiteinden blijven recht afgesneden — precies
 *  de open beëindiging die de crest-boog nodig heeft. */
function boogBand(
  cx: number,
  cy: number,
  buiten: number,
  binnen: number,
  van: number,
  tot: number,
): string {
  const heen = boog(cx, cy, buiten, van, tot);
  const terug = boog(cx, cy, binnen, tot, van).replace(/^M/, "L");
  return `${heen} ${terug} Z`;
}

/** Een polylijn opgeknipt in streepjes van `aan` met gaten van `uit`. Zo is de
 *  onvoltooide helft van de kroon geen tweede tekening maar dezelfde lijn, half
 *  weggehaald: verschuift het watermerk, dan verschuiven de streepjes mee. */
function streepjes(
  punten: readonly (readonly [number, number])[],
  aan: number,
  uit: number,
): string[] {
  const uitvoer: string[] = [];
  let rest = 0; // wat er nog van het lopende streepje/gat over is
  let tekent = true;
  let start: [number, number] | null = [punten[0][0], punten[0][1]];
  for (let i = 0; i + 1 < punten.length; i++) {
    const [x0, y0] = punten[i];
    const [x1, y1] = punten[i + 1];
    const lengte = Math.hypot(x1 - x0, y1 - y0);
    let af = 0;
    while (af < lengte - 1e-9) {
      const nodig = rest > 0 ? rest : tekent ? aan : uit;
      const stap = Math.min(nodig, lengte - af);
      const t = (af + stap) / lengte;
      const hier: [number, number] = [
        rond(x0 + (x1 - x0) * t),
        rond(y0 + (y1 - y0) * t),
      ];
      if (tekent && start)
        uitvoer.push(`M ${start[0]} ${start[1]} L ${hier[0]} ${hier[1]}`);
      if (stap < nodig) {
        // Segment op; het lopende streepje loopt door in het volgende segment.
        rest = nodig - stap;
        start = tekent ? hier : null;
      } else {
        rest = 0;
        tekent = !tekent;
        start = tekent ? hier : null;
      }
      af += stap;
    }
  }
  return uitvoer;
}

/* -------------------------------- materiaal ------------------------------- */

const ALU_CONTOUR = "#1a3560";
const ALU_GLANS = "#f2f8ff";
const ALU_SCHADUW = "#5b6f90";
/** Ijsblauwe keyline óp het kobalt-emaille van crest en medaillon. */
const IJS_KEYLINE = "#cfe1f5";

/** Geborsteld aluminium heeft vier stops, niet twee: één overgang leest als
 *  papier, twee glanspunten als gefreesd metaal. De assen staan per onderdeel
 *  in kaart-units, zodat het licht met de spiegeling meekantelt (de rechterhelft
 *  wordt om x=50 gespiegeld, en daarmee ook de gradient-as). */
const ALU_STOPS = [
  [0, "#fbfdff"],
  [0.3, "#dde7f3"],
  [0.66, "#94a6bc"],
  [1, "#5b7093"],
] as const;

/** Kobalt-emaille: bovenlicht, kern, en de diepe marine in de schaduw. */
const KOBALT_STOPS = [
  [0, "#335592"],
  [0.52, "#1d3872"],
  [1, "#101f47"],
] as const;

const G_CREST_ALU = "fut-div-diamant-crest-alu";
const G_CREST_KOBALT = "fut-div-diamant-crest-kobalt";
const G_RAIL_ALU = "fut-div-diamant-rail-alu";
const G_MED_ALU = "fut-div-diamant-med-alu";
const G_MED_KOBALT = "fut-div-diamant-med-kobalt";

const GRADIENTEN: readonly DivisieGradient[] = [
  // Crest: licht van linksboven, zoals de sheen over het vlak.
  { id: G_CREST_ALU, as: [40, -17, 61, 13], stops: ALU_STOPS },
  { id: G_CREST_KOBALT, as: [50, -14, 50, 12], stops: KOBALT_STOPS },
  // Rail: as dwars over de bandbreedte, dus licht aan de buitenkant en
  // schaduw aan de kaartkant — dat maakt van een strip een rond profiel.
  { id: G_RAIL_ALU, as: [-9, 0, -1.5, 0], stops: ALU_STOPS },
  { id: G_MED_ALU, as: [40, 130, 60, 151], stops: ALU_STOPS },
  { id: G_MED_KOBALT, as: [50, 133, 50, 149], stops: KOBALT_STOPS },
];

/* ---------------------------- crest: de zandloper --------------------------- */
//
// De bovenrand van deze divisiegroep is `fut-schild-punt`: spitse vleugels met
// een V-inkeping die op de as tot v≈8 duikt. De crest valt precies in die
// inkeping — plaat van v=−13,5 tot de punt op v=11,5, dus hij hangt bóven de
// kaart uit én zakt de inkeping in. Daarom staat de hele crest in de vóór-laag:
// achter het schild zou de onderste helft verdwijnen.

/** Open aluminium boog over de plaat: een halve ring die nergens op rust. De
 *  uiteinden stoppen op v=−5,5, ruim bóven de schouders van de plaat (v≈−6,5) —
 *  de boog raakt de crest dus net niet aan. */
const CREST_BOOG = boogBand(50, -5.5, 10.6, 7.6, 180, 360);

/** De kobalt plaat: schild met afgeronde schouders en een punt in de inkeping. */
const CREST_PLAAT =
  "M 42 -6.5 C 42 -11.4 44.6 -13.5 50 -13.5 C 55.4 -13.5 58 -11.4 58 -6.5" +
  " L 58 1.5 C 58 5.5 54 8 50 11.5 C 46 8 42 5.5 42 1.5 Z";

/** Dezelfde vorm, 1,7 units naar binnen: de gegraveerde keyline op het emaille. */
const CREST_KEYLINE =
  "M 43.9 -6.4 C 43.9 -10.3 46 -11.9 50 -11.9 C 54 -11.9 56.1 -10.3 56.1 -6.4" +
  " L 56.1 1.2 C 56.1 4.5 53 6.4 50 9.2 C 47 6.4 43.9 4.5 43.9 1.2 Z";

/** Zandloper in de plaat: één doorlopende omtrek (bovenbak, taille, onderbak). */
const CREST_ZANDLOPER =
  "M 45.2 -9.4 L 54.8 -9.4 L 54.8 -7.9 L 53.5 -7.9" +
  " C 53.5 -5.6 51.2 -4.2 50 -3.1 C 51.2 -2 53.5 -0.6 53.5 1.7" +
  " L 54.8 1.7 L 54.8 3.2 L 45.2 3.2 L 45.2 1.7 L 46.5 1.7" +
  " C 46.5 -0.6 48.8 -2 50 -3.1 C 48.8 -4.2 46.5 -5.6 46.5 -7.9 L 45.2 -7.9 Z";

/** Het zand ligt nog in de bóvenbak: het potentieel is niet verlopen, het is
 *  nooit opgemaakt. Dat is het verschil tussen "te laat" en "eeuwige belofte". */
const CREST_ZAND =
  "M 47.6 -7.9 L 52.4 -7.9 C 52.4 -6 50.9 -5 50 -4.1 C 49.1 -5 47.6 -6 47.6 -7.9 Z";

/* ------------------------- zijrails: het open frame ------------------------ */
//
// Twee losse rails per zijkant, in kaart-units náást het schild. De bovenste
// loopt recht mee met de rechte zijkant; de onderste buigt met de taille naar de
// punt toe, zodat het silhouet klopt. Tussen v=62 en v=84 zit een gat van 22
// units — daar had het derde segment gezeten. Gegenereerd met `bouwStreng`, dus
// omtrek, glans en schaduw komen uit één centerlijn en de linker- en
// rechterhelft kunnen per constructie niet uit elkaar lopen (`spiegel: true`).

const RAIL_BOVEN: Streng = bouwStreng({
  start: [-4.2, 8],
  segmenten: [
    [
      [-4.9, 12],
      [-5.1, 16],
      [-5.1, 22],
    ],
    [
      [-5.1, 40],
      [-5.1, 52],
      [-5.1, 62],
    ],
  ],
  dikte: 1.62,
  punt: 1.15,
  taper: 2.6,
  stappen: 44,
});

const RAIL_ONDER: Streng = bouwStreng({
  start: [-4.6, 84],
  segmenten: [
    [
      [-4.9, 96],
      [-4.5, 104.5],
      [-2.8, 110.5],
    ],
    [
      [-0.4, 116.4],
      [3.6, 120.6],
      [8.2, 124.4],
    ],
  ],
  dikte: 1.55,
  punt: 1,
  taper: 2.8,
  stappen: 52,
});

/** Kobalt binnenlijn tussen rail en kaartrand: samen lezen de twee als één
 *  gelaagd profiel, precies zoals de rand van de kaart zelf. */
const RAIL_BOVEN_LIJN = "M -2.4 10 C -2.8 15 -2.9 18 -2.9 23 L -2.9 60.5";
const RAIL_ONDER_LIJN =
  "M -2.6 85.4 C -2.8 97 -2.4 105 -0.8 110.8 C 1.6 116.5 5.6 120.8 9.9 124.4";

/** De stomp die het gat had moeten dichten en er net náást ligt: 2,2 units naar
 *  buiten verschoven, dus hij kán de rails niet raken. */
const RAIL_STOMP = "M -9.4 67.4 L -7.2 67.4 L -7.2 78.2 L -9.4 78.2 Z";

/* --------------------- medaillon: ruit met zandloperkern -------------------- */
//
// De onderste kaartpunt ligt op (50, 139). Het medaillon staat er middenop
// (v=131,3 tot 150,3), dus het steekt onder de punt uit en moet in de vóór-laag
// staan — een ruit die half achter het schild verdwijnt is geen ruit.

/** Vierpuntige ruit met holle flanken: dezelfde "geslepen" vorm als de
 *  referentie, en de reden dat deze divisie `diamant` heet. */
const MED_RUIT =
  "M 50 131.3 C 51.6 136.2 54.4 139.2 59.4 140.8" +
  " C 54.4 142.4 51.6 145.4 50 150.3 C 48.4 145.4 45.6 142.4 40.6 140.8" +
  " C 45.6 139.2 48.4 136.2 50 131.3 Z";

/** Het kobalt vlak binnen de rand. */
const MED_VLAK =
  "M 50 134.7 C 51.2 138.1 53.2 140 56.5 141.1" +
  " C 53.2 142.2 51.2 144.1 50 147.5 C 48.8 144.1 46.8 142.2 43.5 141.1" +
  " C 46.8 140 48.8 138.1 50 134.7 Z";

/** Vierpuntige glans achter de zandloper — de facetflits van de referentie
 *  zonder een tweede laag steen. */
const MED_GLANS =
  "M 50 135.4 C 50.5 139.4 51 140.5 55.6 141.1" +
  " C 51 141.7 50.5 142.8 50 146.8 C 49.5 142.8 49 141.7 44.4 141.1" +
  " C 49 140.5 49.5 139.4 50 135.4 Z";

/** Dezelfde zandloper als in de crest, klein: crest en punt horen bij elkaar. */
const MED_ZANDLOPER =
  "M 47.4 137.4 L 52.6 137.4 L 52.6 138.3 L 51.9 138.3" +
  " C 51.9 139.6 50.7 140.4 50 141 C 50.7 141.6 51.9 142.4 51.9 143.7" +
  " L 52.6 143.7 L 52.6 144.6 L 47.4 144.6 L 47.4 143.7 L 48.1 143.7" +
  " C 48.1 142.4 49.3 141.6 50 141 C 49.3 140.4 48.1 139.6 48.1 138.3 L 47.4 138.3 Z";

/* ------------------- watermerk: onvoltooide kroon + blauwdruk ------------------ */
//
// Eigen doos van 100 × 100, geplaatst op 72% van de vlakbreedte en 30% hoogte:
// de kroon staat dan tussen het eloblok en de naamplaat, niet eronder. Alles is
// lijnwerk op 13% kobalt — een blauwdruk hoort ijl te zijn en mag de inkt niet
// hinderen (zie de contrastberekening bovenaan).

/** De kroon als polylijn vanaf de linkervoet. Rechts van de as is dezelfde
 *  lijn, maar in streepjes: de tekening is nooit afgemaakt. */
const KROON_LINKS: readonly (readonly [number, number])[] = [
  [26, 66],
  [29.6, 34],
  [42, 50.5],
  [50, 31],
];
const KROON_RECHTS: readonly (readonly [number, number])[] = KROON_LINKS.map(
  ([x, y]) => [100 - x, y] as const,
).reverse();

/** Constructiebogen om de kroon, gecentreerd op de kroonvoet. Drie radii, elk
 *  over een andere hoek: een protractor zoals op een technische tekening. */
const BLAUWDRUK_BOGEN = [
  boog(50, 66, 22, 196, 344),
  boog(50, 66, 30, 202, 338),
  boog(50, 66, 38, 208, 332),
];

/** Tactische lijnen op de diagonalen: links doorgetrokken naar een knooppunt,
 *  rechts blijft het bij een streepje. Die asymmetrie is het hele punt. */
const BLAUWDRUK_LIJNEN = [
  boog(50, 66, 44, 225, 225).replace(
    "M",
    `M ${rond(50 + 30 * Math.cos((225 * Math.PI) / 180))} ${rond(
      66 + 30 * Math.sin((225 * Math.PI) / 180),
    )} L`,
  ),
];

const BLAUWDRUK_KNOOP = boog(21.5, 37.5, 3.4, 0, 360);
const BLAUWDRUK_TIK = streepjes(
  [
    [71.2, 44.8],
    [81.1, 34.9],
  ],
  2.2,
  2.2,
);

const MOTIEF: readonly OrnamentPad[] = [
  // Kroon: linkerhelft en de voet tot de as dicht, rechts in streepjes.
  { d: `M 26 66 L 50 66`, soort: "lijn", breedte: 1.5 },
  {
    d: KROON_LINKS.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" "),
    soort: "lijn",
    breedte: 1.7,
  },
  ...streepjes(KROON_RECHTS, 4.5, 3.2).map(
    (d): OrnamentPad => ({ d, soort: "lijn", breedte: 1.7, alpha: 0.8 }),
  ),
  ...streepjes(
    [
      [50, 66],
      [74, 66],
    ],
    4.5,
    3.2,
  ).map((d): OrnamentPad => ({ d, soort: "lijn", breedte: 1.5, alpha: 0.8 })),
  // Blauwdruk: constructiebogen, één tactische lijn met knooppunt, en rechts
  // alleen nog een aanzet.
  ...BLAUWDRUK_BOGEN.map(
    (d): OrnamentPad => ({ d, soort: "lijn", breedte: 0.9, alpha: 0.6 }),
  ),
  ...BLAUWDRUK_LIJNEN.map(
    (d): OrnamentPad => ({ d, soort: "lijn", breedte: 0.9, alpha: 0.6 }),
  ),
  { d: BLAUWDRUK_KNOOP, soort: "lijn", breedte: 0.9, alpha: 0.6 },
  ...BLAUWDRUK_TIK.map(
    (d): OrnamentPad => ({ d, soort: "lijn", breedte: 0.9, alpha: 0.45 }),
  ),
];

/* ------------------------------- de ornamenten ------------------------------ */

/** Eén streng als ornamentdelen: gevulde omtrek met contour, plus de glans- en
 *  schaduwlijn die het profiel rond maken. Zonder ribbels — "strakkere en iets
 *  lichtere omlijsting dan Forever second" vraagt een gefreesde rail, geen
 *  geribbelde. */
function railDelen(streng: Streng): DivisieDeel[] {
  return [
    {
      d: streng.omtrek,
      vulling: `url(#${G_RAIL_ALU})`,
      contour: ALU_CONTOUR,
      contourBreedte: 0.3,
      spiegel: true,
    },
    {
      d: streng.highlight,
      contour: ALU_GLANS,
      contourBreedte: 0.34,
      alpha: 0.85,
      spiegel: true,
    },
    {
      d: streng.schaduw,
      contour: ALU_SCHADUW,
      contourBreedte: 0.34,
      alpha: 0.7,
      spiegel: true,
    },
  ];
}

const ACHTER: readonly DivisieDeel[] = [
  ...railDelen(RAIL_BOVEN),
  ...railDelen(RAIL_ONDER),
  {
    d: RAIL_STOMP,
    vulling: `url(#${G_RAIL_ALU})`,
    contour: ALU_CONTOUR,
    contourBreedte: 0.3,
    alpha: 0.9,
    spiegel: true,
  },
  {
    d: RAIL_BOVEN_LIJN,
    contour: "#1f3f7d",
    contourBreedte: 1.5,
    spiegel: true,
  },
  {
    d: RAIL_ONDER_LIJN,
    contour: "#1f3f7d",
    contourBreedte: 1.5,
    spiegel: true,
  },
];

const VOOR: readonly DivisieDeel[] = [
  {
    d: CREST_BOOG,
    vulling: `url(#${G_CREST_ALU})`,
    contour: ALU_CONTOUR,
    contourBreedte: 0.3,
  },
  {
    d: CREST_PLAAT,
    vulling: `url(#${G_CREST_KOBALT})`,
    contour: "#e6eefa",
    contourBreedte: 0.9,
  },
  { d: CREST_KEYLINE, contour: IJS_KEYLINE, contourBreedte: 0.32, alpha: 0.55 },
  {
    d: CREST_ZANDLOPER,
    vulling: `url(#${G_CREST_ALU})`,
    contour: ALU_CONTOUR,
    contourBreedte: 0.32,
  },
  { d: CREST_ZAND, vulling: "#8fb6e6", alpha: 0.9 },
  {
    d: MED_RUIT,
    vulling: `url(#${G_MED_ALU})`,
    contour: ALU_CONTOUR,
    contourBreedte: 0.32,
  },
  {
    d: MED_VLAK,
    vulling: `url(#${G_MED_KOBALT})`,
    contour: IJS_KEYLINE,
    contourBreedte: 0.28,
  },
  { d: MED_GLANS, vulling: "#bcd6f2", alpha: 0.45 },
  {
    d: MED_ZANDLOPER,
    vulling: `url(#${G_MED_ALU})`,
    contour: ALU_CONTOUR,
    contourBreedte: 0.26,
  },
];

/* --------------------------------- register -------------------------------- */

export const DIVISIE_DIAMANT: DivisieKaart = {
  key: "diamant",
  naam: "Eeuwige belofte",
  // Spiegel van het `.fut-kaart--diamant`-blok in diamant.css; de synctest in
  // diamant.test.ts houdt de twee gelijk.
  register: {
    frame: [
      [0, "#f4f8fc"],
      [0.4, "#93a3b8"],
      [0.66, "#e2ebf5"],
      [1, "#324a75"],
    ],
    liner: "#152a52",
    vlak: ["#f5f9fe", "#d4e5f7", "#a2c1e8"],
    glow: "rgba(255, 255, 255, 0.5)",
    ink: "#132f6e",
    inkSoft: "#274785",
    lijn: "#6b93cd",
    // Eén krappe kobalt-echo i.p.v. de gedeelde stralenkrans: de referentie
    // heeft een tweede, iets verschoven randlaag en géén zonnestraal.
    echo: [[0.012, 0.014, "rgba(24, 55, 116, 0.7)"]],
    // Aluminium hairline, kobalt spouw, tweede bleke lijn — het gelaagde
    // reliëf van de referentierand, zonder vijfde geclipte laag.
    binnenlijn: [
      [1, "rgba(240, 248, 255, 0.9)"],
      [2.5, "rgba(23, 52, 110, 0.85)"],
      [3.5, "rgba(184, 208, 236, 0.6)"],
    ],
    // Geen stralenkrans: het premium-blok in FutKaart.css zet die wél voor
    // deze tier, maar de blauwdruk is het motief van deze kaart en een
    // conic-zon eroverheen maakt het vlak druk. diamant.css zet ::after
    // daarom terug op het basissatijn.
    stralen: false,
  },
  gradienten: GRADIENTEN,
  achter: ACHTER,
  voor: VOOR,
  motief: {
    paden: MOTIEF,
    kleur: "rgba(21, 52, 118, 0.13)",
    breedte: 0.72,
    positie: 0.3,
  },
};

/** Voor de geometrietest: de delen per laag, plus de losse onderdelen waar de
 *  test iets specifieks over zegt. */
export const DIAMANT_TEST = {
  rails: [RAIL_BOVEN, RAIL_ONDER] as const,
  railStomp: RAIL_STOMP,
  crestBoog: CREST_BOOG,
  medRuit: MED_RUIT,
} as const;
