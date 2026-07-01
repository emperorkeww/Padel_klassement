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
// Aangeklikt vrij slot: toont eerst de beschikbaarheid, pas via de link ga je
// door naar Playtomic. Zo redirect een tik op mobiel niet meteen.
type Selection = {
  left: number;
  top: number;
  court: string;
  start: string;
  end: string;
};

export function Timetable({ data, date }: { data: DayAvailability; date: string }) {
  const times = useMemo(
    () => buildTimeAxis(data.open, data.close),
    [data.open, data.close],
  );
  const [tip, setTip] = useState<Tip | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);

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
            <Row
              key={row.court.id}
              row={row}
              times={times}
              onTip={setTip}
              onSelect={setSel}
            />
          ))}
        </div>
      </div>

      {/* Hover-preview (desktop). Verborgen zodra er een pop-up open staat. */}
      {tip && !sel && (
        <div className="avail-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.text}
        </div>
      )}

      {/* Aangeklikt slot: beschikbaarheid + expliciete reserveerlink. */}
      {sel && (
        <>
          <div
            className="avail-popover-backdrop"
            onClick={() => setSel(null)}
            aria-hidden="true"
          />
          <div
            className="avail-popover"
            style={{ left: sel.left, top: sel.top }}
            role="dialog"
            aria-label={`Beschikbaarheid ${sel.court}`}
          >
            <p className="avail-popover__title">{sel.court}</p>
            <p className="avail-popover__time">
              Vrij van {sel.start} tot {sel.end}
            </p>
            <a
              className="btn btn--primary btn--sm"
              href={bookingUrl(date)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSel(null)}
            >
              Reserveren op Playtomic →
            </a>
          </div>
        </>
      )}
    </>
  );
}

function Row({
  row,
  times,
  onTip,
  onSelect,
}: {
  row: CourtRow;
  times: string[];
  onTip: (tip: Tip | null) => void;
  onSelect: (sel: Selection) => void;
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
          const text = `${row.court.name}: vrij van ${interval.start} tot ${interval.end}`;
          const select = (el: HTMLElement) => {
            const r = el.getBoundingClientRect();
            onTip(null);
            onSelect({
              left: r.left + r.width / 2,
              top: r.bottom + 8,
              court: row.court.name,
              start: interval.start,
              end: interval.end,
            });
          };
          return (
            <div
              key={t}
              className={`avail-cell avail-cell--free ${t.endsWith(":00") ? "is-hour" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${text} — bekijk reserveren`}
              onMouseMove={(e) => onTip({ x: e.clientX, y: e.clientY, text })}
              onMouseLeave={() => onTip(null)}
              onClick={(e) => select(e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(e.currentTarget);
                }
              }}
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
