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
  /** Eigen kleur i.p.v. de laag-inkt (#710, pias): het GOAT-medaillon is één
   *  gravure in één tint, maar een motief dat harlekijnruiten, barstjes én
   *  bordeauxrode chevrons in dezelfde laag legt heeft er meer dan één nodig. */
  kleur?: string;
}

/** Het materiaal van een streng: één vulling plus de lijnkleuren die hem
 *  rondte geven. Losgekoppeld van de vorm, want sinds #710 draaien meerdere
 *  materialen op dezelfde generator (rosé metaal voor de GOAT, roségoud voor
 *  Big Daddy, smaragden loof voor de Kampioen, koper voor On Fire).
 *  `vulling` is de SVG-paint — een verwijzing naar een gradient in
 *  FutKaartDefs; `verloop` zijn dezelfde stops voor canvas, dat geen paint
 *  server kent. */
export interface StrengMateriaal {
  vulling: string;
  verloop: ReadonlyArray<readonly [number, string]>;
  /** Vaste verticale gradient-as in kaart-units [v1, v2] i.p.v. de omhullende
   *  van de streng zelf. Nodig zodra méér dan één streng samen één voorwerp
   *  vormt: een lint van twee bogen zou met een as per boog in de onderste
   *  boog integraal de staart van het verloop krijgen — een gouden hoorn
   *  i.p.v. een doorlopend lint. */
  as?: readonly [number, number];
  contour: string;
  /** Contourdikte; default 0.7. De pias zet hem hoger: daar ís de contour geen
   *  donkere lijn maar de gouden bies zelf. */
  contourBreedte?: number;
  glans: string;
  ribbel: string;
  ribbelGlans: string;
  schaduw: string;
  /** Vulling van de `rug`-band langs de bolle flank (#772). Alleen gezet
   *  waar een streng een tweede metaal draagt — de GOAT-hoorn krijgt zo zijn
   *  platina highlight over de bovenste ribben, terwijl de andere strengen
   *  (lint, loof, koper) de band gewoon niet tekenen. */
  rugGlans?: string;
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
  /** Gesloten band lángs de bolle flank (#772): breder dan de glanslijn en
   *  gevuld i.p.v. gestreept, zodat er een tweede metaal op kan (platina op
   *  de bovenste ribben van de bokhoorn). Alleen getekend als het materiaal
   *  `rugGlans` zet. */
  rug: string;
  /** Omhullende van `rug`, zodat canvas dezelfde objectBoundingBox-gradient
   *  kan leggen als de DOM-defs. */
  rugDoos: { xMin: number; xMax: number; yMin: number; yMax: number };
  /** Schaduwlijn net binnen de holle flank — geeft de streng rondte. */
  schaduw: string;
  /** Verticale grenzen, voor het kleurverloop op canvas. */
  bbox: { yMin: number; yMax: number };
}

interface StrengOpties {
  start: Punt;
  segmenten: readonly Segment[];
  /** Halve dikte bij de wortel. Genegeerd zodra `profiel` gezet is. */
  dikte?: number;
  /** Aantal dwarsribbels (0 = glad). */
  ribbels?: number;
  /** Exponent van de taper: hoger = langer dik, korter spits. */
  taper?: number;
  /** Halve dikte bij de punt (0 = scherp). */
  punt?: number;
  /** Expliciet dikteprofiel als [t, halveDikte]-knopen (#772). De machtstaper
   *  hierboven kan maar één soort verloop: gestaag dunner. De bokhoorn van de
   *  referentie doet iets anders — hij blijft over de hele bovenboog loodzwaar
   *  en knijpt dán in één keer in, waar de krul naar buiten draait. Dat is met
   *  géén exponent te halen (de verhouding dik/dun bij t=0,25 en t=0,5 loopt
   *  bij elke taper tegen een plafond van 2 aan), dus mag een streng zijn
   *  profiel ook uitschrijven; er wordt lineair tussen de knopen bemonsterd. */
  profiel?: readonly (readonly [number, number])[];
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
  dikte = 4,
  ribbels = 0,
  taper = 1.6,
  punt = 0.15,
  profiel,
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
    if (!profiel) return punt + (dikte - punt) * (1 - Math.pow(t, taper));
    // Lineair tussen de knopen; buiten het bereik de dichtstbijzijnde knoop.
    if (t <= profiel[0][0]) return profiel[0][1];
    for (let k = 1; k < profiel.length; k++) {
      const [t1, d1] = profiel[k];
      if (t > t1) continue;
      const [t0, d0] = profiel[k - 1];
      return d0 + ((d1 - d0) * (t - t0)) / (t1 - t0 || 1);
    }
    return profiel[profiel.length - 1][1];
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

