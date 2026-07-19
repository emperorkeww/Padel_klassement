// Tier-systeem (#127): genoemde divisies afgeleid van de globale Elo-rating,
// náást het punten-klassement en het kale rating-getal. Dit is de ENIGE plek
// met drempels; alle UI (badges, toasts, posters) leest hieruit.
//
// Banden van 100 rating-punten met sub-niveaus III/II/I van ~33 (III laagst).
// De onderste tier (Sletje van de baan) is open naar beneden, de hoogste
// (El Padelissimo) open naar boven en zonder sub-niveaus. Iedereen start op
// 1000 = Wannabe III.
//
// De namen zijn bewust ludiek/beledigend — dit draait onder vrienden: onderaan
// genadeloze roast, bovenaan absurde grootspraak.

export type TierNaam =
  | "Sletje van de baan"
  | "Toerist"
  | "Prutser"
  | "Bankvuller"
  | "Blaaskaak"
  | "Wannabe"
  | "Glazenwasser"
  | "Racketconsument"
  | "Forever second"
  | "GOAT"
  | "El Padelissimo";
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
  | "legende"
  | "dictator";

export interface Tier {
  naam: TierNaam;
  /** CSS-modifier / kleurtoken-sleutel ("tier-badge--goud"). */
  key: TierKey;
  /** Herkenbaar icoon per divisie (naast de kleur). */
  emoji: string;
  /** Ludieke bijnaam van de divisie, bv. "denkt dat-ie goed is". */
  flavor: string;
  /** Sub-niveau: III laagst, I hoogst; de hoogste tier heeft er geen. */
  sub: 3 | 2 | 1 | null;
  /** Sub-niveau als Romeins cijfer ("II"); null in de hoogste tier. */
  subLabel: string | null;
  /** Weergavenaam, bv. "Wannabe II" of "Forever second". */
  label: string;
  /** Ondergrens van dit (sub-)niveau, inclusief; null = open naar beneden. */
  min: number | null;
  /** Bovengrens, exclusief; null = open naar boven. */
  max: number | null;
  /** Monotone index over alle niveaus (Sletje van de baan III = 0) voor vergelijkingen. */
  rang: number;
}

/** Hoofdtier-banden, van laag naar hoog. De onderste band (Sletje van de baan) is open
 *  naar beneden: zijn min of 500 is virtueel en dient alleen om de sub-niveaus
 *  te snijden — alles daaronder klemt op Sletje van de baan III. De rating-drempels zijn
 *  ongewijzigd t.o.v. de eerste versie; alleen de namen zijn ludieker.
 *  De `key` blijft de kleur-/tokensleutel (brons = bronskleur enz.). */
export const TIER_BANDEN: ReadonlyArray<{
  naam: TierNaam;
  key: TierKey;
  emoji: string;
  flavor: string;
  min: number;
  max: number | null;
}> = [
  { naam: "Sletje van de baan", key: "slof", emoji: "🥴", flavor: "wordt door de rest van de club gebruikt voor makkelijke gratis winst", min: 500, max: 600 },
  { naam: "Toerist", key: "karton", emoji: "🌴", flavor: "draagt een zonnebril, doet alsof-ie op vakantie is en beweegt voor geen meter", min: 600, max: 700 },
  { naam: "Prutser", key: "hout", emoji: "🫠", flavor: "heeft de hand-oogcoördinatie van een dronken pinguïn", min: 700, max: 800 },
  { naam: "Bankvuller", key: "brons", emoji: "🪑", flavor: "blijft bij voorkeur op de bank zitten om het spelniveau niet te verpesten", min: 800, max: 900 },
  { naam: "Blaaskaak", key: "zilver", emoji: "💨", flavor: "geeft luidkeels tactisch advies dat-ie zelf nog nooit succesvol heeft uitgevoerd", min: 900, max: 1000 },
  { naam: "Wannabe", key: "goud", emoji: "😤", flavor: "koopt een racket van €350 om het chronische gebrek aan talent te compenseren", min: 1000, max: 1100 },
  { naam: "Glazenwasser", key: "platina", emoji: "🪟", flavor: "heeft de glazen achterwand zo vaak geraakt dat hij er inmiddels woont", min: 1100, max: 1200 },
  { naam: "Racketconsument", key: "diamant", emoji: "🛍️", flavor: "gelooft oprecht dat zijn zevende racket dit jaar zijn vreselijke backhand gaat redden", min: 1200, max: 1300 },
  { naam: "Forever second", key: "meester", emoji: "🥈", flavor: "eeuwig gedoemd om de verliezersfinale te spelen, de ultieme figurant", min: 1300, max: 1400 },
  { naam: "GOAT", key: "legende", emoji: "🐐", flavor: "heeft een ego dat zo reusachtig groot is dat het niet eens in de kooi past", min: 1400, max: 1600 },
  { naam: "El Padelissimo", key: "dictator", emoji: "🫡", flavor: "regeert de club als sportief directeur, weert tegenstanders uit de groepsapp en verbiedt kebabs met zijn beeltenis in de kantine", min: 1600, max: null },
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
    // Hoogste tier (El Padelissimo): open naar boven, geen sub-niveaus.
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
    // De onderste tier (Sletje van de baan III) is open naar beneden (de 500-vloer is virtueel).
    min: bandIdx === 0 && subIdx === 0 ? null : subMin,
    max: subMax,
    rang: bandIdx * 3 + subIdx,
  };
}

/** Eén hoofdtier-band uit TIER_BANDEN (divisie zonder sub-niveau). */
export type TierBand = (typeof TIER_BANDEN)[number];

/** De gedeelde hoofddivisie van een groep spelers: de band waarin ze állemaal
 *  zitten, of null zodra één rating ontbreekt of een divisie afwijkt.
 *  Sub-niveaus (III/II/I) tellen niet mee — "divisie" is voor spelers de
 *  hoofdtier. Voedt de derby-detectie (#169). */
export function zelfdeDivisie(
  ratings: ReadonlyArray<number | null>,
): TierBand | null {
  if (ratings.length === 0) return null;
  let band: TierBand | null = null;
  for (const rating of ratings) {
    const tier = tierFor(rating);
    if (!tier) return null;
    if (band && band.naam !== tier.naam) return null;
    band ??= TIER_BANDEN.find((b) => b.naam === tier.naam) ?? null;
  }
  return band;
}

/** De hoofdtiers van hoog (El Padelissimo) naar laag (Sletje van de baan) — voor
 *  het divisie-overzicht en de legenda. */
export const TIER_BANDEN_HOOG_NAAR_LAAG = [...TIER_BANDEN].reverse();

/** Rating-bereik van een hoofdtier als leesbare tekst voor de legenda,
 *  bv. "tot 599" (Sletje van de baan, open omlaag), "1000–1099" of "1600+"
 *  (El Padelissimo). */
export function bandRangeLabel(band: (typeof TIER_BANDEN)[number]): string {
  if (band.max == null) return `${band.min}+`;
  // De laagste band (Sletje van de baan) is open naar beneden; de 500-vloer is virtueel.
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
 *  "Wannabe II · denkt dat-ie goed is — schattig · rating 1034–1066",
 *  "El Padelissimo · onaantastbaar — en dat weet iedereen · rating 1600+".
 *  De bovengrens is exclusief en wordt als max − 1 getoond. */
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
  /** True als ook de hoofdtier wisselde (Wannabe → Pletwals); false bij III → II. */
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
 *  "nog X tot Pletwals"-hint. Null bij een ontbrekende rating. */
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
