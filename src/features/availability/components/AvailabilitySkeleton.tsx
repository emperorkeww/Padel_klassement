/**
 * Laadstaten die op het banenraster lijken (#920).
 *
 * Er stond een generieke `<Skeleton rows={3|7}>`: drie grijze balken waar
 * daarna een tijdraster met baanrijen verscheen. Bij elke datumwissel sprong de
 * pagina daardoor. Deze twee spiegelen de vorm van `Timetable` en `WeekGrid`:
 * een kolom met rijlabels en daarnaast een strook blokjes.
 *
 * Bewust geen echte tabel-structuur — dit is decoratie (`aria-hidden`), en een
 * screenreader hoort al "laden" via de omliggende status.
 */

function Rij({ blokjes }: { blokjes: number }) {
  return (
    <div className="avail-sk__row">
      <span className="sk sk--line avail-sk__label" />
      <span className="avail-sk__cells">
        {Array.from({ length: blokjes }, (_, i) => (
          <span key={i} className="sk avail-sk__cell" />
        ))}
      </span>
    </div>
  );
}

/** Dagweergave: een handvol baanrijen met tijdblokjes. */
export function TimetableSkeleton({ courts = 4 }: { courts?: number }) {
  return (
    <div className="avail-sk" aria-hidden="true">
      {Array.from({ length: courts }, (_, i) => (
        <Rij key={i} blokjes={12} />
      ))}
    </div>
  );
}

/** Weekweergave: zeven dagrijen met een strip per dag. */
export function WeekGridSkeleton({ days = 7 }: { days?: number }) {
  return (
    <div className="avail-sk" aria-hidden="true">
      {Array.from({ length: days }, (_, i) => (
        <Rij key={i} blokjes={8} />
      ))}
    </div>
  );
}
