// Wrapped-posters (#115): pure tekstopmaak per kaartsoort (posterLayout) en
// een dunne canvas-tekenfunctie (1080×1350, 4:5) in de lichte huisstijl —
// zelfde flow als ShareProfile/ShareChampion. posterLayout voedt óók de
// DOM-kaarten in WrappedSheet, zodat poster en scherm dezelfde copy delen.

import { canvasPalette, ellipsize, wrapCentered } from "@/lib/utils/shareImage";
import {
  drawKaartSchild,
  schildVorm,
  type FutKaartKleuren,
} from "@/lib/utils/futKaartCanvas";
import type { WrappedCard, WrappedPeriode } from "./wrapped";

export interface PosterLayout {
  /** Kleine kop boven het herogetal, bv. "Wrapped 2025" of "🤝 Jouw gouden duo". */
  kicker: string;
  /** De blikvanger. */
  hero: string;
  /** Namen en zinnen zijn te lang voor het cijferkorps. */
  heroKlein?: boolean;
  /** Toelichting onder de hero. */
  sub: string[];
}

/** Winstpercentage als tekst, alleen bij een deelbaar aantal. */
const pct = (gewonnen: number, totaal: number) =>
  totaal > 0 ? `${Math.round((gewonnen / totaal) * 100)}%` : "—";

/**
 * Pure copy per kaartsoort — los testbaar, zonder canvas. Sinds #712 leest de
 * tijdvak-afhankelijke copy uit `periode` (jaar óf kwartaal), zodat één set
 * kaarten beide decks bedient.
 */
