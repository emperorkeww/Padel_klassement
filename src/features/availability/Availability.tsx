import { useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { useRefetchOnFocus } from "../../lib/useRefetchOnFocus";
import { Skeleton } from "../../components/Skeleton";
import { getClubAvailability, bookingUrl, CLUB_NAME, type DayAvailability } from "./api";
import { Timetable, localDate } from "./Timetable";
import "./Availability.css";

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function Availability() {
  const today = localDate(0);
  const [date, setDate] = useState(today);
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
        Tik op een vrij (groen) slot om te zien tot hoe laat het vrij is; via de
        knop in dat venster (of de knop hierboven) open je Playtomic voor de
        gekozen dag (het uur kies je daar zelf). Tijden kunnen wijzigen; deze
        weergave is niet-officieel.
      </p>
    </div>
  );
}

export default Availability;
