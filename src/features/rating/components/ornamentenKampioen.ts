// Ornamenten van de Kampioen-editie (#710): de lauwerkrans en medaillelinten
// die búiten het schild uitsteken, de diamantcrest die er vóór ligt, en het
// legacy-zegel als watermerk ín het vlak. Bewust een eigen module naast
// futKaartOrnamenten.ts: die draagt de generator (`bouwStreng`) en het
// GOAT-materiaal, dit bestand alleen de kampioensvormen — zo raken twee
// kaartvarianten elkaars pad-data nooit.
//
// Eén bron voor twee tekenaars, net als bij de GOAT: FutKaart.tsx rendert deze
// strings als inline-SVG, futKaartCanvas.ts voert ze als Path2D op de
// deel-poster. Daarom staan hier pad-strings en kleurtabellen, geen JSX.
//
// Coördinaten: ornamenten in kaart-units (100 breed × 139 hoog, oorsprong
// linksboven op de kaart) binnen de gedeelde ORNAMENT_VIEWBOX; het zegel in
// zijn eigen 100×100-viewBox.
//
// Alle maten zijn opgemeten aan de referentie in issue #710. De kaart staat
// daar op 722 × 1004 px met de linkerbovenhoek op (106, 122), dus één
// kaart-unit ≈ 7,22 px; de getallen hieronder zijn die metingen gedeeld door
// 7,22. Waar een maat afwijkt van de meting staat waaróm erbij.

import { bouwStreng, type OrnamentPad } from "./futKaartOrnamenten";

type Punt = readonly [number, number];

const rond = (n: number) => Math.round(n * 100) / 100;
const graden = (g: number) => (g * Math.PI) / 180;

/* ------------------------------ bladgenerator ----------------------------- */

/** Eén lauwerblad: een lancetvorm met een punt aan bása én top, met een lichte
 *  banaankromming zodat een rij bladeren niet als een kam van identieke stiften
 *  leest. `nerf` is de gegraveerde middenlijn en `rand` de bolle flank apart —
 *  die twee geven het blad zijn reliëf zonder een tweede vulling. */
export interface Blad {
  /** Gesloten omtrek van het blad. */
  d: string;
  /** Gegraveerde middennerf, van de basis naar de punt. */
  nerf: string;
  /** Alleen de bolle flank, als open pad: daarop komt de zilverglans. */
  rand: string;
}

function blad(
  anker: Punt,
  hoek: number,
  lengte: number,
  halveBreedte: number,
  /** Kromming als fractie van de hálve breedte: beide flanken schuiven er
   *  evenveel mee op, dus het blad blijft even dik en buigt alleen. */
  krom = 0.25,
): Blad {
  const [dx, dy] = [Math.cos(hoek), Math.sin(hoek)];
  const [nx, ny] = [-dy, dx];
  const p = (langs: number, dwars: number): string => {
    const x = anker[0] + dx * langs * lengte + nx * dwars * halveBreedte;
    const y = anker[1] + dy * langs * lengte + ny * dwars * halveBreedte;
    return `${rond(x)} ${rond(y)}`;
  };
  const bol = `C ${p(0.13, 1.15 + krom)}, ${p(0.56, 1.32 + krom)}, ${p(1, 0)}`;
  return {
    d: [
      `M ${p(0, 0)}`,
      bol,
      `C ${p(0.56, -1.32 + krom)}, ${p(0.13, -1.15 + krom)}, ${p(0, 0)}`,
      "Z",
    ].join(" "),
    nerf: `M ${p(0.05, krom * 0.4)} C ${p(0.44, 0.2 + krom)}, ${p(
      0.76,
      0.14 + krom,
    )}, ${p(0.96, 0.02)}`,
    rand: `M ${p(0, 0)} ${bol}`,
  };
}

/** Klein lauwerembleem rond `(cx, cy)` dat over `maat` units naar boven opent:
 *  twee steeltjes met elk drie blaadjes. Eén generator voor twee plekken — het
 *  merkje op het middenlint en het teken in het zegelschild — zodat de kaart
 *  overal hetzelfde lauwer spreekt. */
