// Speeldagposter (#675), 1080×1350: de opstelling van de avond als deelbare
// afbeelding — groepsnaam, moment, club en de FUT-kaarten van de bevestigde
// deelnemers. Zelfde model als eveningPoster.ts: pure inhoud (speeldagPoster)
// en pure opbouw (kaartRaster) met drawSpeeldagPoster als dunne canvas-laag
// erboven, zodat álles behalve het tekenen zelf los testbaar is.
//
// De kaarten komen van `drawKaart` uit profielPoster.ts — dezelfde tekening
// als de persoonlijke deel-poster, inclusief de editie-skins (#666). Geen
// tweede kaartrecept dus, en geen kans om die fout opnieuw te maken.

import { canvasPalette, ellipsize, rrect, wrapLines } from "@/lib/utils/shareImage";
import { drawKaart, type KaartData } from "@/features/profiles/profielPoster";

export const POSTER_W = 1080;
export const POSTER_H = 1350;

/** Hoogte/breedte van één FUT-kaart, zoals drawKaart die aanhoudt. */
export const KAART_RATIO = 1.39;

/**
 * Meer kaarten dan dit worden onleesbaar klein op een 1080px-poster: acht
 * kaarten (4×2) zitten al op ~225px breed. Daarboven tonen we de acht hoogst
 * geratete kaarten en noemen we de rest bij naam (#675) — liever een leesbare
 * poster met een namenregel dan twaalf postzegels.
 */
export const MAX_KAARTEN = 8;

export interface SpeeldagPoster {
  groepsnaam: string;
  /** Bv. "vrijdag 10 januari · 20:00". */
  moment: string;
  /** Bv. "LAGO CLUB Padel Beveren · 90 min". */
  club: string;
  /** De kaarten die getekend worden: hoogste rating eerst, max MAX_KAARTEN. */
  kaarten: KaartData[];
  /** "…en 4 anderen: X, Y, Z, W" voor wie buiten het raster viel; anders null. */
  extraNamen: string | null;
  /** Toegangscode — alleen gevuld als de gebruiker daar expliciet voor koos. */
  code: string | null;
}

export interface SpeeldagPosterOpts {
  groepsnaam: string;
  moment: string;
  club: string;
  /** Alle bevestigde (ja-stemmende) deelnemers. */
  spelers: KaartData[];
  /**
   * Toegangscode op de afbeelding. Standaard níét: een poster belandt in
   * WhatsApp, wordt doorgestuurd en blijft in fotorollen staan (#675). Alleen
   * vullen als de gebruiker de opt-in aanzette.
   */
  code?: string | null;
}

/** Hoogste rating eerst; spelers zonder rating achteraan, dan op naam — zodat
 *  dezelfde ploeg altijd dezelfde poster oplevert. */
function opSterkte(a: KaartData, b: KaartData): number {
  if (a.rating != null && b.rating != null && a.rating !== b.rating) {
    return b.rating - a.rating;
  }
  if ((a.rating == null) !== (b.rating == null)) return a.rating == null ? 1 : -1;
  return a.name.localeCompare(b.name, "nl-BE");
}

/** Posterinhoud uit de opstelling van de avond. */
export function speeldagPoster(opts: SpeeldagPosterOpts): SpeeldagPoster {
  const gesorteerd = [...opts.spelers].sort(opSterkte);
  const kaarten = gesorteerd.slice(0, MAX_KAARTEN);
  const rest = gesorteerd.slice(MAX_KAARTEN);
  return {
    groepsnaam: opts.groepsnaam,
    moment: opts.moment,
    club: opts.club,
    kaarten,
    extraNamen:
      rest.length > 0
        ? `…en ${rest.length} ${rest.length === 1 ? "ander" : "anderen"}: ${rest
            .map((s) => s.name)
            .join(", ")}`
        : null,
    code: opts.code?.trim() ? opts.code.trim() : null,
  };
}

export interface Raster {
  kolommen: number;
  rijen: number;
  kaartBreedte: number;
}

/**
 * Hoe de kaarten in de beschikbare ruimte passen. De kolomkeuze houdt de
 * kaarten zo groot mogelijk (2 kolommen tot vier spelers, dan 3, dan 4), en de
 * breedte volgt uit de krapste van de twee grenzen — breedte én hoogte. Zonder
 * die tweede grens vallen 8 kaarten in 2×4 buiten de poster.
 */
export function kaartRaster(
  aantal: number,
  ruimte: { breedte: number; hoogte: number; gap: number },
): Raster {
  const kolommen = aantal <= 2 ? Math.max(1, aantal) : aantal <= 4 ? 2 : aantal <= 6 ? 3 : 4;
  const rijen = Math.ceil(aantal / kolommen);
  const perBreedte = (ruimte.breedte - ruimte.gap * (kolommen - 1)) / kolommen;
  const perHoogte =
    (ruimte.hoogte - ruimte.gap * (rijen - 1)) / rijen / KAART_RATIO;
  return { kolommen, rijen, kaartBreedte: Math.min(perBreedte, perHoogte) };
}

/* ------------------------------ tekenlaag ------------------------------ */

const M = 56;
const CW = POSTER_W - M * 2;
const HEADER_Y = 48;
const HEADER_H = 232;
const BODEM = POSTER_H - 52;
const GAP = 22;

