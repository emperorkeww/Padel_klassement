// Tier-systeem (#127): genoemde divisies afgeleid van de globale Elo-rating,
// náást het punten-klassement en het kale rating-getal. Dit is de ENIGE plek
// met drempels; alle UI (badges, toasts, posters) leest hieruit.
//
// Banden van 100 rating-punten met sub-niveaus III/II/I van ~33 (III laagst).
// Brons is open naar beneden, Diamant open naar boven (geen sub-niveaus).
// Iedereen start op 1000 = Goud III.

export type TierNaam = "Brons" | "Zilver" | "Goud" | "Platina" | "Diamant";
export type TierKey = "brons" | "zilver" | "goud" | "platina" | "diamant";

export interface Tier {
  naam: TierNaam;
  /** CSS-modifier / kleurtoken-sleutel ("tier-badge--goud"). */
  key: TierKey;
  /** Sub-niveau: III laagst, I hoogst; Diamant heeft er geen. */
  sub: 3 | 2 | 1 | null;
  /** Weergavenaam, bv. "Goud II" of "Diamant". */
  label: string;
  /** Ondergrens van dit (sub-)niveau, inclusief; null = open naar beneden. */
  min: number | null;
  /** Bovengrens, exclusief; null = open naar boven. */
  max: number | null;
  /** Monotone index over alle niveaus (Brons III = 0) voor vergelijkingen. */
  rang: number;
}

/** Hoofdtier-banden. De Brons-min van 800 is virtueel en dient alleen om de
 *  sub-niveaus te snijden: alles daaronder klemt op Brons III. */
export const TIER_BANDEN: ReadonlyArray<{
  naam: TierNaam;
  key: TierKey;
  min: number;
  max: number | null;
}> = [
  { naam: "Brons", key: "brons", min: 800, max: 900 },
  { naam: "Zilver", key: "zilver", min: 900, max: 1000 },
  { naam: "Goud", key: "goud", min: 1000, max: 1100 },
  { naam: "Platina", key: "platina", min: 1100, max: 1200 },
  { naam: "Diamant", key: "diamant", min: 1200, max: null },
];

const ROMEINS = ["III", "II", "I"] as const;

/** Rating → tier; null (nog nooit gespeeld) → null. */
export function tierFor(rating: number | null): Tier | null {
  if (rating == null) return null;
  const laatste = TIER_BANDEN.length - 1;
  const bandIdx =
    rating >= TIER_BANDEN[laatste].min
      ? laatste
      : Math.max(
          0,
          TIER_BANDEN.findIndex((b) => b.max != null && rating < b.max),
        );
  const band = TIER_BANDEN[bandIdx];
  if (band.max == null) {
    // Diamant: open naar boven, geen sub-niveaus.
    return {
      naam: band.naam,
      key: band.key,
      sub: null,
      label: band.naam,
      min: band.min,
      max: null,
      rang: bandIdx * 3,
    };
  }
  const breedte = band.max - band.min; // 100
  // Sub-index 0..2 (III..I); onder de virtuele Brons-vloer klemt dit op 0.
  const subIdx = Math.min(
    2,
    Math.max(0, Math.floor(((rating - band.min) * 3) / breedte)),
  );
  const subMin = band.min + Math.ceil((subIdx * breedte) / 3);
  const subMax =
    subIdx === 2 ? band.max : band.min + Math.ceil(((subIdx + 1) * breedte) / 3);
  return {
    naam: band.naam,
    key: band.key,
    sub: (3 - subIdx) as 3 | 2 | 1,
    label: `${band.naam} ${ROMEINS[subIdx]}`,
    // Brons III is open naar beneden (de 800-vloer is virtueel).
    min: bandIdx === 0 && subIdx === 0 ? null : subMin,
    max: subMax,
    rang: bandIdx * 3 + subIdx,
  };
}

/** Tooltip-tekst met de rating-grenzen van het niveau, bv.
 *  "Goud II · rating 1034–1066", "Diamant · rating 1200+",
 *  "Brons III · rating tot 833". De bovengrens is exclusief en wordt dus als
 *  max − 1 getoond (integer-ratings). */
export function tierTitle(t: Tier): string {
  if (t.max == null) return `${t.label} · rating ${t.min}+`;
  if (t.min == null) return `${t.label} · rating tot ${t.max - 1}`;
  return `${t.label} · rating ${t.min}–${t.max - 1}`;
}

export interface TierWissel {
  richting: "promotie" | "degradatie";
  van: Tier;
  naar: Tier;
  /** True als ook de hoofdtier wisselde (Goud → Platina); false bij III → II. */
  hoofdtier: boolean;
}

/** Tier-wissel tussen twee ratings, over sub-niveaus heen; null bij gelijk
 *  niveau of een ontbrekende rating. */
export function tierChange(
  before: number | null,
  after: number | null,
): TierWissel | null {
  const van = tierFor(before);
  const naar = tierFor(after);
  if (!van || !naar || van.rang === naar.rang) return null;
  return {
    richting: naar.rang > van.rang ? "promotie" : "degradatie",
    van,
    naar,
    hoofdtier: van.naam !== naar.naam,
  };
}
