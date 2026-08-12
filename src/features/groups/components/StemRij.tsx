import type { PollVoteStatus } from "@/features/groups/pollsApi";
import { VOTE_SEGMENTS } from "../planPollHelpers";
import { PollJaIcon, PollNeeIcon } from "./pollIconen";
import "@/features/groups/Proposals.css";
import "./StemRij.css";

/* ------------------------------------------------------------------ */
/* Eén moment om op te stemmen: dag, telling en de drie knoppen.       */
/*                                                                     */
/* Dezelfde handeling als op de Plannen-tab, dus dezelfde knoppen:      */
/* VOTE_SEGMENTS en de `seg`-klassen uit Proposals.css, precies zoals   */
/* PollOptionRow ze gebruikt. Bewust niet PollOptionRow zélf: die hangt */
/* aan een PollOption met tally en haalbaarheid, en dat is meer dan een */
/* rij in een sheet moet dragen. De vrije banen komen er sinds #1121    */
/* wél bij: zonder dat getal kies je tussen twee momenten op stemmen    */
/* alleen, terwijl er op één ervan geen baan meer is.                   */
/*                                                                     */
/* Woont bij de polls en niet bij de agenda (#1196): stemmen op een     */
/* moment is groups-domein, de agenda was toevallig de eerste plek waar */
/* het zo compact moest. Hij brengt daarom zijn eigen CSS mee — feature- */
/* CSS hangt aan de route, dus zonder deze twee imports komt de rij      */
/* elders ongestyled binnen.                                            */
/* ------------------------------------------------------------------ */

export function StemRij({
  titel,
  bijschrift,
  omschrijving,
  aantal,
  banen,
  mine,
  onVote,
}: {
  /** Wat er links staat: "Jouw stem" of "do 13 aug · 20:00". */
  titel: string;
  /** Tweede regel onder de titel, bijvoorbeeld de groepsnaam wanneer één lijst
   *  momenten uit meerdere groepen draagt (#1196). Onder en niet achter de
   *  titel: op een telefoon knijpt een derde tekst de knoppen weg. */
  bijschrift?: string;
  /** Hetzelfde moment voluit, voor de knopnamen. Een sheet kan meerdere
   *  stemrijen dragen, en dan is drie keer "Ik kan" geen naam maar een raadsel. */
  omschrijving: string;
  /** Aantal spelers met "ik kan"; null laat de telling weg. */
  aantal: number | null;
  /** Vrije banen op dit moment; null zolang (of omdat) we het niet weten. */
  banen?: number | null;
  mine: PollVoteStatus | null;
  onVote: (status: PollVoteStatus) => void;
}) {
  return (
    <div className="stemrij">
      {bijschrift ? (
        <span className="stemrij__label">
          <span className="stemrij__wanneer">{titel}</span>
          <span className="stemrij__bijschrift">{bijschrift}</span>
        </span>
      ) : (
        <span className="stemrij__wanneer">{titel}</span>
      )}
      {aantal != null && (
        <span className="stemrij__aantal">
          {aantal} {aantal === 1 ? "kan" : "kunnen"}
        </span>
      )}
      {banen != null && (
        <span
          className={`stemrij__banen${banen === 0 ? " is-vol" : ""}`}
        >
          {banen === 0 ? "vol" : `${banen} vrij`}
        </span>
      )}
      <span className="seg" role="group" aria-label={`Jouw stem — ${omschrijving}`}>
        {VOTE_SEGMENTS.map((s) => (
          <button
            key={s.status}
            type="button"
            className={`seg__btn${mine === s.status ? ` is-active is-${s.status}` : ""}`}
            aria-label={`${s.label} — ${omschrijving}`}
            aria-pressed={mine === s.status}
            onClick={() => onVote(s.status)}
          >
            {s.status === "yes" ? (
              <PollJaIcon />
            ) : s.status === "no" ? (
              <PollNeeIcon />
            ) : (
              "?"
            )}
          </button>
        ))}
      </span>
    </div>
  );
}

export default StemRij;
