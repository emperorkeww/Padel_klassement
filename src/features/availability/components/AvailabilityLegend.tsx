import { CourtTypeIcon } from "./CourtTypeIcon";

/**
 * Kleuruitleg onder het banenraster (#920).
 *
 * `DaySection` en `WeekSection` droegen elk hun eigen, bijna identieke kopie —
 * drift-gevoelig, en onder élke weergave een blok van zes swatches met een
 * alinea kleine letters. Nu één bron, en ingeklapt: je leest dit hooguit één
 * keer, daarna is het ruis onder een raster dat je juist wil zien.
 */
export function AvailabilityLegend({
  toonVoorbij,
  modus,
  duration,
}: {
  /** "Voorbij" bestaat alleen vandaag; op een andere dag is er niets voorbij. */
  toonVoorbij: boolean;
  modus: "dag" | "week";
  /** Actief duurfilter, voor de week-uitleg; null = alle duren. */
  duration?: number | null;
}) {
  return (
    <details className="avail-legend-box">
      <summary className="avail-legend-box__summary">
        Wat betekenen de kleuren?
      </summary>

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
        {toonVoorbij && (
          <span className="avail-legend__item">
            <span className="avail-cell avail-cell--past avail-legend__swatch" /> Voorbij
          </span>
        )}
        <span className="avail-legend__item">
          <CourtTypeIcon type="roofed" /> overdekt
        </span>
        <span className="avail-legend__item">
          <CourtTypeIcon type="outdoor" /> buiten
        </span>
      </div>

      <p className="avail-note">
        {modus === "dag" ? (
          <>
            Tik een groen slot voor duren en prijzen. Tijden zijn onder
            voorbehoud — niet officieel.
          </>
        ) : (
          <>
            Elke dag toont een strip per baan; het icoontje bij het baanlabel
            geeft aan of die overdekt (dakje) of buiten (zonnetje) is
            {duration != null ? `. Gefilterd op ${duration} minuten` : ""}. Tik
            op een vrij (groen) vak om de dagweergave met duren en prijzen te
            openen.
          </>
        )}
      </p>
    </details>
  );
}

export default AvailabilityLegend;
