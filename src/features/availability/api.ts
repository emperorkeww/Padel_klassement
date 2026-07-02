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

const TENANT_ID = "91d8d419-3736-498e-90be-362de786d588";
const BASE = "/api/playtomic";

export const CLUB_NAME = "LAGO CLUB Padel Beveren";
const CLUB_SLUG = "lago-club-padel-beveren";

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
/** Per baan: vrije starttijd ("HH:MM", clubtijd) → boekbare duren in minuten. */
export type CourtRow = { court: Court; free: Map<string, number[]> };
export type DayAvailability = {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
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
type SlotMoment = { date: string; time: string; duration: number };

async function getJson<T>(path: string, foutmelding: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
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
export function coveredTimes(free: Map<string, number[]>): Set<string> {
  const covered = new Set<string>();
  for (const [start, durations] of free) {
    const from = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
    for (let m = from; m < from + Math.max(...durations); m += 30) {
      covered.add(
        `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
      );
    }
  }
  return covered;
}

/**
 * Zet een UTC-slotmoment (datum + "HH:MM:SS") om naar de kloktijd ("HH:MM")
 * van de club. Intl handelt zomer-/wintertijd af, ook op omschakeldagen.
 */
export function utcToClubTime(date: string, time: string, timeZone: string): string {
  return new Intl.DateTimeFormat("nl-BE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(`${date}T${time}Z`));
}

/**
 * Haalt voor een dag (YYYY-MM-DD) de openingsuren en per baan de vrije
 * starttijden op. Tijden die niet vrij zijn, zijn (in de weergave) geboekt of
 * niet meer boekbaar.
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
  const open = hours?.opening_time ?? "08:00";
  const close = hours?.closing_time ?? "23:00";

  // Clubtijdzone, niet die van het apparaat: wie vanuit het buitenland kijkt
  // moet dezelfde tijden zien als op de Playtomic-clubpagina.
  const timeZone = tenant.address?.timezone ?? "Europe/Brussels";

  const courts: CourtRow[] = (tenant.resources ?? []).map((r) => {
    const free = new Map<string, number[]>();
    for (const slot of byCourt[r.resource_id] ?? []) {
      const t = utcToClubTime(slot.date, slot.time, timeZone);
      const durations = free.get(t) ?? [];
      if (!durations.includes(slot.duration)) {
        durations.push(slot.duration);
        durations.sort((a, b) => a - b);
      }
      free.set(t, durations);
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

  return { open, close, courts };
}
