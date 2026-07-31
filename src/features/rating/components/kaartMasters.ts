// Rastermasters van de speciale kaarten (#895) — de registratie die DOM en
// canvas delen.
//
// Sinds #834 tekenen de specials hun decoratie niet meer als vector, maar als
// één transparant master-artwork dat drie keer op exact dezelfde coördinaten
// wordt gerenderd: achter de kaart, ín het kaartvlak (door de schildclip) en
// plaatselijk vóór het frame (door een frontmasker). Zie
// docs/fut-kaarten/special-card-visual-effects-architecture.md.
//
// Die architectuur zat alleen in de DOM: de deelposters tekenden nog de oude
// vectorornamenten. Deze tabel is de brug. De getallen zijn letterlijk de vijf
// custom properties uit het bijbehorende *Effect.css — `left`/`top`/`width`
// rekenen in de CSS tegen de kaartstage (100 × 139), dus tegen respectievelijk
// kaartbreedte, kaarthoogte en kaartbreedte. De drifttest in
// kaartMasters.test.ts leest elk stylesheet in en vergelijkt het met de tabel
// hieronder, zodat DOM en poster niet uit elkaar kunnen lopen.
//
// Bewust géén tweede waarheid over de kaartvorm: de binnenlaag wordt op canvas
// door hetzelfde `schildPad` geclipt dat de DOM als `clip-path: var(--schild)`
// gebruikt.

import type { TierKey } from "@/features/rating/tiers";

import bigdaddyMaster from "./bigdaddy/assets/bigdaddy-master.webp";
import bigdaddyBinnenMasker from "./bigdaddy/assets/bigdaddy-inside-mask.webp";
import bigdaddyVoorMasker from "./bigdaddy/assets/bigdaddy-front-mask.webp";
import blaaskaakMaster from "./blaaskaak/assets/blaaskaak-master.webp";
import dictatorMaster from "./dictator/assets/dictator-master.webp";
import dictatorVoorMasker from "./dictator/assets/dictator-front-mask.svg";
import glazenwasserMaster from "./glazenwasser/assets/glazenwasser-master.webp";
import glazenwasserVoorMasker from "./glazenwasser/assets/glazenwasser-front-mask.svg";
import goatMaster from "./goat/assets/goat-master.webp";
import goatBinnenMasker from "./goat/assets/goat-inside-mask.svg";
import goatVoorMasker from "./goat/assets/goat-front-mask.svg";
import onfireMaster from "./onfire/assets/onfire-master.webp";
import onfireVoorMasker from "./onfire/assets/onfire-front-mask.svg";
import piasMaster from "./pias/assets/pias-master.webp";
import piasVoorMasker from "./pias/assets/pias-front-mask.svg";
import pietMaster from "./piet/assets/piet-master.webp";
import pietVoorMasker from "./piet/assets/piet-front-mask.svg";
import stormMaster from "./storm/assets/in-form/storm-master.webp";
import stormVoorMasker from "./storm/assets/in-form/storm-front-mask.svg";
import wannabeMaster from "./wannabe/assets/wannabe-master.webp";
import wannabeVoorMasker from "./wannabe/assets/wannabe-front-mask.svg";

/** De tien kaarten die hun decoratie uit één rastermaster halen. */
export type MasterNaam =
  | "inform"
  | "onfire"
  | "dictator"
  | "bigdaddy"
  | "piet"
  | "pias"
  | "goat"
  | "wannabe"
  | "blaaskaak"
  | "glazenwasser";

/** Contactschaduw onder de voorlaag, als fracties van de kaartbreedte —
 *  spiegel van de drop-shadow op `.<naam>-effect--voor .<naam>-effect__master`.
 *  `[dx, dy, blur, kleur]`, net als de CSS-calc's op `--fut-kw`. */
export type MasterSchaduw = readonly [number, number, number, string];

