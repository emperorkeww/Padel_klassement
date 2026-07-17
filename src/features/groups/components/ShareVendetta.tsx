import { useMemo, useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { canvasPalette, sharePng, wrapCentered } from "@/lib/utils/shareImage";
import { roastSeed } from "@/features/coach/roastTone";
import {
  vendettaPoster,
  type VendettaPoster,
} from "@/features/groups/vendettaPoster";

// Deelbare "vendetta beslist"-poster (4:5) — de triomfantelijke tegenhanger
// van SharePias. Zelfde deel-flow (sharePng); plagend, niet vijandig.

const W = 1080;
const H = 1350;

function draw(ctx: CanvasRenderingContext2D, poster: VendettaPoster) {
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

  // De gekruiste degens, groot.
  ctx.font = "200px system-ui, sans-serif";
  ctx.fillText("⚔️", W / 2, 430);

  // De winnaar, met de versregel eronder.
  ctx.fillStyle = c.gold;
  ctx.font = "800 40px Outfit, system-ui, sans-serif";
  ctx.fillText("WINNAAR", W / 2, 540);
  ctx.fillStyle = c.ink;
  ctx.font = "800 92px Outfit, system-ui, sans-serif";
  wrapCentered(ctx, poster.winnaar, W / 2, 650, W - 140, 96);
  ctx.fillStyle = c.inkSoft;
  ctx.font = "500 44px Outfit, system-ui, sans-serif";
  wrapCentered(ctx, poster.versusRegel, W / 2, 790, W - 160, 58);

  // De eindstand, het grootst van al.
  ctx.fillStyle = c.ink;
  ctx.font = "800 160px Outfit, system-ui, sans-serif";
  ctx.fillText(poster.stand, W / 2, 1010);

  // Speels onderschrift.
  ctx.fillStyle = c.inkSoft;
  ctx.font = "italic 500 34px Outfit, system-ui, sans-serif";
  wrapCentered(ctx, poster.onderschrift, W / 2, 1120, W - 160, 44);

  // Groep + doel + accentstreep.
  ctx.fillStyle = c.inkSoft;
  ctx.font = "700 30px Outfit, system-ui, sans-serif";
  ctx.fillText(poster.periodeLabel, W / 2, 1230);
  ctx.fillStyle = c.lime;
  ctx.fillRect(W / 2 - 80, H - 70, 160, 10);
}

export function ShareVendetta({
  vendettaId,
  winnaar,
  verliezer,
  stand,
  groupName,
  doel,
}: {
  /** Seed voor het onderschrift: overal dezelfde poster voor deze vendetta. */
  vendettaId: string;
  winnaar: string;
  verliezer: string;
  /** Eindstand vanuit de winnaar, bv. "5–3". */
  stand: string;
  groupName: string;
  doel: number;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const poster = useMemo(
    () =>
      vendettaPoster({
        winnaar,
        verliezer,
        stand,
        groupName,
        doel,
        seed: roastSeed(vendettaId),
      }),
    [vendettaId, winnaar, verliezer, stand, groupName, doel],
  );

  async function share() {
    setBusy(true);
    try {
      const outcome = await sharePng((ctx) => draw(ctx, poster), {
        width: W,
        height: H,
        filename: "vendetta.png",
        title: "Vendetta beslist ⚔️",
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
      {busy ? "Bezig…" : "↗ Deel de beslissing"}
    </button>
  );
}

export default ShareVendetta;
