// De Belgische drankkaart (#1004): waar de verliezers de winnaars op
// trakteren. Preset-constante zoals courtType.ts — label + icoon voor de
// keuze in de match-wizard, de matchkaarten, de feed en de drankstatistiek op
// het profiel. De volgorde bepaalt hoe de kiezer en de statistiek sorteren.
//
// Let op de naamgenoot: matches/stakes.ts is de LEF-TIP (#804), die je
// Elo-mutatie verdubbelt. Dit hier is een sociale weddenschap en raakt de
// rating met geen vinger aan.
//
// De slug is wat in matches.wager_drink belandt (zie
// supabase/schemas/tables/05_matches.sql, check matches_wager_drink_slug:
// ^[a-z0-9-]{2,40}$). Bewust geen enum in de databank: deze lijst groeit, en
// dat zou per nieuw biertje een migratie kosten. Prijs daarvan is dat een
// onbekende slug hier kan binnenkomen — die degraderen we naar de slug zelf
// in plaats van te crashen.

import type { Match } from "@/types";

export type DrankSoort = "bier" | "fris";

export interface DrankInfo {
  slug: string;
  label: string;
  icon: string;
  soort: DrankSoort;
}

/** Grens uit de check-constraint matches_wager_qty_range. */
export const DRANK_MIN_AANTAL = 1;
export const DRANK_MAX_AANTAL = 10;

/** De 25 populairste Belgische bieren, in de volgorde van de issue. */
export const BIEREN: DrankInfo[] = [
  { slug: "jupiler", label: "Jupiler", icon: "🍺", soort: "bier" },
  { slug: "stella-artois", label: "Stella Artois", icon: "🍺", soort: "bier" },
  { slug: "maes", label: "Maes", icon: "🍺", soort: "bier" },
  { slug: "duvel", label: "Duvel", icon: "😈", soort: "bier" },
  { slug: "leffe", label: "Leffe (Blond / Bruin)", icon: "🍺", soort: "bier" },
  {
    slug: "tripel-karmeliet",
    label: "Tripel Karmeliet",
    icon: "🍻",
    soort: "bier",
  },
  { slug: "la-chouffe", label: "La Chouffe", icon: "🧙", soort: "bier" },
  { slug: "cornet", label: "Cornet", icon: "🎺", soort: "bier" },
  { slug: "omer", label: "Omer", icon: "🍺", soort: "bier" },
  {
    slug: "vedett",
    label: "Vedett Extra Blond",
    icon: "🍺",
    soort: "bier",
  },
  {
    slug: "chimay",
    label: "Chimay (Blauw / Rood / Tripel)",
    icon: "🍺",
    soort: "bier",
  },
  {
    slug: "westmalle",
    label: "Westmalle (Tripel / Dubbel)",
    icon: "⛪",
    soort: "bier",
  },
  { slug: "orval", label: "Orval", icon: "🐟", soort: "bier" },
  { slug: "rochefort", label: "Rochefort (8 / 10)", icon: "🍺", soort: "bier" },
  {
    slug: "delirium-tremens",
    label: "Delirium Tremens",
    icon: "🐘",
    soort: "bier",
  },
  {
    slug: "gouden-carolus",
    label: "Gouden Carolus (Classic / Tripel)",
    icon: "👑",
    soort: "bier",
  },
  { slug: "victoria", label: "Victoria", icon: "🍺", soort: "bier" },
  { slug: "affligem", label: "Affligem", icon: "🍺", soort: "bier" },
  {
    slug: "kasteelbier",
    label: "Kasteelbier (Rouge / Donker)",
    icon: "🏰",
    soort: "bier",
  },
  { slug: "lindemans-kriek", label: "Lindemans Kriek", icon: "🍒", soort: "bier" },
  { slug: "hoegaarden", label: "Hoegaarden Witbier", icon: "🍋", soort: "bier" },
  {
    slug: "de-koninck",
    label: "De Koninck (Bolleke)",
    icon: "🤲",
    soort: "bier",
  },
  { slug: "saint-hubertus", label: "Saint Hubertus", icon: "🦌", soort: "bier" },
  {
    slug: "troubadour-magma",
    label: "Troubadour Magma",
    icon: "🌋",
    soort: "bier",
  },
  { slug: "cristal-alken", label: "Cristal Alken", icon: "💎", soort: "bier" },
];

