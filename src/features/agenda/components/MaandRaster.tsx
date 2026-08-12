import { useEffect, useRef } from "react";
import {
  dagLabel,
  splitMarkers,
  telWedstrijden,
  toetsStap,
  type AgendaMarker,
  type RasterDag,
  type WedstrijdDag,
} from "../agendaLogic";
import { StatusGlyph } from "@/ui/StatusGlyph";

/* ------------------------------------------------------------------ */
/* Het maandraster (#1091, hervormd in #1112).                         */
/*                                                                     */
/* Een kalenderraster is een raster: elke dag is een knop met een echte */
/* naam, de pijltjes lopen erdoorheen en er is één tab-stop (roving     */
/* tabindex). De glyph-vorm draagt de status, de naam draagt hem in     */
/* woorden — kleur is nergens het enige onderscheid.                    */
/*                                                                     */
/* Wat #1112 veranderde: de cel toonde tijd, groepsnaam en een hint als */
/* tekst, en op mobiel paste daar niets van ("20:00 / Ball…"). Nu is de */
/* cel puur overzicht — dagnummer plus stippen — en staat de leesbare   */
/* tekst eronder. Het raster is daarmee ruim gehalveerd in hoogte.      */
/* ------------------------------------------------------------------ */

/** Hoeveel stippen een dag toont. Meer past niet in een cel van deze maat, en
 *  het exacte aantal staat toch in de toegankelijke naam ("3 speeldagen"). */
const MAX_STIPPEN = 3;

const WEEKDAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export function MaandRaster({
  weeks,
  perDag,
  wedstrijdenPerDag = {},
  losPerDag = {},
  bezig = false,
  vandaag,
  gekozenDag,
  focusDag,
  onFocusDag,
  onPick,
}: {
  weeks: RasterDag[][];
  perDag: Record<string, AgendaMarker[]>;
  /** Alles wat er die dag gespeeld is (#1182) — voedt de toegankelijke naam van
   *  de cel, ook als het bij een speeldag hoort. */
  wedstrijdenPerDag?: Record<string, WedstrijdDag[]>;
  /** Alleen de losse partijen (#1221): wedstrijden zonder speeldag eromheen.
   *  Die dragen de ruit; wat bij een speeldag hoort staat al in diens stip, en
   *  twee glyphs voor één avond was precies de verdubbeling die weg moest. */
  losPerDag?: Record<string, WedstrijdDag[]>;
  /** De maand staat er al, maar de speeldagen zijn nog onderweg (#1182). De
   *  stippen die je dan ziet horen bij het vorige venster. */
  bezig?: boolean;
  vandaag: string;
  /** De dag waar het paneel eronder over gaat (#1112). Los van `focusDag`: met
   *  de pijltjes loop je door het raster zonder telkens iets te kiezen. */
  gekozenDag: string;
  /** De dag die de tab-stop draagt; verplaatst met de pijltjes. */
  focusDag: string;
  /** `viaToetsenbord` bepaalt of de focus meeverhuist — muisklikken doen dat
   *  zelf al, en een programmatische focus zou dan met de klik vechten. */
  onFocusDag: (date: string, viaToetsenbord: boolean) => void;
  onPick: (date: string) => void;
}) {
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
    <div className="agenda-raster" data-bezig={bezig ? "ja" : undefined}>
      <div className="agenda-raster__koppen" aria-hidden="true">
        {WEEKDAGEN.map((d) => (
          <span key={d} className="agenda-raster__kop">
            {d}
          </span>
        ))}
      </div>

      <div
        className="agenda-raster__grid"
        role="grid"
        aria-label="Maandraster met je speeldagen"
        aria-busy={bezig || undefined}
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
              const wedstrijden = wedstrijdenPerDag[dag.date] ?? [];
              const los = losPerDag[dag.date] ?? [];
              // De ruit van de losse partijen krijgt zijn eigen plek, dus de
              // speeldagen leveren er één in: vier glyphs is wat er in een cel
              // van deze maat nog naast elkaar past.
              const { shown } = splitMarkers(
                markers,
                los.length > 0 ? MAX_STIPPEN - 1 : MAX_STIPPEN,
              );
              const isVandaag = dag.date === vandaag;
              const isGekozen = dag.date === gekozenDag;
              const dagnummer = Number(dag.date.slice(8));
              return (
                <div
                  role="gridcell"
                  key={dag.date}
                  className="agenda-raster__cel"
                  aria-selected={isGekozen}
                >
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
                    aria-label={dagLabel(
                      dag.date,
                      markers,
                      dag.date < vandaag,
                      telWedstrijden(wedstrijden),
                    )}
                    aria-current={isVandaag ? "date" : undefined}
                    className={[
                      "agenda-dag",
                      markers.length > 0 && "agenda-dag--bezet",
                      isGekozen && "agenda-dag--gekozen",
                      isVandaag && "agenda-dag--vandaag",
                      !dag.inMonth && "agenda-dag--buiten",
                      markers.length > 0 &&
                        markers.every((m) => m.past) &&
                        "agenda-dag--verleden",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="agenda-dag__nummer" aria-hidden="true">
                      {dagnummer}
                    </span>
                    {/* Vaste hoogte, ook zonder stippen: anders springen de
                        cellen van een week met en zonder speeldag uit elkaar. */}
                    <span className="agenda-dag__stippen" aria-hidden="true">
                      {shown.map((m) => (
                        <StatusGlyph key={m.optionId} status={m.status} past={m.past} />
                      ))}
                      {los.length > 0 && <StatusGlyph status="played" />}
                    </span>
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

export default MaandRaster;
