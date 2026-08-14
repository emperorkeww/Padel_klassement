// Baanbeschikbaarheid van de gekozen club (zie club.ts) via Playtomic.
//
// Playtomic biedt geen publieke, officiële API voor spelers. We gebruiken het
// (ongedocumenteerde) beschikbaarheidsendpoint dat de Playtomic-web-app zelf
// aanroept: playtomic.com/api/clubs/availability. Dat staat CORS vanuit de
// browser niet toe, dus alle calls lopen via een kleine proxy op
// /api/playtomic (Vite-proxy in dev, Cloudflare Worker in productie).
//
// Voor de thuisclub leest de client primair uit de cron-snapshots in Postgres
// (#405, zie snapshotApi.ts): dat koppelt het upstream-verkeer los van het
// aantal bezoekers en houdt /banen bruikbaar bij korte Playtomic-uitval. Het
// live pad hierboven blijft de route voor andere clubs en als fallback.
//
// Let op de tijdzones: de start_time in de respons is UTC. Slottijden worden
// hieronder naar de kloktijd van de club (club.timezone) omgezet.
//
// Beperking van de bron: het endpoint geeft alleen boekbare producten (start
// + duur + prijs) per baan (resource_id), géén baannamen, openingsuren of
// clubgegevens — die endpoints zijn verdwenen (#385). Namen komen uit een
// lokale snapshot (knownCourts.ts) of vallen terug op "Terrein N"; de
// openingsuren-as wordt uit de slots afgeleid. Een vrij gat korter dan het
// kleinste product (60 min) is niet te onderscheiden van een boeking.

import {
  addDays,
  dateInZone,
  fromMinutes,
  minutesNowInZone,
  toMinutes,
} from "@/lib/utils/time";
import { DEFAULT_CLUB, getClub, isPlaytomicClub, type Club } from "./club";
import { BASE, getJson, PlaytomicUnavailableError } from "./playtomicFetch";
// De fout hoort bij het leespad hieronder; hem hier herexporteren houdt de
// bestaande imports uit "./api" heel na de verhuizing naar playtomicFetch.
export { PlaytomicUnavailableError } from "./playtomicFetch";
import { KNOWN_COURTS } from "./knownCourts";
import {
  getSnapshot,
  getSnapshots,
  type AvailabilitySnapshot,
} from "./snapshotApi";

/**
 * Deep-link naar de Playtomic-clubpagina, voorgevuld op de gekozen dag.
 * De canonieke clubpagina gebruikt een slug (bv. "lago-club-padel-beveren");
 * het tenant-id als pad landt op een interne, kapotte redirect. We resolven
 * daarom de slug via de proxy (zie getClubSlug) en bouwen daarmee de link.
 * De clubpagina leest ?sport= en ?date= uit de URL; een specifiek uur kan
 * niet vooraf geselecteerd worden.
 *
 * Zonder bekende slug valt de link terug op playtomic.io/clubs/{id}: dat
 * stuurt netjes door naar de juiste clubpagina (maar zonder dag-voorvulling).
 */
export async function bookingUrl(club: Club, date: string): Promise<string> {
  const slug = await getClubSlug(club.id);
  if (!slug) return `https://playtomic.io/clubs/${club.id}`;
  const params = new URLSearchParams({ sport: "PADEL", date });
  return `https://playtomic.com/clubs/${slug}?${params.toString()}`;
}