/** De 10 populairste frisdranken en waters, in de volgorde van de issue. */
export const FRISDRANKEN: DrankInfo[] = [
  {
    slug: "coca-cola",
    label: "Coca-Cola (Original / Zero)",
    icon: "🥤",
    soort: "fris",
  },
  { slug: "fanta-orange", label: "Fanta Orange", icon: "🍊", soort: "fris" },
  { slug: "sprite", label: "Sprite", icon: "🍋", soort: "fris" },
  {
    slug: "ice-tea",
    label: "Lipton Ice Tea / Fuze Tea",
    icon: "🧊",
    soort: "fris",
  },
  { slug: "spa", label: "Spa (Plat / Bruis)", icon: "💧", soort: "fris" },
  {
    slug: "chaudfontaine",
    label: "Chaudfontaine (Plat / Bruis)",
    icon: "💧",
    soort: "fris",
  },
  { slug: "perrier", label: "Perrier", icon: "🫧", soort: "fris" },
  { slug: "red-bull", label: "Red Bull", icon: "🐂", soort: "fris" },
  {
    slug: "schweppes",
    label: "Schweppes (Tonic / Agrum)",
    icon: "🍸",
    soort: "fris",
  },
  { slug: "oasis", label: "Oasis / Gini", icon: "🍹", soort: "fris" },
];

/** De volledige kaart: eerst de bieren, dan het fris. */
export const DRANKEN: DrankInfo[] = [...BIEREN, ...FRISDRANKEN];

const BY_SLUG = new Map(DRANKEN.map((d) => [d.slug, d]));

/** De kaartinfo bij een slug, of null als de slug niet (meer) op de kaart staat. */
export function drankInfo(slug: string | null | undefined): DrankInfo | null {
  return slug ? (BY_SLUG.get(slug) ?? null) : null;
}

/** Label bij een slug ("Tripel Karmeliet"); onbekende slug → de slug zelf. */
export function drankLabel(slug: string | null | undefined): string {
  if (!slug) return "";
  return BY_SLUG.get(slug)?.label ?? slug;
}

/** Icoontje bij een slug; onbekende slug → een neutraal glas. */
export function drankIcon(slug: string | null | undefined): string {
  if (!slug) return "";
  return BY_SLUG.get(slug)?.icon ?? "🥂";
}

/** Zoekt op label én slug, hoofdletter- en accentongevoelig. Lege term = alles. */
export function zoekDranken(term: string, lijst: DrankInfo[] = DRANKEN): DrankInfo[] {
  const q = normaliseer(term);
  if (!q) return lijst;
  return lijst.filter(
    (d) => normaliseer(d.label).includes(q) || d.slug.includes(q),
  );
}

function normaliseer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** "2× Duvel per winnaar" — het kale onderwerp van de weddenschap. */
export function traktatieTekst(
  slug: string | null | undefined,
  aantal: number | null | undefined,
): string {
  if (!slug) return "";
  const n = Math.max(DRANK_MIN_AANTAL, aantal ?? 1);
  return `${n}× ${drankLabel(slug)} per winnaar`;
}

/**
 * Staat de traktatie nog open? Alleen dan heeft de knop "Traktatie ingelost"
 * zin: er moet een drankje op staan, de match moet afgerond zijn én er moet
 * een winnaar zijn. Bij gelijkspel vervalt de inzet — settle_match_wager
 * weigert dat serverside ook.
 */
export function traktatieOpen(match: Match): boolean {
  return (
    !!match.wager_drink &&
    match.status === "completed" &&
    match.winner_team_id != null &&
    !match.wager_settled_at
  );
}

/**
 * Eén regel voor de matchkaart, het matchdetail en de feed. Volgt de stand van
 * zaken: vooraf de inzet, achteraf de afrekening. Null = er staat geen drankje
 * op deze match.
 */
export function traktatieRegel(match: Match): string | null {
  if (!match.wager_drink) return null;
  const tekst = traktatieTekst(match.wager_drink, match.wager_drink_qty);
  const icoon = drankIcon(match.wager_drink);
  // Afgelast: er is niet gespeeld, dus er valt niets te halen. Zonder deze tak
  // bleef er "Inzet: …" staan op een match die nooit meer komt.
  if (match.status === "cancelled") {
    return `${icoon} Inzet vervallen — de match ging niet door`;
  }
  if (match.status === "completed") {
    // Geen winnaar = gelijkspel: niemand trakteert, iedereen droog.
    if (match.winner_team_id == null) {
      return `${icoon} Inzet vervallen — gelijkspel, dus ${tekst.replace(
        " per winnaar",
        "",
      )} blijft aan de tap`;
    }
    if (match.wager_settled_at) return `🍻 Traktatie ingelost: ${tekst}`;
    return `${icoon} Nog te betalen: ${tekst}`;
  }
  return `${icoon} Inzet: ${tekst}`;
}