function embleem(
  cx: number,
  cy: number,
  maat: number,
): { stelen: string[]; bladen: string[] } {
  const stelen: string[] = [];
  const bladen: string[] = [];
  for (const zijde of [1, -1] as const) {
    stelen.push(
      `M ${cx} ${cy} C ${rond(cx - zijde * maat * 0.5)} ${rond(
        cy - maat * 0.1,
      )}, ${rond(cx - zijde * maat * 0.62)} ${rond(cy - maat * 0.55)}, ${rond(
        cx - zijde * maat * 0.42,
      )} ${rond(cy - maat)}`,
    );
    for (const [t, len] of [
      [0.24, 0.34],
      [0.55, 0.36],
      [0.84, 0.3],
    ] as const) {
      const x = cx - zijde * maat * (0.18 + t * 0.42);
      const y = cy - maat * t * 0.94;
      bladen.push(
        blad([x, y], graden(zijde === 1 ? 210 : -30), maat * len, maat * len * 0.3).d,
      );
    }
  }
  return { stelen, bladen };
}

/* --------------------------- centerlijn-sampler --------------------------- */

/** Eén cubic-segment: twee controlepunten en een eindpunt (zelfde vorm als in
 *  futKaartOrnamenten.ts, want `bouwStreng` leest dezelfde tabel). */
type Segment = readonly [Punt, Punt, Punt];

/** Punt én richting op een keten van cubic-segmenten. De takstam gaat als
 *  `bouwStreng`-streng naar de tekenaar, maar de bladeren moeten op diezelfde
 *  lijn hangen — dus rekent dit bestand de centerlijn nóg een keer uit i.p.v.
 *  de streng-omtrek terug te parsen. */
function opKetting(
  start: Punt,
  segmenten: readonly Segment[],
  t: number,
): { punt: Punt; hoek: number } {
  const g = Math.min(t, 0.9999) * segmenten.length;
  const idx = Math.floor(g);
  const u = g - idx;
  const p0 = idx === 0 ? start : segmenten[idx - 1][2];
  const [c1, c2, p3] = segmenten[idx];
  const bez = (a: number, b: number, c: number, d: number, s: number) => {
    const v = 1 - s;
    return v * v * v * a + 3 * v * v * s * b + 3 * v * s * s * c + s * s * s * d;
  };
  const afgeleide = (a: number, b: number, c: number, d: number, s: number) => {
    const v = 1 - s;
    return 3 * v * v * (b - a) + 6 * v * s * (c - b) + 3 * s * s * (d - c);
  };
  const punt: Punt = [
    bez(p0[0], c1[0], c2[0], p3[0], u),
    bez(p0[1], c1[1], c2[1], p3[1], u),
  ];
  const hoek = Math.atan2(
    afgeleide(p0[1], c1[1], c2[1], p3[1], u),
    afgeleide(p0[0], c1[0], c2[0], p3[0], u),
  );
  return { punt, hoek };
}

/* ------------------------------ lauwerkrans ------------------------------- */

// De tak volgt de linkerrand van het schild: van achter de kaartpunt (u≈35,
// v≈131) omhoog langs de taille naar een uitlopende punt op v≈61. In de
// referentie ligt de stam precies óp de schildrand — de helft verdwijnt dus
// achter de kaart, en dát is wat de krans "achter de kaart omhoog" laat lopen.
const KRANS_START: Punt = [35.5, 130.5];
const KRANS_SEGMENTEN: readonly Segment[] = [
  [
    [29.5, 129.4],
    [22.5, 126.8],
    [16.5, 123],
  ],
  [
    [10.5, 119],
    [5.2, 113.5],
    [2.5, 106],
  ],
  [
    [0.6, 100.5],
    [-0.7, 93.5],
    [-1, 86],
  ],
  [
    [-1.2, 78],
    [-1.4, 70],
    [-1.4, 61],
  ],
];

/** De takstam als getaperde streng: dik bij de wortel achter de kaartpunt,
 *  spits waar de krans bovenaan uitloopt. Glad (geen ribbels) — een tak is
 *  geen geribbeld metaal. */
export const KAMPIOEN_KRANS_STAM = bouwStreng({
  start: KRANS_START,
  segmenten: KRANS_SEGMENTEN,
  dikte: 1.85,
  taper: 1.35,
  punt: 0.12,
  stappen: 64,
});

