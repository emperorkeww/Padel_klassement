import { useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { Skeleton } from "../../components/Skeleton";
import {
  getClubAvailability,
  CLUB_NAME,
  CLUB_URL,
  type CourtAvailability,
} from "./api";
import "./Availability.css";

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

export function Availability() {
  const today = localDate(0);
  const [date, setDate] = useState(today);
  const availability = useAsync<CourtAvailability[]>(
    () => getClubAvailability(date),
    [date],
  );

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Baanbeschikbaarheid</h1>
        <p className="page-subtitle">
          Vrije padelbanen bij {CLUB_NAME} — rechtstreeks van Playtomic.
        </p>
      </header>

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
      ) : (
        <div className="avail-grid">
          {(availability.data ?? []).map(({ court, times }) => (
            <div className="card avail-court" key={court.id}>
              <div className="avail-court__head">
                <h2 className="avail-court__name">{court.name}</h2>
                {court.type && (
                  <span className="badge">
                    {court.type === "roofed" ? "Overdekt" : "Buiten"}
                  </span>
                )}
              </div>
              {times.length === 0 ? (
                <p className="empty">Geen vrije tijdslots.</p>
              ) : (
                <div className="avail-slots">
                  {times.map((t) => (
                    <span
                      className="avail-slot"
                      key={t.time}
                      title={`Duur: ${t.durations.join(" / ")} min`}
                    >
                      {t.time}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="avail-note">
        Reserveren doe je op{" "}
        <a href={CLUB_URL} target="_blank" rel="noopener noreferrer">
          Playtomic
        </a>
        . Tijden en prijzen kunnen wijzigen; deze weergave is niet-officieel.
      </p>
    </div>
  );
}

export default Availability;