import { useMemo, useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { canvasPalette, sharePng, wrapCentered } from "@/lib/utils/shareImage";
import { piasPoster, piasOnderschrift, type PiasPoster } from "@/features/groups/maandpiasPoster";
import type { PiasReden } from "@/features/groups/maandpias";

// Deelbare Pias-poster (4:5) — de gênante tegenhanger van ShareChampion.
// Zelfde deel-flow (sharePng); opzettelijk plagerig van toon.

const W = 1080;
const H = 1350;

function draw(ctx: CanvasRenderingContext2D, poster: PiasPoster, onderschrift: string) {
  const c = canvasPalette();

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(0, H, 0, 0, H, W);
  grad.addColorStop(0, c.accentSoft);
  grad.addColorStop(1, c.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  // Kop.
  ctx.fillStyle = c.inkSoft;
  ctx.font = "800 44px Outfit, system-ui, sans-serif";
  ctx.fillText(poster.kop, W / 2, 150);

  // De pias zelf, groot.
  ctx.font = "220px system-ui, sans-serif";
  ctx.fillText("🤡", W / 2, 470);

  // "PIAS"-label + de ongelukkige.
  ctx.fillStyle = c.gold;
  ctx.font = "800 40px Outfit, system-ui, sans-serif";
  ctx.fillText("PIAS", W / 2, 590);
  ctx.fillStyle = c.ink;
  ctx.font = "800 92px Outfit, system-ui, sans-serif";
  wrapCentered(ctx, poster.naam, W / 2, 710, W - 140, 96);

  // Detail van de afgang.
  ctx.fillStyle = c.inkSoft;
  ctx.font = "500 44px Outfit, system-ui, sans-serif";
  wrapCentered(ctx, poster.detail, W / 2, 900, W - 160, 58);

  // Plagerig onderschrift.
  ctx.fillStyle = c.inkSoft;
  ctx.font = "italic 500 34px Outfit, system-ui, sans-serif";
  ctx.fillText(onderschrift, W / 2, 1120);

  // Periode + accentstreep.
  ctx.fillStyle = c.inkSoft;
  ctx.font = "700 30px Outfit, system-ui, sans-serif";
  ctx.fillText(poster.periodeLabel, W / 2, 1230);
  ctx.fillStyle = c.lime;
  ctx.fillRect(W / 2 - 80, H - 70, 160, 10);
}

export function SharePias({
  naam,
  detail,
  periodeLabel,
  reden,
  scope,
}: {
  naam: string;
  detail: string;
  periodeLabel: string;
  reden: PiasReden;
  scope: "week" | "maand";
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const poster = useMemo(
    () => piasPoster(naam, detail, periodeLabel, scope),
    [naam, detail, periodeLabel, scope],
  );

  async function share() {
    setBusy(true);
    try {
      const outcome = await sharePng((ctx) => draw(ctx, poster, piasOnderschrift(reden)), {
        width: W,
        height: H,
        filename: "pias.png",
        title: "Pias 🤡",
      });
      if (outcome === "clipboard") toast.success("Poster gekopieerd naar klembord.");
      if (outcome === "download") toast.success("Poster gedownload.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn--sm" onClick={share} disabled={busy}>
      {busy ? "Bezig…" : "↗ Deel pias"}
    </button>
  );
}

export default SharePias;
