import type { PartSummary, WeatherSummary } from "@/features/availability/weatherLogic";
import "./WeatherStrip.css";

// Weerstrip voor clubs met buitenbanen (#83): compacte chips per dagdeel
// (dagweergave) of per dag (weekweergave). Verschijnt alleen als er data is;
// regenkans ≥ RAIN_WARN_PCT kleurt als waarschuwing.

export function WeatherParts({ parts }: { parts: PartSummary[] }) {
  if (parts.length === 0) return null;
  return (
    <div
      className="weather-strip"
      role="img"
      aria-label={`Weer voor buitenbanen: ${parts
        .map((p) => `${p.part} ${p.temp} graden, ${p.rainPct}% regenkans`)
        .join("; ")}`}
    >
      {parts.map((p) => (
        <span
          key={p.part}
          className={`weather-chip${p.warn ? " weather-chip--warn" : ""}`}
          title={
            p.warn
              ? `${p.rainPct}% regenkans — buitenspelen is twijfelachtig`
              : `${p.rainPct}% regenkans`
          }
        >
          <span aria-hidden="true">{p.icon}</span>
          <span className="weather-chip__part">{p.part}</span>
          <span className="weather-chip__meta">
            {p.temp}° · {p.rainPct}%
          </span>
        </span>
      ))}
    </div>
  );
}

export function WeatherDays({
  days,
}: {
  days: { date: string; summary: WeatherSummary }[];
}) {
  if (days.length === 0) return null;
  return (
    <div
      className="weather-strip"
      role="img"
      aria-label={`Weer voor buitenbanen deze week: ${days
        .map((d) => `${dayLabel(d.date)} ${d.summary.rainPct}% regenkans`)
        .join("; ")}`}
    >
      {days.map(({ date, summary }) => (
        <span
          key={date}
          className={`weather-chip weather-chip--day${summary.warn ? " weather-chip--warn" : ""}`}
          title={`${summary.temp}° · ${summary.rainPct}% regenkans`}
        >
          <span className="weather-chip__part">{dayLabel(date)}</span>
          <span aria-hidden="true">{summary.icon}</span>
          <span className="weather-chip__meta">{summary.rainPct}%</span>
        </span>
      ))}
    </div>
  );
}

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("nl-BE", { weekday: "short" })
    .format(new Date(`${date}T12:00:00`))
    .replace(".", "");
}
