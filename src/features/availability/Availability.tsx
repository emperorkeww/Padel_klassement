import { useSearchParams } from "react-router-dom";
import { useAsync } from "../../lib/useAsync";
import { useRefetchOnFocus } from "../../lib/useRefetchOnFocus";
import { Skeleton } from "../../components/Skeleton";
import {
  getClubAvailability,
  bookingUrl,
  CLUB_NAME,
  CLUB_TIMEZONE,
  type DayAvailability,
} from "./api";
import { Timetable } from "./Timetable";
import { dateInZone } from "../../lib/time";
import "./Availability.css";

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// Speelduren die Playtomic aanbiedt; null = geen filter (alle duren tonen).
const DURATION_FILTERS = [null, 60, 90, 120] as const;

export function Availability() {
  // "Vandaag" in clubtijd, zodat de dagkeuze klopt vanuit elke tijdzone.
  const today = dateInZone(CLUB_TIMEZONE);

  // Datum en duurfilter leven in de URL (?datum=…&duur=…): deelbaar en
  // refresh-bestendig. Ongeldige of verstreken waarden vallen terug op
  // vandaag / geen filter.
  const [params, setParams] = useSearchParams();
  const rawDate = params.get("datum") ?? "";
  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && rawDate >= today ? rawDate : today;
  const rawDuration = Number(params.get("duur"));
  const duration = (DURATION_FILTERS as readonly (number | null)[]).includes(
    rawDuration,
  )
    ? rawDuration
    : null;

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value == null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }
  const setDate = (d: string) => setParam("datum", d === today ? null : d);
  const setDuration = (d: number | null) =>
    setParam("duur", d == null ? null : String(d));

  const availability = useAsync<DayAvailability>(
    () => getClubAvailability(date),
    [date],
  );
  // Ververs de (Playtomic-)beschikbaarheid zodra de gebruiker terugkeert.
  useRefetchOnFocus(availability.reload);

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
            className={`tab ${date === dateInZone(CLUB_TIMEZONE, 1) ? "is-active" : ""}`}
            onClick={() => setDate(dateInZone(CLUB_TIMEZONE, 1))}
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

      {/* Duurfilter, zoals op de Playtomic-pagina: toon alleen starttijden
          waarop de gekozen speelduur ook echt kan beginnen. */}
      <div className="avail-controls">
        <div className="tabs">
          {DURATION_FILTERS.map((d) => (
            <button
              key={d ?? "alle"}
              type="button"
              className={`tab ${duration === d ? "is-active" : ""}`}
              onClick={() => setDuration(d)}
            >
              {d == null ? "Alle duren" : `${d} min`}
            </button>
          ))}
        </div>
      </div>

      <p className="avail-day">{formatDay(date)}</p>

      {availability.loading ? (
        <Skeleton rows={3} />
      ) : availability.error ? (
        <p className="msg msg--error">{availability.error}</p>
      ) : availability.data ? (
        <Timetable data={availability.data} date={date} duration={duration} />
      ) : null}

      <div className="avail-legend">
        <span className="avail-legend__item">
          <span className="avail-cell avail-cell--free avail-legend__swatch" /> Vrij
        </span>
        <span className="avail-legend__item">
          <span className="avail-cell avail-cell--busy avail-legend__swatch" /> Geboekt
        </span>
        <span className="avail-legend__item">
          <span className="avail-cell avail-cell--nofit avail-legend__swatch" /> Vrij,
          niet boekbaar
        </span>
        {date === today && (
          <span className="avail-legend__item">
            <span className="avail-cell avail-cell--past avail-legend__swatch" /> Voorbij
          </span>
        )}
      </div>

      <p className="avail-note">
        Tik op een vrij (groen) slot om de duren en prijzen te zien; via de
        knop in dat venster (of de knop hierboven) open je Playtomic voor de
        gekozen dag (het uur kies je daar zelf). Playtomic verhuurt vanaf 60
        minuten, dus een korter gat tussen twee boekingen kan als geboekt
        verschijnen. Tijden kunnen wijzigen; deze weergave is niet-officieel.
      </p>
    </div>
  );
}

export default Availability;
