import { useEffect, useState } from "react";
import { searchClubs } from "@/features/availability/api";
import {
  DEFAULT_CLUB,
  manualClub,
  setClub,
  useClub,
  useRecentClubs,
  type Club,
} from "@/features/availability/club";
import "./ClubPicker.css";

/**
 * Locatiekeuze: knop met de huidige club; opent een paneel met een zoekveld
 * dat Belgische Playtomic-clubs met padelbanen op naam zoekt.
 *
 * Ongecontroleerd (geen props): de keuze stuurt de globale clubvoorkeur en geldt
 * voor de hele app (raster, weekoverzicht, dashboard, reserveerlinks).
 * Gecontroleerd (`value` + `onPick`): de knop toont `value` en geeft de keuze
 * via `onPick` door zonder de globale voorkeur te wijzigen — zo kan een
 * speeldag-poll z'n eigen locatie kiezen los van de rest van de app (#322).
 */
export function ClubPicker({
  value,
  onPick,
  allowManual = false,
  align = "left",
}: {
  value?: Club;
  onPick?: (club: Club) => void;
  /** Sta een handmatige locatie toe (niet in Playtomic) — voor speeldag-polls
   *  op een baan die de proxy niet kent (#322). */
  allowManual?: boolean;
  /** Aan welke kant van de knop het paneel opent. "right" wanneer de trigger
   *  rechts in een balk staat (poll-kaart), zodat het niet buiten beeld valt. */
  align?: "left" | "right";
} = {}) {
  const globalClub = useClub();
  const club = value ?? globalClub;
  // Snelle keuzes: recent gekozen clubs, zonder de club die al actief is.
  const recent = useRecentClubs().filter((c) => c.id !== club.id);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Club[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zoeken met debounce; minstens 2 tekens, anders is de trefferlijst zinloos
  // groot en gaat er onnodig verkeer door de proxy.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setResults(null);
      setBusy(false);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    let active = true;
    const timer = setTimeout(() => {
      searchClubs(q)
        .then((clubs) => {
          if (active) setResults(clubs);
        })
        .catch((e: unknown) => {
          if (active) setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function pick(next: Club) {
    if (onPick) onPick(next);
    else setClub(next);
    close();
  }

  // De getypte zoekterm dient meteen als naam voor een handmatige locatie.
  const manualQuery = query.trim();
  const canManual = allowManual && manualQuery.length >= 2;

  return (
    <div className="club-picker">
      <button
        type="button"
        className="btn btn--sm club-picker__toggle"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg
          className="club-picker__pin"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className="club-picker__label">
          {club.name}
          {club.city ? ` · ${club.city}` : ""}
        </span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <>
          <div
            className="avail-popover-backdrop"
            onClick={close}
            aria-hidden="true"
          />
          <div
            className={`club-picker__panel${
              align === "right" ? " club-picker__panel--right" : ""
            }`}
            role="dialog"
            aria-label="Kies een club"
          >
            {recent.length > 0 && (
              <div className="club-picker__recent">
                <p className="club-picker__recent-title">Recent</p>
                <ul className="club-picker__list">
                  {recent.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="club-picker__option"
                        onClick={() => pick(c)}
                      >
                        <span className="club-picker__name">{c.name}</span>
                        {c.city && (
                          <span className="club-picker__city">{c.city}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <input
              type="search"
              className="select club-picker__search"
              placeholder={
                allowManual
                  ? "Zoek een club, of typ je eigen locatie…"
                  : "Zoek een club in België…"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Het paneel opent alleen op verzoek; direct kunnen typen is
              // dan de verwachting.
              autoFocus
            />

            {busy && <p className="club-picker__hint">Zoeken…</p>}
            {error && <p className="msg msg--error">{error}</p>}
            {!busy && !error && !results && (
              <p className="club-picker__hint">
                {allowManual
                  ? "Typ minstens 2 tekens: we zoeken Playtomic-clubs én je kunt de tekst als eigen locatie gebruiken."
                  : "Typ minstens 2 tekens om Playtomic-clubs in België te zoeken."}
              </p>
            )}

            {/* Playtomic-treffers. */}
            {!busy && results && results.length > 0 && (
              <>
                {allowManual && (
                  <p className="club-picker__recent-title">In Playtomic</p>
                )}
                <ul className="club-picker__list">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`club-picker__option ${
                          c.id === club.id ? "is-active" : ""
                        }`}
                        onClick={() => pick(c)}
                      >
                        <span className="club-picker__name">{c.name}</span>
                        {c.city && (
                          <span className="club-picker__city">{c.city}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!busy && !error && allowManual && results && results.length === 0 && (
              <p className="club-picker__hint">
                Geen Playtomic-club voor “{manualQuery}”.
              </p>
            )}
            {!busy && !error && !allowManual && results && results.length === 0 && (
              <p className="club-picker__hint">
                Geen clubs gevonden voor “{manualQuery}”.
              </p>
            )}

            {/* Zelfde zoekterm als eigen (niet-Playtomic) locatie. */}
            {canManual && (
              <div className="club-picker__manual">
                <p className="club-picker__recent-title">Eigen locatie</p>
                <button
                  type="button"
                  className="club-picker__option"
                  onClick={() => pick(manualClub(manualQuery))}
                >
                  <span className="club-picker__name">📍 {manualQuery}</span>
                  <span className="club-picker__city">
                    Zonder Playtomic — je kiest zelf de tijden
                  </span>
                </button>
              </div>
            )}

            {club.id !== DEFAULT_CLUB.id && (
              <button
                type="button"
                className="btn btn--sm club-picker__reset"
                onClick={() => pick(DEFAULT_CLUB)}
              >
                Terug naar {DEFAULT_CLUB.name}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