  // Rugband (#772): een gesloten strook tussen 60% en 90% van de halve dikte
  // aan de bolle kant. Loopt tot 78% van de lengte mee en dooft daar in de
  // omtrek uit, zodat de punt zijn eigen kleur houdt en de band niet als los
  // sliertje eindigt.
  const rugTot = Math.round(stappen * 0.78);
  const rugBinnen: Punt[] = [];
  const rugBuiten: Punt[] = [];
  for (let i = 0; i <= rugTot; i++) {
    const [nx, ny] = normaal(i);
    // De strook knijpt in het laatste kwart naar nul: 1 → 0 over [0.72, 1].
    const knijp = Math.min(1, (1 - i / rugTot) / 0.28);
    const hb = halfDik(i) * (0.9 - 0.3 * (1 - knijp));
    const hi = halfDik(i) * (0.6 + 0.3 * (1 - knijp));
    rugBuiten.push([punten[i][0] + nx * hb, punten[i][1] + ny * hb]);
    rugBinnen.push([punten[i][0] + nx * hi, punten[i][1] + ny * hi]);
  }

  const ys = [...links, ...rechts].map((p) => p[1]);
  const rugPunten = [...rugBuiten, ...rugBinnen];
  return {
    omtrek,
    ribbels: groeven,
    ribbelGlans: ruggen,
    highlight: `M ${lijn(glans)}`,
    rug: `M ${lijn(rugBuiten)} L ${lijn([...rugBinnen].reverse())} Z`,
    rugDoos: {
      xMin: Math.min(...rugPunten.map((p) => p[0])),
      xMax: Math.max(...rugPunten.map((p) => p[0])),
      yMin: Math.min(...rugPunten.map((p) => p[1])),
      yMax: Math.max(...rugPunten.map((p) => p[1])),
    },
    schaduw: `M ${lijn(schaduw)}`,
    bbox: { yMin: Math.min(...ys), yMax: Math.max(...ys) },
  };
}
/* --------------------------- vormhulpjes (#772) --------------------------- */

/** Eén spits blad als gesloten pad: twee bogen die in een punt samenkomen,
 *  geplaatst op `(u, v)` en gedraaid over `hoek` (graden, 0 = naar rechts).
 *  Gedeeld door de lauwerkrans van El Padelissimo en de haarbladen van het
 *  GOAT-baardornament — hetzelfde blad, ander materiaal. */
