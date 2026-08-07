import { dagLabel, weekVan, type AgendaMarker } from "../agendaLogic";
import { StatusGlyph } from "./StatusGlyph";

const LETTERS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

/**
 * "Deze week" boven het maandraster (#1091): zeven dagen met hoogstens één
 * glyph elk. Bewust géén tweede bedienbaar raster — dat zou de toetsenbord-
 * navigatie verdubbelen zonder iets toe te voegen. Dit is een samenvatting;
 * bladeren en aantikken doe je in het raster eronder.
 */
export function WeekStrook({
  vandaag,
  perDag,
}: {
  vandaag: string;
  perDag: Record<string, AgendaMarker[]>;
}) {
  const dagen = weekVan(vandaag);
  return (
    <section className="agenda-week card" aria-label="Deze week">
      <span className="agenda-week__label">Deze week</span>
      <ol className="agenda-week__rij">
        {dagen.map((date, i) => {
          const markers = perDag[date] ?? [];
          const eerste = markers[0];
          return (
            <li
              key={date}
              className={`agenda-week__dag${date === vandaag ? " is-vandaag" : ""}`}
            >
              <span className="agenda-week__letter" aria-hidden="true">
                {LETTERS[i]}
              </span>
              <span className="agenda-week__nummer" aria-hidden="true">
                {Number(date.slice(8))}
              </span>
              {/* Vaste hoogte, ook zonder glyph: anders verspringt de rij
                  tussen dagen met en zonder speeldag. */}
              <span className="agenda-week__glyph">
                {eerste && <StatusGlyph status={eerste.status} past={eerste.past} />}
              </span>
              <span className="sr-only">{dagLabel(date, markers)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default WeekStrook;
