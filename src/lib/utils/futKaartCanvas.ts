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
import {
  DICTATOR_EPAULET,
  DICTATOR_EPAULET_FRANJE,
  DICTATOR_GEM,
  DICTATOR_GEMS,
  DICTATOR_GOUD_CONTOUR,
  DICTATOR_GOUD_GLANS,
  DICTATOR_GOUD_VERLOOP,
  DICTATOR_KROON,
  DICTATOR_KROON_BAND,
  DICTATOR_KROON_BOLLEN,
  DICTATOR_LAUWER_BLADEN,
  DICTATOR_LAUWER_STENGEL,
  DICTATOR_WATERMARK,
  DICTATOR_WATERMARK_BREEDTE,
  DICTATOR_WATERMARK_KLEUR,
  DICTATOR_WATERMARK_POSITIE,
  DICTATOR_ZEGEL,
  GOAT_BAARD_BLAD,
  GOAT_BAARD_FLICK,
  GOAT_BAARD_NERVEN,
  GOAT_HOORN,
  GOAT_MEDAILLON,
  GOAT_MEDAILLON_BREEDTE,
  GOAT_MEDAILLON_KLEUR,
  GOAT_MEDAILLON_POSITIE,
  GOAT_METAAL_CONTOUR,
  GOAT_METAAL_GLANS,
  GOAT_METAAL_RIBBEL,
  GOAT_METAAL_RIBBELGLANS,
  GOAT_METAAL_SCHADUW,
  GOAT_METAAL_VERLOOP,
  type OrnamentPad,
  type Streng,
} from "@/features/rating/components/futKaartOrnamenten";
import {
  kiesOrnament,
  ONFIRE_CREST_BAND,
  ONFIRE_CREST_NERVEN,
  ONFIRE_CREST_PLAAT,
  ONFIRE_CREST_VLAM,
  ONFIRE_GLOED_VERLOOP,
  ONFIRE_KOPER,
  ONFIRE_MEDAILLON,
  ONFIRE_MEDAILLON_DIEP,
  ONFIRE_MEDAILLON_NERVEN,
  ONFIRE_MEDAILLON_VLAM,
  ONFIRE_SINTELS,
  ONFIRE_SINTEL_GLOED,
  ONFIRE_SINTEL_KERN,
  ONFIRE_STAAL_VERLOOP,
  ONFIRE_VINNEN,
  ONFIRE_WATERMARK,
  ONFIRE_WATERMARK_BREEDTE,
  ONFIRE_WATERMARK_KLEUR,
  ONFIRE_WATERMARK_POSITIE,
  type MetaalPalet,
  type OrnamentSoort,
} from "@/features/rating/components/ornamentenOnfire";
import { canvasPalette } from "@/lib/utils/shareImage";

export type SchildVorm = "vlak" | "notch" | "punt" | "kroon" | "troon";

