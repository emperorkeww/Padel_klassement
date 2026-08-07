import type { PollVoteStatus } from "@/features/groups/pollsApi";
import { VOTE_SEGMENTS } from "@/features/groups/planPollHelpers";
import { PollJaIcon, PollNeeIcon } from "@/features/groups/components/pollIconen";

/* ------------------------------------------------------------------ */
/* Eén moment om op te stemmen, zoals het in het dag-sheet staat.      */
/*                                                                     */
/* Dezelfde handeling als op de Plannen-tab, dus dezelfde knoppen:      */
/* VOTE_SEGMENTS en de `seg`-klassen uit Proposals.css, precies zoals   */
/* PollOptionRow ze gebruikt. Bewust niet PollOptionRow zélf: die hangt */
/* aan een PollOption met tally, haalbaarheid en vrije-banen-data, en   */
/* dat haalt de agenda niet op — de haalbaarheid blijft het werk van de */
/* Plannen-tab, die één tik weg is (#1104).                             */
/* ------------------------------------------------------------------ */

export function StemRij({
  titel,
  omschrijving,
  aantal,
  mine,
  onVote,
}: {
  /** Wat er links staat: "Jouw stem" of "do 13 aug · 20:00". */
  titel: string;
  /** Hetzelfde moment voluit, voor de knopnamen. Een sheet kan meerdere
   *  stemrijen dragen, en dan is drie keer "Ik kan" geen naam maar een raadsel. */
  omschrijving: string;
  /** Aantal spelers met "ik kan"; null laat de telling weg. */
  aantal: number | null;
  mine: PollVoteStatus | null;
  onVote: (status: PollVoteStatus) => void;
}) {
  return (
    <div className="stemrij">
      <span className="stemrij__wanneer">{titel}</span>
      {aantal != null && (
        <span className="stemrij__aantal">
          {aantal} {aantal === 1 ? "kan" : "kunnen"}
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
