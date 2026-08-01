// De full-bleed divisiekaarten op canvas (#895).
//
// Twee divisies dragen niet de generieke FUT-stapel (eloblok, avatar,
// naamplaat, divisieregel) maar een eigen compositie: de Ballenraper en
// "Sletje van de baan". In de DOM tekent `DivisieVoorkant` die uit
// `DivisieKaartLayout` — zones als fracties van de kaartdoos, artwork als
// onderdelen per laag. De deelposters kenden dat niet en gaven die spelers een
// gewone schildkaart, dus een compleet andere kaart dan de app toont.
//
// Hier staat de canvas-spiegel. De geometrie komt uit dezelfde
// `DivisieKaartLayout` — dat is één bron, geen kopie. Alleen de zetting
// (kleur, korps, gewicht, spatiering) moet apart: die staat in CSS, en de
// posters mogen bewust geen live tokens lezen (#125). Het register hieronder
// is die tweede boekhouding; `divisieKaartCanvas.test.ts` leest
// DivisieVoorkant.css en SlofKaart.css in en houdt ze ertegen.

import { ellipsize } from "@/lib/utils/shareImage";
import { drawAvatarCirkel } from "@/lib/utils/futKaartCanvas";
import type { Tier } from "@/features/rating/tiers";
import {
  onderdelenPerSlot,
  type DivisieKaartLayout,
  type KaartOnderdeel,
  type KaartOnderdeelSlot,
  type KaartZone,
  type SpelerStatBron,
} from "./kaartLayout";

/** De drie letterfamilies die de kaarten gebruiken. `sans` spiegelt
 *  `var(--font-sans, system-ui, sans-serif)`: dat token bestáát niet in
 *  index.css, dus de CSS valt er echt op system-ui terug — de poster doet
 *  hetzelfde in plaats van stilletjes Outfit te kiezen. */
export type Letterfamilie = "serif" | "sans" | "rounded";

const FAMILIES: Record<Letterfamilie, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: "system-ui, sans-serif",
  rounded: "Nunito, system-ui, sans-serif",
};

export interface TekstStijl {
  kleur: string;
  /** font-size als fractie van de kaartbreedte (de CSS-calc op --fut-kw). */
  korps: number;
  gewicht: number;
  familie: Letterfamilie;
  /** letter-spacing in em, zoals de CSS het schrijft. */
  spatiering?: number;
  hoofdletters?: true;
}

export interface DivisieTekstRegister {
  /** Het stylesheet dat deze zetting draagt — de drifttest leest 'm daar. */
  css: string;
  /** De CSS-klasse waaronder de overrides hangen; leeg voor het basisregister
   *  in DivisieVoorkant.css. */
  klasse?: string;
  rating: TekstStijl;
  subniveau: TekstStijl;
  emoji: { korps: number };
  naam?: TekstStijl;
  titel: TekstStijl & { uitlijning: "links" | "midden" };
  statLabel: TekstStijl;
  statWaarde: TekstStijl;
  /** Kolommen naast elkaar (Ballenraper) of regels onder elkaar (slof). */
  statVorm: "kolommen" | "regels";
  /** Haarlijn onder elke statregel; alleen de regel-variant. */
  statLijn?: string;
  /** Vulling achter het portret; weglaten = geen (het artwork levert de ring). */
  portretVulling?: string;
}

/** Basisregister uit DivisieVoorkant.css — de zetting van de Ballenraper. */
const BALLENRAPER: DivisieTekstRegister = {
  css: "layouts/DivisieVoorkant.css",
  rating: {
    kleur: "#352614",
    korps: 0.205,
    gewicht: 900,
    familie: "serif",
    spatiering: -0.07,
  },
  subniveau: {
    kleur: "#3f321f",
    korps: 0.085,
    gewicht: 800,
    familie: "serif",
    spatiering: 0.05,
  },
  emoji: { korps: 0.085 },
  naam: {
    kleur: "#3a2c18",
    korps: 0.085,
    gewicht: 900,
    familie: "serif",
    spatiering: -0.035,
  },
  titel: {
    kleur: "#f4df9b",
    korps: 0.042,
    gewicht: 900,
    familie: "sans",
    spatiering: 0.035,
    hoofdletters: true,
    uitlijning: "midden",
  },
  statLabel: {
    kleur: "#574932",
    korps: 0.0175,
    gewicht: 900,
    familie: "sans",
    spatiering: -0.045,
  },
  statWaarde: { kleur: "#342718", korps: 0.055, gewicht: 900, familie: "serif" },
  statVorm: "kolommen",
  portretVulling: "#d9d2ba",
};

