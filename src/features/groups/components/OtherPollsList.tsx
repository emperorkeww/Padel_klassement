import { useState } from "react";
import type { GroupMember, Profile } from "@/types";
import type {
  PlayPoll,
  PollOption,
  PollVote,
} from "@/features/groups/pollsApi";
import { pollOptions } from "@/features/groups/pollLogic";
import { lockedOptionOf } from "../planFlowLogic";
import { shortDay } from "../planPollHelpers";
import { PollCard } from "./PollCard";

/* ------------------------------------------------------------------ */
/* Secundaire speeldagen (#349): compact ingeklapt onder de focus-poll */
/* zodat meerdere polls (#267) niet als kaartenstapel concurreren.     */
/* Een rij uitklappen toont de volledige poll-kaart (accordeon).       */
/* ------------------------------------------------------------------ */

const STATUS_BADGE: Record<PlayPoll["status"], string> = {
  open: "stemmen loopt",
  locked: "gekozen",
  booked: "geboekt ✓",
  cancelled: "geannuleerd",
};

export function OtherPollsList({
  polls,
  options,
  votes,
  groupName,
  members,
  profiles,
  myId,
  isOwner,
  onChanged,
}: {
  polls: PlayPoll[];
  options: PollOption[];
  votes: PollVote[];
  groupName: string;
  members: GroupMember[];
  profiles: Record<string, Profile>;
  myId: string;
  isOwner: boolean;
  onChanged: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (polls.length === 0) return null;

  return (
    <details className="card plan-other">
      <summary className="plan-other__summary">
        <h2 className="card__title">Andere speeldagen ({polls.length})</h2>
      </summary>
      <ul className="plan-other__rows">
        {polls.map((p) => {
          const own = pollOptions(p, options);
          const chosen = lockedOptionOf(p, options);
          const first = chosen ?? own[0] ?? null;
          const expanded = openId === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                className="plan-other__row"
                aria-expanded={expanded}
                onClick={() => setOpenId(expanded ? null : p.id)}
              >
                <span className="plan-other__when">
                  {first
                    ? `${shortDay(first.date)} · ${first.start_time}`
                    : "Nog geen momenten"}
                </span>
                <span className={`plan-other__badge is-${p.status}`}>
                  {STATUS_BADGE[p.status]}
                </span>
                <span className="plan-other__chevron" aria-hidden="true">
                  ⌄
                </span>
              </button>
              {expanded && (
                <PollCard
                  poll={p}
                  groupName={groupName}
                  members={members}
                  options={own}
                  votes={votes}
                  profiles={profiles}
                  myId={myId}
                  isOwner={isOwner}
                  onChanged={onChanged}
                />
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