const FONT_EXTRA = "600 26px Outfit, system-ui, sans-serif";
const EXTRA_LH = 34;

/** De hele poster: court-gloed, header met moment en club, het kaartraster en
 *  onderaan de namenregel en (alleen op verzoek) de toegangscode. */
export function drawSpeeldagPoster(
  ctx: CanvasRenderingContext2D,
  poster: SpeeldagPoster,
  avatars: (HTMLImageElement | null)[],
) {
  const c = canvasPalette();

  // Achtergrond met zachte accentgloed rechtsboven — zoals de avondposter.
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  const glow = ctx.createRadialGradient(POSTER_W, 0, 0, POSTER_W, 0, POSTER_W * 0.9);
  glow.addColorStop(0, c.accentSoft);
  glow.addColorStop(1, c.bg);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  // ── Header-kaart (accent → success verloop) ──
  const hg = ctx.createLinearGradient(M, HEADER_Y, M + CW, HEADER_Y + HEADER_H);
  hg.addColorStop(0, c.accent);
  hg.addColorStop(1, c.success);
  rrect(ctx, M, HEADER_Y, CW, HEADER_H, 34);
  ctx.fillStyle = hg;
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = c.lime;
  ctx.font = "800 46px Outfit, system-ui, sans-serif";
  ctx.fillText("Vamos!", POSTER_W / 2, HEADER_Y + 72);

  // Groepsnaam: één regel groot, twee regels kleiner, zodat een lange naam de
  // header niet uit elkaar duwt (zelfde ruil als eveningPoster).
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 38px Outfit, system-ui, sans-serif";
  let naamRegels = wrapLines(ctx, poster.groepsnaam, CW - 90, 2);
  if (naamRegels.length > 1) {
    ctx.font = "800 30px Outfit, system-ui, sans-serif";
    naamRegels = wrapLines(ctx, poster.groepsnaam, CW - 90, 2);
  }
  const naamY = HEADER_Y + (naamRegels.length === 1 ? 124 : 114);
  naamRegels.forEach((regel, i) => {
    ctx.fillText(regel, POSTER_W / 2, naamY + i * 34);
  });

  const onderY = HEADER_Y + (naamRegels.length === 1 ? 172 : 182);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "700 28px Outfit, system-ui, sans-serif";
  ctx.fillText(ellipsize(ctx, poster.moment, CW - 90), POSTER_W / 2, onderY);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "600 23px Outfit, system-ui, sans-serif";
  ctx.fillText(ellipsize(ctx, poster.club, CW - 90), POSTER_W / 2, onderY + 34);

  // ── Voetblokken meten (die claimen hun ruimte vóór het raster) ──
  ctx.font = FONT_EXTRA;
  const extraRegels = poster.extraNamen
    ? wrapLines(ctx, poster.extraNamen, CW, 2)
    : [];
  const extraH = extraRegels.length > 0 ? extraRegels.length * EXTRA_LH + 16 : 0;
  const codeH = poster.code ? 78 : 0;

  // ── Kaartraster in de ruimte die overblijft ──
  const rasterTop = HEADER_Y + HEADER_H + 40;
  const rasterH = BODEM - rasterTop - extraH - codeH;
  const { kolommen, rijen, kaartBreedte } = kaartRaster(poster.kaarten.length, {
    breedte: CW,
    hoogte: rasterH,
    gap: GAP,
  });
  const kaartHoogte = kaartBreedte * KAART_RATIO;
  // Verticaal centreren in de toegewezen ruimte: bij minder rijen dan het
  // maximum blijft het blok optisch in het midden staan i.p.v. bovenaan te
  // plakken.
  const gebruiktH = rijen * kaartHoogte + (rijen - 1) * GAP;
  const startY = rasterTop + Math.max(0, (rasterH - gebruiktH) / 2);

  poster.kaarten.forEach((kaart, i) => {
    const kol = i % kolommen;
    const rij = Math.floor(i / kolommen);
    // Laatste rij centreren als die niet vol is (5 van 6, 7 van 8).
    const inRij = Math.min(kolommen, poster.kaarten.length - rij * kolommen);
    const rijBreedte = inRij * kaartBreedte + (inRij - 1) * GAP;
    const rijX = (POSTER_W - rijBreedte) / 2;
    drawKaart(
      ctx,
      kaart,
      avatars[i] ?? null,
      rijX + kol * (kaartBreedte + GAP),
      startY + rij * (kaartHoogte + GAP),
      kaartBreedte,
    );
  });

  // ── Voet: wie er niet op paste, en desgevraagd de code ──
  let y = BODEM - extraH - codeH + 34;
  if (extraRegels.length > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = c.inkSoft;
    ctx.font = FONT_EXTRA;
    extraRegels.forEach((regel, i) => {
      ctx.fillText(regel, POSTER_W / 2, y + i * EXTRA_LH);
    });
    y += extraRegels.length * EXTRA_LH + 16;
  }
  if (poster.code) {
    rrect(ctx, M + CW / 2 - 220, y - 6, 440, 58, 18);
    ctx.fillStyle = c.successSoft;
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = c.ink;
    ctx.font = "800 30px Outfit, system-ui, sans-serif";
    ctx.fillText(
      ellipsize(ctx, `🔑 Code: ${poster.code}`, 400),
      POSTER_W / 2,
      y + 34,
    );
  }
}
