import { useMemo, useState } from "react";
import { bookingUrl, type CourtRow, type DayAvailability } from "./api";
import "./Availability.css";

const STEP_MIN = 30;

export function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function toMinutes(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

function fromMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Bouwt de kolommen: elk halfuur van openingstijd tot sluitingstijd.
function buildTimeAxis(open: string, close: string): string[] {
  const times: string[] = [];
  for (let m = toMinutes(open); m < toMinutes(close); m += STEP_MIN) {
    times.push(fromMinutes(m));
  }
  return times;
}

type Interval = { start: string; end: string };

// Voegt aaneengesloten vrije halfuren samen tot één blok en geeft per vrije
// tijd het interval (begin → einde) van dat volledige blok terug.
function freeIntervals(times: string[], free: Set<string>): Map<string, Interval> {
  const byTime = new Map<string, Interval>();
  let i = 0;
  while (i < times.length) {
    if (!free.has(times[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < times.length && free.has(times[j + 1])) j++;
    const interval: Interval = {
      start: times[i],
      end: fromMinutes(toMinutes(times[j]) + STEP_MIN),
    };
    for (let k = i; k <= j; k++) byTime.set(times[k], interval);
    i = j + 1;
  }
  return byTime;
}

type Tip = { x: number; y: number; text: string };

export function Timetable({ data, date }: { data: DayAvailability; date: string }) {
  const times = useMemo(
    () => buildTimeAxis(data.open, data.close),
    [data.open, data.close],
  );
  const [tip, setTip] = useState<Tip | null>(null);

  return (
    <>
      <div className="avail-scroll">
        <div
          className="avail-table"
          style={{ gridTemplateColumns: `var(--court-col) repeat(${times.length}, var(--slot-col))` }}
        >
          {/* Kop: lege hoek + uren (label alleen op het hele uur). */}
          <div className="avail-corner" />
          {times.map((t) => (
            <div
              key={t}
              className={`avail-time ${t.endsWith(":00") ? "is-hour" : ""}`}
            >
              {t.endsWith(":00") ? t : ""}
            </div>
          ))}

          {/* Eén rij per baan. */}
          {data.courts.map((row) => (
            <Row key={row.court.id} row={row} times={times} date={date} onTip={setTip} />
          ))}
        </div>
      </div>

      {tip && (
        <div className="avail-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.text}
        </div>
      )}
    </>
  );
}

function Row({
  row,
  times,
  date,
  onTip,
}: {
  row: CourtRow;
  times: string[];
  date: string;
  onTip: (tip: Tip | null) => void;
}) {
  const intervals = useMemo(() => freeIntervals(times, row.free), [times, row.free]);

  return (
    <>
      <div className="avail-rowhead">
        <span className="avail-rowhead__name">{row.court.name}</span>
        {row.court.type && (
          <span className="avail-rowhead__type">
            {row.court.type === "roofed" ? "overdekt" : "buiten"}
          </span>
        )}
      </div>
      {times.map((t) => {
        const interval = intervals.get(t);
        if (interval) {
          const text = `${row.court.name}: vrij van ${interval.start} tot ${interval.end} — klik om te reserveren`;
          return (
            <div
              key={t}
              className={`avail-cell avail-cell--free ${t.endsWith(":00") ? "is-hour" : ""}`}
              role="button"
              tabIndex={0}
              onMouseMove={(e) => onTip({ x: e.clientX, y: e.clientY, text })}
              onMouseLeave={() => onTip(null)}
              onClick={() =>
                window.open(bookingUrl(date), "_blank", "noopener,noreferrer")
              }
            />
          );
        }
        return (
          <div
            key={t}
            className={`avail-cell avail-cell--busy ${t.endsWith(":00") ? "is-hour" : ""}`}
            title={`${row.court.name} — ${t} geboekt`}
          />
        );
      })}
    </>
  );
}