function bladVorm(u: number, v: number, hoek: number, lengte: number): string {
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

/** Bouwt een gesloten vorm die op de as x=50 staat uit `[v, halveBreedte]`-
 *  knopen: de linkerflank van boven naar onder, en dezelfde knopen gespiegeld
 *  weer omhoog. Catmull-Rom door de knopen, zodat een handvol maten volstaat
 *  en de vorm toch vloeiend blijft. De symmetrie is per constructie — de
 *  rechterflank ís de linker, niet een tweede reeks getallen. */
function bouwAsVorm(knopen: readonly (readonly [number, number])[]): string {
  const links: Punt[] = knopen.map(([v, b]) => [50 - b, v]);
  const punten: Punt[] = [
    ...links,
    ...[...links].reverse().map(([x, y]): Punt => [100 - x, y]),
  ];
  // Catmull-Rom → cubics. Eerste en laatste knoop verdubbelen we, zodat de
  // vorm daar in een echte punt eindigt i.p.v. rond te lopen.
  const p = (i: number) => punten[Math.max(0, Math.min(punten.length - 1, i))];
  const uit: string[] = [`M ${rond(punten[0][0])} ${rond(punten[0][1])}`];
  for (let i = 0; i < punten.length - 1; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const c1: Punt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Punt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    uit.push(
      `C ${rond(c1[0])} ${rond(c1[1])}, ${rond(c2[0])} ${rond(c2[1])}, ${rond(
        p2[0],
      )} ${rond(p2[1])}`,
    );
  }
  return `${uit.join(" ")} Z`;
}

/* --------------------------- GOAT (#710, #772) --------------------------- */

/** Linker bokhoorn (#710, herijkt op de referentie van #772). Opgemeten met de
 *  kaartlinkerrand op u=0 en de bovenrand op v=0, schaal 7,33 px per kaart-unit
 *  uit de referentie (kaartbreedte 733 px):
 *
 *    wortel achter de bovenhoek  (30 · 16)   — verdwijnt onder de kaartrand
 *    top van de boog             ( 4 · −15,5) buitenrand tot v≈−25
 *    buitenste punt van de krul  (−16 · 2)   buitenrand tot u≈−20
 *    laatste bocht               (−12,3 · 18,3)
 *    punt                        (−5 · 24,2)
 *
 *  Dat is een krul van ruim 300°: over de bovenrand naar buiten, langs de
 *  zijkant omlaag en met de punt weer naar binnen — zwaarder en ronder dan de
 *  eerste opzet in #710, die op ~270° en de halve dikte bleef steken. Rechts is
 *  de spiegeling om x=50, dus links en rechts kunnen per constructie niet uit
 *  elkaar lopen. */
export const GOAT_HOORN = bouwStreng({
  start: [30, 16],
  segmenten: [
    [
      [24, 6],
      [16, -15.5],
      [4, -15.5],
    ],
    [
      [-6, -15.5],
      [-16, -8],
      [-16, 2],
    ],
    [
      [-16, 9],
      [-15, 15],
      [-12.3, 18.3],
    ],
    [
      [-10.4, 20.9],
      [-8, 23],
      [-5, 24.2],
    ],
  ],
  // Zware, brede basis die pas inknijpt waar de krul naar buiten draait: in de
  // referentie is de boogtop ~21 units dik en de dalende flank nog maar ~8,5.
  // Geen machtstaper haalt dat (zie `profiel` in StrengOpties).
  profiel: [
    [0, 10.2],
    [0.18, 9.6],
    [0.3, 8.4],
    [0.42, 6.2],
    [0.52, 4.5],
    [0.68, 3.5],
    [0.82, 2.6],
    [0.93, 1.5],
    [1, 0.15],
  ],
  ribbels: 26,
  stappen: 108,
});

/** Baardornament, deel 1 — de centrale speerpunt (#772). Staat op de as, dus
 *  hij wordt niet gespiegeld gerenderd maar is uit zichzelf symmetrisch:
 *  `bouwAsVorm` legt de rechterflank aan uit dezelfde knopen als de linker.
 *  Knopen zijn `[v, halveBreedte]`, opgemeten uit de referentie met de
 *  schildpunt op v=139: een slanke lans (v≈124), een taille, het zware
 *  middenblad dat ín de kaartpunt valt (v≈136) en een druppel die er onder
 *  uitsteekt (v≈147). */
export const GOAT_BAARD_SPEER = bouwAsVorm([
  [119.6, 0],
  [121.6, 1.5],
  [124, 2.9],
  [127.2, 2.1],
  [130.2, 1.2],
  [133.2, 3.3],
  [136.2, 3.7],
  [139.4, 1.9],
  [141.8, 0.85],
  [143.6, 2.2],
  [145.2, 1.4],
  [146.9, 0],
]);

/** Gegraveerde nerven in de speerpunt: drie lijnen die met de taille meelopen.
 *  Symmetrisch rond de as, dus de middelste staat er één keer en de twee
 *  flankerende als spiegelpaar. */
export const GOAT_BAARD_NERVEN: readonly string[] = [-1, 0, 1].map((k) => {
  const top = 50 + k * 1.1;
  const mid = 50 + k * 1.5;
  const eind = 50 + k * 0.6;
  return `M ${rond(top)} 121.6 C ${rond(mid)} 127, ${rond(mid)} 133, ${rond(
    eind,
  )} 145`;
});

/** Baardornament, deel 2 — de bovenarm (#772). Eén helft; rechts is de
 *  spiegeling om x=50. Groeit vanaf de as naar buiten-boven en eindigt in een
 *  krul van ~300° met het middelpunt op (35,6 · 117,2): de "sierlijke naar
 *  buiten gekrulde bovenarm" uit de issue. De krul stopt bewust op v≈116,2 —
 *  het vlak heeft 24% bodempadding, dus de divisieregel GOAT eindigt op v≈115
 *  en het ornament mag daar niet overheen. */
export const GOAT_BAARD_ARM = bouwStreng({
  start: [46.2, 120.2],
  segmenten: [
    [
      [41.0, 122.0],
      [36.8, 125.0],
      [32.6, 129.0],
    ],
  ],
  dikte: 0.8,
  punt: 0.1,
  taper: 1.2,
  stappen: 30,
});

/** Baardornament, deel 3 — de onderkrul (#772). */
export const GOAT_BAARD_KRUL = bouwStreng({
  start: [47.8, 122.4],
  segmenten: [
    [
      [45.5, 126.0],
      [43.0, 131.0],
      [41.5, 137.0],
    ],
  ],
  dikte: 0.6,
  punt: 0.08,
  taper: 1.2,
  stappen: 25,
});

/** Baardornament, deel 4 — de gelaagde haarbladen (#772). */
export const GOAT_BAARD_BLADEN: readonly string[] = [
  "M 49 116 C 48.2 125, 47.5 133, 49 140 C 49.8 133, 50.2 125, 49 116 Z",
  "M 46.5 116 C 44.5 124, 43.8 131, 45 137 C 46 131, 47 124, 46.5 116 Z",
  "M 44 117 C 41.5 125, 40.8 131, 42 135 C 43 131, 44.2 125, 44 117 Z",
];

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
/** Platina langs de bovenste ribben van de hoorn (#772): koel wit-grijs op het
 *  warme roségoud. Bewust half doorzichtig — het is een lichtval over het
 *  ribbelreliëf, geen tweede laag metaal, dus de groeven moeten erdoorheen
 *  blijven lezen. */
export const GOAT_PLATINA_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "rgba(255, 253, 252, 0.7)"],
  [0.45, "rgba(226, 224, 230, 0.4)"],
  [1, "rgba(168, 160, 172, 0.12)"],
] as const;