export interface MasterRegistratie {
  /** Prefix van de custom properties: `--<prefix>-master-left` enzovoort. */
  prefix: string;
  /** Het stylesheet dat de registratie draagt, relatief aan deze map — de
   *  drifttest leest 'm daar. */
  css: string;
  /** Het transparante master-artwork. */
  bron: string;
  /** `--…-master-left`, als fractie van de kaartbreedte. */
  links: number;
  /** `--…-master-top`, als fractie van de kaarthóógte (zo rekent `top` in CSS). */
  boven: number;
  /** `--…-master-width`, als fractie van de kaartbreedte. */
  breedte: number;
  /** `--…-master-scale`, om het ankerpunt linksboven. */
  schaal: number;
  /** `--…-master-rotate` in graden, om hetzelfde ankerpunt. */
  rotatie: number;
  /** Opacity van de binnenlaag; 1 als de CSS er geen zet. */
  binnenAlpha: number;
  /** Extra alfamasker op de binnenlaag (GOAT en Big Daddy). */
  binnenMasker?: string;
  /** Frontmasker; ontbreekt waar de alfa van de master zelf de selectie is
   *  (blaaskaak). */
  voorMasker?: string;
  voorSchaduw: MasterSchaduw;
  /** Onderdrukt het vector-ornament (achter én voor) op de poster: het
   *  master-artwork draagt die vormen nu zelf. Spiegel van `ornamentLive` in
   *  FutKaart.tsx — In-Form en On Fire houden hun metalen vinnen bewust wél. */
  onderdruktOrnament?: true;
  /** Onderdrukt de vector-divisiekaart (crest, zijranden, medaillon) — spiegel
   *  van `divisieLive` in FutKaart.tsx. */
  onderdruktDivisie?: true;
  /** Onderdrukt het vlak-motief: de master draagt zijn eigen watermerk —
   *  spiegel van de `motief`-cascade in FutKaart.tsx. */
  onderdruktMotief?: true;
  /** De voorlaag ligt bóven een vector-ornament dat blijft staan. Alleen de
   *  storm doet dat: die staat op z-index 5, terwijl de On-Fire-crest juist op
   *  4 ligt en dus over zijn eigen master heen komt. */
  voorBovenOrnament?: true;
}

