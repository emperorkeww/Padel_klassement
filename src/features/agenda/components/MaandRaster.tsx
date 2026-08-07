import { useEffect, useRef } from "react";
import { useContainerBreedte } from "@/lib/hooks/useContainerBreedte";
import {
  dagLabel,
  splitMarkers,
  toetsStap,
  type AgendaMarker,
  type RasterDag,
} from "../agendaLogic";
import { StatusGlyph } from "./StatusGlyph";

/* ------------------------------------------------------------------ */
/* Het maandraster (#1091).                                            */
/*                                                                     */
/* Een kalenderraster is een raster: elke dag is een knop met een echte */
/* naam, de pijltjes lopen erdoorheen en er is één tab-stop (roving     */
/* tabindex). De glyph-vorm draagt de status, de naam draagt hem in     */
/* woorden — kleur is nergens het enige onderscheid.                    */
/* ------------------------------------------------------------------ */

/** Vanaf deze *containerbreedte* past de volledige markertekst op één regel.
 *  Gemeten aan de container en niet aan het venster: met de zijbalk ernaast is
 *  de inhoud smaller dan het scherm (#913). */
const BREED_VANAF = 620;

const WEEKDAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const WEEKDAGEN_LANG = [
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
  "zondag",
];

export function MaandRaster({
  weeks,
  perDag,
  vandaag,
  focusDag,
  onFocusDag,
  onPick,
}: {
  weeks: RasterDag[][];
  perDag: Record<string, AgendaMarker[]>;
  vandaag: string;
  /** De dag die de tab-stop draagt; verplaatst met de pijltjes. */
  focusDag: string;
  /** `viaToetsenbord` bepaalt of de focus meeverhuist — muisklikken doen dat
   *  zelf al, en een programmatische focus zou dan met de klik vechten. */
  onFocusDag: (date: string, viaToetsenbord: boolean) => void;
  onPick: (date: string) => void;
}) {
  const { ref, breedte } = useContainerBreedte();
  const breed = breedte != null && breedte >= BREED_VANAF;
  const maxMarkers = breed ? 3 : 2;

  // De focus verhuizen ná de render die de nieuwe dag neerzet. Alleen als de
  // verplaatsing van het toetsenbord kwam: anders kaapt het raster de focus
  // zodra de pagina laadt of iemand ergens anders klikt.
  const knoppen = useRef(new Map<string, HTMLButtonElement>());
  const teFocussen = useRef<string | null>(null);
  useEffect(() => {
    const doel = teFocussen.current;
    if (doel == null) return;
    teFocussen.current = null;
    knoppen.current.get(doel)?.focus();
  });

  function verplaats(naar: string) {
    teFocussen.current = naar;
    onFocusDag(naar, true);
  }

  return (
    <div className="agenda-raster" ref={ref}>
      <div className="agenda-raster__koppen" aria-hidden="true">
        {(breed ? WEEKDAGEN_LANG : WEEKDAGEN).map((d) => (
          <span key={d} className="agenda-raster__kop">
            {d}
          </span>
        ))}
      </div>

      <div
        className="agenda-raster__grid"
        role="grid"
        aria-label="Maandraster met je speeldagen"
        onKeyDown={(e) => {
          const naar = toetsStap(focusDag, e.key);
          if (naar == null) return;
          e.preventDefault();
          verplaats(naar);
        }}
      >
        {weeks.map((week) => (
          <div className="agenda-raster__week" role="row" key={week[0].date}>
            {week.map((dag) => {
              const markers = perDag[dag.date] ?? [];
              const { shown, extra } = splitMarkers(markers, maxMarkers);
              const isVandaag = dag.date === vandaag;
              const leeg = markers.length === 0;
              const dagnummer = Number(dag.date.slice(8));
              return (
                <div role="gridcell" key={dag.date} className="agenda-raster__cel">
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) knoppen.current.set(dag.date, el);
                      else knoppen.current.delete(dag.date);
                    }}
                    // Eén tab-stop in het hele raster; de pijltjes doen de rest.
                    tabIndex={dag.date === focusDag ? 0 : -1}
                    onFocus={() => onFocusDag(dag.date, false)}
                    onClick={() => onPick(dag.date)}
                    aria-label={dagLabel(dag.date, markers)}
                    aria-current={isVandaag ? "date" : undefined}
                    className={[
                      "agenda-dag",
                      leeg && "agenda-dag--leeg",
                      isVandaag && "agenda-dag--vandaag",
                      !dag.inMonth && "agenda-dag--buiten",
                      markers.length > 0 && markers.every((m) => m.past) && "agenda-dag--verleden",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="agenda-dag__nummer" aria-hidden="true">
                      {dagnummer}
                    </span>
                    {shown.map((m) => (
                      <span
                        key={m.optionId}
                        className={`agenda-marker agenda-marker--${m.past ? "past" : m.status}`}
                        aria-hidden="true"
                      >
                        <StatusGlyph status={m.status} past={m.past} size={breed ? 10 : 8} />
                        <span className="agenda-marker__tekst">
                          <span className="agenda-marker__tijd">{m.startTime}</span>
                          <span className="agenda-marker__groep">{m.groupName}</span>
                          {breed && <span className="agenda-marker__hint">{markerHint(m)}</span>}
                        </span>
                      </span>
                    ))}
                    {extra > 0 && (
                      <span className="agenda-dag__meer" aria-hidden="true">
                        +{extra}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** De staart van een brede marker: waar wacht deze speeldag op? */
function markerHint(m: AgendaMarker): string {
  if (m.past) return "gespeeld";
  if (m.status === "locked") return "nog boeken";
  if (m.status === "open") return m.iVoted ? "jij ✓" : "stem";
  return "";
}

export default MaandRaster;
