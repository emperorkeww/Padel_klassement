// Tier-systeem (#127): genoemde divisies afgeleid van de globale Elo-rating,
// náást het punten-klassement en het kale rating-getal. Dit is de ENIGE plek
// met drempels; alle UI (badges, toasts, posters) leest hieruit.
//
// Banden van 100 rating-punten met sub-niveaus III/II/I van ~33 (III laagst).
// Brons is open naar beneden, de hoogste tier (Legende) open naar boven en
// zonder sub-niveaus. Iedereen start op 1000 = Goud III.

export type TierNaam =
  | "Slof"
  | "Karton"
  | "Hout"
  | "Brons"
  | "Zilver"
  | "Goud"
  | "Platina"
  | "Diamant"
  | "Meester"
  | "Legende";
export type TierKey =
  | "slof"
  | "karton"
  | "hout"
  | "brons"
  | "zilver"
  | "goud"
  | "platina"
  | "diamant"
  | "meester"
  | "legende";

export interface Tier {
  naam: TierNaam;
  /** CSS-modifier / kleurtoken-sleutel ("tier-badge--goud"). */
  key: TierKey;
  /** Herkenbaar icoon per divisie (naast de kleur). */
  emoji: string;
  /** Ludieke bijnaam van de divisie, bv. "goudhaantje". */
  flavor: string;
  /** Sub-niveau: III laagst, I hoogst; de hoogste tier heeft er geen. */
  sub: 3 | 2 | 1 | null;
  /** Sub-niveau als Romeins cijfer ("II"); null in de hoogste tier. */
  subLabel: string | null;
  /** Weergavenaam, bv. "Goud II" of "Diamant". */
  label: string;
  /** Ondergrens van dit (sub-)niveau, inclusief; null = open naar beneden. */
  min: number | null;
  /** Bovengrens, exclusief; null = open naar boven. */
  max: number | null;
  /** Monotone index over alle niveaus (Brons III = 0) voor vergelijkingen. */
  rang: number;
}

/** Hoofdtier-banden, van laag naar hoog. De onderste band (Slof) is open naar
 *  beneden: zijn min van 500 is virtueel en dient alleen om de sub-niveaus te
 *  snijden — alles daaronder klemt op Slof III. De bestaande drempels vanaf
 *  Brons (800+) zijn ongewijzigd, dus 1000 blijft Goud III. */
export const TIER_BANDEN: ReadonlyArray<{
  naam: TierNaam;
  key: TierKey;
  emoji: string;
  flavor: string;
  min: number;
  max: number | null;
}> = [
  { naam: "Slof", key: "slof", emoji: "🩴", flavor: "op je slippers", min: 500, max: 600 },
  { naam: "Karton", key: "karton", emoji: "📦", flavor: "van karton", min: 600, max: 700 },
  { naam: "Hout", key: "hout", emoji: "🪵", flavor: "houten racket", min: 700, max: 800 },
  { naam: "Brons", key: "brons", emoji: "🥉", flavor: "brons en brutaal", min: 800, max: 900 },
  { naam: "Zilver", key: "zilver", emoji: "🥈", flavor: "zilvervloot", min: 900, max: 1000 },
  { naam: "Goud", key: "goud", emoji: "🥇", flavor: "goudhaantje", min: 1000, max: 1100 },
  { naam: "Platina", key: "platina", emoji: "💠", flavor: "platinaplaat", min: 1100, max: 1200 },
  { naam: "Diamant", key: "diamant", emoji: "💎", flavor: "diamanten hand", min: 1200, max: 1300 },
  { naam: "Meester", key: "meester", emoji: "👑", flavor: "meesterlijk", min: 1300, max: 1400 },
  { naam: "Legende", key: "legende", emoji: "🌟", flavor: "levende legende", min: 1400, max: null },
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
    // Hoogste tier (Legende): open naar boven, geen sub-niveaus.
    return {
      naam: band.naam,
      key: band.key,
      emoji: band.emoji,
      flavor: band.flavor,
      sub: null,
      subLabel: null,
      label: band.naam,
      min: band.min,
      max: null,
      rang: bandIdx * 3,
    };
  }
  const breedte = band.max - band.min; // 100
  // Sub-index 0..2 (III..I); onder de virtuele bodem klemt dit op 0.
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
    emoji: band.emoji,
    flavor: band.flavor,
    sub: (3 - subIdx) as 3 | 2 | 1,
    subLabel: ROMEINS[subIdx],
    label: `${band.naam} ${ROMEINS[subIdx]}`,
    // De onderste tier (Slof III) is open naar beneden (de 500-vloer is virtueel).
    min: bandIdx === 0 && subIdx === 0 ? null : subMin,
    max: subMax,
    rang: bandIdx * 3 + subIdx,
  };
}

