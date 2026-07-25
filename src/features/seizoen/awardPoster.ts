// Gala-poster van de medaille-uitreiking (#713): één deelbare 1080×1350 met
// alle awards van een kwartaal, voor de groepsapp. Zelfde model als
// eveningPoster.ts: pure inhoud (awardPoster) + pure verticale verdeling
// (verdeelVerticaal, hergebruikt) met een dunne canvas-laag erboven, zodat
// álles behalve het tekenen zelf los testbaar is.
//
// Het aantal awards wisselt (1 t/m 8), dus de rijhoogte en de lucht ertussen
// volgen uit de échte resterende ruimte in plaats van uit een vaste y-klem.

import { canvasPalette, ellipsize, rrect, wrapLines } from "@/lib/utils/shareImage";
import { verdeelVerticaal, type Blok } from "@/features/groups/eveningPoster";
import type { Award } from "./awards";

export interface AwardPosterRij {
  emoji: string;
  titel: string;
  /** Naam van de laureaat. */
  naam: string;
  detail: string;
  /** De pias sluit de rij en krijgt een eigen (warme) tint. */
  schande: boolean;
}

export interface AwardPoster {
  groepsnaam: string;
  /** Bv. "☀️ Zomer 2026". */
  seizoen: string;
  rijen: AwardPosterRij[];
}

/**
 * Posterinhoud uit de awards; null zonder awards (dan valt de deelknop weg).
 * `naam` resolvet de laureaat — de awards-module houdt bewust alleen id's bij.
 */
export function awardPoster(opts: {
  groepsnaam: string;
  seizoen: string;
  awards: Award[];
  naam: (playerId: string) => string;
}): AwardPoster | null {
  if (opts.awards.length === 0) return null;
  return {
    groepsnaam: opts.groepsnaam,
    seizoen: opts.seizoen,
    rijen: opts.awards.map((a) => ({
      emoji: a.emoji,
      titel: a.titel,
      naam: opts.naam(a.playerId),
      detail: a.detail,
      schande: a.id === "pias",
    })),
  };
}

// ── Canvas-laag ──────────────────────────────────────────────────────────────

const W = 1080;
const H = 1350;
const M = 60;
const CW = W - 2 * M;

const HEADER_Y = 48;
const HEADER_H = 200;
const BODEM = H - 110;
/** Eerste y waar rijen mogen beginnen: onder de headerkaart. */
const TOP = HEADER_Y + HEADER_H + 24;
const MIN_GAP = 14;
const MAX_GAP = 34;

/** Boven- en ondergrens van een rij: hoger leest als een uitgerekt vlak, lager
 *  wordt te krap voor titel + naam + detail. */
const RIJ_MAX = 150;
const RIJ_MIN = 92;

/**
 * Rijhoogte uit de échte beschikbare ruimte (zelfde gedachte als
 * uitslagenPassing in eveningPoster): acht awards moeten passen zónder onder
 * `BODEM` door te lopen, en twee awards worden geen uitgerekte reuzen. Puur
 * rekenwerk, dus los testbaar.
 */
export function rijHoogte(aantal: number, top = TOP, bodem = BODEM): number {
  if (aantal <= 0) return 0;
  const ruimte = bodem - top - MIN_GAP * (aantal - 1);
  return Math.max(RIJ_MIN, Math.min(RIJ_MAX, Math.floor(ruimte / aantal)));
}

export function drawAwardPoster(
  ctx: CanvasRenderingContext2D,
  poster: AwardPoster,
) {
  const c = canvasPalette();

  // Achtergrond: gouden gloed linksboven — een uitreiking, geen speeldag.
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, W);
  glow.addColorStop(0, c.goldSoft);
  glow.addColorStop(1, c.bg);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Header: merk, seizoen, groep ──
  const hg = ctx.createLinearGradient(M, HEADER_Y, M + CW, HEADER_Y + HEADER_H);
  hg.addColorStop(0, c.gold);
  hg.addColorStop(1, c.hout);
  rrect(ctx, M, HEADER_Y, CW, HEADER_H, 34);
  ctx.fillStyle = hg;
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = c.lime;
  ctx.font = "800 46px Outfit, system-ui, sans-serif";
  ctx.fillText("Vamos!", W / 2, HEADER_Y + 74);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 44px Outfit, system-ui, sans-serif";
  ctx.fillText(ellipsize(ctx, `🏅 ${poster.seizoen}`, CW - 90), W / 2, HEADER_Y + 130);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 26px Outfit, system-ui, sans-serif";
  ctx.fillText(
    ellipsize(ctx, poster.groepsnaam, CW - 90),
    W / 2,
    HEADER_Y + 172,
  );

  // ── Rijen: meten, verdelen, tekenen ──
  const rijH = rijHoogte(poster.rijen.length);
  const blokken: Blok[] = poster.rijen.map(() => ({ h: rijH }));
  const ys = verdeelVerticaal(blokken, TOP, BODEM, MIN_GAP, MAX_GAP);

  poster.rijen.forEach((rij, i) => {
    const y = ys[i];
    rrect(ctx, M, y, CW, rijH, 24);
    ctx.fillStyle = rij.schande ? c.coachSoft : c.goldSoft;
    ctx.fill();
    ctx.strokeStyle = rij.schande ? c.coachLine : c.gold;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Emoji als medaille links.
    ctx.textAlign = "center";
    ctx.font = `${Math.round(rijH * 0.42)}px system-ui, sans-serif`;
    ctx.fillStyle = c.ink;
    ctx.fillText(rij.emoji, M + 66, y + rijH * 0.62);

    // Titel + laureaat + detail rechts van de medaille.
    const x = M + 130;
    const breedte = CW - 130 - 40;
    ctx.textAlign = "left";
    ctx.fillStyle = rij.schande ? c.coachInk : c.hout;
    ctx.font = "700 24px Outfit, system-ui, sans-serif";
    ctx.fillText(rij.titel.toUpperCase(), x, y + rijH * 0.29);

    ctx.fillStyle = c.ink;
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    ctx.fillText(ellipsize(ctx, rij.naam, breedte), x, y + rijH * 0.58);

    ctx.fillStyle = c.inkSoft;
    ctx.font = "600 24px Outfit, system-ui, sans-serif";
    // Eén regel: het detail is kort gehouden in awards.ts, en een tweede regel
    // zou bij acht awards de rij uit z'n hoogte duwen.
    const detail = wrapLines(ctx, rij.detail, breedte, 1)[0] ?? "";
    ctx.fillText(detail, x, y + rijH * 0.83);
  });

  // Voet: lime accentstreep, zoals de andere posters.
  ctx.textAlign = "center";
  ctx.fillStyle = c.lime;
  ctx.fillRect(W / 2 - 80, H - 70, 160, 10);
}
