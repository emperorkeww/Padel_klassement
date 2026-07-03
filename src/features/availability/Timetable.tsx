import { useEffect, useMemo, useRef, useState } from "react";
import {
  bookingUrl,
  coveredTimes,
  slotShareText,
  slotShareUrl,
  type CourtRow,
  type DayAvailability,
  type SlotOption,
} from "./api";
import { getClub } from "./club";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
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

type Tip = { x: number; y: number; text: string };
// Aangeklikt vrij slot: toont eerst de beschikbaarheid, pas via de link ga je
// door naar Playtomic. Zo redirect een tik op mobiel niet meteen.
type Selection = {
  left: number;
  top: number;
  court: string;
  courtType: string;
  start: string;
  end: string;
  options: SlotOption[];
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
  const toast = useToast();

  // Deelt het aangeklikte slot met de vriendengroep: het native deelvenster
  // waar dat kan, anders tekst + link naar het klembord.
  async function share(slot: Selection) {
    const club = getClub();
    const text = slotShareText(slot, date, club.name);
    const url = slotShareUrl(date, club.id);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `Vrij slot bij ${club.name}`, text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success("Link gekopieerd.");
      }
    } catch (err) {
      // Gebruiker die het deelvenster sluit is geen fout.
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(errorMessage(err));
    }
  }

  // Vandaag (in clubtijd!): sloten die al begonnen of voorbij zijn kun je
  // niet meer boeken — die krijgen een eigen "voorbij"-aanduiding.
  const pastCutoff =
    date === dateInZone(data.timeZone) ? minutesNowInZone(data.timeZone) : -1;
  const pastCount = times.filter((t) => toMinutes(t) <= pastCutoff).length;

  // Vandaag: automatisch voorbij het verstreken deel scrollen (met één
  // "voorbij"-kolom als context), zodat het raster bij nú begint in plaats
  // van bij de openingstijd — vooral op mobiel scheelt dat veel geveeg.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || pastCount === 0) return;
    const cell = el.querySelector<HTMLElement>(".avail-cell");
    if (cell) el.scrollLeft = Math.max(0, (pastCount - 1) * cell.offsetWidth);
  }, [pastCount, date]);

  return (
    <>
      <div className="avail-scroll" ref={scrollRef}>
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

      {/* Aangeklikt slot: beschikbaarheid, prijzen + expliciete reserveerlink. */}
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
            <p className="avail-popover__title">
              <CourtTypeIcon type={sel.courtType} /> {sel.court}
            </p>
            <p className="avail-popover__time">
              Vrij van {sel.start} tot {sel.end}
            </p>
            <p className="avail-popover__durs">
              {sel.options.map((o) => (
                <span key={o.duration} className="badge badge--accent">
                  {o.duration} min · {o.price}
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
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => void share(sel)}
            >
              ↗ Delen
            </button>
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
  /** Minuten sinds middernacht (clubtijd); sloten die op of vóór dit moment
   *  starten zijn voorbij. -1 = geen (andere dag dan vandaag). */
  pastCutoff: number;
  duration: number | null;
  onTip: (tip: Tip | null) => void;
  onSelect: (sel: Selection) => void;
}) {
  // Halfuren waarop de baan vrij is (ook zonder boekbare start): de staart
  // van een lang slot en het laatste halfuur voor sluiting horen niet als
  // "geboekt" getoond te worden.
  const covered = useMemo(() => coveredTimes(row.free), [row.free]);

  // Voor screenreaders: de losse cellen zijn visueel; dit vat de rij samen.
  const bookableStarts = times.filter((t) => {
    if (toMinutes(t) <= pastCutoff) return false;
    const options = row.free.get(t);
    return options != null && (duration == null || options.some((o) => o.duration === duration));
  });

  return (
    <>
      <div className="avail-rowhead">
        <span className="avail-rowhead__name">{row.court.name}</span>
        {row.court.type && (
          <span className="avail-rowhead__type">
            <CourtTypeIcon type={row.court.type} />
            {courtTypeLabel(row.court.type)}
          </span>
        )}
        <span className="sr-only">
          {bookableStarts.length > 0
            ? `Boekbare starttijden: ${bookableStarts.join(", ")}.`
            : "Geen boekbare starttijden."}
        </span>
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

        const options = row.free.get(t);
        if (!options || (duration != null && !options.some((o) => o.duration === duration))) {
          // Vrij maar niet boekbaar (geen starttijd, of niet met deze duur)?
          // Anders is het vak echt bezet. De sr-only samenvatting hierboven
          // dekt deze cellen; voor de muis blijft de title-uitleg staan.
          if (covered.has(t)) {
            const reason = options
              ? `om ${t} geen ${duration} min vrij (wel ${options.map((o) => o.duration).join("/")} min)`
              : `om ${t} vrij, maar een boeking kan hier niet starten`;
            return (
              <div
                key={t}
                className={`avail-cell avail-cell--nofit ${hourClass}`}
                title={`${row.court.name} — ${reason}`}
                aria-hidden="true"
              />
            );
          }
          return (
            <div
              key={t}
              className={`avail-cell avail-cell--busy ${hourClass}`}
              title={`${row.court.name} — ${t} geboekt`}
              aria-hidden="true"
            />
          );
        }

        // Boekbare start: "vrij tot" = start + langste (gefilterde) duur.
        const shown =
          duration != null
            ? options.filter((o) => o.duration === duration)
            : options;
        const end = fromMinutes(
          toMinutes(t) + Math.max(...shown.map((o) => o.duration)),
        );
        const text = `${row.court.name}: vrij van ${t} tot ${end} (${shown.map((o) => o.duration).join("/")} min)`;
        const select = (el: HTMLElement) => {
          const r = el.getBoundingClientRect();
          onTip(null);
          // Houd de pop-up binnen het scherm (mobiel toont een bottom sheet
          // en negeert deze coördinaten via CSS).
          const half = Math.min(260, window.innerWidth - 24) / 2;
          const left = Math.min(
            Math.max(r.left + r.width / 2, 12 + half),
            window.innerWidth - 12 - half,
          );
          onSelect({
            left,
            top: r.bottom + 8,
            court: row.court.name,
            courtType: row.court.type,
            start: t,
            end,
            options: shown,
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
