import { useEffect, useMemo, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { dateInZone } from "../../lib/time";
import { useClub } from "../availability/club";
import { displayName } from "../profiles/api";
import {
  getGroupProposals,
  getGroupProposalVotes,
  type PlayProposal,
} from "./proposalsApi";
import { tallyProposal } from "./proposalLogic";
import { FairTeamsCard } from "./FairTeams";
import type { GroupMember, Profile } from "../../lib/types";
import "./Proposals.css";

// "Vanavond": de deelnemers van het speelvoorstel van vandaag, met de
// eerlijke-teams-generator eronder. Vervangt de aanwezigheids-RSVP als bron
// voor wie er meespeelt; de selectie is handmatig bij te sturen (invaller,
// late beslisser) vóór het genereren.

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

  const proposals = useAsync<PlayProposal[]>(
    () => getGroupProposals(groupId, today),
    [groupId, today],
  );
  const votes = useAsync(() => getGroupProposalVotes(groupId), [groupId]);
  useRealtime("play_proposals", proposals.reload, `group_id=eq.${groupId}`);
  useRealtime("play_proposal_votes", votes.reload, `group_id=eq.${groupId}`);

  // Het voorstel van vandaag met de meeste deelnemers (meestal is er maar één).
  const tonight = useMemo(() => {
    const todays = (proposals.data ?? []).filter((p) => p.date === today);
    let best: { proposal: PlayProposal; yes: string[] } | null = null;
    for (const p of todays) {
      const t = tallyProposal(p, votes.data ?? []);
      if (!best || t.yes.length > best.yes.length) {
        best = { proposal: p, yes: t.yes };
      }
    }
    return best;
  }, [proposals.data, votes.data, today]);

  // Handmatig bij te sturen selectie, voorgevuld met de "mee"-stemmers.
  // Nieuwe stemmen overschrijven een handmatige keuze bewust: de reacties
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
          Vanavond · {tonight.proposal.start_time}
        </h2>
        <p className="proposals__hint">
          Deelnemers uit het voorstel van vandaag; tik namen aan of uit om
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