// Club-slug (voor bookingUrl): de facto onveranderlijk, dus één keer per
// sessie per club ophalen. De proxy volgt de playtomic.io-redirect en cachet
// de slug ook aan de edge. null = niet te resolven (dan de uuid-fallback).
const slugPromises = new Map<string, Promise<string | null>>();
function getClubSlug(tenantId: string): Promise<string | null> {
  let promise = slugPromises.get(tenantId);
  if (!promise) {
    promise = fetch(`${BASE}/club-slug/${tenantId}`, {
      headers: { Accept: "application/json" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { slug?: string } | null) => body?.slug ?? null)
      .catch(() => {
        // Fout niet vasthouden; een volgende poging mag opnieuw proberen.
        slugPromises.delete(tenantId);
        return null;
      });
    slugPromises.set(tenantId, promise);
  }
  return promise;
}

/**
 * Deeltekst voor de groepschat, bv. "Terrein 3 vrij van 20:30 tot 21:30 op
 * vr 3 juli bij LAGO CLUB Padel Beveren".
 */
export function slotShareText(
  slot: { court: string; start: string; end: string },
  date: string,
  clubName: string,
): string {
  // 's Middags rekenen, zodat een DST-omschakeling de datum niet kan kantelen.
  const day = new Intl.DateTimeFormat("nl-BE", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
  return `${slot.court} vrij van ${slot.start} tot ${slot.end} op ${day} bij ${clubName}`;
}

/**
 * Absolute deep-link naar het raster van deze app; dag en club reizen mee in
 * de URL zodat de ontvanger hetzelfde overzicht ziet (zie Availability.tsx).
 */
export function slotShareUrl(
  date: string,
  clubId: string,
  view?: "week",
): string {
  const params = new URLSearchParams({ datum: date, club: clubId });
  if (view === "week") params.set("weergave", "week");
  return `${window.location.origin}/banen?${params.toString()}`;
}

export type Court = { id: string; name: string; type: string };
/** Boekbare optie op een starttijd: speelduur (minuten) + weergaveprijzen. */
export type SlotOption = {
  duration: number;
  price: string;
  /** Prijs per persoon (baanprijs ÷ 4); null als de prijs niet numeriek is. */
  perPerson: string | null;
};
/** Per baan: vrije starttijd ("HH:MM", clubtijd) → opties, oplopend op duur. */
export type CourtRow = { court: Court; free: Map<string, SlotOption[]> };
export type AvailabilitySource = "live" | "snapshot";
export type DayAvailability = {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
  timeZone: string; // clubtijdzone, voor "vandaag"/"voorbij" in de weergave
  courts: CourtRow[];
  /** Waar de data vandaan komt: rechtstreeks van Playtomic of de cron-snapshot. */
  source: AvailabilitySource;
  /** ISO-tijdstip van de snapshot; null bij een live respons ("nu"). */
  fetchedAt: string | null;
};

export type RawSlot = { start_time: string; duration: number; price: string };
export type RawAvailability = {
  resource_id: string;
  start_date: string;
  slots?: RawSlot[];
};

// Een slot als UTC-moment: de datum uit de respons-entry + start_time + duur.
type SlotMoment = { date: string; time: string; duration: number; price: string };

/** Rauwe beschikbaarheid van één dag, live bij Playtomic opgehaald. */
function fetchDayRaw(date: string, tenantId: string): Promise<RawAvailability[]> {
  const params = new URLSearchParams({
    tenant_id: tenantId,
    date,
    sport_id: "PADEL",
  });
  return getJson<RawAvailability[]>(
    `/api/clubs/availability?${params.toString()}`,
    "Kon de beschikbaarheid niet laden",
  );
}

/**
 * Alle halfuren ("HH:MM") waarop de baan vrij is: elk boekbaar slot dekt de
 * vakken van zijn starttijd tot start + langste duur. Zo is het onderscheid
 * te maken tussen "echt bezet" en "vrij, maar geen boeking kan hier starten"
 * (bv. het laatste halfuur voor sluiting, of de staart van een lang slot).
 */
export function coveredTimes(free: Map<string, SlotOption[]>): Set<string> {
  const covered = new Set<string>();
  for (const [start, options] of free) {
    const from = toMinutes(start);
    const longest = Math.max(...options.map((o) => o.duration));
    for (let m = from; m < from + longest; m += 30) {
      covered.add(fromMinutes(m));
    }
  }
  return covered;
}

// Gedeelde weergave: nl-BE, hele euro's zonder centen, anders 2 decimalen.
function formatAmount(n: number, currency: string): string {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Eerstvolgende boekbare starttijd van de dag + de banen die dan vrij zijn. */
export type NextFreeSlot = { time: string; courts: Court[] };

/**
 * Vroegste vrije starttijd van de dag, over alle banen heen. Respecteert het
 * duurfilter en telt vandaag (nowMinutes ≠ null) alleen starttijden ná nu —
 * dezelfde "voorbij"-grens als het raster (start ≤ nu is voorbij).
 */
export function nextFreeSlot(
  data: DayAvailability,
  duration: number | null,
  nowMinutes: number | null,
): NextFreeSlot | null {
  const cutoff = nowMinutes ?? -1;
  let best: number | null = null;
  let courts: Court[] = [];
  for (const row of data.courts) {
    for (const [t, options] of row.free) {
      const m = toMinutes(t);
      if (m <= cutoff) continue;
      if (duration != null && !options.some((o) => o.duration === duration)) continue;
      if (best == null || m < best) {
        best = m;
        courts = [row.court];
      } else if (m === best) {
        courts.push(row.court);
      }
    }
  }
  return best == null ? null : { time: fromMinutes(best), courts };
}

/** Playtomic-prijs ("23.33 EUR") → NL-weergave ("€ 23,33", hele euro's zonder centen). */
export function formatPrice(raw: string): string {
  const [num, currency] = raw.split(" ");
  const n = Number(num);
  if (!Number.isFinite(n)) return raw;
  try {
    return formatAmount(n, currency);
  } catch {
    return raw;
  }
}

/**
 * Prijs per persoon (padel speel je met vier): baanprijs ÷ 4, zelfde weergave
 * als formatPrice. Niet-numerieke prijs (bv. "op aanvraag") → null.
 */
export function perPersonPrice(raw: string): string | null {
  const [num, currency] = raw.split(" ");
  const n = Number(num);
  if (!Number.isFinite(n)) return null;
  try {
    return formatAmount(n / 4, currency);
  } catch {
    return null;
  }
}

// Kloktijd-formatters zijn duur om te maken; één per tijdzone volstaat.
const clubTimeFormatters = new Map<string, Intl.DateTimeFormat>();
function clubTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = clubTimeFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("nl-BE", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    clubTimeFormatters.set(timeZone, fmt);
  }
  return fmt;
}

/**
 * Zet een UTC-slotmoment (datum + "HH:MM:SS") om naar de kloktijd ("HH:MM")
 * van de club. Intl handelt zomer-/wintertijd af, ook op omschakeldagen.
 */
export function utcToClubTime(date: string, time: string, timeZone: string): string {
  return clubTimeFormatter(timeZone).format(new Date(`${date}T${time}Z`));
}

/** Baannaam + type voor één resource. Namen komen uit de lokale snapshot
 *  (knownCourts.ts); onbekende banen krijgen een genummerd label. */
function courtInfo(club: Club, resourceId: string, index: number): Court {
  const known = KNOWN_COURTS[club.id]?.find((c) => c.id === resourceId);
  if (known) return { id: resourceId, name: known.name, type: known.type };
  return { id: resourceId, name: `Terrein ${index + 1}`, type: "" };
}

/** Herkomst van een DayAvailability: bron + snapshot-tijdstip (null = live). */
type AvailabilityOrigin = { source: AvailabilitySource; fetchedAt: string | null };

/**
 * Bouwt uit een rauwe availability-respons (live óf uit de snapshot-tabel)
 * het dagoverzicht per baan: vrije starttijden met duren en prijzen.
 * Baannamen/-types komen uit de lokale snapshot (het availability-endpoint
 * geeft alleen resource_id's); de tijd-as wordt uit de slots afgeleid, met
 * 08:00–23:00 als ondergrens.
 */
export function buildDayAvailability(
  data: RawAvailability[],
  club: Club,
  origin: AvailabilityOrigin,
): DayAvailability {
  const byCourt: Record<string, SlotMoment[]> = {};
  for (const entry of data) {
    const list = (byCourt[entry.resource_id] ??= []);
    for (const slot of entry.slots ?? []) {
      list.push({
        date: entry.start_date,
        time: slot.start_time,
        duration: slot.duration,
        price: slot.price,
      });
    }
  }

  // Clubtijdzone, niet die van het apparaat: wie vanuit het buitenland kijkt
  // moet dezelfde tijden zien als op de Playtomic-clubpagina.
  const timeZone = club.timezone;

  // Bekende banen (snapshot) vormen de basisvolgorde, zodat een volgeboekte
  // baan als lege rij zichtbaar blijft; onbekende banen uit de respons volgen
  // erachter, gesorteerd op resource_id voor een stabiele volgorde per dag.
  const known = KNOWN_COURTS[club.id] ?? [];
  const knownIds = known.map((c) => c.id);
  const extraIds = Object.keys(byCourt)
    .filter((id) => !knownIds.includes(id))
    .sort();
  const resourceIds = [...knownIds, ...extraIds];

  const courts: CourtRow[] = resourceIds.map((resourceId, index) => {
    const free = new Map<string, SlotOption[]>();
    for (const slot of byCourt[resourceId] ?? []) {
      const t = utcToClubTime(slot.date, slot.time, timeZone);
      const options = free.get(t) ?? [];
      if (!options.some((o) => o.duration === slot.duration)) {
        options.push({
          duration: slot.duration,
          price: formatPrice(slot.price),
          perPerson: perPersonPrice(slot.price),
        });
        options.sort((a, b) => a.duration - b.duration);
      }
      free.set(t, options);
    }
    return { court: courtInfo(club, resourceId, index), free };
  });

  // Tijd-as: vaste basis 08:00–23:00, opgerekt als er slots buiten vallen. Zo
  // verdwijnen slots nooit stilletjes buiten het raster (het endpoint geeft
  // geen openingsuren meer, dus de slots zijn de enige bron).
  let openM = toMinutes("08:00");
  let closeM = toMinutes("23:00");
  for (const row of courts) {
    for (const [t, options] of row.free) {
      const from = toMinutes(t);
      openM = Math.min(openM, from);
      closeM = Math.max(closeM, from + Math.max(...options.map((o) => o.duration)));
    }
  }

  return {
    open: fromMinutes(openM),
    close: fromMinutes(closeM),
    timeZone,
    courts,
    source: origin.source,
    fetchedAt: origin.fetchedAt,
  };
}

// Hoe oud een snapshot mag zijn om als "vers" te gelden. Gekoppeld aan de
// cron-cadans (volledige weeksweep elk uur, zie
// supabase/snippets/availability_snapshot_cron.sql): 90 min overleeft één
// gemiste tik zonder dat dag 3-7 structureel naar het live pad terugvalt.
const SNAPSHOT_FRESH_MS = 90 * 60_000;

function isSnapshotFresh(snapshot: AvailabilitySnapshot): boolean {
  return Date.now() - Date.parse(snapshot.fetchedAt) < SNAPSHOT_FRESH_MS;
}

/**
 * Is dit een verouderde snapshot, geserveerd als vangnet omdat het live pad
 * faalde? De weergave meldt dan eerlijk van wanneer de stand is.
 */
export function isStaleAvailability(data: DayAvailability): boolean {
  return (
    data.fetchedAt != null &&
    Date.now() - Date.parse(data.fetchedAt) >= SNAPSHOT_FRESH_MS
  );
}

/** De jsonb-payload hoort een RawAvailability[] te zijn; anders negeren. */
function snapshotData(
  snapshot: AvailabilitySnapshot | null,
): RawAvailability[] | null {
  if (!snapshot || !Array.isArray(snapshot.payload)) return null;
  return snapshot.payload as RawAvailability[];
}

/**
 * Dagoverzicht met de snapshot als eerste keus: een verse snapshot spaart de
 * upstream-call uit; zonder (verse) snapshot volgt het live pad, en faalt dat
 * terwijl er nog een verouderde snapshot ligt, dan is die nuttiger dan een
 * foutmelding (de weergave meldt het tijdstip, zie Availability.tsx).
 */
async function resolveDay(
  date: string,
  club: Club,
  snapshot: AvailabilitySnapshot | null,
): Promise<DayAvailability> {
  const cachedData = snapshotData(snapshot);
  const fromSnapshot =
    snapshot && cachedData
      ? () =>
          buildDayAvailability(cachedData, club, {
            source: "snapshot",
            fetchedAt: snapshot.fetchedAt,
          })
      : null;
  if (fromSnapshot && snapshot && isSnapshotFresh(snapshot)) return fromSnapshot();
  try {
    const data = await fetchDayRaw(date, club.id);
    return buildDayAvailability(data, club, { source: "live", fetchedAt: null });
  } catch (err) {
    if (fromSnapshot && err instanceof PlaytomicUnavailableError) {
      return fromSnapshot();
    }
    throw err;
  }
}

/**
 * Beschikbaarheid van één dag. Voor de thuisclub eerst de cron-snapshot uit
 * Postgres (#405) — geen upstream-call naar Playtomic.
 */
export async function getClubAvailability(
  date: string,
  club: Club = getClub(),
): Promise<DayAvailability> {
  const snapshot =
    club.id === DEFAULT_CLUB.id ? await getSnapshot(club.id, date) : null;
  return resolveDay(date, club, snapshot);
}

/** "lago-club-padel-beveren" → "Lago Club Padel Beveren". */
function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Clubgegevens op tenant-id, voor gedeelde links met ?club=… Er is geen
 * clubdetail-endpoint meer (#385); we resolven daarom de slug en leiden de
 * naam daaruit af. De app is BE-only, dus Europe/Brussels is een veilige
 * tijdzone-aanname.
 */
export async function fetchClub(id: string): Promise<Club> {
  const slug = await getClubSlug(id);
  if (!slug) throw new Error("Onbekende club.");
  return {
    id,
    name: humanizeSlug(slug),
    city: "",
    timezone: DEFAULT_CLUB.timezone,
  };
}

/** Eén dag in het weekoverzicht; data of een foutmelding, nooit allebei. */
export type WeekDay = {
  date: string;
  data: DayAvailability | null;
  error: string | null;
};

/**
 * Beschikbaarheid voor een reeks dagen. Snapshots komen in één range-query
 * uit Postgres (thuisclub, #405); alleen dagen zonder verse snapshot gaan
 * nog live — de Playtomic-API staat maximaal 25 uur per aanvraag toe, dus
 * dat zijn parallelle dag-aanvragen (de Worker-cache deelt ze tussen
 * gebruikers). Eén mislukte dag blokkeert de rest niet.
 */
export async function getWeekAvailability(
  fromDate: string,
  days = 7,
  club: Club = getClub(),
): Promise<WeekDay[]> {
  const dates = Array.from({ length: days }, (_, i) => addDays(fromDate, i));
  // Handmatige locatie (#322): geen Playtomic-tenant, dus geen beschikbaarheid
  // op te vragen. Lege dagen; de gebruiker voegt de momenten zelf toe.
  if (!isPlaytomicClub(club)) {
    return dates.map((date) => ({ date, data: null, error: null }));
  }
  const snapshots =
    club.id === DEFAULT_CLUB.id
      ? await getSnapshots(club.id, fromDate, days)
      : new Map<string, AvailabilitySnapshot>();
  return Promise.all(
    dates.map(async (date): Promise<WeekDay> => {
      try {
        const data = await resolveDay(date, club, snapshots.get(date) ?? null);
        return { date, data, error: null };
      } catch (err) {
        return {
          date,
          data: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );
}

/** Moment in de week waarop de meeste banen tegelijk vrij zijn. */
export type BestWeekMoment = { date: string; time: string; count: number };

/**
 * Tijdstip in de week met de meeste tegelijk vrije banen. Respecteert het
 * duurfilter zoals nextFreeSlot en telt vandaag (in clubtijd!) alleen
 * starttijden ná nu — dezelfde "voorbij"-grens als het raster. Bij gelijke
 * stand wint het vroegste moment (eerste dag, dan vroegste tijd). Dagen
 * zonder data (fout) doen niet mee.
 */
export function bestWeekMoment(
  week: WeekDay[],
  duration: number | null,
): BestWeekMoment | null {
  let best: BestWeekMoment | null = null;
  for (const day of week) {
    if (!day.data) continue;
    const isToday = day.date === dateInZone(day.data.timeZone);
    const cutoff = isToday ? minutesNowInZone(day.data.timeZone) : -1;

    // Aantal vrije banen per starttijd (minuten sinds middernacht).
    const counts = new Map<number, number>();
    for (const row of day.data.courts) {
      for (const [t, options] of row.free) {
        const m = toMinutes(t);
        if (m <= cutoff) continue;
        if (duration != null && !options.some((o) => o.duration === duration)) continue;
        counts.set(m, (counts.get(m) ?? 0) + 1);
      }
    }

    // Beste van deze dag: meeste banen, bij gelijke stand de vroegste tijd
    // (de Map volgt de rastervolgorde per baan, niet de kloktijd).
    let dayBest: { start: number; count: number } | null = null;
    for (const [start, count] of counts) {
      if (
        !dayBest ||
        count > dayBest.count ||
        (count === dayBest.count && start < dayBest.start)
      ) {
        dayBest = { start, count };
      }
    }

    // De week is chronologisch: alleen strikt méér banen verslaat een eerdere dag.
    if (dayBest && (!best || dayBest.count > best.count)) {
      best = { date: day.date, time: fromMinutes(dayBest.start), count: dayBest.count };
    }
  }
  return best;
}
