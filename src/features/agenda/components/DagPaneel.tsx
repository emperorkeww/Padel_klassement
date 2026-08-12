import { longDay, shortDay } from "@/features/groups/planPollHelpers";
import type { Profile } from "@/types";
import {
  dagItems,
  metHoofdletter,
  statusLabel,
  type AgendaMarker,
} from "../agendaLogic";
import { StatusGlyph } from "@/ui/StatusGlyph";
import { SpeeldagKaart } from "./SpeeldagKaart";
import "../Agenda.css";

/* ------------------------------------------------------------------ */
/* Het dagpaneel onder het raster (#1112).                             */
/*                                                                     */
/* Hier staat wat in het raster niet meer past: per speeldag een        */
/* samenvattingskaart (SpeeldagKaart, sinds #1182 gedeeld met de        */
/* lijstweergave), en onder een lege dag de wegwijzer naar wat er wél   */
/* aankomt.                                                            */
/* ------------------------------------------------------------------ */

export function DagPaneel({
  datum,
  vandaag,
  markers,
  volgende,
  ledenPerGroep,
  profielen,
  onOpen,
  onPlan,
  onKiesDag,
}: {
  /** De gekozen dag; ISO. */
  datum: string;
  vandaag: string;
  markers: AgendaMarker[];
  /** De eerstvolgende speeldagen ná deze dag. Alleen zichtbaar zolang de dag
   *  zelf leeg is — anders staat er van alles onder elkaar dat over
   *  verschillende dagen gaat. */
  volgende: AgendaMarker[];
  /** Aantal leden per groep — de noemer van "2 van 4 kunnen". */
  ledenPerGroep: Record<string, number>;
  profielen: Record<string, Profile>;
  /** Een aangetikte speeldag: het dag-sheet opent. */
  onOpen: () => void;
  /** Op deze dag een speeldag starten. Ontbreekt voor een dag die geweest is. */
  onPlan?: () => void;
  /** Een rij uit "Hierna": spring naar die dag (en die maand). */
  onKiesDag: (date: string) => void;
}) {
  const isVandaag = datum === vandaag;
  // Per speeldag, niet per moment (#1182): een poll met twee kandidaat-tijden op
  // deze dag is één kaart met beide tijden erop.
  const items = dagItems(markers);
  return (
    <section className="dagpaneel" aria-label={`Speeldagen op ${longDay(datum)}`}>
      <header className="dagpaneel__kop">
        <h2 className="dagpaneel__datum">
          {/* "Vandaag · vrijdag 7 augustus" — de dag zelf blijft erbij staan,
              anders moet je terug naar het raster om te zien wélke dag. */}
          {isVandaag ? (
            <>
              <span className="dagpaneel__vandaag">Vandaag ·</span>{" "}
              {longDay(datum)}
            </>
          ) : (
            metHoofdletter(longDay(datum))
          )}
        </h2>
        {items.length > 0 && (
          <p className="dagpaneel__telling">
            {items.length} {items.length === 1 ? "activiteit" : "activiteiten"}
          </p>
        )}
      </header>

      {markers.length === 0 ? (
        <>
          <div className="dagpaneel__leeg">
            <p className="dagpaneel__leeg-titel">Nog niets gepland</p>
            <p className="dagpaneel__leeg-tekst">
              {onPlan
                ? "Zet er een speeldag op en laat je groep stemmen."
                : "Deze dag is geweest en er stond geen speeldag op."}
            </p>
            {onPlan && (
              <button
                type="button"
                className="btn btn--primary dagpaneel__plan"
                onClick={onPlan}
              >
                Speeldag plannen
              </button>
            )}
          </div>

          {/* Een lege dag is de plek waar de vraag "en wanneer dán wel?" komt.
              Hier staat het antwoord, in plaats van dat je maand voor maand
              moet gaan bladeren. */}
          {volgende.length > 0 && (
            <Hierna dagen={volgende} onKiesDag={onKiesDag} />
          )}
        </>
      ) : (
        <ul className="dagpaneel__lijst">
          {items.map((item) => (
            <li key={item.eerste.pollId}>
              <SpeeldagKaart
                item={item}
                leden={ledenPerGroep[item.eerste.groupId] ?? 0}
                profielen={profielen}
                onOpen={onOpen}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * "Hierna": de eerstvolgende speeldagen, als rijen om naartoe te springen.
 *
 * Compacter dan een speeldagkaart en met opzet: dit gaat niet over déze dag,
 * het is een wegwijzer. Aantikken kiest die dag — daarna staat de volle kaart
 * er gewoon, met dezelfde weg naar het dag-sheet.
 */
function Hierna({
  dagen,
  onKiesDag,
}: {
  dagen: AgendaMarker[];
  onKiesDag: (date: string) => void;
}) {
  return (
    <>
      <h3 className="dagpaneel__kicker">Hierna</h3>
      <ul className="hierna">
        {dagen.map((m) => (
          <li key={m.optionId}>
            <button
              type="button"
              className="hierna__rij"
              onClick={() => onKiesDag(m.date)}
              // De rij is een sprong naar een dag, en dat moet je kunnen horen:
              // de losse stukjes tekst zeggen los van elkaar te weinig.
              aria-label={`${shortDay(m.date)}, ${m.startTime}, ${m.groupName}, ${statusLabel(m.status, m.past)}`}
            >
              <StatusGlyph status={m.status} past={m.past} />
              <span className="hierna__dag" aria-hidden="true">
                {shortDay(m.date)}
              </span>
              <span className="hierna__wat" aria-hidden="true">
                {m.startTime} · {m.groupName}
              </span>
              <IconChevron />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function IconChevron() {
  return (
    <svg
      className="hierna__chevron"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default DagPaneel;
