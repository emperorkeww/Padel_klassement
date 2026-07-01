// Baanbeschikbaarheid van LAGO CLUB Padel Beveren via Playtomic.
//
// Playtomic biedt geen publieke, officiële API voor spelers. We gebruiken de
// (ongedocumenteerde) endpoints die de Playtomic-site zelf ook aanroept. Die
// staan CORS vanuit de browser niet toe, dus alle calls lopen via een kleine
// proxy op /api/playtomic (Vite-proxy in dev, Cloudflare Worker in productie).

const TENANT_ID = "91d8d419-3736-498e-90be-362de786d588";
const BASE = "/api/playtomic";

export const CLUB_NAME = "LAGO CLUB Padel Beveren";
export const CLUB_URL =
  "https://playtomic.com/clubs/lago-club-padel-beveren?q=PADEL~";

export type Court = { id: string; name: string; type: string };
export type TimeSlot = { time: string; durations: number[] };
export type CourtAvailability = { court: Court; times: TimeSlot[] };

type RawResource = {
  resource_id: string;
  name: string;
  properties?: { resource_type?: string };
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

async function getCourts(): Promise<Court[]> {
  const data = await getJson<{ resources?: RawResource[] }>(
    `/v1/tenants/${TENANT_ID}`,
    "Kon de clubgegevens niet laden",
  );
  return (data.resources ?? []).map((r) => ({
    id: r.resource_id,
    name: r.name,
    type: r.properties?.resource_type ?? "",
  }));
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
 * Haalt per baan de vrije starttijden op voor een dag (YYYY-MM-DD).
 * Slots met dezelfde starttijd (maar verschillende duur) worden samengevoegd
 * tot één tijd met de beschikbare duren, zodat de weergave leesbaar blijft.
 */
export async function getClubAvailability(
  date: string,
): Promise<CourtAvailability[]> {
  const [courts, byCourt] = await Promise.all([
    getCourts(),
    getSlotsByCourt(date),
  ]);

  return courts.map((court) => {
    const durationsByTime = new Map<string, Set<number>>();
    for (const slot of byCourt[court.id] ?? []) {
      const time = slot.start_time.slice(0, 5); // "HH:MM"
      (durationsByTime.get(time) ?? durationsByTime.set(time, new Set()).get(time)!).add(
        slot.duration,
      );
    }
    const times = [...durationsByTime.entries()]
      .map(([time, durs]) => ({ time, durations: [...durs].sort((a, b) => a - b) }))
      .sort((a, b) => a.time.localeCompare(b.time));
    return { court, times };
  });
}