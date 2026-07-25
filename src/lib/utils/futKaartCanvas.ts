// Gedeelde canvas-tekening van de FUT-schildkaart (DOM-versie in
// FutKaart.css, #495/#496) voor deel-posters: kleurmix, schildpaden per
// divisiegroep, en de laag-opbouw frame → liner → geclipt vlak
// (metaal/special-diepte + topgloed + sheen). Geëxtraheerd uit
// ShareProfile.tsx (#496) zodat een tweede canvas-consument (Wrapped-
// seizoenskaart, #498) dezelfde schildwiskunde hergebruikt in plaats van
// een derde kopie te tekenen. Puur tekenwerk — geen state, geen
// afhankelijkheid van React of Supabase.
//
// Sinds #666 woont hier óók de kleurtabel: `kaartSkin` is de canvas-spiegel
// van álle registers in FutKaart.css — de divisieladder, de twee
// special-toptiers én de zes speciale edities (#497/#625/#631/#632/#645),
// die op de deel-poster tot dan toe volledig ontbraken. De waarden staan hier
// als literals i.p.v. via getComputedStyle: de posters zijn bewust vastgepind
// op het lichte palet (#125), dus de live tokens lezen zou de export in dark
// mode meetrekken. Die dubbele boekhouding wordt bewaakt door de
// synctest in futKaartCanvas.test.ts, die FutKaart.css en index.css inleest
// en de tokens hieronder ertegen vergelijkt.

import type { TierKey } from "@/features/rating/tiers";
import { canvasPalette } from "@/lib/utils/shareImage";

export type SchildVorm = "vlak" | "notch" | "punt" | "kroon";

/** Bovenrand per divisiegroep — zelfde mapping als FutKaart.css. */
export function schildVorm(key: TierKey | undefined): SchildVorm {
  if (key === "slof" || key === "karton" || key === "hout") return "vlak";
  if (key === "platina" || key === "diamant" || key === "meester")
    return "punt";
  if (key === "legende" || key === "dictator") return "kroon";
  return "notch";
}

/** Kanalen uit "#rrggbb", "rgb(r, g, b)" of "rgba(r, g, b, a)".
 *
 *  Beide notaties (#666): `mix` gééft een rgb()-string terug, dus zodra de CSS
 *  een mix van een mix is — `--kaart-lijn` is een color-mix en de keyline mixt
 *  dáár weer mee — kwam er een rgb()-string terug in de hex-parser. Die las
 *  dan NaN en `mix` gaf `rgb(64, 62, 58)`: de #664-keyline stond op élke
 *  niet-special deel-poster bijna zwart i.p.v. als lichte hairline.
 *
 *  De alpha wordt bewust genegeerd: `mix` spiegelt color-mix() op de
 *  srgb-kanalen, en waar de CSS een half-transparante lijnkleur meemengt
 *  (In-Form/On-Fire) levert dat op canvas een fractie stevigere keyline —
 *  onzichtbaar naast de 1,5px lijndikte, en beter dan een tweede alpha-boekhouding. */
function parseKleur(kleur: string): [number, number, number] {
  if (kleur.startsWith("#")) {
    const v = parseInt(kleur.slice(1), 16);
    return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  }
  const kanalen = kleur.match(/-?\d*\.?\d+/g);
  if (!kanalen || kanalen.length < 3)
    throw new Error(`futKaartCanvas: onbekende kleurnotatie "${kleur}"`);
  return [Number(kanalen[0]), Number(kanalen[1]), Number(kanalen[2])];
}

/** color-mix(in srgb, a p, b 1-p), zoals de CSS van FutKaart. */
export function mix(a: string, b: string, p: number): string {
  const [ar, ag, ab] = parseKleur(a);
  const [br, bg, bb] = parseKleur(b);
  const kanaal = (x: number, y: number) => Math.round(x * p + y * (1 - p));
  return `rgb(${kanaal(ar, br)}, ${kanaal(ag, bg)}, ${kanaal(ab, bb)})`;
}

