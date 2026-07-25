// Persoonlijke deel-poster (4:5, #496): de speler als FUT-kaart — zelfde
// schildvormen, kleurregisters en edities als FutKaart.css — op een donkere
// court-gloed, met klassement, vorm en topbadge eronder. Canvas kent geen
// color-mix, dus alle kleuren komen uit `kaartSkin` (futKaartCanvas.ts), de
// canvas-spiegel van de CSS-registers. De profielfoto (#618) wordt vooraf met
// crossOrigin="anonymous" geladen en cirkelvormig op de kaart getekend;
// Supabase Storage levert CORS-headers, dus het canvas blijft schoon en
// sharePng blijft werken. Zonder foto of bij een laadfout valt hij stil terug
// op de initialen-avatar.
//
// Losgetrokken van ShareProfile.tsx bij #666 (zoals wrappedPoster.ts dat voor
// de Wrapped-kaart al was): de tekenlaag is pure canvas-logica zonder React,
// zodat de dev-showcase (/dev/kaarten) de posterkaart náást de DOM-kaart kan
// tonen en de kaartkleuren toetsbaar zijn.

import { canvasPalette, ellipsize } from "@/lib/utils/shareImage";
import {
  drawKaartSchild,
  kaartSkin,
  rgba,
  schildVorm,
} from "@/lib/utils/futKaartCanvas";
import type { Editie } from "@/features/standings/edities";
import type { Outcome } from "@/features/rating/results";
import type { Tier } from "@/features/rating/tiers";

export const POSTER_W = 1080;
export const POSTER_H = 1350;

export type ProfileShareData = {
  name: string;
  /** Publieke Supabase-Storage-URL van de profielfoto; null zonder foto. */
  avatarUrl: string | null;
  rating: number | null;
  /** Divisie bij de rating (#127); null zonder rating. */
  tier: Tier | null;
  /** Speciale editie (#666): kleurt de kaart, net als live. */
  editie: Editie;
  /** De editie-regel zoals de live kaart die draagt — letterlijk de uitvoer
   *  van `editieLabel`, zodat poster en kaart nooit anders formuleren. */
  editieTekst: string | null;
  rank: number | null;
  form: Outcome[];
  topBadge: { emoji: string; naam: string } | null;
};

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

/** De FUT-kaart zelf: frame → liner → keyline → vlak in het register van de
 *  divisie en (sinds #666) de editie, en daarop het vlak-recept van
 *  FutKaartVoorkant: eloblok, avatar, naamplaat, divisie en editie-regel.
 *  Geëxporteerd voor de dev-showcase. */
export function drawKaart(
  ctx: CanvasRenderingContext2D,
  d: ProfileShareData,
  avatarImg: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
) {
  const h = w * 1.39;
  const key = d.tier?.key;
  const vorm = schildVorm(key);
  const skin = kaartSkin(key, d.editie);
  const { ink, inkSoft, lijn } = skin;

  // Laag-opbouw (frame → liner → keyline → geclipt vlak met textuur, topglans
  // en sheen) komt uit de gedeelde schildkaart-tekening (#498).
  const { fx, fy, fw, fh } = drawKaartSchild(ctx, x, y, w, h, vorm, skin.kleuren);

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

  // Naamplaat met dubbele hairline, daaronder de divisie voluit en — met
  // editie — de editie-regel. Die vierde regel moet boven de schildtaille
  // blijven, dus schuift het hele blok dan wat op: dezelfde ruil als de
  // `padding-bottom: 20%` die de CSS op een vlak mét editie-regel zet (#661).
  const nY = fy + fh * (d.editieTekst ? 0.57 : 0.6);
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
  // Onderrand van de naamplaat: de lijnkleur op 55%, zoals de border-bottom
  // van .fut-kaart__naam — vóór #666 een vaste zandtint met een uitzondering
  // voor de special-toptiers, wat op een roze of speelkaart-witte editie niet
  // meer klopt.
  ctx.strokeStyle = rgba(lijn, 0.55);
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
  if (d.editieTekst) {
    // Iets kleiner dan de divisie en in de editie-kleur, net als
    // .fut-kaart__editie. De langste varianten (pias/Piet, #654) zijn hier de
    // meetlat; de breedtebudget houdt ze binnen het schild, dat op deze hoogte
    // nog ~87% van het vlak breed is.
    ctx.fillStyle = skin.editieKleur;
    ctx.font = `900 ${Math.round(w * 0.052)}px Outfit, system-ui, sans-serif`;
    ctx.fillText(
      ellipsize(ctx, d.editieTekst.toUpperCase(), fw * 0.78),
      fx + fw / 2,
      nY + fh * 0.225,
    );
  }
  ctx.restore();
}

/** De hele poster: court-gloed, kop, de kaart als blikvanger en de
 *  klassement-/vorm-/badge-voet. */
export function drawProfielPoster(
  ctx: CanvasRenderingContext2D,
  d: ProfileShareData,
  avatarImg: HTMLImageElement | null,
) {
  const c = canvasPalette();
  const W = POSTER_W;
  const H = POSTER_H;

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
    const x = kolommen.length === 1 ? W / 2 : W / 2 + (i === 0 ? -220 : 220);
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
