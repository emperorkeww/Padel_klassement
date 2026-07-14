import { useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { canvasPalette, sharePng, wrapCentered } from "@/lib/utils/shareImage";
import type { Outcome } from "@/features/rating/results";
import type { Tier, TierKey } from "@/features/rating/tiers";

// Persoonlijke deel-kaart (4:5): rating, klassementpositie, recente vorm en de
// belangrijkste badge van een speler. Hergebruikt dezelfde canvas-deel-flow
// (sharePng + canvasPalette) als ShareChampion en ShareEvening.

const W = 1080;
const H = 1350;

export type ProfileShareData = {
  name: string;
  rating: number | null;
  /** Divisie bij de rating (#127); null zonder rating. */
  tier: Tier | null;
  rank: number | null;
  form: Outcome[];
  topBadge: { emoji: string; naam: string } | null;
};

/** Afgeronde rechthoek als pad (zelfde vorm als de vorm-blokjes). */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw(ctx: CanvasRenderingContext2D, d: ProfileShareData) {
  const c = canvasPalette();

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, W);
  grad.addColorStop(0, c.accentSoft);
  grad.addColorStop(1, c.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  // Kop: merk en naam.
  ctx.fillStyle = c.accent;
  ctx.font = "800 60px Outfit, system-ui, sans-serif";
  ctx.fillText("Vamos!", W / 2, 140);
  ctx.fillStyle = c.ink;
  ctx.font = "800 74px Outfit, system-ui, sans-serif";
  wrapCentered(ctx, d.name, W / 2, 250, W - 140, 82);

  // Rating als grote blikvanger.
  ctx.fillStyle = c.inkSoft;
  ctx.font = "700 30px Outfit, system-ui, sans-serif";
  ctx.fillText("RATING", W / 2, 470);
  ctx.fillStyle = c.accent;
  ctx.font = "800 200px Outfit, system-ui, sans-serif";
  ctx.fillText(d.rating != null ? String(d.rating) : "—", W / 2, 660);

  // Divisie-chip onder de rating (#127).
  if (d.tier) {
    const tint: Record<TierKey, { fg: string; soft: string }> = {
      slof: { fg: c.slof, soft: c.slofSoft },
      karton: { fg: c.karton, soft: c.kartonSoft },
      hout: { fg: c.hout, soft: c.houtSoft },
      brons: { fg: c.bronze, soft: c.bronzeSoft },
      zilver: { fg: c.silver, soft: c.silverSoft },
      goud: { fg: c.gold, soft: c.goldSoft },
      platina: { fg: c.platina, soft: c.platinaSoft },
      diamant: { fg: c.diamant, soft: c.diamantSoft },
      meester: { fg: c.meester, soft: c.meesterSoft },
      legende: { fg: c.legende, soft: c.legendeSoft },
    };
    const { fg, soft } = tint[d.tier.key];
    ctx.font = "800 44px Outfit, system-ui, sans-serif";
    const label = d.tier.label;
    const chipW = ctx.measureText(label).width + 96;
    const chipH = 76;
    const chipX = W / 2 - chipW / 2;
    const chipY = 692;
    roundedRect(ctx, chipX, chipY, chipW, chipH, chipH / 2);
    ctx.fillStyle = soft;
    ctx.fill();
    ctx.strokeStyle = fg;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(chipX + 44, chipY + chipH / 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillText(label, chipX + 68, chipY + chipH / 2 + 16);
    ctx.textAlign = "center";
  }

  // Klassementpositie.
  if (d.rank != null) {
    ctx.fillStyle = c.inkSoft;
    ctx.font = "700 30px Outfit, system-ui, sans-serif";
    ctx.fillText("KLASSEMENT", W / 2, d.tier ? 838 : 780);
    ctx.fillStyle = c.gold;
    ctx.font = "800 88px Outfit, system-ui, sans-serif";
    ctx.fillText(`#${d.rank}`, W / 2, d.tier ? 926 : 872);
  }

  // Recente vorm als gekleurde blokjes (nieuwste links).
  if (d.form.length > 0) {
    ctx.fillStyle = c.inkSoft;
    ctx.font = "700 30px Outfit, system-ui, sans-serif";
    ctx.fillText("VORM", W / 2, 990);
    const chip = 74;
    const gap = 18;
    const total = d.form.length * chip + (d.form.length - 1) * gap;
    let x = W / 2 - total / 2;
    const colorFor = (o: Outcome) =>
      o === "W" ? c.success : o === "D" ? c.inkSoft : "#d64545";
    for (const o of d.form) {
      ctx.fillStyle = colorFor(o);
      const r = 16;
      const y = 1030;
      // Afgeronde rechthoek.
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + chip, y, x + chip, y + chip, r);
      ctx.arcTo(x + chip, y + chip, x, y + chip, r);
      ctx.arcTo(x, y + chip, x, y, r);
      ctx.arcTo(x, y, x + chip, y, r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 40px Outfit, system-ui, sans-serif";
      ctx.fillText(o, x + chip / 2, y + chip / 2 + 15);
      x += chip + gap;
    }
  }

  // Belangrijkste badge.
  if (d.topBadge) {
    ctx.fillStyle = c.ink;
    ctx.font = "60px system-ui, sans-serif";
    ctx.fillText(d.topBadge.emoji, W / 2 - 30, 1210);
    ctx.fillStyle = c.ink;
    ctx.font = "800 44px Outfit, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(d.topBadge.naam, W / 2 + 20, 1210);
    ctx.textAlign = "center";
  }

  // Lime accentstreep onderaan.
  ctx.fillStyle = c.lime;
  ctx.fillRect(W / 2 - 80, H - 70, 160, 10);
}

export function ShareProfile({
  data,
  label = "↗ Deel profiel",
}: {
  data: ProfileShareData;
  label?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const outcome = await sharePng((ctx) => draw(ctx, data), {
        width: W,
        height: H,
        filename: "vamos-profiel.png",
        title: "Vamos! profiel",
      });
      if (outcome === "clipboard")
        toast.success("Kaart gekopieerd naar klembord.");
      if (outcome === "download") toast.success("Kaart gedownload.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn--sm" onClick={share} disabled={busy}>
      {busy ? "Bezig…" : label}
    </button>
  );
}

export default ShareProfile;
