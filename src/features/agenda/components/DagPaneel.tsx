import { Avatar } from "@/ui/Avatar";
import { courtsLabel, longDay } from "@/features/groups/planPollHelpers";
import type { Profile } from "@/types";
import {
  duurLabel,
  metHoofdletter,
  statusChip,
  type AgendaMarker,
} from "../agendaLogic";

/* ------------------------------------------------------------------ */
/* Het dagpaneel onder het raster (#1112).                             */
/*                                                                     */
/* Hier staat wat in het raster niet meer past. De kaart is bewust een  */
/* *samenvatting* en geen detail: tijd, groep, plek en wie er kan. Wie  */
/* meer wil — stemmen, banen, toegangscode, .ics — tikt de kaart aan en */
/* krijgt het dag-sheet dat er altijd al was. Zo blijft er één plek     */
/* waar je handelt, in plaats van twee die uit elkaar gaan lopen.       */
/* ------------------------------------------------------------------ */

/** Hoeveel gezichten er in de rij passen voordat de rest een telling wordt. */
const MAX_AVATARS = 4;

export function DagPaneel({
  datum,
  vandaag,
  markers,
  ledenPerGroep,
  profielen,
  onOpen,
  onPlan,
}: {
  /** De gekozen dag; ISO. */
  datum: string;
  vandaag: string;
  markers: AgendaMarker[];
  /** Aantal leden per groep — de noemer van "2 van 4 kunnen". */
  ledenPerGroep: Record<string, number>;
  profielen: Record<string, Profile>;
  /** Een aangetikte speeldag: het dag-sheet opent. */
  onOpen: () => void;
  /** Op deze dag een speeldag starten. Ontbreekt voor een dag die geweest is. */
  onPlan?: () => void;
}) {
  const isVandaag = datum === vandaag;
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
        {markers.length > 0 && (
          <p className="dagpaneel__telling">
            {markers.length} {markers.length === 1 ? "activiteit" : "activiteiten"}
          </p>
        )}
      </header>

      {markers.length === 0 ? (
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
      ) : (
        <ul className="dagpaneel__lijst">
          {markers.map((m) => (
            <li key={m.optionId}>
              <SpeeldagKaart
                marker={m}
                leden={ledenPerGroep[m.groupId] ?? 0}
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

function SpeeldagKaart({
  marker,
  leden,
  profielen,
  onOpen,
}: {
  marker: AgendaMarker;
  leden: number;
  profielen: Record<string, Profile>;
  onOpen: () => void;
}) {
  const status = marker.past ? "past" : marker.status;
  const kanners = marker.yesVoterIds;
  return (
    <button type="button" className="speeldag" onClick={onOpen}>
      {/* Het staafje links draagt dezelfde status als de stip in het raster —
          zo herken je de dag terug die je net aantikte. */}
      <span className={`speeldag__rail speeldag__rail--${status}`} aria-hidden="true" />
      <span className="speeldag__body">
        <span className="speeldag__top">
          <span className="speeldag__tijd">{marker.startTime}</span>
          <span className="speeldag__duur">{duurLabel(marker.duration)}</span>
          <span className={`speeldag__chip speeldag__chip--${status}`}>
            {statusChip(marker.status, marker.past)}
          </span>
        </span>
        <span className="speeldag__titel">{marker.groupName}</span>
        <span className="speeldag__plek">{plek(marker)}</span>
        {kanners.length > 0 && (
          <span className="speeldag__spelers">
            <span className="speeldag__avatars" aria-hidden="true">
              {kanners.slice(0, MAX_AVATARS).map((id) => (
                <Avatar key={id} profile={profielen[id]} size={24} short />
              ))}
            </span>
            <span className="speeldag__telling">{spelersLabel(marker, leden)}</span>
          </span>
        )}
      </span>
    </button>
  );
}

/** Waar er gespeeld wordt. Zolang de baan niet geboekt is valt daar nog niets
 *  over te zeggen, en dat is precies wat er dan hoort te staan. */
function plek(m: AgendaMarker): string {
  if (m.status === "booked" && m.courts) return `${m.clubName} · ${courtsLabel(m.courts)}`;
  if (m.status === "open") return `${m.clubName} · baan nog te kiezen`;
  return m.clubName;
}

/**
 * Wie er meedoet. Bij een open poll is dat een tússenstand — "2 van 4 kunnen" —
 * en bij een vastgelegde of geboekte dag zijn het gewoon de spelers.
 */
function spelersLabel(m: AgendaMarker, leden: number): string {
  const n = m.yesVoterIds.length;
  if (m.status === "open" && !m.past) {
    return leden > 0 ? `${n} van ${leden} kunnen` : `${n} kunnen`;
  }
  return `${n} ${n === 1 ? "speler" : "spelers"}`;
}

export default DagPaneel;