/** Vlak-motief (#772): de grote geitenkop als watermerk achter de
 *  kaartinformatie — frontaal, met de zware ramshoorns die de ornamentlaag
 *  buiten de kaart herhaalt, plus een paar zeer lichte gebogen hoornlijnen in
 *  de achtergrond. Géén ring eromheen meer (#710 had er twee): de referentie
 *  zet de kop als silhouet, en een medaillonrand maakte hem klein.
 *  ViewBox 0 0 100 100. */
export const GOAT_WATERMERK: readonly OrnamentPad[] = [
  // Achtergrond: gebogen hoornlijnen, ijler dan de kop zelf.
  { d: "M 9 82 C 3 52, 21 20, 50 11", soort: "lijn", breedte: 0.9, alpha: 0.28 },
  { d: "M 91 82 C 97 52, 79 20, 50 11", soort: "lijn", breedte: 0.9, alpha: 0.28 },
  // Hoorns: uit de schedel naar buiten, omlaag en met de punt terug naar
  // binnen — dezelfde krul als het ornament, in één lijn.
  {
    d: "M 43 27 C 32 14, 13 14, 7 28 C 1 42, 11 57, 27 56 C 15 51, 10 40, 17 32 C 25 23, 37 30, 41 41",
    soort: "lijn",
    breedte: 2,
  },
  {
    d: "M 57 27 C 68 14, 87 14, 93 28 C 99 42, 89 57, 73 56 C 85 51, 90 40, 83 32 C 75 23, 63 30, 59 41",
    soort: "lijn",
    breedte: 2,
  },
  // Hoorn-ribbels (textures).
  { d: "M 38 25 C 33 21, 28 21, 24 25", soort: "lijn", breedte: 0.8 },
  { d: "M 34 32 C 27 28, 20 28, 16 32", soort: "lijn", breedte: 0.8 },
  { d: "M 28 41 C 18 38, 13 38, 10 43", soort: "lijn", breedte: 0.8 },
  { d: "M 22 49 C 13 46, 8 49, 7 54", soort: "lijn", breedte: 0.8 },
  { d: "M 62 25 C 67 21, 72 21, 76 25", soort: "lijn", breedte: 0.8 },
  { d: "M 66 32 C 73 28, 80 28, 84 32", soort: "lijn", breedte: 0.8 },
  { d: "M 72 41 C 82 38, 87 38, 90 43", soort: "lijn", breedte: 0.8 },
  { d: "M 78 49 C 87 46, 92 49, 93 54", soort: "lijn", breedte: 0.8 },
  // Oren (drooping en realistischer).
  { d: "M 40 36 C 33 36, 25 42, 23 52 C 25 54, 30 50, 39 42 Z", soort: "lijn", breedte: 1.4 },
  { d: "M 60 36 C 67 36, 75 42, 77 52 C 75 54, 70 50, 61 42 Z", soort: "lijn", breedte: 1.4 },
  // Kop contour.
  {
    d: "M 43 32 C 40 37, 43 55, 45 68 L 47 77 L 50 78 L 53 77 L 55 68 C 57 55, 60 37, 57 32 Z",
    soort: "lijn",
    breedte: 2,
  },
  // Kaken en snuit-lijnen.
  { d: "M 44 48 C 45.5 54, 46 62, 47.5 68", soort: "lijn", breedte: 1 },
  { d: "M 56 48 C 54.5 54, 54 62, 52.5 68", soort: "lijn", breedte: 1 },
  // Neusbrug en neusgaten.
  { d: "M 47.5 68 L 47.5 73 L 52.5 73 L 52.5 68", soort: "lijn", breedte: 0.8 },
  { d: "M 47 75 C 48 78, 52 78, 53 75", soort: "lijn", breedte: 1 },
  // Realistische ogen met horizontale pupilspleten.
  { d: "M 41.5 45 C 43 44, 45 44, 46.5 45 C 45 47, 43 47, 41.5 45 Z", soort: "lijn", breedte: 0.8 },
  { d: "M 42.5 45.5 L 45.5 45.5", soort: "lijn", breedte: 1.2 },
  { d: "M 58.5 45 C 57 44, 55 44, 53.5 45 C 55 47, 57 47, 58.5 45 Z", soort: "lijn", breedte: 0.8 },
  { d: "M 54.5 45.5 L 57.5 45.5", soort: "lijn", breedte: 1.2 },
  // Geitenbaard (realistisch wispy).
  { d: "M 50 78 C 49 86, 49 92, 50 97 C 51 92, 51 86, 50 78 Z", soort: "lijn", breedte: 1 },
  { d: "M 48 77 C 46 84, 45 90, 46 95 C 47.5 90, 48 84, 48 77 Z", soort: "lijn", breedte: 0.8 },
  { d: "M 52 77 C 54 84, 55 90, 54 95 C 52.5 90, 52 84, 52 77 Z", soort: "lijn", breedte: 0.8 },
] as const;