export function posterLayout(
  card: WrappedCard,
  naam: string,
  periode: WrappedPeriode,
): PosterLayout {
  switch (card.kind) {
    case "cover":
      return {
        kicker: periode.kicker,
        hero: naam,
        heroKlein: true,
        sub: card.kort
          ? [
              `${card.gespeeld} ${card.gespeeld === 1 ? "match" : "matches"} — elke legende begint ergens.`,
            ]
          : [`Jouw ${periode.noemer} in padel`, `${card.gespeeld} matches vol verhalen`],
      };
    case "volume":
      return {
        kicker: periode.kicker,
        hero: String(card.gespeeld),
        sub: [
          card.gespeeld === 1 ? "match gespeeld" : "matches gespeeld",
          `${card.gewonnen} gewonnen${card.winrate != null ? ` · ${card.winrate}% winrate` : ""}`,
        ],
      };
    case "kalender":
      return {
        kicker: "📅 Jouw ritme",
        hero: card.maand.label,
        heroKlein: true,
        sub: [
          `Drukste maand: ${card.maand.aantal} matches`,
          `Topdag: ${card.topdag.label} · ${card.topdag.aantal} ${card.topdag.aantal === 1 ? "match" : "matches"}`,
        ],
      };
    case "reeks":
      return card.type === "winst"
        ? {
            kicker: "🔥 Niet te stoppen",
            hero: String(card.lengte),
            sub: ["op rij gewonnen", `je langste reeks van ${periode.titel}`],
          }
        : {
            kicker: "🧗 Taaiste periode",
            hero: String(card.lengte),
            sub: ["verliezen op rij — en je bleef terugkomen.", "Respect."],
          };
    case "maatje":
      return {
        kicker: "🤝 Jouw gouden duo",
        hero: card.naam,
        heroKlein: true,
        sub: [
          `${card.samen} matches samen`,
          `${card.gewonnen} gewonnen (${pct(card.gewonnen, card.samen)})`,
        ],
      };
    case "rivalen": {
      const sub: string[] = [];
      if (card.favoriet)
        sub.push(
          `😎 Favoriete tegenstander: ${card.favoriet.naam} — ${card.favoriet.gewonnen} van ${card.favoriet.gespeeld} gewonnen`,
        );
      if (card.nemesis)
        sub.push(
          `😈 Angstgegner: ${card.nemesis.naam} — ${card.nemesis.verloren} van ${card.nemesis.gespeeld} verloren`,
        );
      return { kicker: "Jouw rivalen", hero: "⚔️", sub };
    }
    case "slachtoffer":
      return {
        kicker: "🎯 Jouw favoriete slachtoffer",
        hero: card.rivaal.naam,
        heroKlein: true,
        sub: [
          `${card.rivaal.gewonnen} van ${card.rivaal.gespeeld} gewonnen`,
          `dit ${periode.noemer} jouw favoriete tegenstander`,
        ],
      };
    case "prestatie": {
      const sub: string[] = [];
      if (card.zege) sub.push(`Grootste zege: ${card.zege.score} (+${card.zege.marge})`);
      if (card.comeback)
        sub.push(`Comeback: na ${card.comeback.naVerliezen} verliezen op rij stond je weer op`);
      return {
        kicker: "💪 Sterkste moment",
        hero: card.zege ? card.zege.score : "🪃",
        sub,
      };
    }
    case "rating":
      return {
        kicker: "📈 Jouw rating-reis",
        hero: String(card.eind),
        sub: [
          `Start ${card.start} → piek ${card.piek} → eind ${card.eind}`,
          card.eind >= card.start
            ? `+${card.eind - card.start} dit ${periode.noemer}`
            : `${card.eind - card.start} dit ${periode.noemer} — volgend ${periode.noemer} pak je ze terug`,
        ],
      };
    case "badge":
      return {
        kicker: "🦄 Zeldzame vangst",
        hero: card.emoji,
        sub: [
          card.naam,
          card.aantalSpelers === 1
            ? `Jij was de enige die deze in ${periode.titel} haalde`
            : `Slechts ${card.aantalSpelers} spelers haalden deze in ${periode.titel}`,
        ],
      };
    case "outro":
      return {
        kicker: periode.kicker,
        hero: "🎾",
        sub: card.kort
          ? [
              "Een korte maar krachtige eerste set.",
              `${periode.volgendeTitel} wordt jouw ${periode.noemer}`,
            ]
          : [`Vamos! Op naar ${periode.volgendeTitel}`, "Deel je Wrapped met je maatjes"],
      };
    case "eindoordeel": {
      // De verdict-regels zijn viewer-afhankelijk en worden via de coach-payload
      // getekend (drawWrappedCard); hier alleen het frame. Een emoji vat het
      // tijdvak samen op winrate.
      const wr = card.stats.winrate;
      const hero = wr == null ? "📋" : wr >= 55 ? "🏆" : wr < 45 ? "📉" : "📋";
      return { kicker: "🎙️ Rudy's Eindoordeel", hero, sub: [] };
    }
    case "seizoenskaart": {
      // Vooral een terugval: de DOM-kaart (WrappedSheet) en de canvas-poster
      // (drawSeizoenskaart) tonen de échte FUT-kaart-layout, niet deze
      // kicker/hero/sub-tekst.
      const sub: string[] = [];
      if (card.maatje) sub.push(`🤝 ${card.maatje.naam} — ${card.maatje.samen}x samen`);
      if (card.langsteReeks)
        sub.push(
          card.langsteReeks.type === "winst"
            ? `🔥 ${card.langsteReeks.lengte} op rij gewonnen`
            : `🧗 ${card.langsteReeks.lengte} op rij verloren`,
        );
      sub.push(`🎙️ ${card.aantalRoasts}× aan het woord dit Wrapped`);
      return { kicker: periode.kaartKicker, hero: naam, heroKlein: true, sub };
    }
  }
}

const W = 1080;
const H = 1350;

/**
 * Dunne canvas-render van één Wrapped-kaart (gedeeld sjabloon). `coach` bevat
 * Coach Rudy's regel(s) voor de kaart (#295): op gewone kaarten een band onder
 * de toelichting, op de eindoordeel-kaart vormen de regels de body. De regels
 * zijn viewer-afhankelijk en komen daarom van buiten, zodat poster en scherm
 * exact dezelfde copy tonen.
 */
