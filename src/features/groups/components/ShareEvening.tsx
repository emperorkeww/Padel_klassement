import { useMemo, useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { canvasPalette, sharePng, wrapCentered } from "@/lib/utils/shareImage";
import { eveningSummary, type EveningSummary } from "@/features/feed/eveningSummary";
import { displayName } from "@/features/profiles/api";
import { teamLabel } from "@/features/matches/api";
import type { Match, Profile, RatingPoint, Team } from "@/types";

// Deelbare poster (4:5) met de samenvatting van vanavond: avondstand-top-3,
// alle uitslagen en het beste duo. Verschijnt zodra er vandaag minstens één
// afgeronde match in de groep is.

const W = 1080;
const H = 1350;
const M = 60; // zijmarge
const CW = W - 2 * M; // inhoudsbreedte

/** Afgerond-rechthoek-pad (met terugval als ctx.roundRect ontbreekt). */
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

function draw(
  ctx: CanvasRenderingContext2D,
  groupName: string,
  summary: EveningSummary,
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
) {
  const c = canvasPalette();
  const nameOf = (playerId: string) => displayName(profiles[playerId]);

  // Achtergrond met zachte accentgloed rechtsboven.
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, W * 0.9);
  glow.addColorStop(0, c.accentSoft);
  glow.addColorStop(1, c.bg);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Header-kaart (accent → success verloop) ──
  const hy = 48;
  const hh = 208;
  const hg = ctx.createLinearGradient(M, hy, M + CW, hy + hh);
  hg.addColorStop(0, c.accent);
  hg.addColorStop(1, c.success);
  rrect(ctx, M, hy, CW, hh, 34);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = c.lime;
  ctx.font = "800 50px Outfit, system-ui, sans-serif";
  ctx.fillText("Vamos!", W / 2, hy + 80);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 40px Outfit, system-ui, sans-serif";
  wrapCentered(ctx, groupName, W / 2, hy + 135, CW - 90, 46);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 25px Outfit, system-ui, sans-serif";
  ctx.fillText(
    new Date().toLocaleDateString("nl-BE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    W / 2,
    hy + 182,
  );

  // Grootste upset van de avond, als accent-regel in de ruimte onder de header.
  if (summary.biggestUpset) {
    const bu = summary.biggestUpset;
    ctx.textAlign = "center";
    ctx.fillStyle = c.accent;
    ctx.font = "700 24px Outfit, system-ui, sans-serif";
    ctx.fillText(
      `🎯 Grootste upset: ${teamLabel(teams[bu.winnerTeamId], profiles)} · ${Math.round(bu.chance * 100)}% kans`,
      W / 2,
      288,
      CW,
    );
  }

  // Sectielabel met lime streepje, links uitgelijnd.
  const sectionLabel = (text: string, yy: number) => {
    ctx.fillStyle = c.lime;
    rrect(ctx, M, yy - 20, 8, 26, 4);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = c.inkSoft;
    ctx.font = "700 25px Outfit, system-ui, sans-serif";
    ctx.fillText(text.toUpperCase(), M + 24, yy);
  };

  // ── Avondstand: top 3 als podiumrijen ──
  sectionLabel("Avondstand", 312);
  const medal = [c.gold, "#9aa6b2", "#c17d3e"];
  const rowH = 80;
  const gap = 12;
  const top3 = summary.rows.slice(0, 3);
  top3.forEach((row, i) => {
    const ry = 338 + i * (rowH + gap);
    rrect(ctx, M, ry, CW, rowH, 20);
    ctx.fillStyle = i === 0 ? "#faf3dd" : "#f2f6f2";
    ctx.fill();
    // Medaille-cirkel met rangnummer.
    const cx = M + 46;
    const cy = ry + rowH / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 27, 0, Math.PI * 2);
    ctx.fillStyle = medal[i];
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 30px Outfit, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), cx, cy + 11);
    // Naam.
    ctx.textAlign = "left";
    ctx.fillStyle = c.ink;
    ctx.font = "800 34px Outfit, system-ui, sans-serif";
    ctx.fillText(nameOf(row.playerId), M + 92, cy + 12, CW - 290);
    // Punten-pil rechts.
    const pw = 150;
    const px = M + CW - pw - 16;
    rrect(ctx, px, cy - 22, pw, 44, 22);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.fillStyle = c.accent;
    ctx.font = "800 27px Outfit, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${row.points} ptn`, px + pw / 2, cy + 10);
  });
  let y = 338 + top3.length * (rowH + gap);

  // "Ook gespeeld": de overige spelers op één compacte regel.
  const rest = summary.rows.slice(3);
  if (rest.length > 0) {
    y += 34;
    ctx.textAlign = "left";
    ctx.fillStyle = c.inkSoft;
    ctx.font = "600 24px Outfit, system-ui, sans-serif";
    ctx.fillText(
      `Ook gespeeld: ${rest.map((r) => nameOf(r.playerId)).join(", ")}`,
      M,
      y,
      CW,
    );
  }

  // Onderste blok (beste duo + footer) staat vast; de uitslagen mogen daar
  // nooit overheen lopen.
  const duoY = H - 170;
  const maxContentY = duoY - 34;
  const lineH = 50;

  // ── Uitslagen als gestreepte rijen ──
  y = Math.max(y + 52, 660);
  sectionLabel("Uitslagen", y);
  y += 46;
  let shownCount = 0;
  for (const m of summary.matches) {
    if (y + lineH > maxContentY) break; // reserveer ruimte voor "+ N meer"
    rrect(ctx, M, y, CW, lineH - 8, 12);
    ctx.fillStyle = shownCount % 2 === 0 ? "#f5f8f5" : c.bg;
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = c.ink;
    ctx.font = "600 26px Outfit, system-ui, sans-serif";
    const a = teamLabel(teams[m.team_a_id], profiles);
    const b = teamLabel(teams[m.team_b_id], profiles);
    ctx.fillText(
      `${a}   ${m.score_a ?? "–"} – ${m.score_b ?? "–"}   ${b}`,
      W / 2,
      y + (lineH - 8) / 2 + 9,
      CW - 40,
    );
    y += lineH;
    shownCount += 1;
  }
  const restCount = summary.matches.length - shownCount;
  if (restCount > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = c.inkSoft;
    ctx.font = "600 24px Outfit, system-ui, sans-serif";
    ctx.fillText(`+ ${restCount} meer`, W / 2, y + 24);
  }

  // ── Beste duo — uitgelichte kaart onderaan ──
  if (summary.bestDuo) {
    rrect(ctx, M, duoY, CW, 82, 20);
    ctx.fillStyle = "#eaf8ef";
    ctx.fill();
    ctx.fillStyle = c.success;
    ctx.font = "700 30px Outfit, system-ui, sans-serif";
    ctx.textAlign = "center";
    const duo = teamLabel(teams[summary.bestDuo.teamId], profiles);
    ctx.fillText(
      `🏆 Beste duo: ${duo} · ${summary.bestDuo.won} winst${summary.bestDuo.won === 1 ? "" : "en"}`,
      W / 2,
      duoY + 51,
      CW - 60,
    );
  }

  // ── Footer: lime merkstreep ──
  ctx.fillStyle = c.lime;
  rrect(ctx, W / 2 - 70, H - 62, 140, 10, 5);
  ctx.fill();
}

export function ShareEvening({
  groupName,
  matches,
  teams,
  profiles,
  histories,
}: {
  groupName: string;
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  /** Rating-historie om de grootste upset van de avond te bepalen (#85). */
  histories?: Record<string, RatingPoint[]>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const summary = useMemo(
    () => eveningSummary(matches, teams, today, histories),
    [matches, teams, today, histories],
  );

  if (summary.matches.length === 0) return null;

  async function share() {
    setBusy(true);
    try {
      const outcome = await sharePng(
        (ctx) => draw(ctx, groupName, summary, teams, profiles),
        { width: W, height: H, filename: "vamos-avond.png", title: "Vamos! avond" },
      );
      if (outcome === "clipboard")
        toast.success("Poster gekopieerd naar klembord.");
      if (outcome === "download") toast.success("Poster gedownload.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn--sm" onClick={share} disabled={busy}>
      {busy ? "Bezig…" : "↗ Deel avond-samenvatting"}
    </button>
  );
}

export default ShareEvening;
