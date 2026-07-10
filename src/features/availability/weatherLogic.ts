// Pure weerlogica voor de buitenbanen-strip (#83): WMO-weathercodes van
// Open-Meteo samenvatten naar dagdelen (dagweergave) en dagen (weekweergave).
// Getest in weatherLogic.test.ts.

/** Neerslagkans (%) vanaf waar we in warn-stijl waarschuwen. */
export const RAIN_WARN_PCT = 40;

export interface HourWeather {
  /** Lokaal uur (0-23) in clubtijd. */
  hour: number;
  /** WMO-weathercode (Open-Meteo `weathercode`). */
  code: number;
  /** Neerslagkans in %. */
  rainPct: number;
  /** Temperatuur in °C. */
  temp: number;
}

/**
 * WMO-code → icoon. Ernst wint bij het samenvatten: onweer > sneeuw > regen
 * > mist > bewolkt > halfbewolkt > zon.
 */
const SEVERITY: { icon: string; match: (code: number) => boolean }[] = [
  { icon: "⛈️", match: (c) => c >= 95 },
  { icon: "❄️", match: (c) => (c >= 71 && c <= 77) || c === 85 || c === 86 },
  { icon: "🌧️", match: (c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) },
  { icon: "🌫️", match: (c) => c === 45 || c === 48 },
  { icon: "☁️", match: (c) => c === 3 },
  { icon: "⛅", match: (c) => c === 1 || c === 2 },
  { icon: "☀️", match: (c) => c === 0 },
];

export function iconFor(code: number): string {
  return SEVERITY.find((s) => s.match(code))?.icon ?? "⛅";
}

/** Zwaarste weertype in een reeks uren (de SEVERITY-volgorde bepaalt). */
function worstIcon(hours: HourWeather[]): string {
  for (const s of SEVERITY) {
    if (hours.some((h) => s.match(h.code))) return s.icon;
  }
  return "⛅";
}

export interface WeatherSummary {
  icon: string;
  /** Hoogste temperatuur in het venster, afgerond. */
  temp: number;
  /** Hoogste neerslagkans in het venster. */
  rainPct: number;
  /** True vanaf RAIN_WARN_PCT: buitenspelen wordt twijfelachtig. */
  warn: boolean;
}

function summarize(hours: HourWeather[]): WeatherSummary | null {
  if (hours.length === 0) return null;
  const rainPct = Math.max(...hours.map((h) => h.rainPct));
  return {
    icon: worstIcon(hours),
    temp: Math.round(Math.max(...hours.map((h) => h.temp))),
    rainPct,
    warn: rainPct >= RAIN_WARN_PCT,
  };
}

export interface PartSummary extends WeatherSummary {
  part: "ochtend" | "middag" | "avond";
}

const PARTS: { part: PartSummary["part"]; from: number; to: number }[] = [
  { part: "ochtend", from: 6, to: 11 },
  { part: "middag", from: 12, to: 17 },
  { part: "avond", from: 18, to: 23 },
];

/** Dagdeel-samenvattingen (alleen dagdelen waarvoor uurdata bestaat). */
export function summarizeParts(hours: HourWeather[]): PartSummary[] {
  const out: PartSummary[] = [];
  for (const { part, from, to } of PARTS) {
    const slice = hours.filter((h) => h.hour >= from && h.hour <= to);
    const s = summarize(slice);
    if (s) out.push({ part, ...s });
  }
  return out;
}

/** Dag-samenvatting voor de weekweergave (speelbare uren 8-23). */
export function summarizeDay(hours: HourWeather[]): WeatherSummary | null {
  return summarize(hours.filter((h) => h.hour >= 8 && h.hour <= 23));
}
