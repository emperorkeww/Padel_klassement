// Baanbeschikbaarheid van LAGO CLUB Padel Beveren via Playtomic.
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

import { addDays, fromMinutes, toMinutes } from "../../lib/time";

const TENANT_ID = "91d8d419-3736-498e-90be-362de786d588";
const BASE = "/api/playtomic";

export const CLUB_NAME = "LAGO CLUB Padel Beveren";
const CLUB_SLUG = "lago-club-padel-beveren";
/** Tijdzone van de club; de tenant-respons kan dit bevestigen/overschrijven. */
export const CLUB_TIMEZONE = "Europe/Brussels";

/**
 * Deep-link naar de Playtomic-clubpagina, voorgevuld op de gekozen dag.
 * De clubpagina leest alleen ?sport= en ?date= uit de URL; een specifiek uur
 * kan niet vooraf geselecteerd worden.
 */
export function bookingUrl(date: string): string {
  const params = new URLSearchParams({ sport: "PADEL", date });
  return `https://playtomic.com/clubs/${CLUB_SLUG}?${params.toString()}`;
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
/** Boekbare optie op een starttijd: speelduur (minuten) + weergaveprijs. */
export type SlotOption = { duration: number; price: string };
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
  resources?: RawResource[];
  opening_hours?: Record<string, { opening_time?: string; closing_time?: string }>;
  address?: { timezone?: string };
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
// sessie ophalen i.p.v. bij elke datumwissel en elk dashboardbezoek.
let tenantPromise: Promise<RawTenant> | null = null;
function getTenant(): Promise<RawTenant> {
  tenantPromise ??= getJson<RawTenant>(
    `/v1/tenants/${TENANT_ID}`,
    "Kon de clubgegevens niet laden",
  ).catch((err: unknown) => {
    // Fout niet vasthouden; volgende poging mag opnieuw proberen.
    tenantPromise = null;
    throw err;
  });
  return tenantPromise;
}

async function getSlotsByCourt(date: string): Promise<Record<string, SlotMoment[]>> {
  const params = new URLSearchParams({
    user_id: "me",
    tenant_id: TENANT_ID,
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

/** Playtomic-prijs ("23.33 EUR") → NL-weergave ("€ 23,33", hele euro's zonder centen). */
export function formatPrice(raw: string): string {
  const [num, currency] = raw.split(" ");
  const n = Number(num);
  if (!Number.isFinite(n)) return raw;
  try {
    return new Intl.NumberFormat("nl-BE", {
      style: "currency",
      currency: currency || "EUR",
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return raw;
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
): Promise<DayAvailability> {
  const [tenant, byCourt] = await Promise.all([
    getTenant(),
    getSlotsByCourt(date),
  ]);

  const weekday = WEEKDAY_KEYS[new Date(`${date}T00:00:00`).getDay()];
  const hours = tenant.opening_hours?.[weekday];

  // Clubtijdzone, niet die van het apparaat: wie vanuit het buitenland kijkt
  // moet dezelfde tijden zien als op de Playtomic-clubpagina.
  const timeZone = tenant.address?.timezone ?? CLUB_TIMEZONE;

  const courts: CourtRow[] = (tenant.resources ?? []).map((r) => {
    const free = new Map<string, SlotOption[]>();
    for (const slot of byCourt[r.resource_id] ?? []) {
      const t = utcToClubTime(slot.date, slot.time, timeZone);
      const options = free.get(t) ?? [];
      if (!options.some((o) => o.duration === slot.duration)) {
        options.push({ duration: slot.duration, price: formatPrice(slot.price) });
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
): Promise<WeekDay[]> {
  const dates = Array.from({ length: days }, (_, i) => addDays(fromDate, i));
  const results = await Promise.allSettled(dates.map(getClubAvailability));
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
