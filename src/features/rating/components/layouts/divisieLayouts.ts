import type { FutEditie } from "../FutKaart";
import oppervlak from "../ballenraper/assets/ballenraper-surface.webp";
import type {
  DivisieKaartLayout,
  SpelerStatBron,
} from "./kaartLayout";
import type { TierKey } from "@/features/rating/tiers";
import { SLOF_LAYOUT } from "../slof/slofLayout";

const begrens = (waarde: number) => Math.max(1, Math.min(99, Math.round(waarde)));
const verhouding = (deel: number, totaal: number) =>
  totaal > 0 ? deel / totaal : 0;

const score = (
  bron: SpelerStatBron | null,
  bereken: (bron: SpelerStatBron) => number,
) => (bron ? begrens(bereken(bron)) : "—");

export const BALLENRAPER_LAYOUT: DivisieKaartLayout = {
  id: "ballenraper",
  tier: "hout",
  className: "fut-kaart--ballenraper-layout",
  zones: {
    rating: { x: 0.145, y: 0.145, breedte: 0.33, hoogte: 0.13 },
    subniveau: { x: 0.22, y: 0.275, breedte: 0.18, hoogte: 0.07 },
    portret: { x: 0.565, y: 0.19, breedte: 0.245, hoogte: 0.176 },
    naam: { x: 0.14, y: 0.465, breedte: 0.72, hoogte: 0.09 },
    titel: { x: 0.245, y: 0.58, breedte: 0.51, hoogte: 0.055 },
    statistieken: { x: 0.155, y: 0.672, breedte: 0.69, hoogte: 0.105 },
  },
  statistieken: [
    {
      label: "RAPEN",
      waarde: (bron) =>
        score(bron, (b) => 54 + verhouding(b.verloren, b.gespeeld) * 38),
    },
    {
      label: "HUSTLE",
      waarde: (bron) =>
        score(bron, (b) => 48 + Math.min(b.gespeeld, 35) * 1.25),
    },
    {
      label: "FOCUS",
      waarde: (bron) =>
        score(
          bron,
          (b) =>
            42 +
            verhouding(b.gewonnen + b.gelijk * 0.5, b.gespeeld) * 50,
        ),
    },
    {
      label: "VOETWERK",
      waarde: (bron) =>
        score(bron, (b) => 64 + Math.max(-18, Math.min(18, b.doelsaldo))),
    },
    {
      label: "OPRUIMEN",
      waarde: (bron) =>
        score(bron, (b) => 50 + verhouding(b.punten, b.gespeeld * 3) * 42),
    },
  ],
  onderdelen: [
    {
      id: "oppervlak",
      src: oppervlak,
      laag: "randAchter",
      slot: "binnen",
      x: -0.1,
      y: -0.072,
      breedte: 1.2,
      hoogte: 1.151,
    },
  ],
};

const LAYOUTS: Partial<Record<TierKey, DivisieKaartLayout>> = {
  hout: BALLENRAPER_LAYOUT,
  slof: SLOF_LAYOUT,
};

/** Een tijdelijke editie wint altijd van de permanente divisie-layout. */
export function divisieLayout(
  tier: TierKey | null | undefined,
  editie: FutEditie | null | undefined,
) {
  return !editie && tier ? LAYOUTS[tier] : undefined;
}
