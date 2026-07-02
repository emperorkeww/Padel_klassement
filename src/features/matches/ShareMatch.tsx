import { useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { formatDate } from "../../lib/format";
import type { Match, Profile, Team } from "../../lib/types";
import { teamLabel } from "./api";

// Deelt de uitslag als afbeelding. We tekenen een scorebord op een <canvas>
// (geen externe dependency) en delen die via de Web Share API; waar dat niet
// kan valt het terug op kopiëren naar het klembord of een download.

type Props = {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
};

const W = 1080;
const H = 1080;

function palette() {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback;
  return {
    bg: get("--surface", "#ffffff"),
    ink: get("--ink", "#1a2620"),
    inkSoft: get("--ink-soft", "#64756c"),
    accent: get("--accent", "#0c8a5f"),
    accentSoft: get("--accent-soft", "#e6f5ee"),
    line: get("--line", "#e4eae4"),
    lime: get("--lime", "#c7e63a"),
    success: get("--success", "#16a34a"),
  };
}

function drawScoreboard(
  ctx: CanvasRenderingContext2D,
  match: Match,
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
) {
  const c = palette();
  const teamA = teams[match.team_a_id];
  const teamB = teams[match.team_b_id];
  const labelA = teamLabel(teamA, profiles);
  const labelB = teamLabel(teamB, profiles);
  const done = match.status === "completed";
  const aWon = done && match.winner_team_id === match.team_a_id;
  const bWon = done && match.winner_team_id === match.team_b_id;
  const scored = match.score_a != null && match.score_b != null;

  // Achtergrond met subtiele lime→wit gloed.
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(W, 0, 0, W, 0, W);
  grad.addColorStop(0, c.accentSoft);
  grad.addColorStop(1, c.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  // Merk bovenaan.
  ctx.fillStyle = c.accent;
  ctx.font = "800 64px Outfit, system-ui, sans-serif";
  ctx.fillText("Vamos!", W / 2, 150);
  ctx.fillStyle = c.inkSoft;
  ctx.font = "600 30px Outfit, system-ui, sans-serif";
  ctx.fillText(
    formatDate(match.played_at ?? match.created_at) || "",
    W / 2,
    205,
  );

  // Teamnamen.
  ctx.font = "700 54px Outfit, system-ui, sans-serif";
  ctx.fillStyle = aWon ? c.ink : c.inkSoft;
  wrapCentered(ctx, labelA, W / 2, 400, W - 160, 62);
  ctx.fillStyle = bWon ? c.ink : c.inkSoft;
  wrapCentered(ctx, labelB, W / 2, 760, W - 160, 62);

  // Score in het midden.
  ctx.fillStyle = c.accent;
  ctx.font = "800 150px Outfit, system-ui, sans-serif";
  const scoreText = scored ? `${match.score_a} – ${match.score_b}` : "vs";
  ctx.fillText(scoreText, W / 2, 610);

  // Winnaar-label.
  if (done && (aWon || bWon)) {
    ctx.fillStyle = c.success;
    ctx.font = "700 34px Outfit, system-ui, sans-serif";
    ctx.fillText(`🏆 ${aWon ? labelA : labelB}`, W / 2, 900);
  } else if (done) {
    ctx.fillStyle = c.inkSoft;
    ctx.font = "700 34px Outfit, system-ui, sans-serif";
    ctx.fillText("Gelijkspel", W / 2, 900);
  }

  // Lime accentstreep onderaan.
  ctx.fillStyle = c.lime;
  ctx.fillRect(W / 2 - 80, 970, 160, 10);
}

function wrapCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

export function ShareMatch({ match, teams, profiles }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas niet beschikbaar.");
      drawScoreboard(ctx, match, teams, profiles);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Afbeelding maken mislukt.");

      const file = new File([blob], "vamos-match.png", { type: "image/png" });

      // 1) Web Share met bestand (mobiel).
      if (
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: "Vamos! match" });
        return;
      }

      // 2) Klembord (desktop met clipboard-write).
      const ClipboardItemCtor = (
        window as unknown as { ClipboardItem?: typeof ClipboardItem }
      ).ClipboardItem;
      if (navigator.clipboard && ClipboardItemCtor) {
        await navigator.clipboard.write([
          new ClipboardItemCtor({ "image/png": blob }),
        ]);
        toast.success("Afbeelding gekopieerd naar klembord.");
        return;
      }

      // 3) Download als laatste redmiddel.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vamos-match.png";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Afbeelding gedownload.");
    } catch (err) {
      // Gebruiker die het deelvenster sluit is geen fout.
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn--sm" onClick={share} disabled={busy}>
      {busy ? "Bezig…" : "↗ Delen"}
    </button>
  );
}

export default ShareMatch;
