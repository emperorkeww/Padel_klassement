import type { TierKey } from "@/features/rating/tiers";

export type KaartLaag =
  | "sfeer"
  | "randAchter"
  | "oppervlak"
  | "vuil"
  | "inkt"
  | "portret"
  | "randVoor"
  | "bodem"
  | "embleem";

export type KaartOnderdeelSlot = "achter" | "binnen" | "voor";

/** Alle maten zijn fracties van de volledige 100 × 139-kaartdoos. */
export interface KaartZone {
  x: number;
  y: number;
  breedte: number;
  hoogte: number;
  draai?: number;
}

export interface KaartOnderdeel extends KaartZone {
  id: string;
  src: string;
  alt?: string;
  laag: KaartLaag;
  slot: KaartOnderdeelSlot;
}

export interface KaartStat {
  label: string;
  waarde: (bron: SpelerStatBron | null) => number | string;
}

export interface SpelerStatBron {
  gespeeld: number;
  gewonnen: number;
  gelijk: number;
  verloren: number;
  punten: number;
  doelsaldo: number;
  vorm?: ReadonlyArray<"W" | "D" | "L">;
}

export interface DivisieKaartLayout {
  id: string;
  tier: TierKey;
  className: string;
  zones: {
    rating: KaartZone;
    subniveau: KaartZone;
    portret: KaartZone;
    naam: KaartZone;
    titel: KaartZone;
    statistieken: KaartZone;
  };
  statistieken: ReadonlyArray<KaartStat>;
  onderdelen: ReadonlyArray<KaartOnderdeel>;
}

export const KAART_LAAG_VOLGORDE: Record<KaartLaag, number> = {
  sfeer: 10,
  randAchter: 20,
  oppervlak: 30,
  vuil: 40,
  inkt: 50,
  portret: 60,
  randVoor: 70,
  bodem: 80,
  embleem: 90,
};

export function onderdelenPerSlot(
  layout: DivisieKaartLayout,
  slot: KaartOnderdeelSlot,
) {
  return layout.onderdelen
    .filter((onderdeel) => onderdeel.slot === slot)
    .sort(
      (a, b) =>
        KAART_LAAG_VOLGORDE[a.laag] - KAART_LAAG_VOLGORDE[b.laag],
    );
}
