import { useEffect, useId, useRef, useState } from "react";
import type { Season } from "@/features/rating/seasons";
import type { GroupSummary } from "@/features/groups/api";

/**
 * De filters van het klassement (#913).
 *
 * Het menu was een kale `<details>`: het sloot niet bij Escape, niet bij een
 * klik buiten en niet na een keuze, dus het paneel bleef over de ranglijst
 * hangen tot je nog eens op de knop tikte. En buiten het menu stond alleen een
 * telbadge — je zag dus wél dát er gefilterd werd, maar niet waarop.
 *
 * Nu een echte disclosure met een chips-rij eronder die elke actieve keuze bij
 * naam noemt en apart laat wissen.
 */

export type FilterWaarden = {
  season: Season | null;
  seasons: Season[];
  groupId: string;
  groups: GroupSummary[];
  /** Teams hebben geen groepsfilter. */
  toonGroep: boolean;
  asof: string;
  /** Dag van je laatste match, voor de snelkoppeling; null = geen matches. */
  myLastMatchDay: string | null;
  minMatches: number;
};

export type FilterActies = {
  onSeason: (id: string) => void;
  onGroup: (id: string) => void;
  onAsof: (d: string) => void;
  onMin: (n: number) => void;
  /** Alles in één keer. Bewust géén vier losse aanroepen: die lezen elk
   *  dezelfde URLSearchParams en zouden elkaars wijziging overschrijven. */
  onWisAlles: () => void;
};

/** Hoeveel filters staan er aan? Zoeken staat los zichtbaar en telt niet mee. */
function telActieveFilters(v: FilterWaarden): number {
  return (
    (v.season ? 1 : 0) +
    (v.groupId ? 1 : 0) +
    (v.asof ? 1 : 0) +
    (v.minMatches > 0 ? 1 : 0)
  );
}

export function LeaderboardFilterMenu({
  waarden,
  acties,
}: {
  waarden: FilterWaarden;
  acties: FilterActies;
}) {
  const [open, setOpen] = useState(false);
  const wikkelRef = useRef<HTMLDivElement>(null);
  const knopRef = useRef<HTMLButtonElement>(null);
  const paneelId = useId();
  const actief = telActieveFilters(waarden);

  // Escape sluit en geeft de focus terug aan de knop — je verliest je plek
  // niet. Zelfde idioom als Sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      knopRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Klik buiten het menu sluit het. `pointerdown` en niet `click`: zo sluit hij
  // ook als je op iets tikt dat zelf de focus opeist.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wikkelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Na een keuze sluit het menu: de chips eronder tonen meteen wat er gebeurde,
  // dus er is geen reden om het paneel over de lijst te laten hangen.
  const kies = <T,>(fn: (waarde: T) => void) => (waarde: T) => {
    fn(waarde);
    setOpen(false);
  };

  const vandaag = new Date().toISOString().slice(0, 10);

  return (
    <div className="lb-menu" ref={wikkelRef}>
      <button
        type="button"
        ref={knopRef}
        className="lb-menu__btn"
        aria-label="Filteren"
        aria-expanded={open}
        aria-controls={paneelId}
        onClick={() => setOpen((o) => !o)}
      >
        <svg
          className="lb-menu__icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        <span className="lb-menu__label">Filter</span>
        {actief > 0 && <span className="lb-filters__count">{actief}</span>}
      </button>

      {open && (
        <div className="lb-menu__panel" id={paneelId}>
          <div className="lb-menu__row">
            <label className="lb-filters__field">
              <span>Seizoen</span>
              <select
                className="select select--filter"
                aria-label="Seizoen"
                value={waarden.season?.id ?? ""}
                onChange={(e) => kies(acties.onSeason)(e.target.value)}
              >
                <option value="">Alle tijden</option>
                {/* Gedeeld seizoen uit de URL dat (nog) niet in de lijst zit. */}
                {waarden.season &&
                  !waarden.seasons.some((s) => s.id === waarden.season!.id) && (
                    <option value={waarden.season.id}>
                      {waarden.season.label}
                    </option>
                  )}
                {waarden.seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            {waarden.toonGroep && (
              <label className="lb-filters__field">
                <span>Groep</span>
                <select
                  className="select select--filter"
                  aria-label="Groep"
                  value={waarden.groupId}
                  onChange={(e) => kies(acties.onGroup)(e.target.value)}
                >
                  <option value="">Alle groepen</option>
                  {waarden.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* Geavanceerd: stand-op-datum en minimaal aantal matches (#71). */}
          <label className="lb-filters__field">
            <span>Stand op datum</span>
            <input
              className="input select--filter lb-date"
              type="date"
              aria-label="Stand op datum"
              title="Bekijk de stand zoals hij was t/m deze datum"
              value={waarden.asof}
              max={vandaag}
              onChange={(e) => kies(acties.onAsof)(e.target.value)}
            />
          </label>
          {waarden.myLastMatchDay && (
            <button
              type="button"
              className={`tab lb-menu__preset ${
                waarden.asof === waarden.myLastMatchDay ? "is-active" : ""
              }`}
              onClick={() =>
                kies(acties.onAsof)(
                  waarden.asof === waarden.myLastMatchDay
                    ? ""
                    : waarden.myLastMatchDay!,
                )
              }
            >
              Mijn laatste match
            </button>
          )}
          <label className="lb-filters__field">
            <span>Minimaal gespeeld</span>
            <select
              className="select select--filter"
              aria-label="Minimaal aantal matches"
              value={waarden.minMatches}
              onChange={(e) => kies(acties.onMin)(Number(e.target.value))}
            >
              <option value={0}>Alle spelers</option>
              {[3, 5, 10, 20].map((n) => (
                <option key={n} value={n}>
                  ≥ {n} matches
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

/**
 * Elke actieve keuze bij naam, met een eigen wis-knop. Zonder dit zag je alleen
 * een getal op de menuknop en moest je het menu openen om te ontdekken dat je
 * naar een oud kwartaal of één groep zat te kijken.
 */
export function LeaderboardFilterChips({
  waarden,
  acties,
}: {
  waarden: FilterWaarden;
  acties: FilterActies;
}) {
  const chips: { sleutel: string; label: string; wis: () => void }[] = [];

  if (waarden.season)
    chips.push({
      sleutel: "seizoen",
      label: `Seizoen: ${waarden.season.label}`,
      wis: () => acties.onSeason(""),
    });
  if (waarden.groupId) {
    const naam =
      waarden.groups.find((g) => g.id === waarden.groupId)?.name ?? "groep";
    chips.push({
      sleutel: "groep",
      label: `Groep: ${naam}`,
      wis: () => acties.onGroup(""),
    });
  }
  if (waarden.asof)
    chips.push({
      sleutel: "stand",
      label: `Stand op ${waarden.asof}`,
      wis: () => acties.onAsof(""),
    });
  if (waarden.minMatches > 0)
    chips.push({
      sleutel: "min",
      label: `≥ ${waarden.minMatches} matches`,
      wis: () => acties.onMin(0),
    });

  if (chips.length === 0) return null;

  return (
    <div className="lb-chips" role="group" aria-label="Actieve filters">
      {chips.map((c) => (
        <span key={c.sleutel} className="lb-chip">
          {c.label}
          <button
            type="button"
            className="lb-chip__wis"
            aria-label={`${c.label} wissen`}
            onClick={c.wis}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          className="btn btn--sm lb-chips__alles"
          onClick={acties.onWisAlles}
        >
          Alles wissen
        </button>
      )}
    </div>
  );
}
