import { useMemo, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { Skeleton } from "../../components/Skeleton";
import {
  getClubAvailability,
  bookingUrl,
  CLUB_NAME,
  type CourtRow,
  type DayAvailability,
} from "./api";
import "./Availability.css";

const STEP_MIN = 30;

function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
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

export function Availability() {
  const today = localDate(0);
  const [date, setDate] = useState(today);
  const availability = useAsync<DayAvailability>(
    () => getClubAvailability(date),
    [date],
  );

  return (
    <div>
      <div className="avail-header">
        <header className="page-head">
          <h1 className="page-title">Baanbeschikbaarheid</h1>
          <p className="page-subtitle">
            Vrije padelbanen bij {CLUB_NAME} — rechtstreeks van Playtomic.
          </p>
        </header>
        <a
          className="btn avail-book"
          href={bookingUrl(date)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            className="avail-book__logo"
            src="/playtomic-logo.svg"
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
          />
          <span>Reserveren op Playtomic</span>
        </a>
      </div>

      <div className="avail-controls">
        <div className="avail-quick">
          <button
            type="button"
            className={`tab ${date === today ? "is-active" : ""}`}
            onClick={() => setDate(today)}
          >
            Vandaag
          </button>
          <button
            type="button"
            className={`tab ${date === localDate(1) ? "is-active" : ""}`}
            onClick={() => setDate(localDate(1))}
          >
            Morgen
          </button>
        </div>
        <input
          type="date"
          className="select avail-date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <p className="avail-day">{formatDay(date)}</p>

      {availability.loading ? (
        <Skeleton rows={3} />
      ) : availability.error ? (
        <p className="msg msg--error">{availability.error}</p>
      ) : availability.data ? (
        <Timetable data={availability.data} date={date} />
      ) : null}

      <div className="avail-legend">
        <span className="avail-legend__item">
          <span className="avail-cell avail-cell--free avail-legend__swatch" /> Vrij
        </span>
        <span className="avail-legend__item">
          <span className="avail-cell avail-cell--busy avail-legend__swatch" /> Geboekt
        </span>
      </div>

      <p className="avail-note">
        Klik op een vrij (groen) slot of op de knop om Playtomic op de gekozen
        dag te openen (het uur kies je daar zelf). Tijden kunnen wijzigen; deze
        weergave is niet-officieel.
      </p>
    </div>
  );
}

function Timetable({ data, date }: { data: DayAvailability; date: string }) {
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

export default Availability;