/** Aantal bladparen per helft. Twaalf: op de referentie zijn er tussen de
 *  wortel en de kranspunt twaalf blad-aanzetten te tellen, en met minder
 *  bladeren wordt de buitenrand een zaagtand i.p.v. een vol silhouet. */
const KRANS_BLADEREN = 12;

/** De bladeren van één helft, in twee versprongen rijen. De buitenrij zwaait
 *  ver naar buiten-boven (tot u≈−8, de uiterste maat van de referentie), de
 *  binnenrij loopt vlakker mee en vult de gaten — samen leest dat als een
 *  volle tak i.p.v. een rij losse punten. */
function kransBladeren(): readonly Blad[] {
  const uit: Blad[] = [];
  for (let i = 0; i < KRANS_BLADEREN; i++) {
    const t = 0.09 + (i / (KRANS_BLADEREN - 1)) * 0.85;
    for (const rij of [0, 1] as const) {
      // De binnenrij staat een halve stap verder en steekt korter uit.
      const tt = rij === 0 ? t : Math.min(t + 0.042, 0.98);
      const { punt, hoek } = opKetting(KRANS_START, KRANS_SEGMENTEN, tt);
      // Bladeren wijzen naar buiten-boven: de stamrichting (naar de kranspunt)
      // gedraaid weg van de kaart. Onderaan staan ze vlakker (daar ligt de tak
      // bijna horizontaal en zou een grote draai ze ónder de linten duwen),
      // bovenaan steiler — precies de fan van de referentie.
      const basis = -30 - 16 * tt;
      const draai = rij === 0 ? basis : basis + 22;
      const lengte = (12.6 - 5.2 * Math.pow(tt, 1.3)) * (rij === 0 ? 1 : 0.73);
      uit.push(blad(punt, hoek + graden(draai), lengte, lengte * 0.2));
    }
  }
  return uit;
}

export const KAMPIOEN_KRANS_BLAD: readonly Blad[] = kransBladeren();

/* ----------------------------- medaillelinten ----------------------------- */

/** Eén gevouwen lint: de band zelf plus de gegraveerde vouwlijnen die het
 *  reliëf maken. De vulling is een verloop over KAMPIOEN_LINT_AS_VERLOOP — één
 *  as voor alle vijf de linten, zodat de fan als één stuk zijde leest. */
export interface Lint {
  d: string;
  lijnen: readonly string[];
}

interface LintOpties {
  /** Midden van de bovenrand — bewust hoog genoeg dat de kaart hem afdekt. */
  top: Punt;
  /** Helling in graden vanuit loodrecht omlaag; positief = naar buiten (links). */
  hoek: number;
  lengte: number;
  halveBreedte: number;
  /** Zwaluwstaart: de onderrand knikt `vork` units omhóóg naar het midden. */
  vork?: number;
  /** Punt: de onderrand knikt `punt` units omláág naar het midden. */
  punt?: number;
}

function lint({
  top,
  hoek,
  lengte,
  halveBreedte,
  vork = 0,
  punt = 0,
}: LintOpties): Lint {
  const h = graden(hoek);
  // Omlaag met een helling naar buiten (−x), en de dwarsrichting loodrecht daarop.
  const d: Punt = [-Math.sin(h), Math.cos(h)];
  const n: Punt = [Math.cos(h), Math.sin(h)];
  const p = (langs: number, dwars: number): Punt => [
    top[0] + d[0] * langs + n[0] * dwars,
    top[1] + d[1] * langs + n[1] * dwars,
  ];
  const s = (q: Punt) => `${rond(q[0])} ${rond(q[1])}`;
  const A = p(0, -halveBreedte);
  const B = p(0, halveBreedte);
  const C = p(lengte, halveBreedte);
  const D = p(lengte, -halveBreedte);
  const M = p(lengte - vork + punt, 0);
  return {
    // A → B over de bovenrand, omlaag naar C, via het midden M terug naar D:
    // één knik in de onderrand maakt de zwaluwstaart óf de punt.
    d: `M ${s(A)} L ${s(B)} L ${s(C)} L ${s(M)} L ${s(D)} Z`,
    // Twee gegraveerde lijnen langs de flanken: de vouwlijnen van een gevouwen
    // lint, en wat de band van een vlakke driehoek onderscheidt.
    lijnen: [
      `M ${s(p(1.5, -halveBreedte * 0.62))} L ${s(
        p(lengte - vork * 0.55, -halveBreedte * 0.62),
      )}`,
      `M ${s(p(1.5, halveBreedte * 0.62))} L ${s(
        p(lengte - vork * 0.55, halveBreedte * 0.62),
      )}`,
    ],
  };
}