/** Bovenrand per divisiegroep — zelfde mapping als FutKaart.css. */
export function schildVorm(key: TierKey | undefined): SchildVorm {
  if (key === "slof" || key === "karton" || key === "hout") return "vlak";
  if (key === "platina" || key === "diamant" || key === "meester")
    return "punt";
  // #710: de twee toptiers verschillen nu ook in silhouet — GOAT houdt de
  // kroon-crest, El Padelissimo krijgt de hoge, ceremoniële troon-crest.
  if (key === "legende") return "kroon";
  if (key === "dictator") return "troon";
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
  } else if (vorm === "troon") {
    ctx.moveTo(X(0.16), Y(0.012));
    L(0.4, 0.012);
    L(0.5, 0.058);
    L(0.6, 0.012);
    L(0.84, 0.012);
    L(1, 0.085);
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
  else if (vorm === "troon") {
    L(0, 0.085);
    L(0.16, 0.012);
  } else {
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
export type VlakTextuur =
  | "satijn"
  | "confetti"
  | "speelkaart"
  | "brokaat"
  | "groeven";

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
  /** Volledige stoplijst van de sheen (#710), voor een baan die niet met één
   *  piek te beschrijven is: de On Fire-hitteglans heeft zeven stops. Wint van
   *  `sheen`/`sheenSpreiding`. */
  sheenStops?: ReadonlyArray<readonly [number, string]>;
  /** Vignet (#710): elliptische verdieping over het vlak, ná de topgloed —
   *  spiegel van de eerste radial-gradient-laag in .fut-kaart--onfire
   *  .fut-kaart__vlak. Alleen de stops; de geometrie (118% × 88% op 50%/32%)
   *  staat vast in `drawKaartSchild`, net als bij de stralenkrans. */
  vignet?: ReadonlyArray<readonly [number, string]>;
  /** Keyline (#664): dunne lichte lijn tussen liner en vlak — spiegel van
   *  .fut-kaart__keyline. Weglaten = geen keyline (oude opbouw). */
  keyline?: string;
  /** Stralenkrans (#664): de premium-registers (platina/diamant/meester) —
   *  spiegel van de ::after-stralen in FutKaart.css. De dictator zet hem
   *  sinds #710 in goud als propaganda-zonnestraal (zie stralenKleur). */
  stralen?: boolean;
  /** Kleur van de stralenkrans; default het ijle wit van het premium-blok. */
  stralenKleur?: string;
  /** Hoekmaat van één straal en van de periode, in graden (default 5/13 —
   *  de repeating-conic van het premium-blok). */
  stralenStraal?: number;
  stralenPeriode?: number;
  /** Vlak-textuur; default "satijn". */
  textuur?: VlakTextuur;
  /** Satijn-alpha (#710): GOAT zet zijn weefsel ijler (CSS 0.04 → hier
   *  0.035, dezelfde ~0.875-kalibratie als de sheen). Default 0.06. */
  satijnAlpha?: number;
  /** Geborsteld frame (#710): conic-ribbels die uit het kaartmidden stralen
   *  en dus rondom loodrecht op de rand staan — spiegel van de
   *  repeating-conic-laag op .fut-kaart__zijde. */
  frameRibbels?: boolean;
  /** Echo-contour (#710): het schildpad nog eens, verschoven gevuld achter
   *  het frame — spiegel van de --kaart-echo drop-shadow(dx dy 0 kleur).
   *  Offsets als fractie van de kaartbreedte, zoals de CSS-calc op --fut-kw. */
  echo?: ReadonlyArray<readonly [number, number, string]>;
  /** Binnenlijnen (#710): geclipte ringen langs het vlak — spiegel van de
   *  --kaart-binnenlijn inset-schaduwen, [spreiding in CSS-px, kleur] in
   *  dezelfde volgorde als daar (smal → breed; hier omgekeerd getekend). */
  binnenlijn?: ReadonlyArray<readonly [number, string]>;
  /** Vlak-motief (#710): het geëtste watermerk (FutKaartMotief in de DOM),
   *  met letterlijk dezelfde paden uit futKaartOrnamenten.ts als Path2D. */
  motief?: {
    paden: readonly OrnamentPad[];
    kleur: string;
    /** Breedte als fractie van het vlak (CSS --motief-b / 100). */
    breedte: number;
    /** Verticale positie als background-position-fractie (--motief-pos). */
    positie: number;
  };
  /** Ornamentlaag (#710): de vormen die búiten het schild uitsteken, vóór
   *  het frame getekend (de DOM legt ze als eerste kind achter de kaart).
   *  "dictator" en "onfire" tekenen bovendien een vóór-laag (lauwerkrans en
   *  lakzegel, respectievelijk vlamcrest, medaillon en sintels) ná het vlak —
   *  dezelfde laagvolgorde als .fut-kaart__ornament--voor in de CSS. */
  ornament?: OrnamentSoort;
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
  // Ornamentlaag (#710): hoorns en andere uitsteeksels éérst — de DOM legt
  // ze als eerste kind achter de kaart, dus alles hierna tekent eroverheen.
  if (kleuren.ornament === "goat") drawGoatOrnament(ctx, x, y, w);
  if (kleuren.ornament === "dictator") drawDictatorAchter(ctx, x, y, w);
  if (kleuren.ornament === "onfire") drawOnfireAchter(ctx, x, y, w);

  // Echo-contour (#710): het silhouet nog eens, verschoven — spiegel van de
  // --kaart-echo drop-shadow, die in de DOM ná de clip werkt en dus exact
  // het schild volgt.
  if (kleuren.echo) {
    for (const [dx, dy, kleur] of kleuren.echo) {
      schildPad(ctx, x + dx * w, y + dy * w, w, h, vorm);
      ctx.fillStyle = kleur;
      ctx.fill();
    }
  }

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

  // Geborsteld frame (#710): wiggen vanuit het kaartmidden over de volle
  // schildclip — liner en vlak dekken zo dadelijk het midden af, dus alleen
  // de randstrip houdt de ribbels (dezelfde truc als de CSS, waar de conic
  // onder de liner-laag ligt).
  if (kleuren.frameRibbels) {
    ctx.save();
    schildPad(ctx, x, y, w, h, vorm);
    ctx.clip();
    const rcx = x + w / 2;
    const rcy = y + h / 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    for (let a = 0; a < 360; a += 2.2) {
      const a1 = (a * Math.PI) / 180;
      const a2 = ((a + 0.7) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(rcx, rcy);
      ctx.arc(rcx, rcy, h, a1, a2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

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

  // Vignet (#710): ellips van 118% × 88% op 50%/32% van het vlak, transparant
  // in het midden en diep aan de randen — spiegel van de bovenste
  // radial-gradient-laag van het On-Fire-vlak. Zelfde ellips-truc als de
  // mottling: een cirkelverloop in een geschaald assenstelsel.
  if (kleuren.vignet) {
    const straal = 1.18 * fw;
    ctx.save();
    ctx.translate(fx + fw / 2, fy + fh * 0.32);
    ctx.scale(1, (0.88 * fh) / straal);
    const vlek = ctx.createRadialGradient(0, 0, 0, 0, 0, straal);
    for (const [offset, kleur] of kleuren.vignet) vlek.addColorStop(offset, kleur);
    ctx.fillStyle = vlek;
    ctx.fillRect(-straal, -straal, straal * 2, straal * 2);
    ctx.restore();
  }

  // Binnenlijnen (#710): geclipte ringen langs het vlak — spiegel van de
  // inset-schaduwen in --kaart-binnenlijn. Breedste eerst (de CSS somt
  // smal → breed op en de eerste schaduw wint); door de actieve clip blijft
  // van elke stroke alleen de binnenhelft over, dus lineWidth = 2 × de
  // spreiding (CSS-px × 1,4-kalibratie).
  if (kleuren.binnenlijn) {
    for (const [spreiding, kleur] of [...kleuren.binnenlijn].reverse()) {
      schildPad(ctx, fx, fy, fw, fh, vorm);
      ctx.strokeStyle = kleur;
      ctx.lineWidth = spreiding * 1.4 * 2;
      ctx.stroke();
    }
  }

  // Vlak-motief (#710): het geëtste watermerk, exact de DOM-laagvolgorde —
  // boven achtergrond, gloed en binnenlijnen, onder sheen en textuur.
  if (kleuren.motief) drawMotief(ctx, fx, fy, fw, fh, kleuren.motief);

  const sheen = ctx.createLinearGradient(
    fx,
    fy + fh * 0.2,
    fx + fw,
    fy + fh * 0.62,
  );
  if (kleuren.sheenStops) {
    for (const [offset, kleur] of kleuren.sheenStops)
      sheen.addColorStop(offset, kleur);
  } else {
    const spreiding = kleuren.sheenSpreiding ?? 0.08;
    sheen.addColorStop(0.5 - spreiding, "rgba(255, 255, 255, 0)");
    sheen.addColorStop(0.5, kleuren.sheen);
    sheen.addColorStop(0.5 + spreiding, "rgba(255, 255, 255, 0)");
  }
  ctx.fillStyle = sheen;
  ctx.fillRect(fx, fy, fw, fh);

  // Stralenkrans (#664): wiggen vanuit het topcentrum, spiegel van de
  // repeating-conic-gradient in FutKaart.css (clip staat nog actief).
  if (kleuren.stralen) {
    const cx = fx + fw / 2;
    const cy = fy + fh * 0.1;
    const R = fh * 1.3;
    ctx.fillStyle = kleuren.stralenKleur ?? "rgba(255, 255, 255, 0.09)";
    const straal = kleuren.stralenStraal ?? 5;
    const periode = kleuren.stralenPeriode ?? 13;
    for (let a = -100; a < 260; a += periode) {
      const a1 = (a * Math.PI) / 180;
      const a2 = ((a + straal) * Math.PI) / 180;
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
  // Brokaat (#710, dictator): twee gekruiste gouden rasters op 45° — de stof
  // van de troonzaal, spiegel van de twee repeating-linear-gradients in de
  // CSS (periode 7 CSS-px → 10 canvas-px op de vaste ~1,4×-kalibratie).
  if (kleuren.textuur === "brokaat") {
    ctx.strokeStyle = "rgba(240, 199, 102, 0.05)";
    ctx.lineWidth = 1.4;
    for (const richting of [1, -1]) {
      for (let i = -fh; i < fw + fh; i += 10) {
        ctx.beginPath();
        ctx.moveTo(fx + i, fy);
        ctx.lineTo(fx + i + richting * fh, fy + fh);
        ctx.stroke();
      }
    }
  }

  // Geborstelde metaalgroeven (#710, On Fire): concentrische bogen om een punt
  // onder de kaartpunt — spiegel van de repeating-radial-gradient in de CSS
  // (periode 4,5 CSS-px → 6,3 canvas-px op de vaste ~1,4×-kalibratie). De
  // actieve vlak-clip snijdt de bogen op de schildvorm, dus dit werkt op elke
  // tier. Tot ~2 × de kaarthoogte: verder weg raakt geen enkele boog het vlak.
  if (kleuren.textuur === "groeven") {
    const cx = fx + fw / 2;
    const cy = fy + fh * 1.32;
    ctx.strokeStyle = "rgba(255, 178, 116, 0.085)";
    ctx.lineWidth = 1.4;
    for (let r = 6.3; r < fh * 2; r += 6.3) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  }

  if ((kleuren.textuur ?? "satijn") === "satijn") {
    ctx.strokeStyle = `rgba(255, 255, 255, ${kleuren.satijnAlpha ?? 0.06})`;
    ctx.lineWidth = 2;
    const helling = fh * 0.47; // ~115° t.o.v. de kaart, zoals de CSS
    for (let i = -helling; i < fw; i += 7) {
      ctx.beginPath();
      ctx.moveTo(fx + i, fy);
      ctx.lineTo(fx + i + helling, fy + fh);
      ctx.stroke();
    }
  }

  // Vóór-laag (#710): de lauwerkransen en het lakzegel van El Padelissimo
  // liggen over de kaart heen. De vlak-clip moet daarvoor even wijken (die
  // zou alles buiten het vlak wegsnijden) en daarna weer aan, want de caller
  // tekent zijn content nog binnen dezelfde clip.
  if (kleuren.ornament === "dictator" || kleuren.ornament === "onfire") {
    ctx.restore();
    if (kleuren.ornament === "dictator") drawDictatorVoor(ctx, x, y, w);
    else drawOnfireVoor(ctx, x, y, w);
    ctx.save();
    schildPad(ctx, fx, fy, fw, fh, vorm);
    ctx.clip();
  }

  return { fx, fy, fw, fh };
}

/** Gouden ornamentvlak: verloop-vulling, donkere contour en een lichte
 *  binnenrand — spiegel van FutGoud in FutKaart.tsx. */
function goudPad(ctx: CanvasRenderingContext2D, d: string, yTop = -32, yBot = 60) {
  const pad = new Path2D(d);
  const verloop = ctx.createLinearGradient(0, yTop, (yBot - yTop) * 0.3, yBot);
  for (const [offset, kleur] of DICTATOR_GOUD_VERLOOP)
    verloop.addColorStop(offset, kleur);
  ctx.fillStyle = verloop;
  ctx.fill(pad);
  ctx.lineJoin = "round";
  ctx.strokeStyle = DICTATOR_GOUD_CONTOUR;
  ctx.lineWidth = 0.6;
  ctx.stroke(pad);
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = DICTATOR_GOUD_GLANS;
  ctx.lineWidth = 0.35;
  ctx.stroke(pad);
  ctx.restore();
}

/** El Padelissimo, áchter de kaart (#710): epauletten met franje en de
 *  vijfpuntige kroon met bolknoppen en edelstenen. Eén helft plus zijn
 *  spiegeling om x=50, net als de <use transform> in de DOM-defs. */
function drawDictatorAchter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
) {
  const s = w / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  for (const gespiegeld of [false, true]) {
    ctx.save();
    if (gespiegeld) {
      ctx.translate(100, 0);
      ctx.scale(-1, 1);
    }
    goudPad(ctx, DICTATOR_EPAULET, 30, 58);
    ctx.strokeStyle = DICTATOR_GOUD_VERLOOP[1][1];
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    for (const d of DICTATOR_EPAULET_FRANJE) ctx.stroke(new Path2D(d));
    ctx.restore();
  }
  goudPad(ctx, DICTATOR_KROON_BAND, -2, 7);
  goudPad(ctx, DICTATOR_KROON, -32, 2);
  for (const [cx, cy, r] of DICTATOR_KROON_BOLLEN) {
    for (const bx of cx === 50 ? [cx] : [cx, 100 - cx]) {
      ctx.beginPath();
      ctx.arc(bx, cy, r, 0, Math.PI * 2);
      const bol = ctx.createLinearGradient(0, cy - r, 0, cy + r);
      for (const [offset, kleur] of DICTATOR_GOUD_VERLOOP)
        bol.addColorStop(offset, kleur);
      ctx.fillStyle = bol;
      ctx.fill();
      ctx.strokeStyle = DICTATOR_GOUD_CONTOUR;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
  for (const d of DICTATOR_GEMS) {
    for (const spiegel of [false, true]) {
      ctx.save();
      if (spiegel) {
        ctx.translate(100, 0);
        ctx.scale(-1, 1);
      }
      const gem = new Path2D(d);
      ctx.fillStyle = DICTATOR_GEM;
      ctx.fill(gem);
      ctx.strokeStyle = DICTATOR_GOUD_CONTOUR;
      ctx.lineWidth = 0.4;
      ctx.stroke(gem);
      ctx.restore();
    }
  }
  ctx.restore();
}

/** El Padelissimo, vóór de kaart (#710): de twee lauwerkransen en het
 *  lakzegel in de punt. */
function drawDictatorVoor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
) {
  const s = w / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  for (const gespiegeld of [false, true]) {
    ctx.save();
    if (gespiegeld) {
      ctx.translate(100, 0);
      ctx.scale(-1, 1);
    }
    goudPad(ctx, DICTATOR_LAUWER_STENGEL.omtrek, 60, 142);
    for (const d of DICTATOR_LAUWER_BLADEN) goudPad(ctx, d, 60, 142);
    ctx.restore();
  }
  const [zx, zy] = DICTATOR_ZEGEL.midden;
  const ring = ctx.createLinearGradient(0, zy - DICTATOR_ZEGEL.ring, 0, zy + DICTATOR_ZEGEL.ring);
  for (const [offset, kleur] of DICTATOR_GOUD_VERLOOP) ring.addColorStop(offset, kleur);
  ctx.beginPath();
  ctx.arc(zx, zy, DICTATOR_ZEGEL.ring, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.strokeStyle = DICTATOR_GOUD_CONTOUR;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(zx, zy, DICTATOR_ZEGEL.vlak, 0, Math.PI * 2);
  ctx.fillStyle = "#7d1a33";
  ctx.fill();
  ctx.lineWidth = 0.4;
  ctx.stroke();
  goudPad(ctx, DICTATOR_ZEGEL.ster, zy - 5, zy + 5);
  for (const [bx, by, r] of DICTATOR_ZEGEL.bollen) {
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }
  ctx.restore();
}

/** Vlak-motief (#710): de geëtste watermerkpaden uit futKaartOrnamenten.ts —
 *  letterlijk dezelfde strings die FutKaartMotief in de DOM rendert, hier als
 *  Path2D. De 100×100-viewBox schaalt naar `breedte` × het vlak en staat
 *  gecentreerd op de `positie`-fractie, exact zoals de CSS-plaatsing van
 *  .fut-kaart__motief (`center P% / B%`). */
function drawMotief(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  fw: number,
  fh: number,
  motief: NonNullable<FutKaartKleuren["motief"]>,
) {
  const maat = motief.breedte * fw;
  const schaal = maat / 100;
  ctx.save();
  ctx.translate(
    fx + (fw - maat) / 2,
    fy + motief.positie * (fh - maat),
  );
  ctx.scale(schaal, schaal);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const pad of motief.paden) {
    const p = new Path2D(pad.d);
    ctx.globalAlpha = pad.alpha ?? 1;
    if (pad.soort === "vlak") {
      ctx.fillStyle = motief.kleur;
      ctx.fill(p);
    } else {
      ctx.strokeStyle = motief.kleur;
      ctx.lineWidth = pad.breedte ?? 1;
      ctx.stroke(p);
    }
  }
  ctx.restore();
}

/** Het rosé GOAT-metaal als palet, zodat `strokeStreng` de losse GOAT_METAAL_*
 *  constanten en het koper van On Fire op dezelfde manier kan lezen. */
const GOAT_PALET: MetaalPalet = {
  verloop: GOAT_METAAL_VERLOOP,
  contour: GOAT_METAAL_CONTOUR,
  glans: GOAT_METAAL_GLANS,
  ribbel: GOAT_METAAL_RIBBEL,
  ribbelGlans: GOAT_METAAL_RIBBELGLANS,
  schaduw: GOAT_METAAL_SCHADUW,
};

/** Eén getaperde metaalstreng (#710) op canvas: gevulde omtrek met contour,
 *  dwarsribbels en glanslijn — spiegel van FutStreng in FutKaart.tsx, met
 *  letterlijk dezelfde pad-strings uit de ornamentmodules. */
function strokeStreng(
  ctx: CanvasRenderingContext2D,
  streng: Streng,
  ribbelBreedte: number,
  palet: MetaalPalet = GOAT_PALET,
) {
  const omtrek = new Path2D(streng.omtrek);
  const verloop = ctx.createLinearGradient(
    0,
    streng.bbox.yMin,
    (streng.bbox.yMax - streng.bbox.yMin) * 0.35,
    streng.bbox.yMax,
  );
  for (const [offset, kleur] of palet.verloop)
    verloop.addColorStop(offset, kleur);
  ctx.fillStyle = verloop;
  ctx.fill(omtrek);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = palet.contour;
  ctx.lineWidth = 0.7;
  ctx.stroke(omtrek);
  ctx.lineWidth = ribbelBreedte;
  ctx.strokeStyle = palet.ribbelGlans;
  for (const d of streng.ribbelGlans) ctx.stroke(new Path2D(d));
  ctx.strokeStyle = palet.ribbel;
  for (const d of streng.ribbels) ctx.stroke(new Path2D(d));
  ctx.strokeStyle = palet.schaduw;
  ctx.lineWidth = 1.3;
  ctx.stroke(new Path2D(streng.schaduw));
  ctx.strokeStyle = palet.glans;
  ctx.lineWidth = 0.9;
  ctx.stroke(new Path2D(streng.highlight));
}

/** Eén gevuld ornamentvlak met een verticaal verloop over zijn eigen
 *  hoogtebereik — de canvas-tegenhanger van een objectBoundingBox-gradient in
 *  de DOM-defs. `[yTop, yBot]` zijn de grenzen van het pad in kaart-units. */
function vulPad(
  ctx: CanvasRenderingContext2D,
  d: string,
  verloop: readonly (readonly [number, string])[],
  contour: string,
  yTop: number,
  yBot: number,
  lijnBreedte = 0.5,
) {
  const pad = new Path2D(d);
  const g = ctx.createLinearGradient(0, yTop, (yBot - yTop) * 0.35, yBot);
  for (const [offset, kleur] of verloop) g.addColorStop(offset, kleur);
  ctx.fillStyle = g;
  ctx.fill(pad);
  ctx.lineJoin = "round";
  ctx.strokeStyle = contour;
  ctx.lineWidth = lijnBreedte;
  ctx.stroke(pad);
}

/** On Fire, áchter de kaart (#710): de drie vlamvinnen per kant. Eén helft plus
 *  zijn spiegeling om x=50, net als de <use transform> in de DOM-defs. */
function drawOnfireAchter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
) {
  const s = w / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  for (const gespiegeld of [false, true]) {
    ctx.save();
    if (gespiegeld) {
      ctx.translate(100, 0);
      ctx.scale(-1, 1);
    }
    for (const vin of ONFIRE_VINNEN) strokeStreng(ctx, vin, 0.4, ONFIRE_KOPER);
    ctx.restore();
  }
  ctx.restore();
}

/** On Fire, vóór de kaart (#710): de vlamcrest op de bovenrand, het gloeiende
 *  medaillon over de kaartpunt en de sintelaccenten langs de buitenrand. */
function drawOnfireVoor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
) {
  const s = w / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  // Crest: verkoolde stalen plaat met koperen rand, de chevron eronder en de
  // gesmede vlam erin. De koperen rand van de plaat is in de DOM een
  // gradient-stroke; op canvas volstaat de middenkleur van het verloop.
  vulPad(
    ctx,
    ONFIRE_CREST_PLAAT,
    ONFIRE_STAAL_VERLOOP,
    ONFIRE_KOPER.verloop[1][1],
    -1.5,
    12,
    0.55,
  );
  vulPad(ctx, ONFIRE_CREST_BAND, ONFIRE_KOPER.verloop, ONFIRE_KOPER.contour, 2, 14);
  vulPad(ctx, ONFIRE_CREST_VLAM, ONFIRE_KOPER.verloop, ONFIRE_KOPER.contour, -7, 10, 0.35);
  ctx.lineCap = "round";
  ctx.strokeStyle = ONFIRE_KOPER.ribbel;
  ctx.lineWidth = 0.32;
  for (const d of ONFIRE_CREST_NERVEN) ctx.stroke(new Path2D(d));

  // Medaillon: koperen ring, donkere schijf, gloeiende vlam.
  const [mx, my] = ONFIRE_MEDAILLON.midden;
  const ring = ctx.createLinearGradient(
    0,
    my - ONFIRE_MEDAILLON.ring,
    ONFIRE_MEDAILLON.ring * 0.7,
    my + ONFIRE_MEDAILLON.ring,
  );
  for (const [offset, kleur] of ONFIRE_KOPER.verloop)
    ring.addColorStop(offset, kleur);
  ctx.beginPath();
  ctx.arc(mx, my, ONFIRE_MEDAILLON.ring, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.strokeStyle = ONFIRE_KOPER.contour;
  ctx.lineWidth = 0.55;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mx, my, ONFIRE_MEDAILLON.vlak, 0, Math.PI * 2);
  ctx.fillStyle = ONFIRE_MEDAILLON_DIEP;
  ctx.fill();
  ctx.lineWidth = 0.35;
  ctx.stroke();
  // De gloedkern loopt van onder (heet) naar boven (bleek), dus het verloop
  // gaat hier omgekeerd — zoals de y1/y2 van #fut-orn-gloed in de DOM-defs.
  const gloed = ctx.createLinearGradient(0, my + 7, 0, my - 7);
  for (const [offset, kleur] of ONFIRE_GLOED_VERLOOP)
    gloed.addColorStop(offset, kleur);
  ctx.fillStyle = gloed;
  ctx.fill(new Path2D(ONFIRE_MEDAILLON_VLAM));
  ctx.strokeStyle = "rgba(120, 40, 10, 0.5)";
  ctx.lineWidth = 0.3;
  for (const d of ONFIRE_MEDAILLON_NERVEN) ctx.stroke(new Path2D(d));

  // Sintels: kern met een halo, links plus de spiegeling om x=50.
  for (const [u, v, r] of ONFIRE_SINTELS) {
    for (const cx of [u, 100 - u]) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = ONFIRE_SINTEL_GLOED;
      ctx.beginPath();
      ctx.arc(cx, v, r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ONFIRE_SINTEL_KERN;
      ctx.beginPath();
      ctx.arc(cx, v, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** GOAT-ornament (#710): de bokhoorns en het baardornament die buiten het
 *  schild uitsteken. Eén helft plus zijn spiegeling om x=50, net als de
 *  <use transform> in de DOM-defs; de asstreng van de baard staat op x=50 en
 *  wordt daarom niet gespiegeld. Units zijn kaart-units (100 breed), dus één
 *  schaalfactor volstaat. */
function drawGoatOrnament(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
) {
  const s = w / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  // Baardblad: staat op de as, dus niet gespiegeld — met zijn nerven erin.
  const blad = new Path2D(GOAT_BAARD_BLAD);
  const bladVerloop = ctx.createLinearGradient(0, 132, 6, 158);
  for (const [offset, kleur] of GOAT_METAAL_VERLOOP)
    bladVerloop.addColorStop(offset, kleur);
  ctx.fillStyle = bladVerloop;
  ctx.fill(blad);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = GOAT_METAAL_CONTOUR;
  ctx.lineWidth = 0.7;
  ctx.stroke(blad);
  ctx.strokeStyle = GOAT_METAAL_RIBBEL;
  ctx.lineWidth = 0.42;
  for (const d of GOAT_BAARD_NERVEN) ctx.stroke(new Path2D(d));

  // Hoorn en baard-flick: één helft plus zijn spiegeling om x=50.
  for (const gespiegeld of [false, true]) {
    ctx.save();
    if (gespiegeld) {
      ctx.translate(100, 0);
      ctx.scale(-1, 1);
    }
    strokeStreng(ctx, GOAT_HOORN, 0.62);
    strokeStreng(ctx, GOAT_BAARD_FLICK, 0.34);
    ctx.restore();
  }
  ctx.restore();
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
  sheenStops?: ReadonlyArray<readonly [number, string]>;
  ink: string;
  inkSoft: string;
  lijn: string;
  editieKleur: string;
  textuur?: VlakTextuur;
  /** Rand- en dieptelagen (#710): dezelfde velden als bij de toptiers, nu ook
   *  voor een editie — On Fire is de eerste met een eigen rand-register. */
  echo?: ReadonlyArray<readonly [number, number, string]>;
  binnenlijn?: ReadonlyArray<readonly [number, string]>;
  vignet?: ReadonlyArray<readonly [number, string]>;
  /** Eigen vlak-motief van de editie (#710); wint van dat van de tier. */
  motief?: FutKaartKleuren["motief"];
}

/** De basis-sheen (.fut-kaart__vlak::before) die élk register erft. Bewust 0.28
 *  waar de CSS 0.32 zet: de canvas-baan loopt over een kortere gradient-as en
 *  leest daardoor breder en feller: #664 kalibreerde 'm op het oog naar 0.28 en
 *  die kalibratie houden we aan, ook voor de edities. */
const BASIS_SHEEN = "rgba(255, 255, 255, 0.28)";

/** Glanskleur van de GOAT (#710). Vast, net als de dictator-tinten hieronder:
 *  de poster staat op het lichte palet vastgepind (#125), dus alleen vaste
 *  hexen garanderen dat DOM-kaart en deel-poster in béide thema's gelijk zijn —
 *  de dictator draaide tot #710 op --dictator-gold en week in dark mode dus af
 *  van zijn eigen poster. */
const GOAT_GLANS = "#f7869f";

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
  // On-Fire (#632, herzien in #710): verhit koper en rosébrons op donker
  // mahonie. De hitteglans uit de CSS staat op de poster stil — een PNG heeft
  // geen animatie — maar wel op zijn breedste stand (de volle zeven stops van
  // de referentie-gradient), zodat de baan net zo present is als live. Idem
  // voor de thermische ringen: het motief staat hier op zijn neutrale schaal,
  // precies waar de `fut-kaart-thermiek`-keyframe hem heen en terug beweegt.
  onfire: {
    frame: [
      [0, "#f6ddc4"],
      [0.42, "#b06537"],
      [0.68, "#e8b48d"],
      [1, "#4b1e0d"],
    ],
    liner: "#180a05",
    vlak: ["#3a180c", "#241009", "#140704"],
    vlakMid: 0.6,
    glow: "rgba(255, 140, 66, 0.34)",
    sheen: "rgba(255, 190, 112, 0.27)",
    sheenStops: [
      [0.16, "rgba(255, 190, 112, 0)"],
      [0.32, "rgba(137, 48, 17, 0.05)"],
      [0.43, "rgba(255, 111, 35, 0.14)"],
      [0.5, "rgba(255, 190, 112, 0.27)"],
      [0.57, "rgba(255, 118, 38, 0.16)"],
      [0.68, "rgba(113, 35, 12, 0.05)"],
      [0.84, "rgba(255, 190, 112, 0)"],
    ],
    vignet: [
      [0.42, "rgba(22, 8, 3, 0)"],
      [1, "rgba(22, 8, 3, 0.52)"],
    ],
    echo: [
      [0.009, 0, "rgba(198, 104, 52, 0.6)"],
      [-0.009, 0, "rgba(198, 104, 52, 0.6)"],
      [0, 0.011, "rgba(122, 48, 20, 0.85)"],
    ],
    binnenlijn: [
      [1, "rgba(255, 176, 108, 0.55)"],
      [3, "rgba(22, 8, 4, 0.92)"],
      [4.5, "rgba(214, 122, 66, 0.34)"],
    ],
    motief: {
      paden: ONFIRE_WATERMARK,
      kleur: ONFIRE_WATERMARK_KLEUR,
      breedte: ONFIRE_WATERMARK_BREEDTE,
      positie: ONFIRE_WATERMARK_POSITIE,
    },
    ink: "#ffc98a",
    inkSoft: "#d1915b",
    lijn: "rgba(255, 160, 92, 0.45)",
    editieKleur: "#ffb35c",
    textuur: "groeven",
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
 *  FutKaart.css: alleen nog de spitse vleugels. GOAT en dictator stonden hier
 *  tot #710 ook bij; die hebben nu een eigen ::after (ijl satijn met medaillon,
 *  respectievelijk brokaat) — ook onder een editie-skin, want editie-blokken
 *  raken ::after niet aan. */
function premiumTier(key: TierKey | undefined): boolean {
  return key === "platina" || key === "diamant" || key === "meester";
}

/**
 * Alle kleuren van één kaart, in dezelfde cascade als FutKaart.css (#666):
 *
 * — de divisie levert de metaalladder (of, bij GOAT/dictator, het donkere
 *   special-register);
 * — een editie overschrijft dáárbovenop frame, liner, vlak en inkt — ook op een
 *   GOAT-kaart, want in de CSS staat het editie-blok ná het special-blok met
 *   gelijke specificiteit; sinds #710 brengt On Fire ook zijn eigen rand-,
 *   vignet-, textuur- en ornamentlagen mee;
 * — het ornament komt uit `kiesOrnament`: de editie wint van de tier (On Fire
 *   vervangt de bokhoorns door vlamvinnen), en een editie zonder eigen ornament
 *   laat dat van de tier staan;
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
        sheenStops: r.sheenStops,
        vignet: r.vignet,
        echo: r.echo,
        binnenlijn: r.binnenlijn,
        keyline: mix(r.lijn, "#fff8e8", 0.75),
        stralen,
        // Eigen ::after-textuur overleeft de editie (editie-blokken raken
        // ::after niet aan): het ijle GOAT-satijn en het dictator-brokaat
        // blijven staan. Pias, Piet en On Fire brengen hun eigen weefsel mee en
        // winnen wél — hun eigen ::after-regel staat ná het toptier-blok in de
        // CSS.
        textuur: r.textuur ?? (key === "dictator" ? "brokaat" : undefined),
        satijnAlpha: key === "legende" ? 0.035 : undefined,
        // Vastgelegd gedrag (#710): het mótief hoort bij het vlak-register, dus
        // een editie met een eigen watermerk (On Fire) zet dat neer en een
        // editie zonder láát het watermerk van de tier vallen — het
        // GOAT-medaillon zou op het In-Form-navy vloeken. Het ornament volgt de
        // andere regel: zie `kiesOrnament`. Spiegel van FutKaart.tsx.
        motief: r.motief,
        ornament: kiesOrnament(key, editie) ?? undefined,
      },
      ink: r.ink,
      inkSoft: r.inkSoft,
      lijn: r.lijn,
      editieKleur: r.editieKleur,
    };
  }

  // GOAT (#710): het monument — eigen rosé-frame met geborsteld metaal,
  // medaillon-motief, sterkere roze sheen, hoorns, echo en binnenlijnen.
  // Spiegel van het .fut-kaart--legende-blok in FutKaart.css.
  if (key === "legende") {
    const glans = GOAT_GLANS;
    return {
      kleuren: {
        frame: [
          [0, "#ffd3de"],
          [0.4, "#c25573"],
          [0.66, "#fff0f4"],
          [1, "#4a1526"],
        ],
        frameRibbels: true,
        liner: "#140609",
        vlak: [
          [0, "#3c1524"],
          [0.6, "#24101a"],
          [1, "#120a10"],
        ],
        glow: "rgba(247, 134, 159, 0.46)",
        // De CSS zet 0.28 over een bredere baan (36/50/64); op canvas loopt
        // de baan over een kortere as, dus dezelfde ~0,875-kalibratie als de
        // basis-sheen (0.32 → 0.28) en de spreiding van de shimmer-edities.
        sheen: "rgba(255, 187, 204, 0.245)",
        sheenSpreiding: 0.12,
        keyline: "#f2b7c5",
        // Geen stralenkrans: het medaillon ís de textuur (de CSS geeft
        // .fut-kaart--legende een eigen, ijler satijn).
        stralen: false,
        satijnAlpha: 0.035,
        echo: [[0.019, 0.024, "rgba(226, 133, 158, 0.75)"]],
        binnenlijn: [
          [1, "rgba(249, 163, 183, 0.5)"],
          [3.5, "rgba(20, 6, 9, 0.9)"],
          [4.5, "rgba(249, 163, 183, 0.28)"],
        ],
        motief: {
          paden: GOAT_MEDAILLON,
          kleur: GOAT_MEDAILLON_KLEUR,
          breedte: GOAT_MEDAILLON_BREEDTE,
          positie: GOAT_MEDAILLON_POSITIE,
        },
        ornament: "goat",
      },
      ink: mix(glans, "#ffffff", 0.8),
      inkSoft: mix(glans, "#b7a98c", 0.65),
      lijn: rgba(glans, 0.55),
      editieKleur: mix(glans, "#ffffff", 0.8),
    };
  }

  // El Padelissimo: het donkere TOTW-recept in goud op wijn. Tot #710 gedeeld
  // met de GOAT; de tinten staan nu vast op de troonwaarden van het lichte
  // thema, precies wat deze tabel altijd al tekende.
  if (key === "dictator") {
    return {
      kleuren: {
        frame: [
          [0, "#f6e6b4"],
          [0.34, "#a8802f"],
          [0.58, "#f2d98f"],
          [0.82, "#6b4d18"],
          [1, "#2e1f08"],
        ],
        liner: "#140409",
        vlak: [
          [0, "#7d1a33"],
          [0.58, "#4a0f1f"],
          [1, "#230812"],
        ],
        glow: "rgba(240, 199, 102, 0.34)",
        sheen: "rgba(250, 226, 160, 0.18)",
        keyline: "#d9b661",
        // Propaganda-zonnestraal i.p.v. de gedeelde ijl-witte krans: goud op
        // wijn, met de hoekmaten van de repeating-conic in de CSS (6°/16°).
        stralen: true,
        stralenKleur: "rgba(240, 199, 102, 0.1)",
        stralenStraal: 6,
        stralenPeriode: 16,
        textuur: "brokaat",
        echo: [
          [0.012, 0, "rgba(58, 10, 22, 0.9)"],
          [-0.012, 0, "rgba(58, 10, 22, 0.9)"],
          [0, 0.012, "rgba(58, 10, 22, 0.9)"],
        ],
        binnenlijn: [
          [1, "rgba(240, 209, 133, 0.85)"],
          [3, "rgba(24, 6, 12, 0.95)"],
          [4.5, "rgba(198, 158, 84, 0.6)"],
        ],
        motief: {
          paden: DICTATOR_WATERMARK,
          kleur: DICTATOR_WATERMARK_KLEUR,
          breedte: DICTATOR_WATERMARK_BREEDTE,
          positie: DICTATOR_WATERMARK_POSITIE,
        },
        ornament: "dictator",
      },
      ink: "#f2dda2",
      inkSoft: "#cdae6e",
      lijn: "rgba(226, 194, 122, 0.5)",
      editieKleur: "#f2dda2",
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
