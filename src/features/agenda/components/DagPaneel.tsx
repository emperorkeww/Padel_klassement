import { Link } from "react-router-dom";
import { longDay, shortDay } from "@/features/groups/planPollHelpers";
import type { Profile } from "@/types";
import {
  dagItems,
  metHoofdletter,
  statusLabel,
  type AgendaMarker,
  type WedstrijdDag,
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
  wedstrijden = [],
  wedstrijdenPerPoll = {},
  groepNamen = {},
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
  /** Los gelogde partijen, per groep (#1182). Sinds #1221 alléén wat bij geen
   *  enkele speeldag hoort: de rest staat op de speeldagkaart zelf. */
  wedstrijden?: WedstrijdDag[];
  /** Aantal gespeelde wedstrijden per poll (#1221) — de teller op de kaart. */
  wedstrijdenPerPoll?: Record<string, number>;
  groepNamen?: Record<string, string>;
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
  // De telling moet kloppen met wat eronder staat (#1221): een losse partij is
  // ook een activiteit. Tot nu toe telde alleen de speeldagen, en een dag met
  // één speeldag en één losse rij meldde doodleuk "1 activiteit".
  const aantal = items.length + wedstrijden.length;
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
        <div className="dagpaneel__kop-rechts">
          {aantal > 0 && (
            <p className="dagpaneel__telling">
              {aantal} {aantal === 1 ? "activiteit" : "activiteiten"}
            </p>
          )}
          {/* "Is er die dag eigenlijk een baan vrij?" was tot #1213 een vraag
              die je elders opnieuw moest intikken: Banen leest ?datum= al uit
              de URL, maar niets in de plan-flow wees erheen. Alleen vooruit —
              vrije banen op een dag die geweest is zeggen niets. Zonder
              ?club=: dit paneel gaat over meerdere groepen, dus de eigen
              clubkeuze is hier de juiste. */}
          {datum >= vandaag && (
            <Link className="dagpaneel__banen" to={`/banen?datum=${datum}`}>
              Vrije banen op deze dag →
            </Link>
          )}
        </div>
      </header>

      {/* Wat er los gespeeld is (#1182). Staat boven de lege staat én boven de
          speeldagkaarten: op een dag die geweest is is dít het nieuws. */}
      {wedstrijden.length > 0 && (
        <ul className="dagpaneel__lijst">
          {wedstrijden.map((w) => (
            <li key={w.groupId}>
              <WedstrijdRij dag={w} groepNaam={groepNamen[w.groupId] ?? "Groep"} />
            </li>
          ))}
        </ul>
      )}

      {markers.length === 0 ? (
        <>
          {wedstrijden.length === 0 && (
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
          )}

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
                wedstrijden={wedstrijdenPerPoll[item.eerste.pollId] ?? 0}
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
 * Wat er die dag los gespeeld is (#1182).
 *
 * Eén rij per groep, want dat is de eenheid waarin je erover praat ("drie
 * wedstrijden bij Vamos!"). Bij precies één wedstrijd gaat de link naar die
 * wedstrijd; bij meer naar het matchoverzicht van de groep, want een dagfilter
 * bestaat daar niet.
 *
 * Alleen voor wedstrijden zónder speeldag eromheen (#1221). Wat bij een
 * speeldag hoort staat op die kaart; anders stond dezelfde avond er twee keer.
 *
 * Draagt precies dezelfde schil als een speeldagkaart (#1207). De eigen,
 * vlakkere variant die hier stond las naast die kaarten als iets uit een andere
 * app; het staafje links zegt al dat deze dag geweest is.
 */
function WedstrijdRij({
  dag,
  groepNaam,
}: {
  dag: WedstrijdDag;
  groepNaam: string;
}) {
  const n = dag.matches.length;
  const naar =
    n === 1 ? `/matches/${dag.matches[0].id}` : `/spelen?groep=${dag.groupId}`;
  return (
    <Link className="speeldag" to={naar}>
      <span className="speeldag__rail speeldag__rail--past" aria-hidden="true" />
      <span className="speeldag__body">
        <span className="speeldag__top">
          <span className="speeldag__tijd">
            {n} {n === 1 ? "wedstrijd" : "wedstrijden"}
          </span>
          <span className="speeldag__chip speeldag__chip--past">Gespeeld</span>
        </span>
        <span className="speeldag__titel">{groepNaam}</span>
      </span>
    </Link>
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