export const KAART_MASTERS: Readonly<Record<MasterNaam, MasterRegistratie>> = {
  // ── Edities ──
  inform: {
    prefix: "storm",
    css: "storm/InformStorm.css",
    bron: stormMaster,
    links: -0.2,
    boven: -0.16,
    breedte: 1.55,
    schaal: 1,
    rotatie: 0,
    binnenAlpha: 0.97,
    voorMasker: stormVoorMasker,
    voorSchaduw: [-0.014, 0.008, 0.012, "rgba(2, 4, 10, 0.78)"],
    voorBovenOrnament: true,
  },
  onfire: {
    prefix: "onfire",
    css: "onfire/OnfireEffect.css",
    bron: onfireMaster,
    links: -0.16,
    boven: -0.24,
    breedte: 1.32,
    schaal: 1,
    rotatie: 0,
    binnenAlpha: 0.78,
    voorMasker: onfireVoorMasker,
    voorSchaduw: [0.012, 0.008, 0.014, "rgba(6, 2, 1, 0.88)"],
  },
  bigdaddy: {
    prefix: "bigdaddy",
    css: "bigdaddy/BigDaddyEffect.css",
    bron: bigdaddyMaster,
    links: -0.2,
    boven: -0.22,
    breedte: 1.4,
    schaal: 1,
    rotatie: 0,
    binnenAlpha: 0.16,
    binnenMasker: bigdaddyBinnenMasker,
    voorMasker: bigdaddyVoorMasker,
    voorSchaduw: [0, 0.012, 0.018, "rgba(62, 8, 37, 0.82)"],
    onderdruktOrnament: true,
  },
  pias: {
    prefix: "pias",
    css: "pias/PiasEffect.css",
    bron: piasMaster,
    links: -0.146,
    boven: -0.099,
    breedte: 1.293,
    schaal: 1,
    rotatie: 0,
    binnenAlpha: 0.82,
    voorMasker: piasVoorMasker,
    voorSchaduw: [0, 0.014, 0.014, "rgba(24, 10, 3, 0.86)"],
    onderdruktOrnament: true,
  },
  piet: {
    prefix: "piet",
    css: "piet/PietEffect.css",
    bron: pietMaster,
    links: -0.1939,
    boven: -0.078,
    breedte: 1.3852,
    schaal: 1,
    rotatie: 0,
    binnenAlpha: 1,
    voorMasker: pietVoorMasker,
    voorSchaduw: [0, 0.014, 0.014, "rgba(3, 2, 1, 0.9)"],
    onderdruktOrnament: true,
    // De stadssilhouet uit de master staat precies waar de vectorpion stond;
    // twee watermerken over elkaar leest als vervuiling (FutKaart.tsx).
    onderdruktMotief: true,
  },

  // ── Tiers ──
  dictator: {
    prefix: "dictator",
    css: "dictator/DictatorEffect.css",
    bron: dictatorMaster,
    links: -0.15,
    boven: -0.18,
    breedte: 1.3,
    schaal: 1,
    rotatie: 0,
    binnenAlpha: 0.16,
    voorMasker: dictatorVoorMasker,
    voorSchaduw: [0, 0.012, 0.018, "rgba(5, 1, 1, 0.9)"],
    onderdruktOrnament: true,
  },
  goat: {
    prefix: "goat",
    css: "goat/GoatEffect.css",
    bron: goatMaster,
    links: -0.2,
    boven: -0.53,
    breedte: 1.4,
    schaal: 1,
    rotatie: 0,
    binnenAlpha: 0.92,
    binnenMasker: goatBinnenMasker,
    voorMasker: goatVoorMasker,
    voorSchaduw: [0, 0.01, 0.016, "rgba(12, 3, 7, 0.86)"],
    onderdruktOrnament: true,
  },
  glazenwasser: {
    prefix: "glazenwasser",
    css: "glazenwasser/GlazenwasserEffect.css",
    bron: glazenwasserMaster,
    links: -0.0818,
    boven: -0.1308,
    breedte: 1.1636,
    schaal: 1,
    rotatie: 0,
    binnenAlpha: 0.94,
    voorMasker: glazenwasserVoorMasker,
    voorSchaduw: [0, 0.008, 0.014, "rgba(4, 16, 30, 0.72)"],
    onderdruktDivisie: true,
    onderdruktMotief: true,
  },
  wannabe: {
    prefix: "wannabe",
    css: "wannabe/WannabeEffect.css",
    bron: wannabeMaster,
    links: -0.0953,
    boven: -0.1255,
    breedte: 1.1907,
    schaal: 1,
    rotatie: 0,
    binnenAlpha: 0.9,
    voorMasker: wannabeVoorMasker,
    voorSchaduw: [-0.004, 0.008, 0.01, "rgba(46, 32, 16, 0.5)"],
    onderdruktDivisie: true,
    onderdruktMotief: true,
  },
  blaaskaak: {
    prefix: "blaaskaak",
    css: "blaaskaak/BlaaskaakEffect.css",
    bron: blaaskaakMaster,
    links: -0.04,
    boven: -0.14,
    breedte: 1.08,
    schaal: 1,
    rotatie: 0,
    binnenAlpha: 0.72,
    // Geen frontmasker: de alfa van het WebP is hier zelf het organische
    // masker (BlaaskaakEffect.css). De megafoon-uitsnede en de tekstburst zijn
    // DOM-verfijningen die de poster (nog) niet naspeelt.
    voorSchaduw: [0, 0.009, 0.014, "rgba(12, 31, 51, 0.48)"],
    onderdruktDivisie: true,
    onderdruktMotief: true,
  },
};