export function drawWrappedCard(
  ctx: CanvasRenderingContext2D,
  card: WrappedCard,
  naam: string,
  periode: WrappedPeriode,
  coach?: { regels: string[] } | null,
) {
  const c = canvasPalette();
  const l = posterLayout(card, naam, periode);

  const eindoordeel = card.kind === "eindoordeel";

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H);
  // De eindoordeel-kaart krijgt de warme coach-tint (#295).
  grad.addColorStop(0, eindoordeel ? c.coachSoft : c.accentSoft);
  grad.addColorStop(1, c.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  // Merk + kicker.
  ctx.fillStyle = c.accent;
  ctx.font = "800 56px Outfit, system-ui, sans-serif";
  ctx.fillText("Vamos!", W / 2, 130);
  ctx.fillStyle = c.inkSoft;
  ctx.font = "700 40px Outfit, system-ui, sans-serif";
  ctx.fillText(l.kicker.toUpperCase(), W / 2, 300);

  // Hero: groot cijferkorps, of kleiner en gewrapt voor namen/zinnen. De
  // eindoordeel-kaart slaat de grote hero over — die tekent z'n eigen, compacte
  // emoji + verdict-body hieronder, zodat drie regels comfortabel passen.
  if (!eindoordeel) {
    ctx.fillStyle = c.accent;
    if (l.heroKlein) {
      ctx.fillStyle = c.ink;
      ctx.font = "800 96px Outfit, system-ui, sans-serif";
      wrapCentered(ctx, l.hero, W / 2, 620, W - 160, 108);
    } else {
      ctx.font = /^[0-9]/.test(l.hero)
        ? "800 240px Outfit, system-ui, sans-serif"
        : "200px system-ui, sans-serif"; // emoji of score
      ctx.fillText(l.hero, W / 2, 700);
    }
  }

  // Toelichting.
  ctx.fillStyle = c.ink;
  ctx.font = "700 46px Outfit, system-ui, sans-serif";
  l.sub.forEach((regel, i) => {
    wrapCentered(ctx, regel, W / 2, 880 + i * 130, W - 160, 56);
  });

  // Coach Rudy (#295): op de eindoordeel-kaart vormen de regels de body; op
  // gewone kaarten staat één regel in een aparte band onder de toelichting.
  const regels = coach?.regels ?? [];
  if (regels.length > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = c.coach;
    ctx.font = "700 32px Outfit, system-ui, sans-serif";
    if (eindoordeel) {
      // Compacte emoji-hero + label + verdict; de voet staat op H-120 = 1230,
      // dus drie (elk gewrapte) regels op 720 + i*135 blijven ruim daarboven.
      ctx.font = "120px system-ui, sans-serif";
      ctx.fillText(l.hero, W / 2, 520);
      ctx.fillStyle = c.coach;
      ctx.font = "700 32px Outfit, system-ui, sans-serif";
      ctx.fillText("🎙️ COACH RUDY", W / 2, 620);
      ctx.fillStyle = c.coachInk;
      ctx.font = "700 44px Outfit, system-ui, sans-serif";
      regels.forEach((regel, i) => {
        wrapCentered(ctx, regel, W / 2, 720 + i * 135, W - 150, 50);
      });
    } else {
      ctx.fillText("🎙️ COACH RUDY", W / 2, 1088);
      ctx.fillStyle = c.coachInk;
      ctx.font = "700 38px Outfit, system-ui, sans-serif";
      wrapCentered(ctx, regels[0], W / 2, 1150, W - 180, 48);
    }
  }

  // Voet: naam + lime accentstreep.
  ctx.fillStyle = c.inkSoft;
  ctx.font = "700 34px Outfit, system-ui, sans-serif";
  ctx.fillText(`${naam} · ${periode.kicker}`, W / 2, H - 120);
  ctx.fillStyle = c.lime;
  ctx.fillRect(W / 2 - 80, H - 70, 160, 10);
}

/** Eigen thema van de seizoenskaart (#498): donkere court-groene glans met
 *  lime inkt/frame — bewust géén hergebruik van de witgouden Icon- of
 *  marineblauwe In-Form-skin uit FutKaart.css, zodat de kaart meteen als
 *  "Wrapped" leesbaar is. De schildvorm blijft die van de eigen divisie. */
