// Kleine module-level querycache met TTL, gedeeld over alle componenten.
//
// Doel: dezelfde lookup (profielen, teams, standen) niet op elke pagina en
// elke navigatie opnieuw ophalen. Lopende én recente promises worden per
// sleutel gedeeld; mutaties en realtime-events invalideren per prefix, zodat
// een reload() na een wijziging altijd verse data ziet.

type Entry = { at: number; promise: Promise<unknown> };

const cache = new Map<string, Entry>();

const DEFAULT_TTL = 30_000; // 30s: ruim binnen een "sessie-moment", kort genoeg voor live gevoel

/** Haalt data via de cache; bij een verse hit wordt de bestaande promise gedeeld. */
export function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise as Promise<T>;
  const promise = fn().catch((err: unknown) => {
    // Fouten niet cachen: de volgende poging mag opnieuw proberen.
    cache.delete(key);
    throw err;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

/** Verwijdert alle sleutels die met één van de prefixen beginnen. */
export function invalidate(...prefixes: string[]) {
  for (const key of cache.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) cache.delete(key);
  }
}

/** Leegt de hele cache — bij in-/uitloggen, zodat RLS-gefilterde data nooit
 *  tussen sessies blijft hangen. */
export function invalidateAll() {
  cache.clear();
}
