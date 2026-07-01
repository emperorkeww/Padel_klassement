// Baanbeschikbaarheid van LAGO CLUB Padel Beveren via Playtomic.
//
// Playtomic biedt geen publieke, officiële API voor spelers. We gebruiken de
// (ongedocumenteerde) endpoints die de Playtomic-site zelf ook aanroept. Die
// staan CORS vanuit de browser niet toe, dus alle calls lopen via een kleine
// proxy op /api/playtomic (Vite-proxy in dev, Cloudflare Worker in productie).

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
export type CourtRow = { court: Court; free: Set<string> };
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
};
type RawSlot = { start_time: string; duration: number; price: string };
type RawAvailability = { resource_id: string; slots?: RawSlot[] };

async function getJson<T>(path: string, foutmelding: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${foutmelding} (status ${res.status}).`);
  return res.json() as Promise<T>;
}

async function getSlotsByCourt(date: string): Promise<Record<string, RawSlot[]>> {
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
  const byCourt: Record<string, RawSlot[]> = {};
  for (const entry of data) {
    (byCourt[entry.resource_id] ??= []).push(...(entry.slots ?? []));
  }
  return byCourt;
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
    getJson<RawTenant>(`/v1/tenants/${TENANT_ID}`, "Kon de clubgegevens niet laden"),
    getSlotsByCourt(date),
  ]);

  const weekday = WEEKDAY_KEYS[new Date(`${date}T00:00:00`).getDay()];
  const hours = tenant.opening_hours?.[weekday];
  const open = hours?.opening_time ?? "08:00";
  const close = hours?.closing_time ?? "23:00";

  const courts: CourtRow[] = (tenant.resources ?? []).map((r) => {
    const free = new Set<string>();
    for (const slot of byCourt[r.resource_id] ?? []) {
      free.add(slot.start_time.slice(0, 5)); // "HH:MM"
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
