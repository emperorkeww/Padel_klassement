// Avondposter (#421), 1080×1350: pure inhoud (eveningPoster) + pure verticale
// opbouw (verdeelVerticaal, uitslagenPassing) met drawEveningPoster als dunne
// canvas-laag erboven — zelfde model als wrappedPoster.ts. De tekenlaag meet de
// tekst en vraagt de verdeling hier op, zodat álles behalve het tekenen zelf
// los testbaar is.
//
// Coach Rudy staat als geattribueerde quote op de poster en is meteen de
// blikvanger: hij hergebruikt coachAvond() met dezelfde seed als de feed, dus de
// groepschat leest exact wat de app al zei.

import { canvasPalette, ellipsize, rrect, wrapLines } from "@/lib/utils/shareImage";
import { drawKaart, type KaartData } from "@/features/profiles/profielPoster";
import type { GeladenMaster } from "@/features/rating/components/kaartMasters";
import type { GeladenOnderdelen } from "@/features/rating/components/layouts/divisieKaartCanvas";
import { coachAvond, type AvondCtx } from "@/features/feed/coachEvening";
import { COMMENTATOR } from "@/features/coach/roastTone";
import type { EveningSummary } from "@/features/feed/eveningSummary";

export interface EveningPoster {
  /** Groepsnaam in de header. */
  groepsnaam: string;
  /** Bv. "vrijdag 17 juli". */
  datum: string;
  /** Rudy's quote (blikvanger), of null als er niets te melden valt. */
  coachQuote: string | null;
  /** De winnaar van de avond als FUT-kaart (#895), naast de avondstand. Null
   *  wanneer de caller geen kaart kon samenstellen — dan blijft de stand op de
   *  volle breedte staan, precies zoals vóór #895. */
  winnaar: KaartData | null;
  /** Avondstand-top-3. */
  podium: { plaats: number; naam: string; punten: number }[];
  /** "Ook gespeeld: …" voor de spelers buiten de top 3, of null. */
  ookGespeeld: string | null;
  /** Uitslagen als kant-en-klare regels, in speelvolgorde. */
  uitslagen: string[];
  /** "🏆 Beste duo: … · 3 winsten", of null. */
  bestDuo: string | null;
}

export interface EveningPosterOpts {
  groepsnaam: string;
  datum: string;
  /** Spelernaam-resolver. */
  naam: (playerId: string) => string;
  /** Teamnaam-resolver. */
  duo: (teamId: string) => string;
  /** Rudy's quote; stel samen met eveningCoachQuote(). */
  coachQuote: string | null;
  /** Kaart-resolver voor de winnaar (#895). De editie hangt aan het
   *  klassement, niet aan de avond, dus die context komt van de caller —
   *  hetzelfde `vsKaartVoor`-recept als de speeldagposter. Weglaten (of null
   *  teruggeven) laat de kaart weg. */
  kaart?: (playerId: string) => KaartData | null;
}

/**
 * Coach Rudy's avondverslag als geattribueerde quote voor op de poster, in het
 * formaat van piasCoachQuote (#202). Null als er niets te melden valt. Seed
 * `groupId|dag` — gelijk aan de feed, dus poster en app tonen hetzelfde verslag.
 * Het roast-schild van de afgang wordt binnen coachAvond al gerespecteerd (de
 * sneer valt weg, het feit blijft).
 */
export function eveningCoachQuote(
  summary: EveningSummary,
  seedKey: string,
  ctx: AvondCtx,
): string | null {
  const lijnen = coachAvond(summary, seedKey, ctx);
  if (lijnen.length === 0) return null;
  return `${COMMENTATOR.emoji} ${COMMENTATOR.naam}: “${lijnen.join(" ")}”`;
}

