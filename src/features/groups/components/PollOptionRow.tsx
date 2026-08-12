import { Avatar } from "@/ui/Avatar";
import { displayName } from "@/features/profiles/api";
import type {
  PollOption,
  PollVoteStatus,
} from "@/features/groups/pollsApi";
import {
  PLAYERS_PER_COURT,
  type OptionState,
  type OptionTally,
} from "@/features/groups/pollLogic";
import type { Profile } from "@/types";
import { VOTE_SEGMENTS, shortDay } from "../planPollHelpers";
import { PollJaIcon, PollNeeIcon, PollStateIcon } from "./pollIconen";

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
  const maybeNames = t.maybe.map(name).join(", ");

  return (
    <li className="poll-row-wrap">
      <div className={`poll-row poll-option--${state}`}>
        <span className="poll-row__when">
          {shortDay(o.date)} · {o.start_time}
        </span>
        <span className="poll-row__people">
          <span className="poll-row__avatars" aria-hidden="true">
            {t.yes.slice(0, 4).map((pid) => (
              <Avatar key={pid} profile={profiles[pid]} size={22} />
            ))}
            {t.yes.length > 4 && (
              <span className="poll-row__more">+{t.yes.length - 4}</span>
            )}
          </span>
          {/* De "+N?"-badge was hover-only (#803): op touch kwam je nooit te
              weten wíe er twijfelt. Nu opent hij hetzelfde detail als de
              haalbaarheidsknop, waar de namen staan. */}
          {t.maybe.length > 0 && (
            <button
              type="button"
              className="poll-row__maybe"
              title={maybeNames}
              aria-label={`${t.maybe.length} misschien: ${maybeNames} — uitleg`}
              aria-expanded={detailOpen}
              onClick={onToggleDetail}
            >
              +{t.maybe.length}?
            </button>
          )}
        </span>
        <button
          type="button"
          className={`poll-row__state poll-state--${state}`}
          aria-label={`Haalbaarheid: ${state}${
            t.tekort > 0 ? `, nog ${t.tekort} speler(s) nodig` : ""
          } — uitleg`}
          aria-expanded={detailOpen}
          onClick={onToggleDetail}
        >
          <PollStateIcon state={state} />
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
        ) : (
          <span className="proposal__meta">
            {past
              ? "voorbij"
              : `${t.yes.length} mee${t.maybe.length > 0 ? ` · ${t.maybe.length}?` : ""}`}
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
          {/* De drempel waarop de cron beslist (#1234): onder de vier gaat de
              speeldag niet door. Hier, naast de banen, want dit is de andere
              helft van "kan dit doorgaan". */}
          {t.tekort > 0 && (
            <p className="proposal__meta poll-row-detail__tekort">
              Nog {t.tekort} {t.tekort === 1 ? "speler" : "spelers"} nodig —
              onder de {PLAYERS_PER_COURT} gaat de speeldag niet door.
            </p>
          )}
          {t.yes.length > 0 && (
            <p className="proposal__names">
              Kan: {t.yes.map(name).join(", ")}
            </p>
          )}
          {t.maybe.length > 0 && (
            <p className="proposal__names proposal__names--maybe">
              Misschien: {maybeNames}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
