// Gedeelde canvas-tekening van de FUT-schildkaart (DOM-versie in
// FutKaart.css, #495/#496) voor deel-posters: kleurmix, schildpaden per
// divisiegroep, en de laag-opbouw frame → liner → geclipt vlak
// (metaal/special-diepte + topgloed + sheen). Geëxtraheerd uit
// ShareProfile.tsx (#496) zodat een tweede canvas-consument (Wrapped-
// seizoenskaart, #498) dezelfde schildwiskunde hergebruikt in plaats van
// een derde kopie te tekenen. Puur tekenwerk — geen state, geen
// afhankelijkheid van React of Supabase.

import type { TierKey } from "@/features/rating/tiers";

export type SchildVorm = "vlak" | "notch" | "punt" | "kroon";

/** Bovenrand per divisiegroep — zelfde mapping als FutKaart.css. */
export function schildVorm(key: TierKey | undefined): SchildVorm {
  if (key === "slof" || key === "karton" || key === "hout") return "vlak";
  if (key === "platina" || key === "diamant" || key === "meester")
    return "punt";
  if (key === "legende" || key === "dictator") return "kroon";
  return "notch";
}

/** color-mix(in srgb, a p, b 1-p) voor hexkleuren, zoals de CSS van FutKaart. */
export function mix(a: string, b: string, p: number): string {
  const va = parseInt(a.slice(1), 16);
  const vb = parseInt(b.slice(1), 16);
  const kanaal = (shift: number) =>
    Math.round(((va >> shift) & 0xff) * p + ((vb >> shift) & 0xff) * (1 - p));
  return `rgb(${kanaal(16)}, ${kanaal(8)}, ${kanaal(0)})`;
}

export function rgba(hex: string, alpha: number): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 0xff}, ${(v >> 8) & 0xff}, ${v & 0xff}, ${alpha})`;
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

/** Resolved themakleuren voor één laag-opbouw. De offsets die niet per
 *  thema wisselen (frame op 0/0.42/0.68/1, glow op 0/1, sheen op
 *  0.42/0.5/0.58) liggen vast in `drawKaartSchild`; hier alleen de kleuren
 *  (en `vlakMidOffset`, de ene vlak-offset die wél wisselt tussen normale
 *  en special-toptier-kaarten: 0.56 vs 0.6). */
export interface FutKaartKleuren {
  /** Metaalgradient van het frame, stops op 0/0.42/0.68/1. */
  frame: [string, string, string, string];
  liner: string;
  /** Vlakgradient, stops op 0/vlakMidOffset/1. */
  vlak: [string, string, string];
  vlakMidOffset: number;
  /** Topgloed-kleur op offset 0 (offset 1 is altijd transparant wit). */
  glow: string;
  /** Sheen-kleur op offset 0.5 (0.42/0.58 zijn altijd transparant wit). */
  sheen: string;
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
  // Frame (metaal-gradient met twee glanspunten, ~160°).
  const frame = ctx.createLinearGradient(x, y, x + w * 0.34, y + h * 0.94);
  frame.addColorStop(0, kleuren.frame[0]);
  frame.addColorStop(0.42, kleuren.frame[1]);
  frame.addColorStop(0.68, kleuren.frame[2]);
  frame.addColorStop(1, kleuren.frame[3]);
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  schildPad(ctx, x, y, w, h, vorm);
  ctx.fillStyle = frame;
  ctx.fill();
  ctx.restore();

  // Liner (donkere binnenrand).
  schildPad(ctx, x + 6, y + 6, w - 12, h - 12, vorm);
  ctx.fillStyle = kleuren.liner;
  ctx.fill();

  // Vlak, geclipt: metaal (of special-diepte) + topglans + sheen.
  const fx = x + 9;
  const fy = y + 9;
  const fw = w - 18;
  const fh = h - 18;
  ctx.save();
  schildPad(ctx, fx, fy, fw, fh, vorm);
  ctx.clip();
  const vlak = ctx.createLinearGradient(0, fy, 0, fy + fh);
  vlak.addColorStop(0, kleuren.vlak[0]);
  vlak.addColorStop(kleuren.vlakMidOffset, kleuren.vlak[1]);
  vlak.addColorStop(1, kleuren.vlak[2]);
  ctx.fillStyle = vlak;
  ctx.fillRect(fx, fy, fw, fh);
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
  sheen.addColorStop(0.42, "rgba(255, 255, 255, 0)");
  sheen.addColorStop(0.5, kleuren.sheen);
  sheen.addColorStop(0.58, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(fx, fy, fw, fh);

  return { fx, fy, fw, fh };
}
