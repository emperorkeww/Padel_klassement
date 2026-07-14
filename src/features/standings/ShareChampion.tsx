import { useMemo, useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { canvasPalette, sharePng, wrapCentered } from "@/lib/utils/shareImage";
import {
  championPoster,
  type ChampionPoster,
  type PosterRow,
} from "@/features/standings/championPoster";

// Deelbare kampioensposter (4:5) bij een afgesloten seizoen: seizoenslabel,
// de kampioen in het goud en het podium. Zelfde deel-flow als ShareEvening.

const W = 1080;
const H = 1350;

function draw(ctx: CanvasRenderingContext2D, poster: ChampionPoster) {
  const c = canvasPalette();

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(W, 0, 0, W, 0, W);
  grad.addColorStop(0, c.accentSoft);
  grad.addColorStop(1, c.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  // Kop: merk en seizoen.
  ctx.fillStyle = c.accent;
  ctx.font = "800 60px Outfit, system-ui, sans-serif";
  ctx.fillText("Vamos!", W / 2, 130);
  ctx.fillStyle = c.ink;
  ctx.font = "800 46px Outfit, system-ui, sans-serif";
  ctx.fillText(`Seizoen ${poster.seasonLabel}`, W / 2, 210);

  // De kampioen: beker en naam in het goud.
  ctx.font = "200px system-ui, sans-serif";
  ctx.fillText("🏆", W / 2, 500);
  ctx.fillStyle = c.inkSoft;
  ctx.font = "700 32px Outfit, system-ui, sans-serif";
  ctx.fillText("KAMPIOEN", W / 2, 600);
  ctx.fillStyle = c.gold;
  ctx.font = "800 84px Outfit, system-ui, sans-serif";
  wrapCentered(ctx, poster.champion, W / 2, 710, W - 140, 92);

  // Podium: top 3 met medaillekleuren.
  ctx.fillStyle = c.inkSoft;
  ctx.font = "700 26px Outfit, system-ui, sans-serif";
  ctx.fillText("PODIUM", W / 2, 930);
  const medal = [c.gold, "#8c98a4", "#b0722d"];
  let y = 995;
  for (const line of poster.podium) {
    ctx.fillStyle = medal[line.place - 1];
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    ctx.fillText(
      `${line.place}. ${line.name} — ${line.points} ptn`,
      W / 2,
      y,
      W - 140,
    );
    y += 58;
  }

  // Lime accentstreep onderaan.
  ctx.fillStyle = c.lime;
  ctx.fillRect(W / 2 - 80, H - 70, 160, 10);
}

export function ShareChampion({
  seasonLabel,
  rows,
}: {
  seasonLabel: string;
  rows: PosterRow[];
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const poster = useMemo(
    () => championPoster(seasonLabel, rows),
    [seasonLabel, rows],
  );

  async function share() {
    if (!poster) return;
    setBusy(true);
    try {
      const outcome = await sharePng((ctx) => draw(ctx, poster), {
        width: W,
        height: H,
        filename: "vamos-kampioen.png",
        title: "Vamos! kampioen",
      });
      if (outcome === "clipboard")
        toast.success("Poster gekopieerd naar klembord.");
      if (outcome === "download") toast.success("Poster gedownload.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!poster) return null;

  return (
    <button
      className="btn btn--sm champion-banner__share"
      onClick={share}
      disabled={busy}
    >
      {busy ? "Bezig…" : "↗ Deel poster"}
    </button>
  );
}

export default ShareChampion;