// Vijf staarten onder de kaartpunt: per helft een smaragdgroene buitenband en
// een platina band ertussen, plus één groene band op de as. De bovenranden
// liggen op v≈124–125, waar het schild nog ~50 units breed is — zo begint elk
// lint onzichtbaar achter de kaart en steekt alleen de staart eronder uit.
// De hellingen (22°) en de staartlengtes zijn opgemeten aan de referentie: de
// buitenste band loopt daar van u≈23 op v≈138 naar u≈18 op v≈151.
/** Buitenste groene lint van één helft (wordt gespiegeld). */
export const KAMPIOEN_LINT_BUITEN = lint({
  top: [36, 124],
  hoek: 22,
  lengte: 33,
  halveBreedte: 5.15,
  vork: 5,
});
/** Platina lint van één helft, tussen de groene banden (wordt gespiegeld). */
export const KAMPIOEN_LINT_PLATINA = lint({
  top: [44.5, 125],
  hoek: 22,
  lengte: 30,
  halveBreedte: 4.7,
  vork: 4,
});
/** Het middenlint op de as: staat rechtop, eindigt in een punt en draagt het
 *  lauwerembleem. Niet gespiegeld — hij ís de spiegelas. */
export const KAMPIOEN_LINT_AS = lint({
  top: [50, 124],
  hoek: 0,
  lengte: 26,
  halveBreedte: 7.5,
  punt: 8.5,
});

/** Lauwerembleem op het middenlint: het gestempelde merkje van een medaillelint,
 *  net onder de kaartpunt. Als open omtrek (stroke), niet gevuld: op deze maat
 *  (≈9 units breed) zou een vulling dichtslibben tot een groene vlek. */
export const KAMPIOEN_LINT_EMBLEEM: readonly string[] = (() => {
  const { stelen, bladen } = embleem(50, 152, 9);
  return [...stelen, ...bladen];
})();

/* ------------------------------ diamantcrest ------------------------------ */

/** Ruit met vier hoekpunten rond (50, `mid`), `halveB` breed en van `top` tot
 *  `onder`. De crest is een stapeling van drie zulke ruiten. */
function ruit(halveB: number, top: number, onder: number): string {
  const mid = (top + onder) / 2;
  return `M 50 ${rond(top)} L ${rond(50 + halveB)} ${rond(mid)} L 50 ${rond(
    onder,
  )} L ${rond(50 - halveB)} ${rond(mid)} Z`;
}

// Opgemeten aan de referentie: de blauwe steen loopt van u 45,2 tot 54,6 en
// van v −2,1 tot 9,7 — hij hangt dus met zijn punt boven de kaartrand en zakt
// met zijn onderpunt in de inkeping. De zetting eromheen is ~1,5 unit ruimer.
const STEEN_HB = 5;
const STEEN_TOP = -2.4;
const STEEN_ONDER = 10;
const STEEN_MID = (STEEN_TOP + STEEN_ONDER) / 2;

/** Platina zetting: de buitenste ruit van de crest. */
export const KAMPIOEN_CREST_ZETTING = ruit(6.8, -4.2, 11.8);
/** Smaragden tussenring: de donkere schaduwlijn tussen zetting en steen — een
 *  smalle strook, anders leest de crest als een donkere ruit i.p.v. een steen
 *  in een lichte zetting. */
export const KAMPIOEN_CREST_RING = ruit(5.7, -3.1, 10.7);
/** De omtrek van de steen — voor de contourlijn over de facetten heen. */
export const KAMPIOEN_CREST_STEEN = ruit(STEEN_HB, STEEN_TOP, STEEN_ONDER);

