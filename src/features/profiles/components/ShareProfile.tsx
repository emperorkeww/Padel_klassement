import { useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { canvasPalette, ellipsize, sharePng } from "@/lib/utils/shareImage";
import type { Outcome } from "@/features/rating/results";
import type { Tier, TierKey } from "@/features/rating/tiers";

// Persoonlijke deel-poster (4:5, #496): de speler als FUT-kaart — zelfde
// schildvormen, metaalvlakken en special-toptiers als FutKaart.css — op een
// donkere court-gloed, met klassement, vorm en topbadge eronder. Canvas kent
// geen color-mix, dus de metaal- en inktkleuren worden hier in JS gemixt uit
// de canvasPalette-tierkleuren met dezélfde verhoudingen als de CSS. De
// profielfoto (#618) wordt vooraf met crossOrigin="anonymous" geladen en
// cirkelvormig op de kaart getekend; Supabase Storage levert CORS-headers,
// dus het canvas blijft schoon en sharePng blijft werken. Zonder foto of bij
// een laadfout valt hij stil terug op de initialen-avatar. Zelfde deel-flow
// (sharePng) als ShareChampion en ShareEvening.

const W = 1080;
const H = 1350;

export type ProfileShareData = {
  name: string;
  /** Publieke Supabase-Storage-URL van de profielfoto; null zonder foto. */
  avatarUrl: string | null;
  rating: number | null;
  /** Divisie bij de rating (#127); null zonder rating. */
  tier: Tier | null;
  rank: number | null;
  form: Outcome[];
  topBadge: { emoji: string; naam: string } | null;
};

/* ------------------------------ kleurmix ------------------------------ */

/** color-mix(in srgb, a p, b 1-p) voor hexkleuren, zoals de CSS van FutKaart. */
function mix(a: string, b: string, p: number): string {
  const va = parseInt(a.slice(1), 16);
  const vb = parseInt(b.slice(1), 16);
  const kanaal = (shift: number) =>
    Math.round(((va >> shift) & 0xff) * p + ((vb >> shift) & 0xff) * (1 - p));
  return `rgb(${kanaal(16)}, ${kanaal(8)}, ${kanaal(0)})`;
}

function rgba(hex: string, alpha: number): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 0xff}, ${(v >> 8) & 0xff}, ${v & 0xff}, ${alpha})`;
}

/* ----------------------------- schildpaden ----------------------------- */

type SchildVorm = "vlak" | "notch" | "punt" | "kroon";

/** Bovenrand per divisiegroep — zelfde mapping als FutKaart.css. */
function schildVorm(key: TierKey | undefined): SchildVorm {
  if (key === "slof" || key === "karton" || key === "hout") return "vlak";
  if (key === "platina" || key === "diamant" || key === "meester")
    return "punt";
  if (key === "legende" || key === "dictator") return "kroon";
  return "notch";
}

/** Zet het genormaliseerde schildpad (de objectBoundingBox-paden van
 *  FutKaartDefs ×(w,h)) op de context. Alle vier de vormen delen exact
 *  dezelfde onderkant met de punt op (0.5, 1). */
function schildPad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  vorm: SchildVorm,
) {
  const X = (u: number) => x + u * w;
  const Y = (v: number) => y + v * h;
  const L = (u: number, v: number) => ctx.lineTo(X(u), Y(v));
  const C = (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) => ctx.bezierCurveTo(X(a), Y(b), X(c), Y(d), X(e), Y(f));
  ctx.beginPath();
  // Bovenrand per vorm; eindigt telkens op de rechterschouder (1, y).
  if (vorm === "vlak") {
    ctx.moveTo(X(0.04), Y(0));
    L(0.96, 0);
    L(1, 0.055);
  } else if (vorm === "notch") {
    ctx.moveTo(X(0.085), Y(0));
    L(0.4, 0);
    C(0.44, 0, 0.46, 0.022, 0.5, 0.022);
    C(0.54, 0.022, 0.56, 0, 0.6, 0);
    L(0.915, 0);
    C(0.962, 0, 1, 0.028, 1, 0.062);
  } else if (vorm === "punt") {
    ctx.moveTo(X(0.035), Y(0.01));
    L(0.44, 0.04);
    C(0.47, 0.042, 0.48, 0.058, 0.5, 0.058);
    C(0.52, 0.058, 0.53, 0.042, 0.56, 0.04);
    L(0.965, 0.01);
    L(1, 0.075);
  } else {
    ctx.moveTo(X(0.085), Y(0.035));
    L(0.38, 0.035);
    C(0.43, 0.035, 0.44, 0, 0.5, 0);
    C(0.56, 0, 0.57, 0.035, 0.62, 0.035);
    L(0.915, 0.035);
    C(0.962, 0.035, 1, 0.062, 1, 0.095);
  }
  // Gedeelde onderkant: rechterzijde → taille → punt → linkerzijde.
  L(1, 0.6);
  C(1, 0.74, 0.955, 0.795, 0.865, 0.838);
  L(0.565, 0.972);
  C(0.545, 0.982, 0.523, 1, 0.5, 1);
  C(0.477, 1, 0.455, 0.982, 0.435, 0.972);
  L(0.135, 0.838);
  C(0.045, 0.795, 0, 0.74, 0, 0.6);
  // Linkerschouder terug naar het beginpunt van de bovenrand.
  if (vorm === "vlak") L(0, 0.055);
  else if (vorm === "notch") {
    L(0, 0.062);
    C(0, 0.028, 0.038, 0, 0.085, 0);
  } else if (vorm === "punt") L(0, 0.075);
  else {
    L(0, 0.095);
    C(0, 0.062, 0.038, 0.035, 0.085, 0.035);
  }
  ctx.closePath();
}

/* ------------------------------- avatar ------------------------------- */

// Zelfde initialen- en hue-recept als Avatar.tsx, met de lichte hue-tokens
// uit index.css — de poster is (net als de andere posters, #125) vastgepind
// op het lichte palet.
const AVATAR_HUES: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: "#dcefdd", fg: "#256d33" },
  { bg: "#dbeafe", fg: "#1d4ed8" },
  { bg: "#fde8d7", fg: "#b45309" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#cffafe", fg: "#0e7490" },
  { bg: "#fef3c7", fg: "#a16207" },
  { bg: "#e2e8f0", fg: "#334155" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hueIndex(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 8;
}

/* ------------------------------- tekenen ------------------------------- */

/** De FUT-kaart zelf: frame → liner → metaal-/specialvlak met sheen, en het
 *  vlak-recept van FutKaartVoorkant (eloblok, avatar, naamplaat, divisie). */
function drawKaart(
  ctx: CanvasRenderingContext2D,
  d: ProfileShareData,
  avatarImg: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
) {
  const c = canvasPalette();
  const h = w * 1.39;
  const key = d.tier?.key;
  const vorm = schildVorm(key);
  const special = key === "legende" || key === "dictator";
  const tierKleur: Record<TierKey, string> = {
    slof: c.slof,
    karton: c.karton,
    hout: c.hout,
    brons: c.bronze,
    zilver: c.silver,
    goud: c.gold,
    platina: c.platina,
    diamant: c.diamant,
    meester: c.meester,
    legende: c.legende,
    dictator: c.dictator,
  };
  const tier = key ? tierKleur[key] : c.slof;
  // Special-glans en -diepten: dezelfde constanten als FutKaart.css
  // (dictator = troon-tokens, GOAT = vaste roze).
  const glans = key === "dictator" ? "#e6b34d" : "#f7869f";
  const diepHi = key === "dictator" ? "#a52347" : "#3c1524";
  const diep = key === "dictator" ? "#5e1228" : "#24101a";

  const ink = special ? mix(glans, "#ffffff", 0.8) : mix(tier, "#1d1508", 0.52);
  const inkSoft = special
    ? mix(glans, "#b7a98c", 0.65)
    : mix(tier, "#4a3d26", 0.58);
  const lijn = special ? rgba(glans, 0.55) : mix(tier, "#a8987a", 0.55);

  // Frame (metaal-gradient met twee glanspunten, ~160°).
  const frame = ctx.createLinearGradient(x, y, x + w * 0.34, y + h * 0.94);
  if (special) {
    frame.addColorStop(0, mix(glans, "#ffffff", 0.85));
    frame.addColorStop(0.42, mix(glans, "#201505", 0.55));
    frame.addColorStop(0.68, mix(glans, "#fff8e0", 0.92));
    frame.addColorStop(1, mix(glans, "#140d02", 0.45));
  } else {
    frame.addColorStop(0, mix(tier, "#fff8e8", 0.55));
    frame.addColorStop(0.42, mix(tier, "#3a2f18", 0.88));
    frame.addColorStop(0.68, mix(tier, "#fff3d6", 0.6));
    frame.addColorStop(1, mix(tier, "#241b0c", 0.9));
  }
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  schildPad(ctx, x, y, w, h, vorm);
  ctx.fillStyle = frame;
  ctx.fill();
  ctx.restore();

  // Liner (donkere binnenrand).
  schildPad(ctx, x + 6, y + 6, w - 12, h - 12, vorm);
  ctx.fillStyle = special ? "#0c0805" : mix(tier, "#211806", 0.7);
  ctx.fill();

  // Vlak, geclipt: metaal (of special-diepte) + topglans + sheen.
  const fx = x + 9;
  const fy = y + 9;
  const fw = w - 18;
  const fh = h - 18;
  ctx.save();
  schildPad(ctx, fx, fy, fw, fh, vorm);
  ctx.clip();
  const vlak = ctx.createLinearGradient(0, fy, 0, fy + fh);
  if (special) {
    vlak.addColorStop(0, diepHi);
    vlak.addColorStop(0.6, diep);
    vlak.addColorStop(1, "#120a10");
  } else {
    vlak.addColorStop(0, mix(tier, "#fdfbf6", 0.2));
    vlak.addColorStop(0.56, mix(tier, "#f1eadb", 0.46));
    vlak.addColorStop(1, mix(tier, "#d9cfba", 0.62));
  }
  ctx.fillStyle = vlak;
  ctx.fillRect(fx, fy, fw, fh);
  const glow = ctx.createRadialGradient(
    fx + fw / 2,
    fy - fh * 0.06,
    0,
    fx + fw / 2,
    fy - fh * 0.06,
    fh * 0.55,
  );
  glow.addColorStop(0, special ? rgba(glans, 0.4) : "rgba(255, 255, 255, 0.5)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(fx, fy, fw, fh);
  const sheen = ctx.createLinearGradient(
    fx,
    fy + fh * 0.2,
    fx + fw,
    fy + fh * 0.62,
  );
  const sheenKleur = special
    ? "rgba(255, 240, 200, 0.14)"
    : "rgba(255, 255, 255, 0.28)";
  sheen.addColorStop(0.42, "rgba(255, 255, 255, 0)");
  sheen.addColorStop(0.5, sheenKleur);
  sheen.addColorStop(0.58, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(fx, fy, fw, fh);

  // Eloblok links: rating groot, sub-niveau (Romeins), divisie-emoji.
  const ex = fx + fw * 0.27;
  ctx.textAlign = "center";
  ctx.fillStyle = ink;
  ctx.font = `800 ${Math.round(w * 0.185)}px Outfit, system-ui, sans-serif`;
  ctx.fillText(d.rating != null ? String(d.rating) : "—", ex, fy + fh * 0.19);
  ctx.fillStyle = inkSoft;
  if (d.tier?.subLabel) {
    ctx.font = `800 ${Math.round(w * 0.075)}px Outfit, system-ui, sans-serif`;
    ctx.fillText(d.tier.subLabel, ex, fy + fh * 0.26);
  }
  if (d.tier) {
    ctx.font = `${Math.round(w * 0.1)}px system-ui, sans-serif`;
    ctx.fillText(d.tier.emoji, ex, fy + fh * 0.36);
  }
  ctx.strokeStyle = lijn;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ex - fw * 0.17, fy + fh * 0.41);
  ctx.lineTo(ex + fw * 0.17, fy + fh * 0.41);
  ctx.stroke();

  // Avatar rechts: de echte profielfoto cirkelvormig geclipt (#618), met de
  // initialen-variant als terugval wanneer de foto ontbreekt of niet laadde.
  const ax = fx + fw * 0.67;
  const ay = fy + fh * 0.26;
  const ar = w * 0.185;
  if (avatarImg) {
    // Cover-fit: de foto vult de cirkel, overtollige randen worden geklipt.
    const iw = avatarImg.naturalWidth || avatarImg.width;
    const ih = avatarImg.naturalHeight || avatarImg.height;
    const schaal = Math.max((ar * 2) / iw, (ar * 2) / ih);
    const dw = iw * schaal;
    const dh = ih * schaal;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, ax - dw / 2, ay - dh / 2, dw, dh);
    ctx.restore();
  } else {
    const hue = AVATAR_HUES[hueIndex(d.name)];
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.fillStyle = hue.bg;
    ctx.fill();
    ctx.fillStyle = hue.fg;
    ctx.font = `800 ${Math.round(ar * 0.75)}px Outfit, system-ui, sans-serif`;
    ctx.fillText(initials(d.name), ax, ay + ar * 0.27);
  }
  // Witte rand rondom beide varianten.
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.stroke();

  // Naamplaat met dubbele hairline, daaronder de divisie voluit.
  const nY = fy + fh * 0.6;
  ctx.strokeStyle = lijn;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(fx + fw * 0.06, nY);
  ctx.lineTo(fx + fw * 0.94, nY);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.font = `800 ${Math.round(w * 0.093)}px Outfit, system-ui, sans-serif`;
  ctx.fillText(
    ellipsize(ctx, d.name.toUpperCase(), fw * 0.84),
    fx + fw / 2,
    nY + fh * 0.078,
  );
  ctx.strokeStyle = special ? lijn : rgba("#a8987a", 0.45);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fx + fw * 0.06, nY + fh * 0.105);
  ctx.lineTo(fx + fw * 0.94, nY + fh * 0.105);
  ctx.stroke();
  if (d.tier) {
    ctx.fillStyle = inkSoft;
    ctx.font = `800 ${Math.round(w * 0.055)}px Outfit, system-ui, sans-serif`;
    ctx.fillText(
      ellipsize(ctx, d.tier.label.toUpperCase(), fw * 0.7),
      fx + fw / 2,
      nY + fh * 0.165,
    );
  }
  ctx.restore();
}

function draw(
  ctx: CanvasRenderingContext2D,
  d: ProfileShareData,
  avatarImg: HTMLImageElement | null,
) {
  const c = canvasPalette();

  // Donkere court-gloed als achtergrond (de kaart is de lichtbron) met een
  // subtiel binnenkader. De poster is bewust één donker geheel; de
  // vastgepinde lichte huisstijl (#125) leeft in de kaart en de accenten.
  const bg = ctx.createRadialGradient(
    W / 2,
    -H * 0.1,
    0,
    W / 2,
    -H * 0.1,
    H * 1.15,
  );
  bg.addColorStop(0, "#14563e");
  bg.addColorStop(0.6, "#0b241a");
  bg.addColorStop(1, "#071510");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 4;
  const rand = 36;
  ctx.strokeRect(rand, rand, W - rand * 2, H - rand * 2);

  // Kop: merk + label.
  ctx.textAlign = "center";
  ctx.fillStyle = c.lime;
  ctx.font = "800 64px Outfit, system-ui, sans-serif";
  ctx.fillText("Vamos!", W / 2, 130);
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.font = "800 26px Outfit, system-ui, sans-serif";
  ctx.fillText("S P E L E R S K A A R T", W / 2, 176);

  // De kaart als blikvanger.
  const kaartW = 560;
  drawKaart(ctx, d, avatarImg, (W - kaartW) / 2, 218, kaartW);

  // Klassement en vorm naast elkaar onder de kaart.
  const statsY = 1108;
  type Kolom = { label: string; teken: (x: number) => void };
  const kolommen: Kolom[] = [];
  if (d.rank != null) {
    kolommen.push({
      label: "KLASSEMENT",
      teken: (x) => {
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 60px Outfit, system-ui, sans-serif";
        ctx.fillText(`#${d.rank}`, x, statsY + 62);
      },
    });
  }
  if (d.form.length > 0) {
    kolommen.push({
      label: "VORM",
      teken: (x) => {
        const chip = 52;
        const gap = 14;
        const totaal = d.form.length * chip + (d.form.length - 1) * gap;
        let cx = x - totaal / 2 + chip / 2;
        const kleur = (o: Outcome) =>
          o === "W" ? c.success : o === "D" ? "#b08a2f" : "#d64545";
        for (const o of d.form) {
          ctx.beginPath();
          ctx.arc(cx, statsY + 44, chip / 2, 0, Math.PI * 2);
          ctx.fillStyle = kleur(o);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "800 26px Outfit, system-ui, sans-serif";
          ctx.fillText(
            o === "D" ? "G" : o === "L" ? "V" : "W",
            cx,
            statsY + 53,
          );
          cx += chip + gap;
        }
      },
    });
  }
  kolommen.forEach((kolom, i) => {
    const x =
      kolommen.length === 1 ? W / 2 : W / 2 + (i === 0 ? -220 : 220);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "800 24px Outfit, system-ui, sans-serif";
    ctx.fillText(kolom.label, x, statsY - 16);
    kolom.teken(x);
  });

  // Belangrijkste badge.
  if (d.topBadge) {
    ctx.fillStyle = "#f4dfae";
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    ctx.fillText(
      `${d.topBadge.emoji} ${d.topBadge.naam}`,
      W / 2,
      kolommen.length > 0 ? 1252 : 1180,
    );
  }

  // Lime accentstreep onderaan.
  ctx.fillStyle = c.lime;
  ctx.fillRect(W / 2 - 80, H - 78, 160, 10);
}

/**
 * Laadt de profielfoto met crossOrigin="anonymous" zodat het canvas na het
 * tekenen niet getaint raakt (#618). Elke faaltak — geen url, laad-/CORS-fout —
 * resolvet naar null, waarna de kaart stil op de initialen-avatar terugvalt en
 * de deel-actie gewoon doorloopt.
 */
function laadAvatar(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
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
      const avatarImg = await laadAvatar(data.avatarUrl);
      const outcome = await sharePng((ctx) => draw(ctx, data, avatarImg), {
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