/** "Sletje van de baan" overschrijft bijna elke zone — een verweerd plaquette
 *  met zwarte inkt en zes label-links/waarde-rechts-regels (SlofKaart.css). */
const SLOF: DivisieTekstRegister = {
  css: "slof/SlofKaart.css",
  klasse: "divisie-voorkant--slof",
  rating: {
    kleur: "#14110d",
    korps: 0.23,
    gewicht: 900,
    familie: "rounded",
    spatiering: -0.02,
  },
  subniveau: {
    kleur: "#14110d",
    korps: 0.076,
    gewicht: 800,
    familie: "sans",
    spatiering: 0.12,
  },
  emoji: { korps: 0.092 },
  // De naam draagt deze kaart niet in beeld; hij blijft in de DOM alleen
  // voorleesbaar staan. Een poster heeft geen schermlezer, dus hij vervalt.
  naam: undefined,
  titel: {
    kleur: "#14110d",
    korps: 0.06,
    gewicht: 800,
    familie: "sans",
    spatiering: 0.01,
    hoofdletters: true,
    uitlijning: "links",
  },
  statLabel: {
    kleur: "#14110d",
    korps: 0.044,
    gewicht: 800,
    familie: "sans",
    spatiering: 0.01,
    hoofdletters: true,
  },
  statWaarde: { kleur: "#6a170f", korps: 0.044, gewicht: 800, familie: "sans" },
  statVorm: "regels",
  statLijn: "rgba(20, 17, 13, 0.42)",
};

export const DIVISIE_TEKST: Readonly<Record<string, DivisieTekstRegister>> = {
  ballenraper: BALLENRAPER,
  slof: SLOF,
};

/** De onderdelen van één layout, geladen en klaar om te tekenen. */
export type GeladenOnderdelen = Record<string, HTMLImageElement>;

/** Eén laadbeurt per layout per sessie: de speeldagposter tekent tot acht
 *  kaarten en mag hetzelfde plaatwerk niet acht keer ophalen. */
const cache = new Map<string, Promise<GeladenOnderdelen>>();

/**
 * Laadt het artwork van een divisielayout. Onderdelen die niet laden vallen
 * gewoon weg: liever een kaart met één ontbrekende laag dan geen poster.
 */
export function laadDivisieOnderdelen(
  layout: DivisieKaartLayout,
): Promise<GeladenOnderdelen> {
  const gecachet = cache.get(layout.id);
  if (gecachet) return gecachet;
  const beurt = laadOnderdelen(layout);
  cache.set(layout.id, beurt);
  return beurt;
}

function laadOnderdelen(
  layout: DivisieKaartLayout,
): Promise<GeladenOnderdelen> {
  return Promise.all(
    layout.onderdelen.map(
      (onderdeel) =>
        new Promise<[string, HTMLImageElement | null]>((resolve) => {
          const img = new Image();
          const klaar = () => {
            if (typeof img.decode !== "function") return resolve([onderdeel.id, img]);
            img.decode().then(
              () => resolve([onderdeel.id, img]),
              () => resolve([onderdeel.id, img]),
            );
          };
          img.onload = klaar;
          img.onerror = () => resolve([onderdeel.id, null]);
          img.src = onderdeel.src;
        }),
    ),
  ).then((paren) =>
    Object.fromEntries(paren.filter((p): p is [string, HTMLImageElement] => !!p[1])),
  );
}

/** Wat een divisiekaart aan gegevens nodig heeft. Spiegel van de props van
 *  `DivisieVoorkant` plus de avatar. */
export interface DivisieKaartData {
  naam: string;
  rating: number | null;
  tier: Tier | null;
  stats: SpelerStatBron | null;
}

/** Zone → absolute rechthoek op een kaart van `w` breed op `(x, y)`. */
function zoneDoos(zone: KaartZone, x: number, y: number, w: number, h: number) {
  return {
    zx: x + zone.x * w,
    zy: y + zone.y * h,
    zw: zone.breedte * w,
    zh: zone.hoogte * h,
  };
}