/** Datumbijschrift voor een clubdag (YYYY-MM-DD), bv. "vrijdag 17 juli". */
export function avondDatumLabel(dag: string): string {
  return new Date(`${dag}T12:00:00`).toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Posterinhoud uit de avondsamenvatting. */
export function eveningPoster(
  summary: EveningSummary,
  opts: EveningPosterOpts,
): EveningPoster {
  const rest = summary.rows.slice(3);
  const winnaarId = summary.rows[0]?.playerId;
  return {
    groepsnaam: opts.groepsnaam,
    datum: opts.datum,
    coachQuote: opts.coachQuote,
    winnaar: (winnaarId && opts.kaart?.(winnaarId)) || null,
    podium: summary.rows.slice(0, 3).map((r, i) => ({
      plaats: i + 1,
      naam: opts.naam(r.playerId),
      punten: r.points,
    })),
    ookGespeeld:
      rest.length > 0
        ? `Ook gespeeld: ${rest.map((r) => opts.naam(r.playerId)).join(", ")}`
        : null,
    uitslagen: summary.matches.map(
      (m) =>
        `${opts.duo(m.team_a_id)}   ${m.score_a ?? "–"} – ${m.score_b ?? "–"}   ${opts.duo(m.team_b_id)}`,
    ),
    bestDuo: summary.bestDuo
      ? `🏆 Beste duo: ${opts.duo(summary.bestDuo.teamId)} · ${summary.bestDuo.won} winst${summary.bestDuo.won === 1 ? "" : "en"}`
      : null,
  };
}

/**
 * Hoeveel uitslag-rijen er in `ruimte` passen. Past alles, dan tonen we alles;
 * anders reserveren we `restH` voor de "+ N meer"-regel. Zo blijft het aantal
 * getoonde uitslagen een gevolg van de échte resterende ruimte i.p.v. van een
 * vaste y-klem (#421).
 */
export function uitslagenPassing(
  totaal: number,
  ruimte: number,
  rijH: number,
  restH: number,
): { toon: number; rest: number } {
  const past = Math.max(0, Math.floor(ruimte / rijH));
  if (totaal <= past) return { toon: totaal, rest: 0 };
  const toon = Math.max(0, Math.floor((ruimte - restH) / rijH));
  return { toon, rest: totaal - toon };
}

export interface Blok {
  /** Gemeten hoogte van het blok. */
  h: number;
  /** Aandeel in de restruimte van de gap ná dit blok (0 = strak eronder). */
  groei?: number;
}

/**
 * Verdeelt blokken verticaal tussen `top` en `bodem`. Elk blok krijgt minstens
 * `minGap` lucht; wat overblijft gaat naar `groei`-gewicht, tot maximaal
 * `maxGap`. Blijft er dán nog ruimte over (een avond met twee spelers en één
 * match), dan wordt de hele stapel gecentreerd i.p.v. de gaps op te rekken:
 * uitgerekte gaps lezen als dode gaten, gelijke lucht boven en onder leest als
 * compositie. Geeft de y-top per blok. Bij te veel inhoud vallen de gaps terug
 * op `minGap` en loopt de stapel door onder `bodem`; de tekenlaag hoort dat te
 * voorkomen door eerst uitslagenPassing() te vragen.
 */
export function verdeelVerticaal(
  blokken: Blok[],
  top: number,
  bodem: number,
  minGap: number,
  maxGap = Number.POSITIVE_INFINITY,
): number[] {
  if (blokken.length === 0) return [];
  const inhoud = blokken.reduce((s, b) => s + b.h, 0);
  const n = blokken.length - 1; // aantal gaps
  const vrij = bodem - top - inhoud;
  const extra = Math.max(0, vrij - minGap * n);
  const totaalGroei = blokken.slice(0, n).reduce((s, b) => s + (b.groei ?? 1), 0);

  const gaps = blokken
    .slice(0, n)
    .map((b) =>
      Math.min(
        maxGap,
        minGap + (totaalGroei > 0 ? (extra * (b.groei ?? 1)) / totaalGroei : 0),
      ),
    );
  const rest = vrij - gaps.reduce((s, g) => s + g, 0);

  const ys: number[] = [];
  let y = top + Math.max(0, rest) / 2; // centreer wat na maxGap overblijft
  blokken.forEach((b, i) => {
    ys.push(y);
    y += b.h + (gaps[i] ?? 0);
  });
  return ys;
}

// ── Canvas-laag ──────────────────────────────────────────────────────────────

const W = 1080;
const H = 1350;
const M = 60; // zijmarge
const CW = W - 2 * M; // inhoudsbreedte

const HEADER_Y = 48;
const HEADER_H = 208;
/** Onderrand voor de inhoud: boven de lime merkstreep op H-62. */
const BODEM = H - 86;
const MIN_GAP = 24;
/** Boven deze gap gaat rekken lezen als een dood gat; dan liever centreren. */
const MAX_GAP = 96;

const LABEL_H = 46; // sectielabel + lucht eronder
const RIJ_H = 76; // podiumrij
const RIJ_GAP = 12;
const UITSLAG_H = 46; // uitslagrij incl. tussenruimte
const REST_H = 36; // "+ N meer"-regel
const QUOTE_LH = 42; // regelhoogte van Rudy's quote
const QUOTE_PAD = 30;
/** Rudy is de blikvanger, maar mag de uitslagen niet helemaal verdringen. */
const QUOTE_MAX_REGELS = 4;
const OOK_LH = 32;
/** Breedte van de winnaarskaart (#895). Groter dan dit duwt de podiumrijen zo
 *  smal dat namen gaan afkappen; kleiner en de kaart leest als een sticker
 *  i.p.v. als de trofee van de avond. */
const KAART_W = 250;
/** Lucht tussen de podiumrijen en de kaart. */
const KAART_GAP = 26;
const KAART_H = KAART_W * 1.39;

const FONT_QUOTE = "italic 500 32px Outfit, system-ui, sans-serif";
const FONT_OOK = "600 24px Outfit, system-ui, sans-serif";

/** Tekent gecentreerde regels, met `y` als basislijn van de eerste. */
function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
) {
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

/** Sectielabel met lime streepje, links uitgelijnd; `y` = top van het blok. */
function sectionLabel(ctx: CanvasRenderingContext2D, text: string, y: number) {
  const c = canvasPalette();
  ctx.fillStyle = c.lime;
  rrect(ctx, M, y, 8, 26, 4);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = c.inkSoft;
  ctx.font = "700 25px Outfit, system-ui, sans-serif";
  ctx.fillText(text.toUpperCase(), M + 24, y + 21);
}

/** Dunne canvas-render van de avondposter. */
export function drawEveningPoster(
  ctx: CanvasRenderingContext2D,
  poster: EveningPoster,
  /** Profielfoto van de winnaar; vooraf geladen, zoals bij de andere posters. */
  winnaarAvatar: HTMLImageElement | null = null,
  /** Rastermaster van de winnaarskaart (#895), of null. */
  winnaarMaster: GeladenMaster | null = null,
  /** Artwork van zijn divisielayout (#895), voor de twee divisies die er een
   *  hebben. */
  winnaarOnderdelen: GeladenOnderdelen | null = null,
) {
  const c = canvasPalette();

  // Achtergrond met zachte accentgloed rechtsboven.
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, W * 0.9);
  glow.addColorStop(0, c.accentSoft);
  glow.addColorStop(1, c.bg);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Header-kaart (accent → success verloop) ──
  const hg = ctx.createLinearGradient(M, HEADER_Y, M + CW, HEADER_Y + HEADER_H);
  hg.addColorStop(0, c.accent);
  hg.addColorStop(1, c.success);
  rrect(ctx, M, HEADER_Y, CW, HEADER_H, 34);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = c.lime;
  ctx.font = "800 50px Outfit, system-ui, sans-serif";
  ctx.fillText("Vamos!", W / 2, HEADER_Y + 80);
  // Groepsnaam: één regel groot, twee regels kleiner — zo botst een lange naam
  // niet tegen "Vamos!" of de datum, en blijft de header één vast blok.
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 40px Outfit, system-ui, sans-serif";
  let naamRegels = wrapLines(ctx, poster.groepsnaam, CW - 90, 2);
  if (naamRegels.length > 1) {
    ctx.font = "800 32px Outfit, system-ui, sans-serif";
    naamRegels = wrapLines(ctx, poster.groepsnaam, CW - 90, 2);
  }
  drawLines(ctx, naamRegels, W / 2, HEADER_Y + (naamRegels.length === 1 ? 135 : 124), 36);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 25px Outfit, system-ui, sans-serif";
  ctx.fillText(poster.datum, W / 2, HEADER_Y + (naamRegels.length === 1 ? 182 : 192));

  // ── Blokhoogtes meten, dan pas verdelen ──
  ctx.font = FONT_QUOTE;
  const quoteRegels = poster.coachQuote
    ? wrapLines(ctx, poster.coachQuote, CW - 80, QUOTE_MAX_REGELS)
    : [];
  const coachH =
    quoteRegels.length > 0 ? QUOTE_PAD * 2 + quoteRegels.length * QUOTE_LH : 0;

  ctx.font = FONT_OOK;
  const ookRegels = poster.ookGespeeld
    ? wrapLines(ctx, poster.ookGespeeld, CW, 2)
    : [];
  const podiumH =
    poster.podium.length * RIJ_H + Math.max(0, poster.podium.length - 1) * RIJ_GAP;
  // De kaart staat naast de podiumrijen (#895) en is doorgaans hoger dan drie
  // rijen; het blok groeit dus tot de hoogste van de twee kolommen.
  const kolomH = poster.winnaar ? Math.max(podiumH, KAART_H) : podiumH;
  const standH =
    LABEL_H + kolomH + (ookRegels.length > 0 ? 18 + ookRegels.length * OOK_LH : 0);
  // Breedte van één podiumrij: de volle inhoudsbreedte, of wat er naast de
  // kaart overblijft.
  const rijW = poster.winnaar ? CW - KAART_W - KAART_GAP : CW;

  const duoH = poster.bestDuo ? 82 : 0;

  // Uitslagen krijgen de ruimte die écht overblijft — geen vaste y-klem.
  const blokken: Blok[] = [];
  if (coachH > 0) blokken.push({ h: coachH, groei: 1.3 });
  blokken.push({ h: standH, groei: 1 });
  const uitslagIndex = blokken.length;
  blokken.push({ h: 0, groei: 1.2 }); // hoogte volgt hieronder
  if (duoH > 0) blokken.push({ h: duoH });

  const vast = coachH + standH + duoH;
  const ruimte =
    BODEM - (HEADER_Y + HEADER_H) - vast - MIN_GAP * (blokken.length - 1) - LABEL_H;
  const { toon, rest } = uitslagenPassing(
    poster.uitslagen.length,
    ruimte,
    UITSLAG_H,
    REST_H,
  );
  blokken[uitslagIndex].h = LABEL_H + toon * UITSLAG_H + (rest > 0 ? REST_H : 0);

  const ys = verdeelVerticaal(blokken, HEADER_Y + HEADER_H, BODEM, MIN_GAP, MAX_GAP);
  let i = 0;

  // ── Coach Rudy's quote: de blikvanger, in zijn eigen amber ──
  if (coachH > 0) {
    const cy = ys[i++];
    rrect(ctx, M, cy, CW, coachH, 24);
    ctx.fillStyle = c.coachSoft;
    ctx.fill();
    ctx.strokeStyle = c.coachLine;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = c.coachInk;
    ctx.font = FONT_QUOTE;
    drawLines(ctx, quoteRegels, W / 2, cy + QUOTE_PAD + 30, QUOTE_LH);
  }

  // ── Avondstand: top 3 als podiumrijen ──
  const sy = ys[i++];
  sectionLabel(ctx, "Avondstand", sy);
  const medaille = [c.gold, c.silver, c.bronze];
  // De rijen staan optisch gecentreerd naast de kaart wanneer die hoger is —
  // drie rijen die bovenaan blijven plakken lezen als een gat onder de stand.
  const rijTop = sy + LABEL_H + Math.max(0, (kolomH - podiumH) / 2);
  poster.podium.forEach((row, n) => {
    const ry = rijTop + n * (RIJ_H + RIJ_GAP);
    rrect(ctx, M, ry, rijW, RIJ_H, 20);
    ctx.fillStyle = n === 0 ? c.goldSoft : c.zebra;
    ctx.fill();
    // Medaille-cirkel met rangnummer.
    const mx = M + 46;
    const my = ry + RIJ_H / 2;
    ctx.beginPath();
    ctx.arc(mx, my, 27, 0, Math.PI * 2);
    ctx.fillStyle = medaille[n];
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 30px Outfit, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(row.plaats), mx, my + 11);
    // Punten-pil rechts in de rij.
    const pw = 150;
    const px = M + rijW - pw - 16;
    rrect(ctx, px, my - 22, pw, 44, 22);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.fillStyle = c.accent;
    ctx.font = "800 27px Outfit, system-ui, sans-serif";
    ctx.fillText(`${row.punten} ptn`, px + pw / 2, my + 10);
    // Naam — afkappen met ellipsis i.p.v. de letters samen te persen.
    ctx.textAlign = "left";
    ctx.fillStyle = c.ink;
    ctx.font = "800 34px Outfit, system-ui, sans-serif";
    ctx.fillText(ellipsize(ctx, row.naam, px - (M + 92) - 24), M + 92, my + 12);
  });

  // ── De winnaar als FUT-kaart, rechts naast de stand (#895) ──
  // Zelfde tekening als de profiel- en speeldagposter, dus inclusief het
  // rastermaster van zijn editie of divisie. Ná de rijen: een breakout die
  // buiten het schild valt hoort over de rij ernaast te lopen, niet eronder —
  // net als in de app.
  if (poster.winnaar) {
    const kx = M + CW - KAART_W;
    const ky = sy + LABEL_H + Math.max(0, (kolomH - KAART_H) / 2);
    drawKaart(
      ctx,
      poster.winnaar,
      winnaarAvatar,
      kx,
      ky,
      KAART_W,
      winnaarMaster,
      winnaarOnderdelen,
    );
  }

  if (ookRegels.length > 0) {
    ctx.textAlign = "left";
    ctx.fillStyle = c.inkSoft;
    ctx.font = FONT_OOK;
    drawLines(ctx, ookRegels, M, sy + LABEL_H + kolomH + 18 + 22, OOK_LH);
  }

  // ── Uitslagen als gestreepte rijen ──
  const uy = ys[i++];
  sectionLabel(ctx, "Uitslagen", uy);
  poster.uitslagen.slice(0, toon).forEach((regel, n) => {
    const ry = uy + LABEL_H + n * UITSLAG_H;
    rrect(ctx, M, ry, CW, UITSLAG_H - 8, 12);
    ctx.fillStyle = n % 2 === 0 ? c.zebra : c.bg;
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = c.ink;
    ctx.font = "600 26px Outfit, system-ui, sans-serif";
    ctx.fillText(ellipsize(ctx, regel, CW - 40), W / 2, ry + (UITSLAG_H - 8) / 2 + 9);
  });
  if (rest > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = c.inkSoft;
    ctx.font = FONT_OOK;
    ctx.fillText(`+ ${rest} meer`, W / 2, uy + LABEL_H + toon * UITSLAG_H + 26);
  }

  // ── Beste duo — uitgelichte kaart onderaan ──
  if (poster.bestDuo) {
    const dy = ys[i];
    rrect(ctx, M, dy, CW, duoH, 20);
    ctx.fillStyle = c.successSoft;
    ctx.fill();
    ctx.fillStyle = c.success;
    ctx.font = "700 30px Outfit, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ellipsize(ctx, poster.bestDuo, CW - 60), W / 2, dy + 51);
  }

  // ── Footer: lime merkstreep ──
  ctx.fillStyle = c.lime;
  rrect(ctx, W / 2 - 70, H - 62, 140, 10, 5);
  ctx.fill();
}