export function rgba(kleur: string, alpha: number): string {
  const [r, g, b] = parseKleur(kleur);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Zet het genormaliseerde schildpad (de objectBoundingBox-paden van
 *  FutKaartDefs ×(w,h)) op de context. Alle vier de vormen delen exact
 *  dezelfde onderkant met de punt op (0.5, 1). */
export function schildPad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  vorm: SchildVorm,
) {
  const X = (u: number) => x + u * w;
  const Y = (v: number) => y + v * h;
  const L = (u: number, v: number) => ctx.lineTo(X(u), Y(v));
  const C = (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) => ctx.bezierCurveTo(X(a), Y(b), X(c), Y(d), X(e), Y(f));
  ctx.beginPath();
  // Bovenrand per vorm; eindigt telkens op de rechterschouder (1, y).
  if (vorm === "vlak") {
    ctx.moveTo(X(0.04), Y(0));
    L(0.96, 0);
    L(1, 0.055);
  } else if (vorm === "notch") {
    ctx.moveTo(X(0.085), Y(0));
    L(0.4, 0);
    C(0.44, 0, 0.46, 0.022, 0.5, 0.022);
    C(0.54, 0.022, 0.56, 0, 0.6, 0);
    L(0.915, 0);
    C(0.962, 0, 1, 0.028, 1, 0.062);
  } else if (vorm === "punt") {
    ctx.moveTo(X(0.035), Y(0.01));
    L(0.44, 0.04);
    C(0.47, 0.042, 0.48, 0.058, 0.5, 0.058);
    C(0.52, 0.058, 0.53, 0.042, 0.56, 0.04);
    L(0.965, 0.01);
    L(1, 0.075);
  } else {
    ctx.moveTo(X(0.085), Y(0.035));
    L(0.38, 0.035);
    C(0.43, 0.035, 0.44, 0, 0.5, 0);
    C(0.56, 0, 0.57, 0.035, 0.62, 0.035);
    L(0.915, 0.035);
    C(0.962, 0.035, 1, 0.062, 1, 0.095);
  }
  // Gedeelde onderkant: rechterzijde → taille → punt → linkerzijde.
  L(1, 0.6);
  C(1, 0.74, 0.955, 0.795, 0.865, 0.838);
  L(0.565, 0.972);
  C(0.545, 0.982, 0.523, 1, 0.5, 1);
  C(0.477, 1, 0.455, 0.982, 0.435, 0.972);
  L(0.135, 0.838);
  C(0.045, 0.795, 0, 0.74, 0, 0.6);
  // Linkerschouder terug naar het beginpunt van de bovenrand.
  if (vorm === "vlak") L(0, 0.055);
  else if (vorm === "notch") {
    L(0, 0.062);
    C(0, 0.028, 0.038, 0, 0.085, 0);
  } else if (vorm === "punt") L(0, 0.075);
  else {
    L(0, 0.095);
    C(0, 0.062, 0.038, 0.035, 0.085, 0.035);
  }
  ctx.closePath();
}

/** Vlak-textuur (#664/#666) — spiegel van de ::after-laag in FutKaart.css:
 *  "satijn" is het fijne weefsel dat élk vlak draagt, terwijl de pias
 *  (kraftkarton met confetti) en de Piet (speelkaart met suit-pips) een eigen
 *  weefsel meebrengen en het satijn juist uitzetten — dubbel weefsel wordt
 *  druk (de `background: none`-regel in de CSS). */
export type VlakTextuur = "satijn" | "confetti" | "speelkaart";

/** Resolved themakleuren voor één laag-opbouw. De offsets die niet per thema
 *  wisselen (glow op 0/1, sheen rond 0.5) liggen vast in `drawKaartSchild`;
 *  frame en vlak dragen hun CSS-stops als [offset, kleur]-paren mee, omdat de
 *  editie-frames dat aantal niet delen (het Icon-frame wisselt goud en roze af
 *  over vijf stops, de tierladder heeft vier). */