/** De vier facetten van de steen als losse driehoeken (noord-west, noord-oost,
 *  zuid-oost, zuid-west), elk met zijn eigen tint uit KAMPIOEN_STEEN_FACETTEN.
 *  Vier vlakken i.p.v. één vlak met facetlíjnen: dát is wat een geslepen steen
 *  van een blauwe ruit onderscheidt — elk vlak vangt ander licht. */
export const KAMPIOEN_CREST_FACET: readonly string[] = [
  `M 50 ${STEEN_TOP} L 50 ${STEEN_MID} L ${50 - STEEN_HB} ${STEEN_MID} Z`,
  `M 50 ${STEEN_TOP} L ${50 + STEEN_HB} ${STEEN_MID} L 50 ${STEEN_MID} Z`,
  `M 50 ${STEEN_MID} L ${50 + STEEN_HB} ${STEEN_MID} L 50 ${STEEN_ONDER} Z`,
  `M 50 ${STEEN_MID} L 50 ${STEEN_ONDER} L ${50 - STEEN_HB} ${STEEN_MID} Z`,
];
/** Het lichte kruis tussen de vier facetten — de slijpnaad van de steen. */
export const KAMPIOEN_CREST_KRUIS = `M 50 ${STEEN_TOP} L 50 ${STEEN_ONDER} M ${
  50 - STEEN_HB
} ${STEEN_MID} L ${50 + STEEN_HB} ${STEEN_MID}`;
/** Tinten van de vier facetten, in dezelfde volgorde: het licht komt uit het
 *  bovenste midden, dus links-boven is het helderst en rechts-onder het diepst. */
export const KAMPIOEN_STEEN_FACETTEN: readonly string[] = [
  "#eef7ff",
  "#c6e0fa",
  "#6f9fd8",
  "#9cc4f0",
];
const stip = (x: number, y: number, r: number) =>
  `M ${rond(x - r)} ${rond(y)} A ${r} ${r} 0 1 1 ${rond(x + r)} ${rond(
    y,
  )} A ${r} ${r} 0 1 1 ${rond(x - r)} ${rond(y)}`;

/** Het lichtpunt in het hart van de steen — de "fijne metalen highlight" van
 *  de referentie. */
export const KAMPIOEN_CREST_GLANS = stip(50, STEEN_MID, 1);
/** De vier diepblauwe stipjes op de hoekpunten: de zetklauwtjes die de steen
 *  vasthouden. Wit zouden ze de crest laten flikkeren; donker zetten ze de
 *  ruit juist vast, zoals op de referentie. */
export const KAMPIOEN_CREST_KLAUW: readonly string[] = [
  stip(50, STEEN_TOP + 0.9, 0.42),
  stip(50, STEEN_ONDER - 0.9, 0.42),
  stip(50 - STEEN_HB + 0.9, STEEN_MID, 0.42),
  stip(50 + STEEN_HB - 0.9, STEEN_MID, 0.42),
];

/* -------------------------------- kleuren -------------------------------- */

/** Loof: donker smaragd dat naar boven in saliegroen oploopt — de zachte
 *  lichtval vanuit het bovenste midden, zoals de referentie. De verlooplijn
 *  staat in kaart-units (userSpaceOnUse), zodat DOM en canvas hetzelfde
 *  licht zien; op de gespiegelde helft kantelt hij mee. */
export const KAMPIOEN_LOOF_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "#93aea1"],
  [0.34, "#5d8071"],
  [0.72, "#345448"],
  [1, "#1d3229"],
] as const;
/** Verloopas van het loof: [x1, y1, x2, y2] in kaart-units. */
export const KAMPIOEN_LOOF_AS: readonly [number, number, number, number] = [
  20, 55, 4, 148,
];
export const KAMPIOEN_LOOF_CONTOUR = "#16261f";
export const KAMPIOEN_LOOF_NERF = "rgba(233, 244, 238, 0.6)";
export const KAMPIOEN_LOOF_GLANS = "rgba(240, 249, 245, 0.55)";
export const KAMPIOEN_LOOF_SCHADUW = "rgba(17, 33, 26, 0.42)";