/** Etskleur van het watermerk: de GOAT-inkt op lage alpha. Bewust net iets
 *  hoger dan #710 (0.16 → 0.18): de kop is nu een lijntekening zonder ring,
 *  en die viel op de kleine maten weg. Contrast van de inkt op het vlak blijft
 *  ongemoeid — dit is een laag onder de tekst. */
export const GOAT_WATERMERK_KLEUR = "rgba(249, 163, 183, 0.18)";
/** Motiefmaat: breedte als fractie van het vlak, en de verticale positie als
 *  background-position-percentage (0.3 ≡ `center 30%`). Groter en iets lager
 *  dan het medaillon van #710: de kop hoort áchter de kaartinformatie te
 *  staan, niet erboven. */
export const GOAT_WATERMERK_BREEDTE = 0.96;
export const GOAT_WATERMERK_POSITIE = 0.3;

/** Divisie-icoon (#772): een compacte geitenkop als eigen SVG, zodat de
 *  GOAT-identiteit niet aan de emoji hangt — 🐐 rendert op iOS, Android en
 *  desktop als drie verschillende beestjes en valt op 96px uit elkaar. Zelfde
 *  silhouet als het watermerk, maar met dikkere lijnen en zonder detail: op de
 *  kleinste kaart is dit vakje ~11 px hoog. Decoratief: de tekst "GOAT" onder
 *  de kaart draagt de betekenis al. ViewBox 0 0 24 24. */