/** Zet een tekststijl op de context en geeft het korps in px terug. */
function zetStijl(
  ctx: CanvasRenderingContext2D,
  stijl: TekstStijl,
  w: number,
): number {
  const px = stijl.korps * w;
  ctx.fillStyle = stijl.kleur;
  ctx.font = `${stijl.gewicht} ${px}px ${FAMILIES[stijl.familie]}`;
  // letterSpacing bestaat niet in elke engine (jsdom, oudere Safari); zonder is
  // de tekst een fractie breder, niet fout.
  const doel = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in doel)
    doel.letterSpacing = `${(stijl.spatiering ?? 0) * px}px`;
  return px;
}

/** Zet de spatiering terug; een achtergebleven waarde lekt naar de rest van de
 *  poster. */
function wisStijl(ctx: CanvasRenderingContext2D) {
  const doel = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in doel) doel.letterSpacing = "0px";
}

/**
 * Eén tekstzone. `knip` bepaalt of de tekst op de zonebreedte wordt afgekapt:
 * alleen de zones die in de CSS `overflow: hidden` dragen (naam, titel,
 * statlabel) doen dat. De rating, het subniveau en de statwaarden mógen buiten
 * hun zone lopen — dat doen ze in de DOM ook, en een afgekapte "540" is erger
 * dan een paar pixels overloop.
 */
function tekstIn(
  ctx: CanvasRenderingContext2D,
  tekst: string,
  stijl: TekstStijl,
  doos: { zx: number; zy: number; zw: number; zh: number },
  w: number,
  uitlijning: "links" | "midden" | "rechts" = "midden",
  knip = false,
) {
  if (!tekst) return;
  zetStijl(ctx, stijl, w);
  ctx.textBaseline = "middle";
  ctx.textAlign =
    uitlijning === "links" ? "left" : uitlijning === "rechts" ? "right" : "center";
  const tx =
    uitlijning === "links"
      ? doos.zx
      : uitlijning === "rechts"
        ? doos.zx + doos.zw
        : doos.zx + doos.zw / 2;
  ctx.fillText(
    knip ? ellipsize(ctx, tekst, doos.zw) : tekst,
    tx,
    doos.zy + doos.zh / 2,
  );
  wisStijl(ctx);
}

/** Eén artworklaag, in de laagvolgorde van `onderdelenPerSlot`. */
export function drawDivisieOnderdelen(
  ctx: CanvasRenderingContext2D,
  layout: DivisieKaartLayout,
  slot: KaartOnderdeelSlot,
  geladen: GeladenOnderdelen,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  for (const onderdeel of onderdelenPerSlot(layout, slot)) {
    const img = geladen[onderdeel.id];
    if (!img) continue;
    tekenOnderdeel(ctx, onderdeel, img, x, y, w, h);
  }
}

function tekenOnderdeel(
  ctx: CanvasRenderingContext2D,
  onderdeel: KaartOnderdeel,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const { zx, zy, zw, zh } = zoneDoos(onderdeel, x, y, w, h);
  ctx.save();
  if (onderdeel.draai) {
    // Rond het midden, zoals `transform: rotate()` met de standaard origin.
    ctx.translate(zx + zw / 2, zy + zh / 2);
    ctx.rotate((onderdeel.draai * Math.PI) / 180);
    ctx.drawImage(img, -zw / 2, -zh / 2, zw, zh);
  } else {
    ctx.drawImage(img, zx, zy, zw, zh);
  }
  ctx.restore();
}

/**
 * De tekstlaag van een divisiekaart: rating, subniveau, emoji, portret, naam,
 * titel en het statblok. Spiegel van `DivisieVoorkant`, met dezelfde zones.
 */
