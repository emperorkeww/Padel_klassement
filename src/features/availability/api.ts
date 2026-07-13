// Baanbeschikbaarheid van de gekozen club (zie club.ts) via Playtomic.
//
// Playtomic biedt geen publieke, officiële API voor spelers. We gebruiken de
// (ongedocumenteerde) endpoints die de Playtomic-site zelf ook aanroept. Die
// staan CORS vanuit de browser niet toe, dus alle calls lopen via een kleine
// proxy op /api/playtomic (Vite-proxy in dev, Cloudflare Worker in productie).
//
// Let op de tijdzones: de local_start_min/max-filters zijn lokale clubtijd,
// maar de start_time in de respons is UTC. De openingsuren uit de
// tenant-endpoint zijn dan weer lokaal. Slottijden worden daarom hieronder
// naar de kloktijd van de club (tenant.address.timezone) omgezet.
//
// Beperking van de bron: de API toont boekbare producten (start + duur +
// prijs), geen werkelijke bezetting. Een vrij gat korter dan het kleinste
// product (60 min) is dus niet te onderscheiden van een boeking.

import {
  addDays,
  dateInZone,
  fromMinutes,
  minutesNowInZone,
  toMinutes,
} from "../../lib/time";
import { DEFAULT_CLUB, getClub, isPlaytomicClub, type Club } from "./club";

const BASE = "/api/playtomic";

/**
 * Deep-link naar de Playtomic-clubpagina, voorgevuld op de gekozen dag.
 * Het tenant-id werkt als slug: Playtomic stuurt door (308) naar de canonieke
 * clubpagina, met behoud van de query. De clubpagina leest alleen ?sport= en
 * ?date= uit de URL; een specifiek uur kan niet vooraf geselecteerd worden.
 */
export function bookingUrl(date: string): string {
  const params = new URLSearchParams({ sport: "PADEL", date });
  return `https://playtomic.com/clubs/${getClub().id}?${params.toString()}`;
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

// Playtomic gebruikt Engelse weekdagnamen als sleutel in opening_hours.
const WEEKDAY_KEYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

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
export type DayAvailability = {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
  timeZone: string; // clubtijdzone, voor "vandaag"/"voorbij" in de weergave
  courts: CourtRow[];
};

type RawResource = {
  resource_id: string;
  name: string;
  properties?: { resource_type?: string };
};
type RawTenant = {
  tenant_name?: string;
  resources?: RawResource[];
  opening_hours?: Record<string, { opening_time?: string; closing_time?: string }>;
  address?: {
    city?: string;
    timezone?: string;
    // Playtomic levert de clublocatie onder wisselende veldnamen.
    coordinate?: { lat?: number; lon?: number; latitude?: number; longitude?: number };
  };
};
type RawSlot = { start_time: string; duration: number; price: string };
type RawAvailability = { resource_id: string; start_date: string; slots?: RawSlot[] };

// Een slot als UTC-moment: de datum uit de respons-entry + start_time + duur.
type SlotMoment = { date: string; time: string; duration: number; price: string };

async function getJson<T>(path: string, foutmelding: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 429) {
    throw new Error("Even te veel verzoeken naar Playtomic — probeer zo opnieuw.");
  }
  if (!res.ok) throw new Error(`${foutmelding} (status ${res.status}).`);
  return res.json() as Promise<T>;
}

// Clubgegevens (banen, openingsuren) zijn de facto statisch: één keer per
// sessie per club ophalen i.p.v. bij elke datumwissel en elk dashboardbezoek.
const tenantPromises = new Map<string, Promise<RawTenant>>();
function getTenant(tenantId: string): Promise<RawTenant> {
  let promise = tenantPromises.get(tenantId);
  if (!promise) {
    promise = getJson<RawTenant>(
      `/v1/tenants/${tenantId}`,
      "Kon de clubgegevens niet laden",
    ).catch((err: unknown) => {
      // Fout niet vasthouden; volgende poging mag opnieuw proberen.
      tenantPromises.delete(tenantId);
      throw err;
    });
    tenantPromises.set(tenantId, promise);
  }
  return promise;
}

/**
 * Clubgegevens op tenant-id, voor gedeelde links met ?club=… — zelfde
 * tenant-detail (en dus cache) als het beschikbaarheidsraster.
 */
export async function fetchClub(id: string): Promise<Club> {
  const tenant = await getTenant(id);
  if (!tenant.tenant_name) throw new Error("Onbekende club.");
  return {
    id,
    name: tenant.tenant_name,
    city: tenant.address?.city ?? "",
    timezone: tenant.address?.timezone ?? DEFAULT_CLUB.timezone,
  };
}

/** Clublocatie voor de weerstrip (#83); null als Playtomic er geen meegeeft. */
export async function getClubCoordinate(
  tenantId: string,
): Promise<{ lat: number; lon: number } | null> {
  const c = (await getTenant(tenantId)).address?.coordinate;
  const lat = c?.lat ?? c?.latitude;
  const lon = c?.lon ?? c?.longitude;
  return typeof lat === "number" && typeof lon === "number" ? { lat, lon } : null;
}

