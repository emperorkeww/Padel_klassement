import { useEffect, useMemo, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { dateInZone } from "../../lib/time";
import { useClub } from "../availability/club";
import { displayName } from "../profiles/api";
import {
  getGroupPolls,
  getGroupPollOptions,
  getGroupPollVotes,
  type PollOption,
} from "./pollsApi";
import { tallyOption } from "./pollLogic";
import { FairTeamsCard } from "./FairTeams";
import type { GroupMember, Profile } from "../../lib/types";
import "./Proposals.css";

// "Vanavond": de deelnemers van het gekozen/meest gesteunde poll-moment van
// vandaag, met de eerlijke-teams-generator eronder. De selectie is handmatig
// bij te sturen (invaller, late beslisser) vóór het genereren.

export function Tonight({
  groupId,
  members,
  profiles,
  myId,
}: {
  groupId: string;
  members: GroupMember[];
  profiles: Record<string, Profile>;
  myId: string;
}) {
  const club = useClub();
  const today = dateInZone(club.timezone);

  const polls = useAsync(() => getGroupPolls(groupId), [groupId]);
  const options = useAsync(() => getGroupPollOptions(groupId), [groupId]);
  const votes = useAsync(() => getGroupPollVotes(groupId), [groupId]);
  useRealtime("play_polls", polls.reload, `group_id=eq.${groupId}`);
  useRealtime("play_poll_votes", votes.reload, `group_id=eq.${groupId}`);

  // Het moment van vandaag: het gelockte/geboekte moment wint; anders de
  // best gesteunde optie van vandaag uit een open poll.
  const tonight = useMemo(() => {
    const live = (polls.data ?? []).filter((p) => p.status !== "cancelled");
    const todaysOptions = (options.data ?? []).filter(
      (o) => o.date === today && live.some((p) => p.id === o.poll_id),
    );
    if (todaysOptions.length === 0) return null;

    const chosen = todaysOptions.find((o) =>
      live.some(
        (p) =>
          p.locked_option_id === o.id &&
          (p.status === "locked" || p.status === "booked"),
      ),
    );
    let best: PollOption | null = chosen ?? null;
    if (!best) {
      let bestYes = -1;
      for (const o of todaysOptions) {
        const yes = tallyOption(o, votes.data ?? []).yes.length;
        if (yes > bestYes) {
          bestYes = yes;
          best = o;
        }
      }
    }
    if (!best) return null;
    return { option: best, yes: tallyOption(best, votes.data ?? []).yes };
  }, [polls.data, options.data, votes.data, today]);

  // Handmatig bij te sturen selectie, voorgevuld met de "kan"-stemmers.
  // Nieuwe stemmen overschrijven een handmatige keuze bewust: de stemmen
  // zijn de bron van waarheid, de toggles zijn een last-minute correctie.
  const yesKey = tonight?.yes.join(",") ?? "";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(new Set(yesKey ? yesKey.split(",") : []));
  }, [yesKey]);

  if (!tonight) return null;

  const toggle = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <section className="card">
        <h2 className="card__title">
          Vanavond · {tonight.option.start_time}
        </h2>
        <p className="proposals__hint">
          Deelnemers uit de poll van vandaag; tik namen aan of uit om
          last-minute te corrigeren.
        </p>
        <div className="tonight__players" role="group" aria-label="Deelnemers">
          {members.map((m) => {
            const on = selected.has(m.player_id);
            return (
              <button
                key={m.player_id}
                type="button"
                className={`btn btn--sm attendance-btn ${on ? "is-active is-yes" : ""}`}
                aria-pressed={on}
                onClick={() => toggle(m.player_id)}
              >
                {displayName(profiles[m.player_id])}
                {m.player_id === myId ? " (jij)" : ""}
              </button>
            );
          })}
        </div>
      </section>
      <FairTeamsCard
        groupId={groupId}
        playerIds={[...selected]}
        profiles={profiles}
      />
    </>
  );
}

export default Tonight;