export interface FutKaartKleuren {
  /** Framegradient — de stops van .fut-kaart__zijde. De metaalregisters
   *  dragen er vier (twee glanspunten), de matte schand-edities twee (#705). */
  frame: ReadonlyArray<readonly [number, string]>;
  /** Snijkant (#705): dunne bleke lijn langs de bovenrand van het frame — de
   *  pulpkern van doorgesneden karton. Alleen de pias zet hem. */
  snijkant?: string;
  liner: string;
  /** Vlakgradient — de stops van de linear-gradient in .fut-kaart__vlak. */
  vlak: ReadonlyArray<readonly [number, string]>;
  /** Topgloed-kleur op offset 0 (offset 1 is altijd transparant wit). */
  glow: string;
  /** Sheen-kleur op offset 0.5. */
  sheen: string;
  /** Halve breedte van de sheen-baan: stops op 0.5 ± dit. Default 0.08 (de
   *  42/50/58 van de basis-::before); de shimmer-edities zetten 0.12. */
  sheenSpreiding?: number;
  /** Keyline (#664): dunne lichte lijn tussen liner en vlak — spiegel van
   *  .fut-kaart__keyline. Weglaten = geen keyline (oude opbouw). */
  keyline?: string;
  /** Stralenkrans (#664): premium-registers (platina/diamant/meester en de
   *  special-toptiers) — spiegel van de ::after-stralen in FutKaart.css. */
  stralen?: boolean;
  /** Vlak-textuur; default "satijn". */
  textuur?: VlakTextuur;
}

/**
 * Tekent frame → liner → geclipt vlak (metaal/diepte + topgloed + sheen)
 * voor één kaart op `(x, y)` met breedte `w` en hoogte `h`. Laat de
 * vlak-clip ná het tekenen actief staan zodat de caller er content
 * (eloblok, avatar, naamplaat, stats — wat de kaart ook draagt) bovenop kan
 * tekenen; de caller moet zelf `ctx.restore()` aanroepen zodra die content
 * klaar is. Geeft de binnenmaten van het geclipte vlak terug.
 */