export const GOAT_ICOON_VIEWBOX = "0 0 24 24";
export const GOAT_ICOON: readonly OrnamentPad[] = [
  // Hoorns: naar buiten-boven en met de punt terug omlaag. Bewust géén volle
  // spiraal zoals het ornament — op 11 px loopt zo'n krul dicht en leest de
  // kop als een muis met oren.
  {
    d: "M 9.8 6.2 C 8.8 3.4, 6.4 1.4, 3.4 1.5 C 5.2 3.4, 5.8 5.8, 5.2 8.2",
    soort: "lijn",
    breedte: 1.6,
  },
  {
    d: "M 14.2 6.2 C 15.2 3.4, 17.6 1.4, 20.6 1.5 C 18.8 3.4, 18.2 5.8, 18.8 8.2",
    soort: "lijn",
    breedte: 1.6,
  },
  // Oren opzij, en de kop met snuit als één gesloten silhouet.
  { d: "M 8.4 10.2 C 6.8 9.8, 5.4 10.4, 4.4 11.6", soort: "lijn", breedte: 1.6 },
  { d: "M 15.6 10.2 C 17.2 9.8, 18.6 10.4, 19.6 11.6", soort: "lijn", breedte: 1.6 },
  {
    d: "M 8.4 6.6 C 7.4 10.6, 8.4 14, 10.4 16.8 L 11.4 19.4 C 11.6 20.1, 12.4 20.1, 12.6 19.4 L 13.6 16.8 C 15.6 14, 16.6 10.6, 15.6 6.6 C 13.2 5, 10.8 5, 8.4 6.6 Z",
    soort: "lijn",
    breedte: 1.6,
  },
  // De sik: het detail dat de kop van een ram een geit maakt.
  {
    d: "M 12 19.8 C 11.2 20.9, 11.2 22, 12 22.7 C 12.8 22, 12.8 20.9, 12 19.8 Z",
    soort: "vlak",
  },
  {
    d: "M 9.85 10.3 A 0.95 0.95 0 1 1 11.75 10.3 A 0.95 0.95 0 1 1 9.85 10.3",
    soort: "vlak",
  },
  {
    d: "M 12.25 10.3 A 0.95 0.95 0 1 1 14.15 10.3 A 0.95 0.95 0 1 1 12.25 10.3",
    soort: "vlak",
  },
] as const;


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
/** Dictator militair gepeakte pet die in de bovenrand van het schild zit. */
export const DICTATOR_KROON =
  "M 50 -25 C 38 -24, 25 -22, 20 -18 C 17 -16, 21 -10, 24 -2 L 76 -2 C 79 -10, 83 -16, 80 -18 C 75 -22, 62 -24, 50 -25 Z";

/** De rode band onder de pet. */
export const DICTATOR_KROON_BAND =
  "M 24 -2.5 L 76 -2.5 L 75.2 2.5 L 24.8 2.5 Z";

/** Geen bolknoppen meer op de pet. */
export const DICTATOR_KROON_BOLLEN: readonly (readonly [
  number,
  number,
  number,
])[] = [];

/** Geen edelstenen meer op de pet. */
export const DICTATOR_GEMS: readonly string[] = [];

/** Pet klep (visor). */
export const DICTATOR_PET_KLEP =
  "M 26 2.5 C 34 10, 66 10, 74 2.5 C 65 5.5, 35 5.5, 26 2.5 Z";

/** Pet klep glans. */
export const DICTATOR_PET_KLEP_GLANS =
  "M 32 4 C 38 6.7, 62 6.7, 68 4 C 62 5.4, 38 5.4, 32 4 Z";

/** Pet stormband. */
export const DICTATOR_PET_STORM =
  "M 26.5 1.5 C 36 5.5, 64 5.5, 73.5 1.5";

/** Pet cocarde gouden ster. */
export const DICTATOR_PET_COCARDE_STER =
  "M 50 -13.5 L 51.2 -10.5 L 54.4 -10.5 L 51.8 -8.5 L 52.8 -5.5 L 50 -7.4 L 47.2 -5.5 L 48.2 -8.5 L 45.6 -10.5 L 48.8 -10.5 Z";



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

export const DICTATOR_LAUWER_BLADEN: readonly string[] = LAUWER_BLADEN.map(
  ([u, v, hoek, lengte]) => bladVorm(u, v, hoek, lengte),
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

/** Watermark achter de spelerinformatie: een gevechtsster met
 *  lauwertakken — het militaire embleem. ViewBox 0 0 100 100. */
export const DICTATOR_WATERMARK: readonly OrnamentPad[] = [
  // Grote gevechtsster.
  {
    d: "M 50 25 L 56 41 L 73 41 L 59 50 L 64 66 L 50 56 L 36 66 L 41 50 L 27 41 L 44 41 Z",
    soort: "lijn",
    breedte: 2,
  },
  // Extra binnenste gevechtsster-lijnen.
  {
    d: "M 50 32 L 54 44 L 66 44 L 56 51 L 60 62 L 50 55 L 40 62 L 44 51 L 34 44 L 46 44 Z",
    soort: "lijn",
    breedte: 1,
  },
  // Lauwertakken eromheen.
  { d: "M 50 82 C 25 76 13 60 14 38", soort: "lijn", breedte: 1.5 },
  { d: "M 50 82 C 75 76 87 60 86 38", soort: "lijn", breedte: 1.5 },
] as const;

export const DICTATOR_WATERMARK_KLEUR = "rgba(240, 199, 102, 0.09)";
export const DICTATOR_WATERMARK_BREEDTE = 0.78;
export const DICTATOR_WATERMARK_POSITIE = 0.42;
