// Clubs zoeken op naam (#391).
//
// Apart van api.ts: dat bestand leest ook de snapshots uit Postgres en trekt
// dus de supabase-client mee. De clubkiezer heeft daar niets aan — hij praat
// alleen met de proxy — en zou anders in élke test die hem rendert een
// databankverbinding opzetten.

import { DEFAULT_CLUB, type Club } from "./club";
import { getJson } from "./playtomicFetch";

/** Zoektreffer: een club plus het adres waarmee je naamgenoten uit elkaar houdt. */
export type ClubTreffer = Club & {
  /** "9120 Pastoor Steenssensstraat 108a" — leeg als Playtomic niets meegeeft. */
  adres: string;
};

/** Vorm waarin de proxy (Worker/dev) de treffers teruggeeft — zie club-search. */
type RawClubTreffer = {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  street: string;
  postalCode: string;
};

/** Onder de twee tekens is de trefferlijst zinloos groot; dan niet zoeken. */
const MIN_TEKENS = 2;

/**
 * Belgische padelclubs zoeken op naam.
 *
 * Er is geen zoek-API meer (#385): de proxy leest de publieke zoekpagina van
 * Playtomic en geeft de geparste treffers terug (zie supabase/functions/
 * club-search). Twee dingen die het oude endpoint wél gaf, zitten er niet meer
 * in — de stad en de tijdzone. Voor Belgische clubs is de tijdzone geen gok
 * (Europe/Brussels); de stad laten we bewust leeg in plaats van hem uit een
 * postcode te verzinnen, en tonen in de trefferlijst het adres.
 */
export async function searchClubs(query: string): Promise<ClubTreffer[]> {
  const q = query.trim();
  if (q.length < MIN_TEKENS) return [];
  const { clubs } = await getJson<{ clubs: RawClubTreffer[] }>(
    `/club-search?q=${encodeURIComponent(q)}`,
    "Kon geen clubs zoeken",
  );
  return (clubs ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    city: "",
    timezone: DEFAULT_CLUB.timezone,
    adres: [c.postalCode, c.street].filter(Boolean).join(" "),
  }));
}
