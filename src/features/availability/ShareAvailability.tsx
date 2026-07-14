import { useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { canvasPalette, sharePng, wrapCentered } from "@/lib/utils/shareImage";
import { shareOrCopyText } from "@/lib/utils/shareText";
import { dateInZone, minutesNowInZone } from "@/lib/utils/time";
import { bookingUrl, slotShareUrl, type DayAvailability, type WeekDay } from "./api";
import type { Club } from "./club";
import {
  dayShareText,
  freeStartTimes,
  weekHeatmap,
  weekShareText,
  type FreeStart,
  type WeekHeatmap,
} from "./availabilityShare";

// Exporteert de baanbeschikbaarheid van een dag of week naar de vriendengroep:
// als nette tekst (deelvenster/klembord) of als poster (PNG). De poster hergebruikt
// de canvas-infra van ShareEvening (sharePng + canvasPalette + wrapCentered).

const W = 1080;
const H = 1350;
const M = 64;
const CW = W - 2 * M;

type Props =
  | { mode: "dag"; data: DayAvailability; date: string; duration: number | null; club: Club }
  | { mode: "week"; week: WeekDay[]; date: string; duration: number | null; club: Club };

// 's Middags formatteren zodat DST de datum niet kantelt (zoals availabilityShare).
function fmtDate(date: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("nl-BE", opts).format(new Date(`${date}T12:00:00`));
}
const longDay = (date: string) =>
  fmtDate(date, { weekday: "long", day: "numeric", month: "long" });
const shortDay = (date: string) =>
  fmtDate(date, { weekday: "short", day: "numeric", month: "short" });

/** Afgerond-rechthoek-pad, met terugval als ctx.roundRect ontbreekt. */
function rrect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  const anyCtx = ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
  };
  if (typeof anyCtx.roundRect === "function") {
    anyCtx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

type Palette = ReturnType<typeof canvasPalette>;

/** Gedeelde poster-basis: achtergrond, headerkaart en lime footer-streep.
 *  Geeft de y terug waar de inhoud mag beginnen. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  c: Palette,
  title: string,
  clubName: string,
  sub: string,
): number {
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, W * 0.9);
  glow.addColorStop(0, c.accentSoft);
  glow.addColorStop(1, c.bg);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const hy = 48;
  const hh = 200;
  const hg = ctx.createLinearGradient(M, hy, M + CW, hy + hh);
  hg.addColorStop(0, c.accent);
  hg.addColorStop(1, c.success);
  rrect(ctx, M, hy, CW, hh, 34);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = c.lime;
  ctx.font = "800 42px Outfit, system-ui, sans-serif";
  ctx.fillText(title, W / 2, hy + 68);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 40px Outfit, system-ui, sans-serif";
  wrapCentered(ctx, clubName, W / 2, hy + 120, CW - 90, 46);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 26px Outfit, system-ui, sans-serif";
  ctx.fillText(sub, W / 2, hy + 172);

  // Footer: lime merkstreep.
  ctx.fillStyle = c.lime;
  rrect(ctx, W / 2 - 70, H - 62, 140, 10, 5);
  ctx.fill();

  return hy + hh + 52;
}

function drawEmpty(ctx: CanvasRenderingContext2D, c: Palette, y: number, text: string) {
  ctx.textAlign = "center";
  ctx.fillStyle = c.inkSoft;
  ctx.font = "600 30px Outfit, system-ui, sans-serif";
  ctx.fillText(text, W / 2, y + 60);
}

/** Dagposter: per starttijd de vrije banen. */
function drawDay(
  ctx: CanvasRenderingContext2D,
  info: { clubName: string; date: string; duration: number | null; isToday: boolean; starts: FreeStart[] },
) {
  const c = canvasPalette();
  const sub = [longDay(info.date)];
  if (info.isToday) sub.push("vanaf nu");
  if (info.duration != null) sub.push(`${info.duration} min`);
  let y = drawFrame(ctx, c, "Baanbeschikbaarheid", info.clubName, sub.join(" · "));

  if (info.starts.length === 0) {
    drawEmpty(ctx, c, y, info.isToday ? "Vandaag niets meer vrij." : "Geen vrije banen op deze dag.");
    return;
  }

  const gap = 10;
  const footerTop = H - 96;
  const availTotal = footerTop - y;
  // Zoveel rijen passen minstens (bij een compacte hoogte); anders afkappen.
  const minRowH = 58;
  const maxRows = Math.floor(availTotal / (minRowH + gap));
  const capped = info.starts.length > maxRows;
  const shown = capped ? info.starts.slice(0, maxRows - 1) : info.starts;
  // Rijhoogte groeit tot een maximum zodat de poster mooi gevuld is.
  const rowH = Math.min(94, Math.floor(availTotal / shown.length) - gap);
  const blockH = shown.length * (rowH + gap) + (capped ? 42 : 0);
  y += Math.max(0, Math.floor((availTotal - blockH) / 2));

  const pw = 132; // breedte tijd-pil
  const durW = 150; // gereserveerd voor "· 60/90 min" rechts
  shown.forEach((s, i) => {
    rrect(ctx, M, y, CW, rowH, 16);
    ctx.fillStyle = i % 2 === 0 ? "#f5f8f5" : c.bg;
    ctx.fill();
    // Tijd-pil.
    rrect(ctx, M + 14, y + 12, pw, rowH - 24, 12);
    ctx.fillStyle = c.accentSoft;
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = c.accent;
    ctx.font = "800 30px Outfit, system-ui, sans-serif";
    ctx.fillText(s.time, M + 14 + pw / 2, y + rowH / 2 + 11);
    // Banen (links).
    ctx.textAlign = "left";
    ctx.fillStyle = c.ink;
    ctx.font = "600 29px Outfit, system-ui, sans-serif";
    const namesX = M + pw + 40;
    ctx.fillText(s.courts.join(", "), namesX, y + rowH / 2 + 11, CW - pw - durW - 70);
    // Speelduren (rechts, gedempt).
    ctx.textAlign = "right";
    ctx.fillStyle = c.inkSoft;
    ctx.font = "700 25px Outfit, system-ui, sans-serif";
    ctx.fillText(`${s.durations.join("/")} min`, M + CW - 20, y + rowH / 2 + 10);
    y += rowH + gap;
  });

  const rest = info.starts.length - shown.length;
  if (rest > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = c.inkSoft;
    ctx.font = "600 25px Outfit, system-ui, sans-serif";
    ctx.fillText(`+ ${rest} meer starttijden`, W / 2, y + 30);
  }
}

// Kleurschaal voor het aantal tegelijk vrije banen (0..4+).
const HEAT_SHADES = ["#eef2f0", "#dcefe4", "#a9dcc0", "#5cbd8b", "#0c8a5f"];
const heatShade = (n: number) => HEAT_SHADES[Math.min(n, HEAT_SHADES.length - 1)];

// Kop-labels per dag: bovenaan de weekdag, eronder dag/maand.
function dayHead(date: string): { top: string; bottom: string } {
  const d = new Date(`${date}T12:00:00`);
  const top = new Intl.DateTimeFormat("nl-BE", { weekday: "short" }).format(d);
  return { top: top.replace(".", ""), bottom: `${d.getDate()}/${d.getMonth() + 1}` };
}

// Sectielabel met lime streepje, links uitgelijnd (zoals ShareEvening).
function sectionLabel(
  ctx: CanvasRenderingContext2D,
  c: ReturnType<typeof canvasPalette>,
  text: string,
  y: number,
) {
  ctx.fillStyle = c.lime;
  rrect(ctx, M, y - 20, 8, 26, 4);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = c.inkSoft;
  ctx.font = "700 25px Outfit, system-ui, sans-serif";
  ctx.fillText(text.toUpperCase(), M + 24, y);
}

/**
 * Weekposter als planning-hulp: één grote tijdlijn per dag die álle vrije
 * halfuren toont (kleur + cijfer = aantal vrije banen). Zo zie je in de
 * groepschat meteen wanneer er deze week plaats is en kun je samen een moment
 * kiezen. Begrensd tot 7 dagrijen → past altijd, niets overlapt of verbergt.
 */
function drawWeek(
  ctx: CanvasRenderingContext2D,
  info: { clubName: string; range: string; duration: number | null; heat: WeekHeatmap },
) {
  const c = canvasPalette();
  const sub = [info.range];
  if (info.duration != null) sub.push(`${info.duration} min`);
  let y = drawFrame(ctx, c, "Weekoverzicht", info.clubName, sub.join(" · "));

  const { times, days } = info.heat;
  if (times.length === 0) {
    drawEmpty(ctx, c, y, "Deze week niets vrij.");
    return;
  }

  sectionLabel(ctx, c, "Vrije banen per halfuur", y + 8);
  y += 40;

  // Raster: dagen als (brede) kolommen, elk vrij halfuur als rij, in elke cel
  // het exacte aantal vrije banen op dat halfuur. Tijd-labels links (nooit
  // overlap), dagkoppen bovenaan. Alleen halfuren waarop érgens iets vrij is.
  const footerTop = H - 80;
  const timeColW = 104;
  const gridX = M + timeColW;
  const dayColW = (CW - timeColW) / days.length;
  const headH = 66;

  // Dagkoppen (kolommen).
  ctx.textAlign = "center";
  days.forEach((day, di) => {
    const cx = gridX + di * dayColW + dayColW / 2;
    const { top, bottom } = dayHead(day.date);
    ctx.fillStyle = c.ink;
    ctx.font = "800 27px Outfit, system-ui, sans-serif";
    ctx.fillText(top, cx, y + 26, dayColW - 6);
    ctx.fillStyle = c.inkSoft;
    ctx.font = "600 22px Outfit, system-ui, sans-serif";
    ctx.fillText(bottom, cx, y + 52, dayColW - 6);
  });
  ctx.fillStyle = c.line;
  ctx.fillRect(M, y + headH - 8, CW, 2);
  y += headH;

  // Rijen (halfuren) — vullen de resterende ruimte.
  const rowH = Math.floor((footerTop - y) / times.length);
  const cellH = rowH - 6;
  const numFont = Math.min(30, Math.round(rowH * 0.5));
  times.forEach((t) => {
    // Tijdlabel links.
    ctx.textAlign = "right";
    ctx.fillStyle = c.ink;
    ctx.font = "800 24px Outfit, system-ui, sans-serif";
    ctx.fillText(t, M + timeColW - 14, y + rowH / 2 + 8);

    days.forEach((day, di) => {
      const n = day.counts[t] ?? 0;
      const cx = gridX + di * dayColW;
      rrect(ctx, cx + 4, y + 2, dayColW - 8, cellH, 8);
      ctx.fillStyle = day.error ? "#f7f2ee" : n > 0 ? heatShade(n) : "#eef2f0";
      ctx.fill();
      if (n > 0) {
        ctx.textAlign = "center";
        ctx.fillStyle = n >= 3 ? "#ffffff" : c.ink;
        ctx.font = `800 ${numFont}px Outfit, system-ui, sans-serif`;
        ctx.fillText(String(n), cx + dayColW / 2, y + rowH / 2 + numFont / 3);
      }
    });
    y += rowH;
  });

  // Footer-uitleg.
  ctx.textAlign = "center";
  ctx.fillStyle = c.inkSoft;
  ctx.font = "600 23px Outfit, system-ui, sans-serif";
  ctx.fillText("cijfer = aantal vrije banen op dat halfuur · leeg = bezet", W / 2, footerTop + 28);
}

export function ShareAvailability(props: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState<"text" | "image" | null>(null);
  const { club, date, duration } = props;

  async function shareAsText() {
    setBusy("text");
    try {
      let text: string;
      let title: string;
      if (props.mode === "dag") {
        const isToday = date === dateInZone(props.data.timeZone);
        const nowMinutes = isToday ? minutesNowInZone(props.data.timeZone) : null;
        text = dayShareText(props.data, date, duration, nowMinutes, {
          clubName: club.name,
          bookingUrl: bookingUrl(date),
          viewUrl: slotShareUrl(date, club.id),
        });
        title = `Baanbeschikbaarheid — ${club.name}`;
      } else {
        text = weekShareText(props.week, duration, {
          clubName: club.name,
          viewUrl: slotShareUrl(date, club.id, "week"),
        });
        title = `Weekoverzicht — ${club.name}`;
      }
      // Links staan al in de tekst, dus geen losse url meegeven.
      const outcome = await shareOrCopyText({ title, text });
      if (outcome === "clipboard") toast.success("Tekst gekopieerd naar klembord.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function shareAsImage() {
    setBusy("image");
    try {
      let draw: (ctx: CanvasRenderingContext2D) => void;
      let filename: string;
      let title: string;
      if (props.mode === "dag") {
        const isToday = date === dateInZone(props.data.timeZone);
        const nowMinutes = isToday ? minutesNowInZone(props.data.timeZone) : null;
        const starts = freeStartTimes(props.data, duration, nowMinutes);
        draw = (ctx) =>
          drawDay(ctx, { clubName: club.name, date, duration, isToday, starts });
        filename = `banen-${date}.png`;
        title = "Baanbeschikbaarheid";
      } else {
        const heat = weekHeatmap(props.week, duration);
        const range =
          props.week.length > 0
            ? `${shortDay(props.week[0].date)} – ${shortDay(props.week[props.week.length - 1].date)}`
            : "";
        draw = (ctx) => drawWeek(ctx, { clubName: club.name, range, duration, heat });
        filename = `banen-week-${date}.png`;
        title = "Weekoverzicht banen";
      }
      const outcome = await sharePng(draw, { width: W, height: H, filename, title });
      if (outcome === "clipboard") toast.success("Poster gekopieerd naar klembord.");
      if (outcome === "download") toast.success("Poster gedownload.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="avail-export">
      <span className="avail-export__label">Delen in de groep</span>
      <div className="avail-export__actions">
        <button
          type="button"
          className="btn btn--sm"
          onClick={shareAsText}
          disabled={busy !== null}
        >
          {busy === "text" ? "Bezig…" : "↗ Tekst"}
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={shareAsImage}
          disabled={busy !== null}
        >
          {busy === "image" ? "Bezig…" : "🖼 Afbeelding"}
        </button>
      </div>
    </div>
  );
}

export default ShareAvailability;
