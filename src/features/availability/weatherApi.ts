import { cached } from "../../lib/queryCache";
import { getClubCoordinate } from "./api";
import type { Club } from "./club";
import type { HourWeather } from "./weatherLogic";

// Weerdata voor de buitenbanen-strip (#83): Open-Meteo, gratis en zonder
// API-key (CORS toegestaan → direct client-side). Per club per uur gecachet;
// elke fout of ontbrekende locatie levert null op — de UI toont dan niets.

/** Uurdata per kalenderdag (YYYY-MM-DD, in clubtijd). */
export type WeekWeather = Record<string, HourWeather[]>;

/**
 * Locatie via de stadnaam als Playtomic geen coördinaat meegeeft (vangnet;
 * in de praktijk hebben alle tenants er een). Belgische treffer wint —
 * stadsnamen als "Beveren" bestaan in meerdere landen.
 */
async function geocodeCity(
  city: string,
): Promise<{ lat: number; lon: number } | null> {
  if (!city) return null;
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=nl`,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: { latitude?: number; longitude?: number; country_code?: string }[];
  };
  const results = json.results ?? [];
  const hit = results.find((r) => r.country_code === "BE") ?? results[0];
  return typeof hit?.latitude === "number" && typeof hit?.longitude === "number"
    ? { lat: hit.latitude, lon: hit.longitude }
    : null;
}

/** Weersverwachting (7 dagen, per uur) voor de club; null = niet beschikbaar. */
export function getWeekWeather(club: Club): Promise<WeekWeather | null> {
  // Sleutel per uur: de verwachting hoeft niet vaker te verversen.
  const hourKey = new Date().toISOString().slice(0, 13);
  return cached(`weather:${club.id}:${hourKey}`, async () => {
    try {
      const coord =
        (await getClubCoordinate(club.id).catch(() => null)) ??
        (await geocodeCity(club.city).catch(() => null));
      if (!coord) return null;

      const params = new URLSearchParams({
        latitude: String(coord.lat),
        longitude: String(coord.lon),
        hourly: "weathercode,precipitation_probability,temperature_2m",
        forecast_days: "7",
        timezone: club.timezone,
      });
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) return null;
      const json = (await res.json()) as {
        hourly?: {
          time?: string[];
          weathercode?: number[];
          precipitation_probability?: (number | null)[];
          temperature_2m?: number[];
        };
      };
      const times = json.hourly?.time ?? [];
      const codes = json.hourly?.weathercode ?? [];
      const rain = json.hourly?.precipitation_probability ?? [];
      const temp = json.hourly?.temperature_2m ?? [];

      const out: WeekWeather = {};
      times.forEach((t, i) => {
        const date = t.slice(0, 10);
        (out[date] ??= []).push({
          hour: Number(t.slice(11, 13)),
          code: codes[i] ?? 0,
          rainPct: rain[i] ?? 0,
          temp: temp[i] ?? 0,
        });
      });
      return out;
    } catch {
      // Weer is een extraatje: nooit de banen-flow laten struikelen.
      return null;
    }
  });
}