/** Welke editie welk master draagt — spiegel van de `editie === …`-takken in
 *  FutKaart.tsx. De Kampioen heeft (nog) geen master en houdt zijn vector. */
const EDITIE_MASTER: Readonly<Record<string, MasterNaam>> = {
  icon: "bigdaddy",
  inform: "inform",
  onfire: "onfire",
  pias: "pias",
  piet: "piet",
};

/** Welke divisie welk master draagt zónder editie — spiegel van
 *  `tier?.key === … && !editie` en de `…Master`-vlaggen in FutKaart.tsx. */
const TIER_MASTER: Readonly<Partial<Record<TierKey, MasterNaam>>> = {
  dictator: "dictator",
  legende: "goat",
  platina: "glazenwasser",
  goud: "wannabe",
  zilver: "blaaskaak",
};

/**
 * De cascade van FutKaart.tsx: een editie met eigen master wint, anders hangt
 * het master aan de divisie — een GOAT met In-Form draagt dus de storm, niet
 * zijn monument.
 */
export function masterVoor(
  tier: TierKey | null | undefined,
  editie: string | null | undefined,
): MasterNaam | null {
  if (editie) return EDITIE_MASTER[editie] ?? null;
  return (tier && TIER_MASTER[tier]) ?? null;
}

/** Eén geladen master met zijn maskers, klaar om te tekenen. */
export interface GeladenMaster {
  naam: MasterNaam;
  registratie: MasterRegistratie;
  master: HTMLImageElement;
  binnenMasker: HTMLImageElement | null;
  voorMasker: HTMLImageElement | null;
}

/**
 * Laadt één afbeelding en wacht op `decode()`. Dat wachten is niet optioneel:
 * een `HTMLImageElement` dat nog niet gedecodeerd is tekent op canvas als niets
 * — dezelfde val als `decoding="sync"` bij de headless screenshots. Elke
 * faaltak resolvet naar null, zodat de poster stil op zijn vectorlaag terugvalt
 * in plaats van helemaal niet te delen.
 */
function laadAfbeelding(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // `decode` bestaat niet overal (jsdom, oudere webviews); daar is `onload`
      // het enige signaal dat we hebben.
      if (typeof img.decode !== "function") return resolve(img);
      img.decode().then(
        () => resolve(img),
        () => resolve(img),
      );
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Eén laadbeurt per master per sessie: de speeldagposter tekent tot acht
 *  kaarten en mag hetzelfde artwork niet acht keer ophalen. */
const cache = new Map<MasterNaam, Promise<GeladenMaster | null>>();

/**
 * Laadt het master-artwork (en zijn maskers) voor één kaart. Geeft null terug
 * zodra er géén master bij deze tier/editie hoort, of als het artwork niet
 * laadde — de caller tekent dan gewoon de vectorversie.
 */
export function laadKaartMaster(
  naam: MasterNaam | null,
): Promise<GeladenMaster | null> {
  if (!naam) return Promise.resolve(null);
  const gecachet = cache.get(naam);
  if (gecachet) return gecachet;
  const registratie = KAART_MASTERS[naam];
  const beurt = Promise.all([
    laadAfbeelding(registratie.bron),
    registratie.binnenMasker
      ? laadAfbeelding(registratie.binnenMasker)
      : Promise.resolve(null),
    registratie.voorMasker
      ? laadAfbeelding(registratie.voorMasker)
      : Promise.resolve(null),
  ]).then(([master, binnenMasker, voorMasker]) =>
    master ? { naam, registratie, master, binnenMasker, voorMasker } : null,
  );
  cache.set(naam, beurt);
  return beurt;
}

/** Laadt in één keer de masters voor een hele poster; dubbele namen delen
 *  dezelfde laadbeurt. De uitvoer staat in dezelfde volgorde als de invoer. */
export function laadKaartMasters(
  namen: ReadonlyArray<MasterNaam | null>,
): Promise<Array<GeladenMaster | null>> {
  return Promise.all(namen.map(laadKaartMaster));
}