/** Groen lint: iets koeler en vlakker dan het loof — geweven zijde vangt geen
 *  specular licht zoals een blad. */
export const KAMPIOEN_LINT_GROEN_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "#7e9d8f"],
  [0.34, "#4e7364"],
  [0.74, "#325244"],
  [1, "#1f382d"],
] as const;
/** Platina lint: geborsteld zilver met één glanspunt. */
export const KAMPIOEN_LINT_PLATINA_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "#fbfdfc"],
  [0.3, "#e3ebe7"],
  [0.68, "#b3c0ba"],
  [1, "#7f9089"],
] as const;
/** Verloopas van de linten: [x1, y1, x2, y2] in kaart-units. */
export const KAMPIOEN_LINT_AS_VERLOOP: readonly [number, number, number, number] = [
  38, 126, 30, 160,
];
export const KAMPIOEN_LINT_CONTOUR = "#1b2c24";
export const KAMPIOEN_LINT_LIJN = "rgba(238, 246, 242, 0.55)";

/** IJsblauwe steen: de énige koude kleur op de kaart, dus mag hij helder zijn. */
export const KAMPIOEN_STEEN_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "#f4faff"],
  [0.32, "#cbe4fb"],
  [0.66, "#8ebeee"],
  [1, "#4b81c8"],
] as const;
export const KAMPIOEN_STEEN_AS: readonly [number, number, number, number] = [
  45, -2, 55, 10,
];
export const KAMPIOEN_STEEN_CONTOUR = "#26518c";
export const KAMPIOEN_STEEN_FACET = "rgba(255, 255, 255, 0.62)";
export const KAMPIOEN_STEEN_GLANS = "rgba(255, 255, 255, 0.85)";
export const KAMPIOEN_STEEN_KLAUW = "#1d3f74";
/** Platina zetting van de crest. */
export const KAMPIOEN_ZETTING_VERLOOP: readonly (readonly [number, string])[] = [
  [0, "#ffffff"],
  [0.42, "#e0e9e5"],
  [1, "#8fa199"],
] as const;
export const KAMPIOEN_ZETTING_AS: readonly [number, number, number, number] = [
  43, -5, 57, 12,
];
export const KAMPIOEN_ZETTING_CONTOUR = "#274435";
/** Smaragden tussenring tussen zetting en steen. */
export const KAMPIOEN_CREST_RING_KLEUR = "#26402f";

/* ------------------------- legacy-zegel (watermerk) ----------------------- */

/** Ellips als pad-string (twee halve bogen) — `<ellipse>` bestaat niet als
 *  pad-data en Path2D leest alleen paden. De seizoensringen zijn op de
 *  referentie breder dan hoog (rx/ry ≈ 1,25): ze lezen als een schuin
 *  liggende schijf, niet als een schietschijf. */
function ring(rx: number, ry: number, cy = 53): string {
  return `M ${rond(50 - rx)} ${cy} A ${rx} ${ry} 0 1 1 ${rond(
    50 + rx,
  )} ${cy} A ${rx} ${ry} 0 1 1 ${rond(50 - rx)} ${cy}`;
}

/** De lauwerkrans ín het zegel: twee spiegelbeeldige takken die onderaan
 *  kruisen en bovenaan open blijven — dezelfde bladgenerator als de krans
 *  buiten de kaart, dus het zegel is letterlijk hetzelfde ornament in het
 *  klein. Opgemeten: kruispunt op v≈78, takpunten op v≈34 en u≈27/73 — hier
 *  omgerekend naar de zegel-viewBox. */
