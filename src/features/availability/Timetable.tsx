import { useMemo, useState } from "react";
import {
  bookingUrl,
  coveredTimes,
  type CourtRow,
  type DayAvailability,
} from "./api";
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

type Tip = { x: number; y: number; text: string };
// Aangeklikt vrij slot: toont eerst de beschikbaarheid, pas via de link ga je
// door naar Playtomic. Zo redirect een tik op mobiel niet meteen.
type Selection = {
  left: number;
  top: number;
  court: string;
  start: string;
  end: string;
  durations: number[];
};

export function Timetable({
  data,
  date,
  duration = null,
}: {
  data: DayAvailability;
  date: string;
  /** Duurfilter in minuten; null = alle duren tonen. */
  duration?: number | null;
}) {
  const times = useMemo(
    () => buildTimeAxis(data.open, data.close),
    [data.open, data.close],
  );
  const [tip, setTip] = useState<Tip | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);

  // Vandaag: sloten die al begonnen of voorbij zijn kun je niet meer boeken —
  // die krijgen een eigen "voorbij"-aanduiding i.p.v. vrij/geboekt.
  const now = new Date();
  const pastCutoff =
    date === localDate(0) ? now.getHours() * 60 + now.getMinutes() : -1;
  const pastCount = times.filter((t) => toMinutes(t) <= pastCutoff).length;

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
              pastCutoff={pastCutoff}
              duration={duration}
              onTip={setTip}
              onSelect={setSel}
            />
          ))}

          {/* Eén arcering over het volledige "voorbij"-gebied: de schuine
              strepen lopen zo naadloos door over alle baanrijen heen. */}
          {pastCount > 0 && (
            <div
              className="avail-past-overlay"
              style={{
                gridColumn: `2 / ${2 + pastCount}`,
                gridRow: `2 / ${2 + data.courts.length}`,
              }}
              aria-hidden="true"
            />
          )}
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
            <p className="avail-popover__durs">
              {sel.durations.map((d) => (
                <span key={d} className="badge badge--accent">
                  {d} min
                </span>
              ))}
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
  pastCutoff,
  duration,
  onTip,
  onSelect,
}: {
  row: CourtRow;
  times: string[];
  /** Minuten sinds middernacht; sloten die op of vóór dit moment starten zijn
   *  voorbij. -1 = geen (andere dag dan vandaag). */
  pastCutoff: number;
  duration: number | null;
  onTip: (tip: Tip | null) => void;
  onSelect: (sel: Selection) => void;
}) {
  // Halfuren waarop de baan vrij is (ook zonder boekbare start): de staart
  // van een lang slot en het laatste halfuur voor sluiting horen niet als
  // "geboekt" getoond te worden.
  const covered = useMemo(() => coveredTimes(row.free), [row.free]);

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
        const hourClass = t.endsWith(":00") ? "is-hour" : "";

        // Voorbij: neutraal vlak, niet klikbaar — geen vrij, geen geboekt.
        if (toMinutes(t) <= pastCutoff) {
          return (
            <div
              key={t}
              className={`avail-cell avail-cell--past ${hourClass}`}
              title={`${row.court.name} — ${t} is al voorbij`}
              aria-hidden="true"
            />
          );
        }

        const durations = row.free.get(t);
        if (!durations || (duration != null && !durations.includes(duration))) {
          // Vrij maar niet boekbaar (geen starttijd, of niet met deze duur)?
          // Anders is het vak echt bezet.
          if (covered.has(t)) {
            const reason = durations
              ? `om ${t} geen ${duration} min vrij (wel ${durations.join("/")} min)`
              : `om ${t} vrij, maar een boeking kan hier niet starten`;
            return (
              <div
                key={t}
                className={`avail-cell avail-cell--nofit ${hourClass}`}
                title={`${row.court.name} — ${reason}`}
              />
            );
          }
          return (
            <div
              key={t}
              className={`avail-cell avail-cell--busy ${hourClass}`}
              title={`${row.court.name} — ${t} geboekt`}
            />
          );
        }

        // Boekbare start: "vrij tot" = start + langste (gefilterde) duur.
        const shown = duration != null ? [duration] : durations;
        const end = fromMinutes(toMinutes(t) + Math.max(...shown));
        const text = `${row.court.name}: vrij van ${t} tot ${end} (${shown.join("/")} min)`;
        const select = (el: HTMLElement) => {
          const r = el.getBoundingClientRect();
          onTip(null);
          onSelect({
            left: r.left + r.width / 2,
            top: r.bottom + 8,
            court: row.court.name,
            start: t,
            end,
            durations: shown,
          });
        };
        return (
          <div
            key={t}
            className={`avail-cell avail-cell--free ${hourClass}`}
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
      })}
    </>
  );
}