/** De hoofdtiers van hoog (Legende) naar laag (Slof) — voor het divisie-
 *  overzicht en de legenda. */
export const TIER_BANDEN_HOOG_NAAR_LAAG = [...TIER_BANDEN].reverse();

/** Rating-bereik van een hoofdtier als leesbare tekst voor de legenda,
 *  bv. "tot 599" (Slof, open omlaag), "1000–1099" of "1400+" (Legende). */
export function bandRangeLabel(band: (typeof TIER_BANDEN)[number]): string {
  if (band.max == null) return `${band.min}+`;
  // De laagste band (Slof) is open naar beneden; de 500-vloer is virtueel.
  if (band.naam === TIER_BANDEN[0].naam) return `tot ${band.max - 1}`;
  return `${band.min}–${band.max - 1}`;
}

export interface TierLegendItem {
  naam: TierNaam;
  key: TierKey;
  emoji: string;
  flavor: string;
  /** Rating-bereik van de tier, bv. "1000–1099". */
  range: string;
  /** Instapdrempel: de rating die je nodig hebt om erin te komen; null voor de
   *  laagste tier (geen ondergrens). */
  vanaf: number | null;
}

/** Legenda-gegevens: de hoofdtiers (hoog → laag) met hun rating-bereik en de
 *  instapdrempel die nodig is om er te komen. */
export function tierLegend(): TierLegendItem[] {
  return TIER_BANDEN_HOOG_NAAR_LAAG.map((b) => ({
    naam: b.naam,
    key: b.key,
    emoji: b.emoji,
    flavor: b.flavor,
    range: bandRangeLabel(b),
    // De laagste band heeft geen instapdrempel.
    vanaf: b.naam === TIER_BANDEN[0].naam ? null : b.min,
  }));
}

/** Tooltip-tekst met bijnaam en rating-grenzen, bv.
 *  "Goud II · goudhaantje · rating 1034–1066", "Legende · levende legende ·
 *  rating 1400+". De bovengrens is exclusief en wordt als max − 1 getoond. */
export function tierTitle(t: Tier): string {
  const bereik =
    t.max == null
      ? `rating ${t.min}+`
      : t.min == null
        ? `rating tot ${t.max - 1}`
        : `rating ${t.min}–${t.max - 1}`;
  return `${t.label} · ${t.flavor} · ${bereik}`;
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

export interface TierProgress {
  huidig: Tier;
  /** De eerstvolgende hoofd-divisie, of null als je al in de hoogste zit. */
  volgende: {
    naam: TierNaam;
    key: TierKey;
    emoji: string;
    /** Rating die je nodig hebt om deze divisie te bereiken. */
    vanaf: number;
  } | null;
  /** Rating-punten tot de volgende divisie; null in de hoogste tier. */
  puntenNodig: number | null;
}

/** Hoe ver een speler van de volgende hoofd-divisie af staat — voedt de
 *  "nog X tot Platina"-hint. Null bij een ontbrekende rating. */
export function tierProgress(rating: number | null): TierProgress | null {
  const huidig = tierFor(rating);
  if (huidig == null || rating == null) return null;
  const idx = TIER_BANDEN.findIndex((b) => b.naam === huidig.naam);
  const next = TIER_BANDEN[idx + 1];
  if (!next) return { huidig, volgende: null, puntenNodig: null };
  return {
    huidig,
    volgende: {
      naam: next.naam,
      key: next.key,
      emoji: next.emoji,
      vanaf: next.min,
    },
    puntenNodig: Math.max(0, next.min - rating),
  };
}
