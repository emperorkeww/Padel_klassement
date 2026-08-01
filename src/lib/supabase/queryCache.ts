// Kleine module-level querycache met TTL, gedeeld over alle componenten.
//
// Doel: dezelfde lookup (profielen, teams, standen) niet op elke pagina en
// elke navigatie opnieuw ophalen. Lopende én recente promises worden per
// sleutel gedeeld; mutaties en realtime-events invalideren per prefix, zodat
// een reload() na een wijziging altijd verse data ziet.
//
// De cache is begrensd (#738): een PWA blijft dagen open staan, en sleutels met
// een id erin (matches:one:…, profiles:one:…) zijn per bekeken item uniek.
// Zonder grens groeit de Map alleen maar — verlopen entries werden vroeger pas
// weggegooid als dezelfde sleutel opnieuw gevraagd werd. Nu geldt: verlopen
// entries verdwijnen bij lezen, bij een sweep (tabwissel) en via een LRU-grens.

type Entry = { at: number; ttl: number; promise: Promise<unknown> };

const cache = new Map<string, Entry>();

const DEFAULT_TTL = 30_000; // 30s: ruim binnen een "sessie-moment", kort genoeg voor live gevoel

/** Bovengrens op het aantal entries. Ruim boven wat één scherm nodig heeft, laag
 *  genoeg om een dagenlange sessie niet te laten oplopen. */
const MAX_ENTRIES = 200;

function isFresh(entry: Entry, now: number): boolean {
  return now - entry.at < entry.ttl;
}

/** Gooit de oudst-gebruikte entries weg tot de cache weer binnen de grens past.
 *  Map bewaart insertion-order en `cached()` her-insert bij elke hit, dus de
 *  eerste sleutel is de langst niet aangeraakte. */
function evictIfNeeded() {
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) return;
    cache.delete(oldest.value);
  }
}

function store(key: string, promise: Promise<unknown>, ttlMs: number) {
  // Eerst weg, dan erin: zo staat de sleutel achteraan in de insertion-order en
  // blijft die volgorde bruikbaar als recency-lijst.
  cache.delete(key);
  cache.set(key, { at: Date.now(), ttl: ttlMs, promise });
  evictIfNeeded();
}

/** Voegt de standaard foutafhandeling toe: fouten niet cachen, zodat de
 *  volgende poging opnieuw mag proberen. */
function forgetOnError<T>(key: string, promise: Promise<T>): Promise<T> {
  return promise.catch((err: unknown) => {
    cache.delete(key);
    throw err;
  });
}

/** Haalt data via de cache; bij een verse hit wordt de bestaande promise gedeeld. */
export function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL,
): Promise<T> {
  const hit = cache.get(key);
  if (hit) {
    if (isFresh(hit, Date.now())) {
      // Aanraken = achteraan in de recency-volgorde zetten (zonder de TTL te
      // verlengen: `at` blijft het moment van ophalen).
      cache.delete(key);
      cache.set(key, hit);
      return hit.promise as Promise<T>;
    }
    cache.delete(key);
  }
  const promise = forgetOnError(key, fn());
  store(key, promise, ttlMs);
  return promise;
}

/**
 * Cachet per losse id in plaats van per id-combinatie (#738).
 *
 * Sleutels als `profiles:ids:<hele lijst>` zijn uniek per samenstelling, dus
 * elke bekeken wedstrijd liet een eigen entry met volledige profielrijen
 * achter. Hier krijgt elke id zijn eigen sleutel (`${prefix}${id}`), zodat
 * overlappende sets hun entries delen — en die sleutels zijn dezelfde als die
 * van de losse getters, dus een `getProfile()` profiteert er ook van.
 *
 * De ontbrekende id's worden in één `fetchMissing`-aanroep opgehaald (niet N
 * losse queries). De afgeleide per-id-promises worden synchroon weggeschreven,
 * vóór het awaiten, zodat een tweede aanroeper met dezelfde set meelift op de
 * lopende fetch in plaats van een tweede query te starten.
 */
export function cachedMany<T>(
  prefix: string,
  ids: string[],
  fetchMissing: (missing: string[]) => Promise<Record<string, T>>,
  ttlMs: number = DEFAULT_TTL,
): Promise<Record<string, T>> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return Promise.resolve({});

  const now = Date.now();
  const hits: Promise<[string, T | null]>[] = [];
  const missing: string[] = [];

  for (const id of wanted) {
    const key = `${prefix}${id}`;
    const hit = cache.get(key);
    if (hit && isFresh(hit, now)) {
      cache.delete(key);
      cache.set(key, hit);
      hits.push((hit.promise as Promise<T | null>).then((v) => [id, v]));
    } else {
      if (hit) cache.delete(key);
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    const batch = fetchMissing(missing);
    for (const id of missing) {
      const key = `${prefix}${id}`;
      // Niet-gevonden id's leggen we als null vast: dat is wat de losse getter
      // ook teruggeeft, en het voorkomt dat een verwijderd profiel bij elke
      // render opnieuw wordt opgevraagd.
      const one = forgetOnError(
        key,
        batch.then((map) => map[id] ?? null),
      );
      store(key, one, ttlMs);
      hits.push(one.then((v) => [id, v]));
    }
  }

  return Promise.all(hits).then((pairs) =>
    Object.fromEntries(pairs.filter(([, v]) => v != null)),
  ) as Promise<Record<string, T>>;
}

/** Verwijdert alle verlopen entries. Wordt aangeroepen zodra de gebruiker naar
 *  het tabblad terugkeert (zie `useRefetchOnFocus`): een sessie die uren op de
 *  achtergrond stond, begint dan weer met een opgeruimde cache. Alleen verlopen
 *  entries — alles wissen zou de renderende schermen een refetch-storm geven. */
export function sweepExpired() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (!isFresh(entry, now)) cache.delete(key);
  }
}

// Abonnees op invalidatie (#907). Een cache legen is niet genoeg: componenten
// die al gerenderd staan houden hun eigen kopie in useAsync-state en merken
// niets van een lege cache. Wie op dezelfde gegevens leunt als een ander scherm
// — het lef-dagtegoed, dat over meerdere matchkaarten gedeeld is — kan zich
// hier abonneren en zelf opnieuw ophalen.
type InvalidateListener = (prefixes: string[]) => void;

const listeners = new Set<InvalidateListener>();

function notify(prefixes: string[]) {
  for (const cb of listeners) cb(prefixes);
}

/** Abonneert op invalidaties; geeft een unsubscribe-functie terug. De callback
 *  krijgt de geraakte prefixen mee — `""` betekent "alles" (invalidateAll). */
export function subscribeInvalidate(cb: InvalidateListener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Verwijdert alle sleutels die met één van de prefixen beginnen. */
export function invalidate(...prefixes: string[]) {
  for (const key of cache.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) cache.delete(key);
  }
  notify(prefixes);
}

/** Leegt de hele cache — bij in-/uitloggen, zodat RLS-gefilterde data nooit
 *  tussen sessies blijft hangen. */
export function invalidateAll() {
  cache.clear();
  // De lege prefix raakt per definitie elke sleutel: abonnees weten zo dat hun
  // gegevens óók weg zijn, zonder dat we hier elke prefix hoeven te kennen.
  notify([""]);
}

/** Aantal entries in de cache. Alleen voor tests/diagnose. */
export function cacheSize(): number {
  return cache.size;
}