function zegelKrans(): OrnamentPad[] {
  const uit: OrnamentPad[] = [];
  for (const zijde of [1, -1] as const) {
    // De tak vertrekt onderaan op de as en zwaait naar buiten omhoog; `zijde`
    // = +1 is de linkerhelft. Twee segmenten: de bocht en de opgaande flank.
    const start: Punt = [50 - zijde * 1.2, 77];
    const segmenten: readonly Segment[] = [
      [
        [50 - zijde * 13, 76],
        [50 - zijde * 23, 69],
        [50 - zijde * 25.5, 57],
      ],
      [
        [50 - zijde * 27.5, 47],
        [50 - zijde * 27, 36],
        [50 - zijde * 23, 28],
      ],
    ];
    uit.push({
      d: `M ${start.join(" ")} C ${segmenten[0]
        .map((p) => p.join(" "))
        .join(", ")} C ${segmenten[1].map((p) => p.join(" ")).join(", ")}`,
      soort: "lijn",
      breedte: 1,
    });
    for (let i = 0; i < 8; i++) {
      const t = 0.1 + (i / 7) * 0.86;
      const { punt, hoek } = opKetting(start, segmenten, t);
      const lengte = 10.5 - 2.6 * t;
      const b = blad(punt, hoek + graden(zijde * -38), lengte, lengte * 0.21);
      uit.push({ d: b.d, soort: "vlak", alpha: 0.8 });
    }
  }
  return uit;
}

/** Het zegelschild-teken: hetzelfde lauwerembleem als op het middenlint, hier
 *  gevuld — in een watermerk op ~16 units mag een blaadje wél massief zijn. */
function zegelEmbleem(cx: number, cy: number, maat: number): OrnamentPad[] {
  const { stelen, bladen } = embleem(cx, cy, maat);
  return [
    ...stelen.map((d): OrnamentPad => ({ d, soort: "lijn", breedte: 0.55 })),
    ...bladen.map((d): OrnamentPad => ({ d, soort: "vlak", alpha: 0.8 })),
  ];
}

/** Het legacy-zegel: concentrische seizoensringen, de lauwerkrans en een
 *  eenvoudig schild — precies de drie lagen die #710 vraagt. Bewust géén
 *  kroon: die zou actuele nummer-éénstatus suggereren, en deze kaart gáát over
 *  een titel uit een afgesloten seizoen. In het schild staat daarom hetzelfde
 *  lauwerembleem als op het middenlint.
 *  ViewBox 0 0 100 100. */
export const KAMPIOEN_ZEGEL: readonly OrnamentPad[] = [
  // Seizoensringen: drie ringen plus twee ijlere bogen ertussen — één ring per
  // afgesloten seizoen, zoals de jaarringen van een boom.
  { d: ring(37, 29.5), soort: "lijn", breedte: 1 },
  { d: ring(34, 27), soort: "lijn", breedte: 0.45, alpha: 0.7 },
  { d: ring(29.5, 23.5), soort: "lijn", breedte: 0.7 },
  {
    d: "M 50 25.4 A 35.5 28.3 0 0 1 85.5 53",
    soort: "lijn",
    breedte: 0.55,
    alpha: 0.55,
  },
  {
    d: "M 14.5 53 A 35.5 28.3 0 0 1 46 24.9",
    soort: "lijn",
    breedte: 0.55,
    alpha: 0.55,
  },
  ...zegelKrans(),
  // Eenvoudig schild op de as, met een gegraveerde binnenlijn.
  {
    d: "M 39.5 34 L 60.5 34 L 60.5 47 C 60.5 54 55.8 57 50 59.5 C 44.2 57 39.5 54 39.5 47 Z",
    soort: "lijn",
    breedte: 0.9,
  },
  {
    d: "M 41.5 36 L 58.5 36 L 58.5 46.8 C 58.5 52.6 54.6 55.2 50 57.4 C 45.4 55.2 41.5 52.6 41.5 46.8 Z",
    soort: "lijn",
    breedte: 0.4,
    alpha: 0.7,
  },
  ...zegelEmbleem(50, 52.5, 11),
] as const;

/** Etskleur van het zegel: de kampioensinkt op lage alpha. Bewust ijl — het
 *  vlak is licht en de tekst erop moet ruim contrast houden. */
export const KAMPIOEN_ZEGEL_KLEUR = "rgba(31, 92, 64, 0.1)";
/** Motiefmaat: breedte als fractie van het vlak, en de verticale positie als
 *  background-position-fractie (0.12 ≡ `center 12%`). Zo landt het hart van de
 *  ringen op v≈54 — waar de referentie hem heeft, tussen de twee hairlines. */
export const KAMPIOEN_ZEGEL_BREEDTE = 0.98;
export const KAMPIOEN_ZEGEL_POSITIE = 0.12;
