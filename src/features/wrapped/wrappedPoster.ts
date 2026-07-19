// Wrapped-posters (#115): pure tekstopmaak per kaartsoort (posterLayout) en
// een dunne canvas-tekenfunctie (1080×1350, 4:5) in de lichte huisstijl —
// zelfde flow als ShareProfile/ShareChampion. posterLayout voedt óók de
// DOM-kaarten in WrappedSheet, zodat poster en scherm dezelfde copy delen.

import { canvasPalette, wrapCentered } from "@/lib/utils/shareImage";
import type { WrappedCard } from "./wrapped";

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

/** Pure copy per kaartsoort — los testbaar, zonder canvas. */
export function posterLayout(card: WrappedCard, naam: string, jaar: number): PosterLayout {
  switch (card.kind) {
    case "cover":
      return {
        kicker: `Wrapped ${jaar}`,
        hero: naam,
        heroKlein: true,
        sub: card.kort
          ? [
              `${card.gespeeld} ${card.gespeeld === 1 ? "match" : "matches"} — elke legende begint ergens.`,
            ]
          : ["Jouw jaar in padel", `${card.gespeeld} matches vol verhalen`],
      };
    case "volume":
      return {
        kicker: `Wrapped ${jaar}`,
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
            sub: ["op rij gewonnen", `je langste reeks van ${jaar}`],
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
            ? `+${card.eind - card.start} dit jaar`
            : `${card.eind - card.start} dit jaar — volgend jaar pak je ze terug`,
        ],
      };
    case "badge":
      return {
        kicker: "🦄 Zeldzame vangst",
        hero: card.emoji,
        sub: [
          card.naam,
          card.aantalSpelers === 1
            ? `Jij was de enige die deze in ${jaar} haalde`
            : `Slechts ${card.aantalSpelers} spelers haalden deze in ${jaar}`,
        ],
      };
    case "outro":
      return {
        kicker: `Wrapped ${jaar}`,
        hero: "🎾",
        sub: card.kort
          ? ["Een korte maar krachtige eerste set.", `${jaar + 1} wordt jouw jaar`]
          : [`Vamos! Op naar ${jaar + 1}`, "Deel je Wrapped met je maatjes"],
      };
    case "eindoordeel": {
      // De verdict-regels zijn viewer-afhankelijk en worden via de coach-payload
      // getekend (drawWrappedCard); hier alleen het frame. Een cijfer-emoji vat
      // het jaar samen op winrate.
      const wr = card.stats.winrate;
      const hero = wr == null ? "📋" : wr >= 55 ? "🏆" : wr < 45 ? "📉" : "📋";
      return { kicker: "🎙️ Rudy's Eindoordeel", hero, sub: [] };
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
  jaar: number,
  coach?: { regels: string[] } | null,
) {
  const c = canvasPalette();
  const l = posterLayout(card, naam, jaar);

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
  ctx.fillText(`${naam} · Wrapped ${jaar}`, W / 2, H - 120);
  ctx.fillStyle = c.lime;
  ctx.fillRect(W / 2 - 80, H - 70, 160, 10);
}
