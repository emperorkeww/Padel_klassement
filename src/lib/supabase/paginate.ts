// Pagineren langs max_rows heen (#731).
//
// Sommige queries moeten écht compleet zijn: de teams-map en de profielen-map
// zijn lookups waar de hele app namen uit haalt, en de matchlijst van een groep
// voedt de stand van die groep. Een afkapping op `max_rows` levert daar geen
// foutmelding op maar "Onbekend team" en een stand die stilletjes rijen mist.
//
// Zo'n query kun je niet oprekken — een `.limit()` bóven `max_rows` wordt door
// PostgREST alsnog teruggeknipt. Wat wél kan is pagineren met `.range()`: pagina
// voor pagina ophalen tot er een onvolledige pagina terugkomt. De wachter uit
// truncation.ts blijft voor de queries die dit niet nodig hebben; deze helper is
// voor de handvol die niet mag missen.

import { MAX_ROWS } from "./truncation";

/** Eén pagina ophalen; `from`/`to` zijn inclusief, net als bij `.range()`. */
type PageFetcher<T> = (
  from: number,
  to: number,
) => PromiseLike<{ data: T[] | null; error: unknown }>;

/** Noodrem: 50 pagina's = 50.000 rijen. Dat haalt geen enkele lookup in deze
 *  app; komen we hier toch, dan is er iets anders mis en wil je het weten in
 *  plaats van eindeloos door te pagineren. */
const MAX_PAGES = 50;

/**
 * Haalt alle rijen op in pagina's van `max_rows`. Stopt zodra een pagina niet
 * vol is — dat is het einde van de tabel.
 *
 *   const teams = await fetchAllPages((from, to) =>
 *     supabase.from("teams").select("*").order("id").range(from, to));
 *
 * Let op: geef de query een stabiele, volledige sortering mee (eindig op een
 * unieke kolom). Zonder deterministische volgorde kan dezelfde rij op twee
 * pagina's opduiken — of tussen wal en schip vallen.
 */
export async function fetchAllPages<T>(
  fetchPage: PageFetcher<T>,
  pageSize: number = MAX_ROWS,
): Promise<T[]> {
  const alles: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * pageSize;
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const rijen = data ?? [];
    alles.push(...rijen);
    if (rijen.length < pageSize) return alles;
  }
  console.warn(
    `[supabase] pagineren gestopt na ${MAX_PAGES} pagina's (${alles.length} rijen) — ` +
      `dit hoort een begrensde lookup te zijn (#731).`,
  );
  return alles;
}
