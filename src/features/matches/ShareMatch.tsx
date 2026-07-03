import { useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { formatDate } from "../../lib/format";
import { errorMessage } from "../../lib/errors";
import { canvasPalette, sharePng, wrapCentered } from "../../lib/shareImage";
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

function drawScoreboard(
  ctx: CanvasRenderingContext2D,
  match: Match,
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
) {
  const c = canvasPalette();
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

export function ShareMatch({ match, teams, profiles }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const outcome = await sharePng(
        (ctx) => drawScoreboard(ctx, match, teams, profiles),
        { filename: "vamos-match.png", title: "Vamos! match" },
      );
      if (outcome === "clipboard")
        toast.success("Afbeelding gekopieerd naar klembord.");
      if (outcome === "download") toast.success("Afbeelding gedownload.");
    } catch (err) {
      toast.error(errorMessage(err));
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