const SEIZOEN_KLEUREN: FutKaartKleuren = {
  frame: [
    [0, "#eafccb"],
    [0.42, "#3c5a1c"],
    [0.68, "#d7f28c"],
    [1, "#1c2b0e"],
  ],
  liner: "#0c1408",
  vlak: [
    [0, "#14563e"],
    [0.6, "#0b241a"],
    [1, "#071510"],
  ],
  glow: "rgba(199, 230, 58, 0.32)",
  sheen: "rgba(234, 252, 203, 0.16)",
  // #664: keyline + stralen — de seizoenskaart is per definitie de special.
  keyline: "rgba(214, 240, 140, 0.75)",
  stralen: true,
};
const SEIZOEN_INK = "#eafccb";
const SEIZOEN_INK_SOFT = "#a9c97e";
const SEIZOEN_LIJN = "rgba(199, 230, 58, 0.5)";

/** "ZOMER" → "Z O M E R": de gespatieerde kop van de seizoenskaart-poster.
 *  Canvas kent geen letter-spacing, dus doen we het met de hand (#712 — het
 *  woord komt sinds dan uit de periode en is niet meer vast "SEIZOEN"). */
function spatieer(woord: string): string {
  return [...woord].join(" ");
}

function initialenVan(naam: string): string {
  const delen = naam.trim().split(/\s+/).filter(Boolean);
  if (delen.length === 0) return "?";
  if (delen.length === 1) return delen[0].slice(0, 2).toUpperCase();
  return (delen[0][0] + delen[delen.length - 1][0]).toUpperCase();
}

/**
 * Canvas-poster van de seizoenskaart (#498): dezelfde donkere court-gloed als
 * ShareProfile, met de FUT-schildkaart (via `drawKaartSchild`, #498-refactor)
 * in het lime seizoensthema en de drie jaarstats eronder. `avatarImg` moet al
 * geladen zijn (zelfde `laadAvatar`-patroon als ShareProfile) — deze functie
 * tekent puur synchroon, zoals `sharePng` vereist.
 */
