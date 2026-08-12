import { Avatar } from "@/ui/Avatar";
import { courtsLabel, shortDay } from "@/features/groups/planPollHelpers";
import type { Profile } from "@/types";
import {
  duurLabel,
  kannersOpDag,
  statusChip,
  tijdenLabel,
  volgendeStap,
  type AgendaMarker,
  type DagItem,
} from "../agendaLogic";
import "../Agenda.css";

/* ------------------------------------------------------------------ */
/* De samenvattingskaart van één speeldag (#1112, gedeeld sinds #1182). */
/*                                                                     */
/* Bewust een *samenvatting* en geen detail: tijd, groep, plek en wie   */
/* er kan. Wie meer wil — stemmen, banen, toegangscode, .ics — tikt de  */
/* kaart aan en krijgt het dag-sheet. Zo blijft er één plek waar je     */
/* handelt, in plaats van twee die uit elkaar gaan lopen.               */
/*                                                                     */
/* Stond tot #1182 in DagPaneel.tsx; de lijstweergave toont dezelfde    */
/* kaart, en twee kopieën zouden meteen uit elkaar lopen. Hij           */
/* importeert zijn eigen CSS, want Vite splitst per route-chunk.        */
/* ------------------------------------------------------------------ */

/** Hoeveel gezichten er in de rij passen voordat de rest een telling wordt. */
const MAX_AVATARS = 4;

export function SpeeldagKaart({
  item,
  leden,
  profielen,
  metDag = false,
  onOpen,
}: {
  item: DagItem;
  /** Aantal leden van de groep — de noemer van "2 van 4 kunnen". */
  leden: number;
  profielen: Record<string, Profile>;
  /** Zet de dag voor de tijd ("za 16 aug · 20:00"). In het dagpaneel weet je
   *  welke dag het is; in een lijst over meerdere weken niet. */
  metDag?: boolean;
  onOpen: () => void;
}) {
  const marker = item.eerste;
  const status = marker.past ? "past" : marker.status;
  const kanners = kannersOpDag(item.momenten);
  // Eén duur onder de tijden zeggen kan alleen als ze allemaal even lang zijn;
  // anders hoort die regel bij een tijd die er niet meer los staat.
  const gelijkeDuur = item.momenten.every((m) => m.duration === marker.duration);
  // Op deze dag stemmen telt als stemmen: wie op 20:00 "ik kan" zei, hoeft van
  // 21:30 niets meer te vinden om zijn antwoord kwijt te zijn.
  const mijnStem = item.momenten.find((m) => m.myVote != null)?.myVote ?? null;
  // Waar deze speeldag op wacht (#1121). De Plannen-tab zei dit in een balk
  // bovenaan, over precies één speeldag; hier hoort het bij de kaart waar het
  // over gaat — er kunnen er drie tegelijk lopen, elk in een andere fase.
  const stap = volgendeStap(
    mijnStem === marker.myVote ? marker : { ...marker, myVote: mijnStem },
  );
  const opJou = marker.status === "open" && !marker.past && mijnStem == null;
  const tijden = tijdenLabel(item.momenten);
  return (
    <button type="button" className="speeldag" onClick={onOpen}>
      {/* Het staafje links draagt dezelfde status als de stip in het raster —
          zo herken je de dag terug die je net aantikte. */}
      <span className={`speeldag__rail speeldag__rail--${status}`} aria-hidden="true" />
      <span className="speeldag__body">
        <span className="speeldag__top">
          <span className="speeldag__tijd">
            {metDag ? `${shortDay(marker.date)} · ${tijden}` : tijden}
          </span>
          {gelijkeDuur && (
            <span className="speeldag__duur">{duurLabel(marker.duration)}</span>
          )}
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
            <span className="speeldag__telling">
              {spelersLabel(marker, leden, kanners.length)}
            </span>
          </span>
        )}
        {stap && <span className={`speeldag__stap${opJou ? " is-jij" : ""}`}>{stap}</span>}
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
 *
 * `n` komt van buiten: bij een gebundelde speeldag telt iedereen mee die op
 * mínstens één moment van die dag kan (#1182).
 */
function spelersLabel(m: AgendaMarker, leden: number, n: number): string {
  if (m.status === "open" && !m.past) {
    return leden > 0 ? `${n} van ${leden} kunnen` : `${n} kunnen`;
  }
  return `${n} ${n === 1 ? "speler" : "spelers"}`;
}

export default SpeeldagKaart;
