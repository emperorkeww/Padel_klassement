import { Avatar } from "@/ui/Avatar";
import { displayName } from "@/features/profiles/api";
import type {
  PollOption,
  PollVoteStatus,
} from "@/features/groups/pollsApi";
import type { OptionState, OptionTally } from "@/features/groups/pollLogic";
import type { Profile } from "@/types";
import { STATE_ICON, VOTE_SEGMENTS, shortDay } from "../planPollHelpers";

/* ------------------------------------------------------------------ */
/* Eén kandidaat-moment: compacte stemrij met haalbaarheid + detail.   */
/* ------------------------------------------------------------------ */

export function PollOptionRow({
  option: o,
  tally: t,
  state,
  free,
  mine,
  votable,
  past,
  detailOpen,
  onToggleDetail,
  onVote,
  profiles,
}: {
  option: PollOption;
  tally: OptionTally;
  state: OptionState;
  free: number | null;
  mine: PollVoteStatus | null;
  /** Stemmen kan: poll open en het moment nog niet voorbij. */
  votable: boolean;
  past: boolean;
  detailOpen: boolean;
  onToggleDetail: () => void;
  onVote: (status: PollVoteStatus) => void;
  profiles: Record<string, Profile>;
}) {
  const name = (id: string) => displayName(profiles[id]);

  return (
    <li className="poll-row-wrap">
      <div className={`poll-row poll-option--${state}`}>
        <span className="poll-row__when">
          {shortDay(o.date)} · {o.start_time}
        </span>
        <span className="poll-row__people" aria-hidden="true">
          {t.yes.slice(0, 4).map((pid) => (
            <Avatar key={pid} profile={profiles[pid]} size={22} />
          ))}
          {t.yes.length > 4 && (
            <span className="poll-row__more">+{t.yes.length - 4}</span>
          )}
          {t.maybe.length > 0 && (
            <span
              className="poll-row__maybe"
              title={`${t.maybe.length} misschien`}
            >
              +{t.maybe.length}?
            </span>
          )}
        </span>
        <button
          type="button"
          className={`poll-row__state poll-state--${state}`}
          aria-label={`Haalbaarheid: ${state} — uitleg`}
          aria-expanded={detailOpen}
          onClick={onToggleDetail}
        >
          {STATE_ICON[state]}
        </button>
        {votable ? (
          <span className="seg" role="group" aria-label="Jouw stem">
            {VOTE_SEGMENTS.map((s) => (
              <button
                key={s.status}
                className={`seg__btn${mine === s.status ? ` is-active is-${s.status}` : ""}`}
                aria-label={s.label}
                title={s.label}
                onClick={() => onVote(s.status)}
              >
                {s.icon}
              </button>
            ))}
          </span>
        ) : (
          <span className="proposal__meta">
            {past ? "voorbij" : `${t.yes.length} mee`}
          </span>
        )}
      </div>
      {detailOpen && (
        <div className="poll-row-detail">
          <p className="proposal__meta">
            {t.yes.length} {t.yes.length === 1 ? "speler" : "spelers"} →{" "}
            {t.needed} {t.needed === 1 ? "baan" : "banen"} nodig ·{" "}
            {free == null
              ? "beschikbaarheid onbekend"
              : `${free} vrij (${state})`}
            {t.maybe.length > 0 && ` · ${t.maybe.length} misschien`}
          </p>
          {t.yes.length > 0 && (
            <p className="proposal__names">
              Kan: {t.yes.map(name).join(", ")}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