export function drawSeizoenskaart(
  ctx: CanvasRenderingContext2D,
  card: Extract<WrappedCard, { kind: "seizoenskaart" }>,
  periode: WrappedPeriode,
  avatarImg: HTMLImageElement | null,
) {
  const c = canvasPalette();

  const bg = ctx.createRadialGradient(W / 2, -H * 0.1, 0, W / 2, -H * 0.1, H * 1.15);
  bg.addColorStop(0, "#14563e");
  bg.addColorStop(0.6, "#0b241a");
  bg.addColorStop(1, "#071510");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 4;
  const rand = 36;
  ctx.strokeRect(rand, rand, W - rand * 2, H - rand * 2);

  ctx.textAlign = "center";
  ctx.fillStyle = c.lime;
  ctx.font = "800 64px Outfit, system-ui, sans-serif";
  ctx.fillText("Vamos!", W / 2, 130);
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.font = "800 26px Outfit, system-ui, sans-serif";
  ctx.fillText(`${spatieer(periode.kaartWoord)} ${periode.jaar}`, W / 2, 176);

  // De kaart als blikvanger — zelfde geometrie als ShareProfile's kaartW=560.
  const kaartW = 560;
  const kaartH = kaartW * 1.39;
  const x = (W - kaartW) / 2;
  const y = 218;
  const vorm = schildVorm(card.tier?.key);
  const { fx, fy, fw, fh } = drawKaartSchild(ctx, x, y, kaartW, kaartH, vorm, SEIZOEN_KLEUREN);

  // Eloblok links: rating, sub-niveau, divisie-emoji.
  const ex = fx + fw * 0.27;
  ctx.fillStyle = SEIZOEN_INK;
  ctx.font = `800 ${Math.round(kaartW * 0.185)}px Outfit, system-ui, sans-serif`;
  ctx.fillText(card.rating != null ? String(card.rating) : "—", ex, fy + fh * 0.19);
  ctx.fillStyle = SEIZOEN_INK_SOFT;
  if (card.tier?.subLabel) {
    ctx.font = `800 ${Math.round(kaartW * 0.075)}px Outfit, system-ui, sans-serif`;
    ctx.fillText(card.tier.subLabel, ex, fy + fh * 0.26);
  }
  if (card.tier) {
    ctx.font = `${Math.round(kaartW * 0.1)}px system-ui, sans-serif`;
    ctx.fillText(card.tier.emoji, ex, fy + fh * 0.36);
  }
  ctx.strokeStyle = SEIZOEN_LIJN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ex - fw * 0.17, fy + fh * 0.41);
  ctx.lineTo(ex + fw * 0.17, fy + fh * 0.41);
  ctx.stroke();

  // Avatar rechts: de echte foto cirkelvormig geclipt, anders initialen op
  // het eigen (lime-op-donker) seizoensthema i.p.v. ShareProfile's hue-set.
  const ax = fx + fw * 0.67;
  const ay = fy + fh * 0.26;
  const ar = kaartW * 0.185;
  if (avatarImg) {
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
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.fillStyle = "#1c2b0e";
    ctx.fill();
    ctx.fillStyle = SEIZOEN_INK;
    ctx.font = `800 ${Math.round(ar * 0.75)}px Outfit, system-ui, sans-serif`;
    ctx.fillText(initialenVan(card.naam), ax, ay + ar * 0.27);
  }
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.stroke();

  // Naamplaat + seizoens-editieregel i.p.v. de gewone divisieregel.
  const nY = fy + fh * 0.6;
  ctx.strokeStyle = SEIZOEN_LIJN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(fx + fw * 0.06, nY);
  ctx.lineTo(fx + fw * 0.94, nY);
  ctx.stroke();
  ctx.fillStyle = SEIZOEN_INK;
  ctx.font = `800 ${Math.round(kaartW * 0.093)}px Outfit, system-ui, sans-serif`;
  ctx.fillText(
    ellipsize(ctx, card.naam.toUpperCase(), fw * 0.84),
    fx + fw / 2,
    nY + fh * 0.078,
  );
  ctx.strokeStyle = SEIZOEN_LIJN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fx + fw * 0.06, nY + fh * 0.105);
  ctx.lineTo(fx + fw * 0.94, nY + fh * 0.105);
  ctx.stroke();
  ctx.fillStyle = c.lime;
  ctx.font = `900 ${Math.round(kaartW * 0.06)}px Outfit, system-ui, sans-serif`;
  ctx.fillText(periode.kaartEditie.toUpperCase(), fx + fw / 2, nY + fh * 0.165);
  ctx.restore();

  // Jaarstats onder de kaart, gestapeld i.p.v. naast elkaar (drie stuks
  // passen niet leesbaar in twee kolommen zoals ShareProfile).
  const stats: { label: string; waarde: string }[] = [];
  if (card.maatje)
    stats.push({
      label: "🤝 MAATJE VAN HET JAAR",
      waarde: `${card.maatje.naam} · ${card.maatje.samen}× samen`,
    });
  if (card.langsteReeks)
    stats.push({
      label: card.langsteReeks.type === "winst" ? "🔥 LANGSTE REEKS" : "🧗 TAAISTE REEKS",
      waarde: `${card.langsteReeks.lengte} op rij`,
    });
  stats.push({ label: "🎙️ ROASTS VAN RUDY", waarde: `${card.aantalRoasts}× dit Wrapped` });

  const statsY = 1020;
  stats.forEach((s, i) => {
    const rijY = statsY + i * 78;
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "800 24px Outfit, system-ui, sans-serif";
    ctx.fillText(s.label, W / 2, rijY);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 34px Outfit, system-ui, sans-serif";
    ctx.fillText(s.waarde, W / 2, rijY + 38);
  });

  ctx.fillStyle = c.lime;
  ctx.fillRect(W / 2 - 80, H - 70, 160, 10);
}
