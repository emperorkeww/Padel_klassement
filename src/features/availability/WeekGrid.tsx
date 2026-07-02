import { Fragment, useMemo } from "react";
import { coveredTimes, type CourtRow, type WeekDay } from "./api";
import { useClub } from "./club";
import {
  buildTimeAxis,
  dateInZone,
  fromMinutes,
  minutesNowInZone,
  toMinutes,
} from "../../lib/time";
import { CourtTypeIcon } from "../../components/CourtTypeIcon";
import { courtTypeLabel } from "../../lib/format";
import "./Availability.css";

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("nl-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Compact baanlabel naast de strip: "Terrein 1 (overdekt)" → "T1".
function shortCourtName(name: string): string {
  const num = name.match(/\d+/);
  return num ? `T${num[0]}` : name.slice(0, 3);
}

/**
 * Weekoverzicht met per dag een strip per baan: dezelfde celtoestanden als de
 * dagweergave (vrij / vrij-maar-niet-boekbaar / geboekt / voorbij), maar dan
 * zeven dagen onder elkaar. Klikken op een vrij vak opent de dagweergave.
 */
export function WeekGrid({
  week,
  duration,
  onPickDay,
}: {
  week: WeekDay[];
  /** Duurfilter in minuten; null = alle duren tonen. */
  duration: number | null;
  onPickDay: (date: string) => void;
}) {
  const club = useClub();
  const timeZone = week.find((d) => d.data)?.data?.timeZone ?? club.timezone;

  // Tijd-as: de unie van de openingsuren van alle geladen dagen.
  const times = useMemo(() => {
    let openM = Infinity;
    let closeM = -Infinity;
    for (const day of week) {
      if (!day.data) continue;
      openM = Math.min(openM, toMinutes(day.data.open));
      closeM = Math.max(closeM, toMinutes(day.data.close));
    }
    if (!Number.isFinite(openM)) return [];
    return buildTimeAxis(fromMinutes(openM), fromMinutes(closeM));
  }, [week]);

  const today = dateInZone(timeZone);
  const nowMinutes = minutesNowInZone(timeZone);
  const pastCount = times.filter((t) => toMinutes(t) <= nowMinutes).length;

  if (times.length === 0) return null;

  // Grid-rij-administratie (rij 1 = tijd-as); nodig om de "voorbij"-overlay
  // precies over de baanrijen van vandaag te leggen.
  let rowCursor = 2;
  let pastOverlay: { row: number; span: number } | null = null;
  const rows: React.ReactNode[] = [];

  for (const day of week) {
    const label = dayLabel(day.date);

    if (!day.data) {
      rows.push(
        <Fragment key={day.date}>
          <div className="week-rowhead week-cell--dayend">
            <span className="week-rowhead__day">{label}</span>
          </div>
          <div
            className="avail-week-error week-cell--dayend"
            style={{ gridColumn: `2 / ${2 + times.length}` }}
          >
            {day.error ?? "Kon deze dag niet laden."}
          </div>
        </Fragment>,
      );
      rowCursor += 1;
      continue;
    }

    const courts = day.data.courts;
    const pastCutoff = day.date === today ? nowMinutes : -1;
    if (pastCutoff >= 0 && pastCount > 0) {
      pastOverlay = { row: rowCursor, span: courts.length };
    }

    // Screenreader-samenvatting van de dag, bij het daglabel.
    const summary = courts
      .map((row) => {
        const starts = times.filter((t) => isBookable(row, t, duration, pastCutoff));
        return starts.length > 0 ? `${row.court.name}: ${starts.join(", ")}` : null;
      })
      .filter(Boolean)
      .join("; ");

    courts.forEach((row, i) => {
      rows.push(
        <CourtStrips
          key={`${day.date}:${row.court.id}`}
          date={day.date}
          row={row}
          times={times}
          pastCutoff={pastCutoff}
          duration={duration}
          dayEnd={i === courts.length - 1}
          head={
            i === 0 ? (
              <>
                <span
                  className={`week-rowhead__day ${day.date === today ? "is-today" : ""}`}
                >
                  {label}
                </span>
                <span className="sr-only">
                  {summary ? `Vrije starttijden — ${summary}.` : "Geen vrije starttijden."}
                </span>
              </>
            ) : null
          }
          label={`${label} ${row.court.name}${row.court.type ? ` (${courtTypeLabel(row.court.type)})` : ""}`}
          onPick={() => onPickDay(day.date)}
        />,
      );
    });
    rowCursor += courts.length;
  }

  return (
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

        {rows}

        {/* Arcering over het verstreken deel van de vandaag-rijen. */}
        {pastOverlay && (
          <div
            className="avail-past-overlay"
            style={{
              gridColumn: `2 / ${2 + pastCount}`,
              gridRow: `${pastOverlay.row} / ${pastOverlay.row + pastOverlay.span}`,
            }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

function isBookable(
  row: CourtRow,
  t: string,
  duration: number | null,
  pastCutoff: number,
): boolean {
  if (toMinutes(t) <= pastCutoff) return false;
  const options = row.free.get(t);
  return (
    options != null &&
    (duration == null || options.some((o) => o.duration === duration))
  );
}

function CourtStrips({
  date,
  row,
  times,
  pastCutoff,
  duration,
  dayEnd,
  head,
  label,
  onPick,
}: {
  date: string;
  row: CourtRow;
  times: string[];
  pastCutoff: number;
  duration: number | null;
  dayEnd: boolean;
  head: React.ReactNode;
  label: string;
  onPick: () => void;
}) {
  const covered = useMemo(() => coveredTimes(row.free), [row.free]);
  const endClass = dayEnd ? "week-cell--dayend" : "";

  return (
    <>
      <div className={`week-rowhead ${endClass}`}>
        {head}
        <span
          className="week-rowhead__court"
          title={`${row.court.name}${row.court.type ? ` — ${courtTypeLabel(row.court.type)}` : ""}`}
        >
          <CourtTypeIcon type={row.court.type} />
          {shortCourtName(row.court.name)}
        </span>
      </div>
      {times.map((t) => {
        const hourClass = t.endsWith(":00") ? "is-hour" : "";
        const base = `avail-cell week-strip ${hourClass} ${endClass}`;

        if (toMinutes(t) <= pastCutoff) {
          return (
            <div key={t} className={`${base} avail-cell--past`} aria-hidden="true" />
          );
        }

        const options = row.free.get(t);
        if (!options || (duration != null && !options.some((o) => o.duration === duration))) {
          if (covered.has(t)) {
            const reason = options
              ? `geen ${duration} min vrij (wel ${options.map((o) => o.duration).join("/")} min)`
              : "vrij, maar een boeking kan hier niet starten";
            return (
              <div
                key={t}
                className={`${base} avail-cell--nofit`}
                title={`${label} — ${t}: ${reason}`}
                aria-hidden="true"
              />
            );
          }
          return (
            <div
              key={t}
              className={`${base} avail-cell--busy`}
              title={`${label} — ${t} geboekt`}
              aria-hidden="true"
            />
          );
        }

        const shown = duration != null ? [duration] : options.map((o) => o.duration);
        const text = `${label} — ${t} vrij (${shown.join("/")} min)`;
        return (
          <div
            key={t}
            className={`${base} avail-cell--free`}
            role="button"
            tabIndex={0}
            aria-label={`${text} — open dagweergave van ${date}`}
            title={text}
            onClick={onPick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPick();
              }
            }}
          />
        );
      })}
    </>
  );
}