async function getSlotsByCourt(
  date: string,
  tenantId: string,
): Promise<Record<string, SlotMoment[]>> {
  const params = new URLSearchParams({
    user_id: "me",
    tenant_id: tenantId,
    sport_id: "PADEL",
    local_start_min: `${date}T00:00:00`,
    local_start_max: `${date}T23:59:59`,
  });
  const data = await getJson<RawAvailability[]>(
    `/v1/availability?${params.toString()}`,
    "Kon de beschikbaarheid niet laden",
  );
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
  return byCourt;
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

/**
 * Haalt voor een dag (YYYY-MM-DD) de openingsuren en per baan de vrije
 * starttijden (met duren en prijzen) op.
 */
export async function getClubAvailability(
  date: string,
  club: Club = getClub(),
): Promise<DayAvailability> {
  const [tenant, byCourt] = await Promise.all([
    getTenant(club.id),
    getSlotsByCourt(date, club.id),
  ]);

  const weekday = WEEKDAY_KEYS[new Date(`${date}T00:00:00`).getDay()];
  const hours = tenant.opening_hours?.[weekday];

  // Clubtijdzone, niet die van het apparaat: wie vanuit het buitenland kijkt
  // moet dezelfde tijden zien als op de Playtomic-clubpagina.
  const timeZone = tenant.address?.timezone ?? club.timezone;

  const courts: CourtRow[] = (tenant.resources ?? []).map((r) => {
    const free = new Map<string, SlotOption[]>();
    for (const slot of byCourt[r.resource_id] ?? []) {
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
    return {
      court: {
        id: r.resource_id,
        name: r.name,
        type: r.properties?.resource_type ?? "",
      },
      free,
    };
  });

  // Tijd-as: openingsuren, maar opgerekt als er slots buiten vallen (bv.
  // afwijkende feestdaguren die de tenant-data niet per datum meegeeft).
  // Zo verdwijnen slots nooit stilletjes buiten het raster.
  let openM = toMinutes(hours?.opening_time ?? "08:00");
  let closeM = toMinutes(hours?.closing_time ?? "23:00");
  for (const row of courts) {
    for (const [t, options] of row.free) {
      const from = toMinutes(t);
      openM = Math.min(openM, from);
      closeM = Math.max(closeM, from + Math.max(...options.map((o) => o.duration)));
    }
  }

  return { open: fromMinutes(openM), close: fromMinutes(closeM), timeZone, courts };
}

// Wat we van een club uit het zoekendpoint nodig hebben; de respons bevat
// veel meer (banen, foto's, boekingsinstellingen), maar dat halen we pas op
// via het tenant-detail zodra de club echt gekozen is.
type RawTenantSummary = {
  tenant_id: string;
  tenant_name: string;
  address?: { city?: string; timezone?: string; country_code?: string };
};

/** Zoekt actieve Belgische Playtomic-clubs met padelbanen op (deel van de) naam. */
export async function searchClubs(query: string): Promise<Club[]> {
  const params = new URLSearchParams({
    playtomic_status: "ACTIVE",
    sport_id: "PADEL",
    tenant_name: query,
    // Server-side op België filteren. Zonder deze parameter zeeft een
    // client-side filter de (wereldwijde) top-10 leeg: op "padel" matchen
    // duizenden buitenlandse clubs en blijft er geen Belgische over.
    country_code: "BE",
    size: "10",
  });
  const data = await getJson<RawTenantSummary[]>(
    `/v1/tenants?${params.toString()}`,
    "Kon geen clubs zoeken",
  );
  // Vangnet voor als de (ongedocumenteerde) landparameter ooit wegvalt.
  return data
    .filter((t) => t.address?.country_code === "BE")
    .map((t) => ({
      id: t.tenant_id,
      name: t.tenant_name,
      city: t.address?.city ?? "",
      timezone: t.address?.timezone ?? DEFAULT_CLUB.timezone,
    }));
}

/** Eén dag in het weekoverzicht; data of een foutmelding, nooit allebei. */
export type WeekDay = {
  date: string;
  data: DayAvailability | null;
  error: string | null;
};

/**
 * Beschikbaarheid voor een reeks dagen. De API staat maximaal 25 uur per
 * aanvraag toe, dus dit zijn parallelle dag-aanvragen (de Worker-cache deelt
 * ze tussen gebruikers). Eén mislukte dag blokkeert de rest niet.
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
  // Expliciet per dag doorgeven: dates.map(getClubAvailability) zou de index als
  // tweede argument (club) meesturen.
  const results = await Promise.allSettled(
    dates.map((d) => getClubAvailability(d, club)),
  );
  return results.map((result, i) =>
    result.status === "fulfilled"
      ? { date: dates[i], data: result.value, error: null }
      : {
          date: dates[i],
          data: null,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        },
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