export function drawDivisieVoorkant(
  ctx: CanvasRenderingContext2D,
  layout: DivisieKaartLayout,
  d: DivisieKaartData,
  avatarImg: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
) {
  const register = DIVISIE_TEKST[layout.id];
  if (!register) return;
  const h = w * 1.39;
  const zones = layout.zones;

  tekstIn(
    ctx,
    d.rating != null ? String(d.rating) : "—",
    register.rating,
    zoneDoos(zones.rating, x, y, w, h),
    w,
  );
  tekstIn(
    ctx,
    d.tier?.subLabel ?? "",
    register.subniveau,
    zoneDoos(zones.subniveau, x, y, w, h),
    w,
  );
  if (zones.emoji && d.tier) {
    const doos = zoneDoos(zones.emoji, x, y, w, h);
    ctx.font = `${register.emoji.korps * w}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(d.tier.emoji, doos.zx + doos.zw / 2, doos.zy + doos.zh / 2);
  }

  // Portret: rond geclipt en cover-passend, zoals de border-radius + object-fit
  // in de CSS.
  const p = zoneDoos(zones.portret, x, y, w, h);
  const pr = Math.min(p.zw, p.zh) / 2;
  const pcx = p.zx + p.zw / 2;
  const pcy = p.zy + p.zh / 2;
  if (register.portretVulling) {
    ctx.beginPath();
    ctx.arc(pcx, pcy, pr, 0, Math.PI * 2);
    ctx.fillStyle = register.portretVulling;
    ctx.fill();
  }
  drawAvatarCirkel(ctx, d.naam, avatarImg, pcx, pcy, pr);

  if (register.naam) {
    tekstIn(
      ctx,
      d.naam,
      register.naam,
      zoneDoos(zones.naam, x, y, w, h),
      w,
      "midden",
      true,
    );
  }
  if (d.tier) {
    // Zelfde bron als `DivisieVoorkant`: het label mét subniveau ("Sletje van
    // de baan III"), niet de flavourtitel — daar is de zone op gemaat.
    const titel = d.tier.label;
    tekstIn(
      ctx,
      register.titel.hoofdletters ? titel.toUpperCase() : titel,
      register.titel,
      zoneDoos(zones.titel, x, y, w, h),
      w,
      register.titel.uitlijning,
      true,
    );
  }

  drawStatblok(ctx, layout, register, d.stats, zoneDoos(zones.statistieken, x, y, w, h), w);
}

function drawStatblok(
  ctx: CanvasRenderingContext2D,
  layout: DivisieKaartLayout,
  register: DivisieTekstRegister,
  bron: SpelerStatBron | null,
  doos: { zx: number; zy: number; zw: number; zh: number },
  w: number,
) {
  const stats = layout.statistieken;
  if (stats.length === 0) return;

  if (register.statVorm === "kolommen") {
    // flex: 1 1 20% met space-between — bij vijf regels precies vijf gelijke
    // kolommen. Label boven de waarde, met de gap uit de CSS ertussen.
    const kolom = doos.zw / stats.length;
    const gap = 0.006 * w;
    stats.forEach((stat, i) => {
      const cx = doos.zx + kolom * i;
      const labelPx = register.statLabel.korps * w;
      const waardePx = register.statWaarde.korps * w;
      const totaal = labelPx + gap + waardePx;
      const top = doos.zy + (doos.zh - totaal) / 2;
      const label = register.statLabel.hoofdletters
        ? stat.label.toUpperCase()
        : stat.label;
      tekstIn(
        ctx,
        label,
        register.statLabel,
        { zx: cx, zy: top, zw: kolom, zh: labelPx },
        w,
        "midden",
        true,
      );
      tekstIn(ctx, String(stat.waarde(bron)), register.statWaarde, {
        zx: cx,
        zy: top + labelPx + gap,
        zw: kolom,
        zh: waardePx,
      }, w);
    });
    return;
  }

  // Regels: label links, waarde rechts, met een haarlijn onder elke regel.
  const rij = doos.zh / stats.length;
  stats.forEach((stat, i) => {
    const ry = doos.zy + rij * i;
    const label = register.statLabel.hoofdletters
      ? stat.label.toUpperCase()
      : stat.label;
    // De waarde claimt zijn breedte eerst; het label krijgt de rest, zodat een
    // lang label afkapt in plaats van over het getal te lopen.
    zetStijl(ctx, register.statWaarde, w);
    const waarde = String(stat.waarde(bron));
    const waardeW = ctx.measureText(waarde).width;
    wisStijl(ctx);
    const gat = 0.1 * doos.zw;
    tekstIn(
      ctx,
      label,
      register.statLabel,
      { zx: doos.zx, zy: ry, zw: Math.max(0, doos.zw - waardeW - gat), zh: rij },
      w,
      "links",
      true,
    );
    tekstIn(
      ctx,
      waarde,
      register.statWaarde,
      { zx: doos.zx, zy: ry, zw: doos.zw, zh: rij },
      w,
      "rechts",
    );
    if (register.statLijn) {
      ctx.strokeStyle = register.statLijn;
      ctx.lineWidth = Math.max(1, 0.0022 * w);
      ctx.beginPath();
      ctx.moveTo(doos.zx, ry + rij);
      ctx.lineTo(doos.zx + doos.zw, ry + rij);
      ctx.stroke();
    }
  });
}