export function drawKaartSchild(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  vorm: SchildVorm,
  kleuren: FutKaartKleuren,
): { fx: number; fy: number; fw: number; fh: number } {
  // Frame op ~160°: bij de metaalregisters vier stops met twee glanspunten,
  // bij de matte schand-edities twee vlakke tonen (#705).
  const frame = ctx.createLinearGradient(x, y, x + w * 0.34, y + h * 0.94);
  for (const [offset, kleur] of kleuren.frame) frame.addColorStop(offset, kleur);
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  schildPad(ctx, x, y, w, h, vorm);
  ctx.fillStyle = frame;
  ctx.fill();
  ctx.restore();

  // Snijkant (#705): de bleke pulpkern langs de bovenrand — spiegel van de
  // 2px-laag in de CSS (3 canvas-px, de vaste ~1,4×-kalibratie).
  if (kleuren.snijkant) {
    ctx.save();
    schildPad(ctx, x, y, w, h, vorm);
    ctx.clip();
    ctx.fillStyle = kleuren.snijkant;
    ctx.fillRect(x, y, w, 3);
    ctx.restore();
  }

  // Liner (donkere binnenrand).
  schildPad(ctx, x + 6, y + 6, w - 12, h - 12, vorm);
  ctx.fillStyle = kleuren.liner;
  ctx.fill();

  // Keyline (#664): dunne lichte lijn tussen liner en vlak, zoals
  // .fut-kaart__keyline (de vlak-inset van 9px hieronder maakt de lijn
  // ~1.5px dik).
  if (kleuren.keyline) {
    schildPad(ctx, x + 7.5, y + 7.5, w - 15, h - 15, vorm);
    ctx.fillStyle = kleuren.keyline;
    ctx.fill();
  }

  // Vlak, geclipt: metaal (of special-diepte) + topglans + sheen.
  const fx = x + 9;
  const fy = y + 9;
  const fw = w - 18;
  const fh = h - 18;
  ctx.save();
  schildPad(ctx, fx, fy, fw, fh, vorm);
  ctx.clip();
  const vlak = ctx.createLinearGradient(0, fy, 0, fy + fh);
  for (const [offset, kleur] of kleuren.vlak) vlak.addColorStop(offset, kleur);
  ctx.fillStyle = vlak;
  ctx.fillRect(fx, fy, fw, fh);

  // Eigen weefsel (#666: kraftkarton/speelkaart) ligt in de CSS tússen de
  // vlakgradient en de sheen — het zijn achtergrondlagen, de sheen is een
  // ::before erbovenop. Het satijn hoort juist bij de ::after-laag en komt
  // daarom pas ná de stralenkrans, onderaan deze functie.
  if (kleuren.textuur === "confetti") drawConfetti(ctx, fx, fy, fw, fh);
  if (kleuren.textuur === "speelkaart") drawSpeelkaart(ctx, fx, fy, fw, fh);

  const glow = ctx.createRadialGradient(
    fx + fw / 2,
    fy - fh * 0.06,
    0,
    fx + fw / 2,
    fy - fh * 0.06,
    fh * 0.55,
  );
  glow.addColorStop(0, kleuren.glow);
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(fx, fy, fw, fh);
  const sheen = ctx.createLinearGradient(
    fx,
    fy + fh * 0.2,
    fx + fw,
    fy + fh * 0.62,
  );
  const spreiding = kleuren.sheenSpreiding ?? 0.08;
  sheen.addColorStop(0.5 - spreiding, "rgba(255, 255, 255, 0)");
  sheen.addColorStop(0.5, kleuren.sheen);
  sheen.addColorStop(0.5 + spreiding, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(fx, fy, fw, fh);

  // Stralenkrans (#664): wiggen vanuit het topcentrum, spiegel van de
  // repeating-conic-gradient in FutKaart.css (clip staat nog actief).
  if (kleuren.stralen) {
    const cx = fx + fw / 2;
    const cy = fy + fh * 0.1;
    const R = fh * 1.3;
    ctx.fillStyle = "rgba(255, 255, 255, 0.09)";
    for (let a = -100; a < 260; a += 13) {
      const a1 = (a * Math.PI) / 180;
      const a2 = ((a + 5) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a1, a2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Satijn-weefsel (#664): fijne diagonale banen in de sheen-richting,
  // spiegel van de ::after-textuur in FutKaart.css. De kaarten met een eigen
  // weefsel slaan dit over (#666, zoals de `background: none`-regel daar).
  if ((kleuren.textuur ?? "satijn") === "satijn") {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 2;
    const helling = fh * 0.47; // ~115° t.o.v. de kaart, zoals de CSS
    for (let i = -helling; i < fw; i += 7) {
      ctx.beginPath();
      ctx.moveTo(fx + i, fy);
      ctx.lineTo(fx + i + helling, fy + fh);
      ctx.stroke();
    }
  }

  return { fx, fy, fw, fh };
}

/** Deterministische PRNG (mulberry32) voor de vezelkorrel: de poster moet bij
 *  elke export dezelfde pixels geven (en de kaart naast een eerdere export
 *  dezelfde korrel), dus nooit Math.random(). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mottling (#705): twee grote, zachte vlekken onder de korrel — spiegel van
 *  de twee grote radial-gradients in de CSS ([u, v, rx, ry] als fracties van
 *  het vlak; transparant op 60% van de ellips, zoals daar). */
function drawMottling(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  fw: number,
  fh: number,
) {
  const vlekken: ReadonlyArray<
    readonly [number, number, number, number, string]
  > = [
    [0.28, 0.22, 1.2, 0.9, "rgba(58, 37, 12, 0.05)"],
    [0.78, 0.74, 1.0, 0.8, "rgba(255, 246, 222, 0.05)"],
  ];
  for (const [u, v, rx, ry, kleur] of vlekken) {
    const straal = rx * fw * 0.6;
    ctx.save();
    ctx.translate(fx + u * fw, fy + v * fh);
    ctx.scale(1, (ry * fh) / (rx * fw));
    const vlek = ctx.createRadialGradient(0, 0, 0, 0, 0, straal);
    vlek.addColorStop(0, kleur);
    vlek.addColorStop(1, rgba(kleur, 0));
    ctx.fillStyle = vlek;
    ctx.fillRect(-straal, -straal, straal * 2, straal * 2);
    ctx.restore();
  }
}

/** Vezelkorrel (#705): spiegel van de 28px-SVG-tegel in de CSS — donkere
 *  vezelstreepjes en lichtere pulp-stipjes, om en om. De tegel draagt 14
 *  spikkels per 28×28 CSS-px; hier dezelfde dichtheid over het vlak op de
 *  vaste ~1,4×-kalibratie (vezel ~2,6 CSS-px → 3,6, breedte 0,8 → 1,1,
 *  stip-r 0,7 → 1). Geen tegel-herhaling maar een uitgerolde puntwolk: op
 *  posterformaat zou de herhaling van 39px zichtbaar gaan rasteren. */
function drawVezelkorrel(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  fw: number,
  fh: number,
) {
  const rnd = mulberry32(0x631705);
  const aantal = Math.round((((fw / 1.4) * (fh / 1.4)) / (28 * 28)) * 14);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = "rgba(58, 37, 12, 0.1)";
  ctx.fillStyle = "rgba(255, 246, 222, 0.35)";
  for (let i = 0; i < aantal; i++) {
    const px = fx + rnd() * fw;
    const py = fy + rnd() * fh;
    if (i % 2 === 0) {
      const hoek = rnd() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(hoek) * 3.6, py + Math.sin(hoek) * 3.6);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(px, py, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Kraftkarton-weefsel van de pias (#631/#705): mottling en vezelkorrel met
 *  vier confetti-stipjes erop, als gedrukte inkt — zachtere rand en lagere
 *  alpha dan #631. De CSS-radiussen rekenen tegen de gradient-straal
 *  (farthest-corner ≈ 1,25–1,39 × de vlakbreedte); hier uitgerekend als
 *  fractie van die breedte, met de veer van de CSS (vol tot ~55%,
 *  transparant op 1,5 × de radius). */
function drawConfetti(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  fw: number,
  fh: number,
) {
  drawMottling(ctx, fx, fy, fw, fh);
  drawVezelkorrel(ctx, fx, fy, fw, fh);
  const stippen: ReadonlyArray<
    readonly [number, number, number, string]
  > = [
    [0.24, 0.16, 0.045, "rgba(140, 42, 23, 0.24)"],
    [0.76, 0.28, 0.035, "rgba(31, 92, 64, 0.21)"],
    [0.38, 0.76, 0.034, "rgba(31, 74, 128, 0.19)"],
    [0.84, 0.64, 0.029, "rgba(140, 42, 23, 0.19)"],
  ];
  for (const [u, v, r, kleur] of stippen) {
    const cx = fx + u * fw;
    const cy = fy + v * fh;
    const straal = r * fw;
    const stip = ctx.createRadialGradient(cx, cy, 0, cx, cy, straal * 1.5);
    stip.addColorStop(0, kleur);
    stip.addColorStop(0.55, kleur);
    stip.addColorStop(1, rgba(kleur, 0));
    ctx.fillStyle = stip;
    ctx.beginPath();
    ctx.arc(cx, cy, straal * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Speelkaart-weefsel van de Zwarte Piet (#645/#705): linnen-finish met de
 *  vier suit-pips erop. Het linnen is de spiegel van de twee gekruiste
 *  repeating-linear-gradients (0°/90°, 1px lijn op periode 3) — op de vaste
 *  ~1,4×-kalibratie: lijn 1,5, periode 4. Pip-coördinaten en tekengrootte
 *  komen 1-op-1 uit de inline-SVG-laag in FutKaart.css (viewBox 100×139 —
 *  precies de kaartverhouding, dus één schaalfactor volstaat). */
function drawSpeelkaart(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  fw: number,
  fh: number,
) {
  ctx.strokeStyle = "rgba(32, 29, 24, 0.045)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < fh; i += 4) {
    ctx.beginPath();
    ctx.moveTo(fx, fy + i);
    ctx.lineTo(fx + fw, fy + i);
    ctx.stroke();
  }
  for (let i = 0; i < fw; i += 4) {
    ctx.beginPath();
    ctx.moveTo(fx + i, fy);
    ctx.lineTo(fx + i, fy + fh);
    ctx.stroke();
  }
  const pips: ReadonlyArray<readonly [number, number, string, string]> = [
    [11, 28, "♠", "rgba(32, 29, 24, 0.2)"],
    [77, 42, "♥", "rgba(168, 39, 27, 0.22)"],
    [16, 100, "♦", "rgba(168, 39, 27, 0.22)"],
    [77, 90, "♣", "rgba(32, 29, 24, 0.2)"],
  ];
  const s = fw / 100;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${13 * s}px serif`;
  for (const [px, py, glyph, kleur] of pips) {
    ctx.fillStyle = kleur;
    ctx.fillText(glyph, fx + px * s, fy + py * (fh / 139));
  }
  ctx.restore();
}

/* ------------------------------ kleurregisters ------------------------------ */

/** De zes speciale edities zoals FutKaart.tsx ze als prop kent. Bewust een
 *  eigen union i.p.v. `Editie` uit features/standings: die module hangt aan de
 *  klassement-domeinlogica en importeert zélf features/rating, dus de
 *  afhankelijkheid moet deze kant op niet bestaan. De callers typeren hun veld
 *  als `Editie` en laten TypeScript de twee unions vergelijken. */
export type KaartEditie =
  | "icon"
  | "kampioen"
  | "inform"
  | "onfire"
  | "pias"
  | "piet";

/** Alles wat de kaart aan kleur nodig heeft: de laag-opbouw voor
 *  `drawKaartSchild` plus de inkt- en lijnkleuren voor de content erop. */
export interface KaartSkin {
  kleuren: FutKaartKleuren;
  /** --kaart-ink: elo, naam. */
  ink: string;
  /** --kaart-ink-soft: sub-niveau, divisieregel. */
  inkSoft: string;
  /** --kaart-lijn: de hairlines onder eloblok en naamplaat. */
  lijn: string;
  /** --editie-kleur: de editie-regel; valt in de CSS terug op --kaart-ink. */
  editieKleur: string;
}

/** Eén editie-register uit FutKaart.css, in dezelfde volgorde als daar
 *  gelezen: frame (.fut-kaart__zijde), liner, vlak-gradient, topgloed, sheen
 *  en de kleurtokens. `vlakMid` is de middelste stop van de vlak-gradient
 *  (56% voor de lichte registers, 60% voor de donkere). */
interface EditieRegister {
  frame: ReadonlyArray<readonly [number, string]>;
  /** Snijkant (#705) — de --kaart-snijkant-token; alleen de pias. */
  snijkant?: string;
  liner: string;
  vlak: readonly [string, string, string];
  vlakMid: number;
  /** Radiale topgloed; de pias en de Piet hebben er in de CSS geen. */
  glow: string;
  /** Alleen gezet waar de editie de ::before-sheen overschrijft. */
  sheen?: string;
  sheenSpreiding?: number;
  ink: string;
  inkSoft: string;
  lijn: string;
  editieKleur: string;
  textuur?: VlakTextuur;
}

/** De basis-sheen (.fut-kaart__vlak::before) die élk register erft. Bewust 0.28
 *  waar de CSS 0.32 zet: de canvas-baan loopt over een kortere gradient-as en
 *  leest daardoor breder en feller: #664 kalibreerde 'm op het oog naar 0.28 en
 *  die kalibratie houden we aan, ook voor de edities. */
const BASIS_SHEEN = "rgba(255, 255, 255, 0.28)";

/** De zes editie-registers — waarden spiegelen FutKaart.css (regels 637-951)
 *  en, voor de Icon, de --bigdaddy-kaart-/--bigdaddy-frame-tokens uit
 *  index.css. Bewaakt door de synctest in futKaartCanvas.test.ts. */
const EDITIE_REGISTERS: Record<KaartEditie, EditieRegister> = {
  // Icon (Big Daddy, #625): roze vlak, frame dat goud en roze afwisselt — het
  // enige register met vijf framestops.
  icon: {
    frame: [
      [0, "#f6d7a0"],
      [0.38, "#dd6ba2"],
      [0.62, "#ffeef6"],
      [0.82, "#c99a3f"],
      [1, "#8f3560"],
    ],
    liner: "#54203a",
    vlak: ["#fff6fa", "#fbdeed", "#f2bcd7"],
    vlakMid: 0.56,
    glow: "rgba(255, 226, 240, 0.9)",
    ink: "#8c2f5a",
    inkSoft: "#a04a72",
    lijn: "#d989ae",
    editieKleur: "#c2447c",
  },
  // Kampioen (#625): platina-wit met lauwergroen.
  kampioen: {
    frame: [
      [0, "#eef6f1"],
      [0.42, "#8fb3a0"],
      [0.68, "#f6fbf8"],
      [1, "#4f7a63"],
    ],
    liner: "#223c2f",
    vlak: ["#fbfdfc", "#e9f2ee", "#cfe0d6"],
    vlakMid: 0.56,
    glow: "rgba(236, 250, 242, 0.9)",
    ink: "#1f5c40",
    inkSoft: "#48745e",
    lijn: "#9dbfab",
    editieKleur: "#2e7050",
  },
  // In-Form (#497): navy-goud. De lopende shimmer uit de CSS staat op de
  // poster stil — een PNG heeft geen animatie — maar wel op zijn breedste
  // stand (38/50/62), zodat de gouden baan net zo present is als live.
  inform: {
    frame: [
      [0, "#f7dfa0"],
      [0.45, "#8a6a1c"],
      [0.7, "#ffe9ac"],
      [1, "#4c390a"],
    ],
    liner: "#0a0c14",
    vlak: ["#232c44", "#141826", "#0a0c14"],
    vlakMid: 0.6,
    glow: "rgba(240, 199, 102, 0.28)",
    sheen: "rgba(255, 222, 140, 0.28)",
    sheenSpreiding: 0.12,
    ink: "#f2cf7d",
    inkSoft: "#c9a95e",
    lijn: "rgba(240, 199, 102, 0.45)",
    editieKleur: "#f2cf7d",
  },
  // On-Fire (#632): sintel-donker met ember-frame, zelfde stille shimmer.
  onfire: {
    frame: [
      [0, "#ffd9a0"],
      [0.42, "#b3411a"],
      [0.68, "#ffc07a"],
      [1, "#591107"],
    ],
    liner: "#180a05",
    vlak: ["#3a180c", "#241009", "#140704"],
    vlakMid: 0.6,
    glow: "rgba(255, 140, 66, 0.34)",
    sheen: "rgba(255, 170, 92, 0.3)",
    sheenSpreiding: 0.12,
    ink: "#ffc98a",
    inkSoft: "#d1915b",
    lijn: "rgba(255, 160, 92, 0.45)",
    editieKleur: "#ffb35c",
  },
  // Pias (#631/#705): mat kraftkarton met confetti — vlak frame met bleke
  // snijkant, warme diffuse waas i.p.v. de witte specular-baan.
  pias: {
    frame: [
      [0, "#a8814e"],
      [1, "#987040"],
    ],
    snijkant: "#d9c193",
    liner: "#4a3315",
    vlak: ["#dcbd85", "#c9a468", "#a37e46"],
    vlakMid: 0.56,
    glow: "rgba(255, 255, 255, 0)",
    sheen: "rgba(255, 240, 214, 0.06)",
    sheenSpreiding: 0.2,
    ink: "#3a250c",
    inkSoft: "#6b4d24",
    lijn: "#8a6534",
    editieKleur: "#8c2a17",
    textuur: "confetti",
  },
  // Zwarte Piet (#645/#705): speelkaart-wit met vlak mat lakframe; de bone
  // liner is de witte snijkant van het kaartkarton. Sheen uit.
  piet: {
    frame: [
      [0, "#23211d"],
      [1, "#131211"],
    ],
    liner: "#efe7d2",
    vlak: ["#f4eedb", "#e6ddc2", "#cfc4a4"],
    vlakMid: 0.56,
    glow: "rgba(255, 255, 255, 0)",
    sheen: "rgba(255, 255, 255, 0)",
    ink: "#201d16",
    inkSoft: "#5d5645",
    lijn: "#a2977a",
    editieKleur: "#a8271b",
    textuur: "speelkaart",
  },
};

/** Tierkleur uit het vastgepinde poster-palet, zoals de --tier-tokens. */
function tierKleur(key: TierKey | undefined): string {
  const c = canvasPalette();
  const tabel: Record<TierKey, string> = {
    slof: c.slof,
    karton: c.karton,
    hout: c.hout,
    brons: c.bronze,
    zilver: c.silver,
    goud: c.gold,
    platina: c.platina,
    diamant: c.diamant,
    meester: c.meester,
    legende: c.legende,
    dictator: c.dictator,
  };
  return key ? tabel[key] : c.slof;
}

/** Draagt deze divisiegroep de stralenkrans? Spiegel van het premium-blok in
 *  FutKaart.css: de spitse vleugels en de kroon-crest. */
function premiumTier(key: TierKey | undefined): boolean {
  return (
    key === "platina" ||
    key === "diamant" ||
    key === "meester" ||
    key === "legende" ||
    key === "dictator"
  );
}

/**
 * Alle kleuren van één kaart, in dezelfde cascade als FutKaart.css (#666):
 *
 * — de divisie levert de metaalladder (of, bij GOAT/dictator, het donkere
 *   special-register);
 * — een editie overschrijft dáárbovenop frame, liner, vlak en inkt — ook op een
 *   GOAT-kaart, want in de CSS staat het editie-blok ná het special-blok met
 *   gelijke specificiteit;
 * — de stralenkrans blijft van de divisie (de editie-blokken raken ::after
 *   niet), behalve bij de pias en de Piet: die zetten hem uit, ook op een
 *   premium-tier, want hun eigen weefsel verdraagt geen tweede laag.
 *
 * De schildvorm staat hier bewust buiten: die komt van `schildVorm(key)` en
 * wisselt nooit met de editie.
 */
export function kaartSkin(
  key: TierKey | undefined,
  editie: KaartEditie | null,
): KaartSkin {
  const special = key === "legende" || key === "dictator";
  const stralen = premiumTier(key) && editie !== "pias" && editie !== "piet";

  if (editie) {
    const r = EDITIE_REGISTERS[editie];
    return {
      kleuren: {
        frame: r.frame,
        snijkant: r.snijkant,
        liner: r.liner,
        vlak: [
          [0, r.vlak[0]],
          [r.vlakMid, r.vlak[1]],
          [1, r.vlak[2]],
        ],
        glow: r.glow,
        sheen: r.sheen ?? BASIS_SHEEN,
        sheenSpreiding: r.sheenSpreiding,
        keyline: mix(r.lijn, "#fff8e8", 0.75),
        stralen,
        textuur: r.textuur,
      },
      ink: r.ink,
      inkSoft: r.inkSoft,
      lijn: r.lijn,
      editieKleur: r.editieKleur,
    };
  }

  if (special) {
    // Special-glans en -diepten: dezelfde constanten als FutKaart.css
    // (dictator = troon-tokens, GOAT = vaste roze).
    const glans = key === "dictator" ? "#e6b34d" : "#f7869f";
    const diepHi = key === "dictator" ? "#a52347" : "#3c1524";
    const diep = key === "dictator" ? "#5e1228" : "#24101a";
    return {
      kleuren: {
        frame: [
          [0, mix(glans, "#ffffff", 0.85)],
          [0.42, mix(glans, "#201505", 0.55)],
          [0.68, mix(glans, "#fff8e0", 0.92)],
          [1, mix(glans, "#140d02", 0.45)],
        ],
        liner: "#0c0805",
        vlak: [
          [0, diepHi],
          [0.6, diep],
          [1, "#120a10"],
        ],
        glow: rgba(glans, 0.4),
        sheen: "rgba(255, 240, 200, 0.14)",
        keyline: mix(glans, "#fff8e8", 0.55),
        stralen,
      },
      ink: mix(glans, "#ffffff", 0.8),
      inkSoft: mix(glans, "#b7a98c", 0.65),
      lijn: rgba(glans, 0.55),
      editieKleur: mix(glans, "#ffffff", 0.8),
    };
  }

  const tier = tierKleur(key);
  const lijn = mix(tier, "#a8987a", 0.55);
  const ink = mix(tier, "#1d1508", 0.52);
  return {
    kleuren: {
      frame: [
        [0, mix(tier, "#fff8e8", 0.55)],
        [0.42, mix(tier, "#3a2f18", 0.88)],
        [0.68, mix(tier, "#fff3d6", 0.6)],
        [1, mix(tier, "#241b0c", 0.9)],
      ],
      liner: mix(tier, "#211806", 0.7),
      vlak: [
        [0, mix(tier, "#fdfbf6", 0.2)],
        [0.56, mix(tier, "#f1eadb", 0.46)],
        [1, mix(tier, "#d9cfba", 0.62)],
      ],
      glow: "rgba(255, 255, 255, 0.5)",
      sheen: BASIS_SHEEN,
      keyline: mix(lijn, "#fff8e8", 0.75),
      stralen,
    },
    ink,
    inkSoft: mix(tier, "#4a3d26", 0.58),
    lijn,
    // Zonder editie valt --editie-kleur in de CSS terug op --kaart-ink.
    editieKleur: ink,
  };
}

/**
 * Laadt een afbeelding met crossOrigin="anonymous" zodat het canvas na het
 * tekenen niet getaint raakt (nodig voor Supabase Storage-URL's, #618). Elke
 * faaltak — geen url, laad-/CORS-fout — resolvet naar null, zodat de caller
 * stil op een initialen-avatar kan terugvallen.
 */
export function laadAvatar(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
