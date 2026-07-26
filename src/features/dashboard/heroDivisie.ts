// Het basisthema van de dashboard player card (#771): het materiaal van je
// divisie.
//
// Vóór #771 was een kaart zonder speciale status een neutraal vlak met een
// lime-was — hetzelfde voor de Sletje van de baan als voor de GOAT. De issue
// zet daar een streep door: draagt een speler geen permanent thema, dan is de
// kaart die van zijn divisie.
//
// Waar de kleuren vandaan komen: het `register` van de divisiekaart uit #710
// (divisies/<key>.ts), dezelfde data die de FUT-kaart en de deel-poster lezen.
// Geen tweede palet en geen negen nieuwe CSS-blokken — die zouden stil uit
// elkaar gaan lopen met de kaart. Deze module vertaalt het register naar een
// handvol custom properties; DashboardHero.css doet er de rest mee.
//
// Bewust zuinig (keuze bij #771): rand, keyline, een zweem materiaal en het
// divisiemotief als watermerk. Het vlak zelf blijft het gewone kaartoppervlak.
// De verticale FUT-kaart is een kleinood dat je even bekijkt; dit vlak staat de
// hele dag boven je overzicht en draagt een coachbriefing, drie knoppen en een
// vormreeks. Volledig materiaal zou negen contrastbudgetten in twee thema's
// betekenen voor een kaart die vooral leesbaar moet zijn.
//
// De twee toptiers (GOAT en El Padelissimo) staan op de generieke metaalladder
// en hebben dus geen register. Zij krijgen de statische stand van hun premium
// glans (#773) als basis — dezelfde highlight die die kaarten aan een bezoeker
// met `prefers-reduced-motion` tonen. Bewegen doet de hero niet: de baan van de
// kaart loopt 8–11 seconden per cyclus, en dat is gedrag voor een kaartje in een
// raster, niet voor de kop van je startpagina.

import type { CSSProperties } from "react";
import { divisieKaart } from "@/features/rating/components/divisies";
import { premiumGlans } from "@/features/rating/components/premiumGlans";
import type { OrnamentPad } from "@/features/rating/components/futKaartOrnamenten";
import { tierForWeergave, type TierKey } from "@/features/rating/tiers";
import type { HeroPermanent } from "./heroThema";

/** Het watermerk van de basis: het divisiemotief, in de doos waarin #710 het
 *  tekent (viewBox 0 0 100 100). */
export type HeroWatermerk = {
  paden: readonly OrnamentPad[];
  kleur: string;
  /** Breedte als fractie van de watermerk-doos; default uit het register. */
  breedte?: number;
};

export type HeroBasis = {
  /** Tier-sleutel, voor de klasse `hero--div-<key>`. */
  key: TierKey;
  /** Custom properties voor DashboardHero.css. */
  stijl: CSSProperties;
  watermerk: HeroWatermerk | null;
  /** Toptier zonder register: de statische premium-glanshighlight (#773). */
  glans: "goat" | "dictator" | null;
};

/** Eerste stop van een gradient-tabel — de lichtste kant van het frame. */
function stop(
  tabel: ReadonlyArray<readonly [number, string]> | undefined,
  index: number,
): string | undefined {
  return tabel?.[index]?.[1];
}

/** Het basisthema voor deze rating.
 *
 *  `permanent` doet mee omdat een permanent thema het hele vlak overneemt (stap
 *  4 in de laagvolgorde ligt boven stap 3): dan is er niets te tekenen en houden
 *  we de DOM leeg in plaats van een onzichtbare laag te renderen.
 *
 *  `isDictator` gaat naar tierForWeergave: buiten De Troon toont niemand de
 *  El-Padelissimo-tier (#545), dus een speler van 1600+ zonder troon krijgt de
 *  GOAT-basis — precies wat zijn divisiebadge ernaast ook zegt. */
export function heroBasis(
  rating: number | null,
  {
    permanent = null,
    isDictator = false,
  }: { permanent?: HeroPermanent; isDictator?: boolean } = {},
): HeroBasis | null {
  if (permanent) return null;
  const tier = tierForWeergave(rating, isDictator);
  if (!tier) return null;

  const kaart = divisieKaart(tier.key);
  const reg = kaart?.register;
  const glans = premiumGlans(null, tier.key).variant;
  if (!reg && !glans) return null;

  const stijl: Record<string, string> = {};
  if (reg) {
    // De rand van de kaart: de lichtste framestop als hooglicht, de liner als
    // de donkere kern ertussen. Samen leest dat als hetzelfde materiaal dat de
    // FUT-kaart om zijn schild heeft staan.
    const hoog = stop(reg.frame, 0);
    if (hoog) stijl["--hero-div-hoog"] = hoog;
    if (reg.liner) stijl["--hero-div-liner"] = reg.liner;
    if (reg.keyline) stijl["--hero-div-keyline"] = reg.keyline;
    stijl["--hero-div-lijn"] = reg.lijn;
    stijl["--hero-div-gloed"] = reg.glow;
    // De lichtste vlak-stop als was over het kaartoppervlak. Alleen de tint
    // komt hier vandaan; de dekking staat in de CSS, zodat licht en donker
    // dezelfde waarde delen.
    stijl["--hero-div-was"] = reg.vlak[0];
  }

  return {
    key: tier.key,
    stijl: stijl as CSSProperties,
    watermerk: kaart?.motief
      ? {
          paden: kaart.motief.paden,
          kleur: kaart.motief.kleur,
          breedte: kaart.motief.breedte,
        }
      : null,
    glans: glans === "goat" || glans === "dictator" ? glans : null,
  };
}

/** De klassenlijst van de basis, zodat DashboardHero er niets over hoeft te
 *  weten. Leeg zodra een permanent thema het materiaal overneemt. */
export function heroBasisKlassen(basis: HeroBasis | null): string[] {
  if (!basis) return [];
  return [
    "hero--divisie",
    `hero--div-${basis.key}`,
    ...(basis.glans ? [`hero--glans-${basis.glans}`] : []),
  ];
}
