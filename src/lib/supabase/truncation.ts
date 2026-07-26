// Afkap-wachter voor PostgREST (#731).
//
// PostgREST kapt élk resultaat af op `max_rows` (supabase/config.toml:18 en de
// hosted default: 1000). Dat gebeurt stil: `error` blijft null, je krijgt
// gewoon minder rijen dan er zijn. Een query zonder filter of limiet levert dus
// op een dag ongemerkt een half antwoord — precies wat er met
// getAllRatingHistories dreigde te gebeuren.
//
// Een resultaat dat exact op de limiet uitkomt is hét signaal dat er afgekapt
// is (of dat je er rakelings tegenaan zit). Deze wachter maakt dat luidruchtig
// in plaats van stil, zodat het opvalt vóórdat de UI verkeerde data toont.

/** De PostgREST-grens uit supabase/config.toml; ook de hosted default. */
export const MAX_ROWS = 1000;

/**
 * Waarschuwt wanneer `rows` de limiet raakt en geeft de rijen ongewijzigd
 * terug, zodat hij om een resultaat heen te vouwen is:
 *
 *   return warnIfTruncated(data ?? [], "rating_history");
 *
 * `limit` is de expliciete `.limit()` van de query; laat 'm weg als de query er
 * geen heeft — dan geldt `max_rows`.
 */
export function warnIfTruncated<T>(
  rows: T[],
  source: string,
  limit: number = MAX_ROWS,
): T[] {
  if (rows.length >= limit) {
    console.warn(
      `[supabase] ${source}: ${rows.length} rijen = de limiet (${limit}). ` +
        `Waarschijnlijk afgekapt — filter, pagineer of gebruik een RPC (#731).`,
    );
  }
  return rows;
}
