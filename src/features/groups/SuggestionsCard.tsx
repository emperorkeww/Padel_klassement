import { useMemo, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { addDays, dateInZone } from "../../lib/time";
import { getWeekAvailability, type WeekDay } from "../availability/api";
import { weekHeatmap } from "../availability/availabilityShare";
import { useClub } from "../availability/club";
import { getGroupSlotVotes, type SlotVote } from "./planApi";
import {
  getGroupProposals,
  getGroupProposalVotes,
  createProposal,
  type PlayProposal,
} from "./proposalsApi";
import { tallyProposal } from "./proposalLogic";
import {
  playedMoments,
  suggestMoments,
  type Suggestion,
} from "./suggestionLogic";
import type { Match } from "../../lib/types";
import "./Proposals.css";

// Suggestiekaart: stelt de beste speelmomenten van de komende week voor op
// basis van vrije banen, slot-stemmen van leden, de speelhistoriek van de
// groep en eerder succesvolle voorstellen. Eén tik zet een suggestie om in
// een echt speelvoorstel (op de Plannen-tab).

/** Zoveel dagen terug kijken we voor historiek en eerdere voorstellen. */
const HISTORY_DAYS = 60;

function shortDay(date: string): string {
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

export function SuggestionsCard({
  groupId,
  myId,
  matches,
}: {
  groupId: string;
  myId: string;
  /** Alle matches van de groep (voor de speelhistoriek). */
  matches: Match[];
}) {
  const club = useClub();
  const toast = useToast();
  const today = dateInZone(club.timezone);
  const [proposing, setProposing] = useState<string | null>(null);

  const week = useAsync<WeekDay[]>(() => getWeekAvailability(today), [today, club.id]);
  const slotVotes = useAsync<SlotVote[]>(
    () => getGroupSlotVotes(groupId, today),
    [groupId, today],
  );
  const proposals = useAsync<PlayProposal[]>(
    () => getGroupProposals(groupId, addDays(today, -HISTORY_DAYS)),
    [groupId, today],
  );
  const propVotes = useAsync(() => getGroupProposalVotes(groupId), [groupId]);
  useRealtime("play_proposals", proposals.reload, `group_id=eq.${groupId}`);
  useRealtime("slot_availability", slotVotes.reload, `group_id=eq.${groupId}`);

  const suggestions: Suggestion[] = useMemo(() => {
    const heat = weekHeatmap(week.data ?? [], null);
    const all = proposals.data ?? [];
    const past = all.filter((p) => p.date < today);
    const pastPlayable = past.filter(
      (p) => tallyProposal(p, propVotes.data ?? []).playable,
    );
    const history = playedMoments(
      matches
        .filter((m) => m.status === "completed")
        .map((m) => m.played_at ?? m.created_at),
      club.timezone,
    );
    return suggestMoments({
      heat,
      slotVotes: slotVotes.data ?? [],
      history,
      pastPlayable,
      existing: all.filter((p) => p.date >= today),
    });
  }, [week.data, slotVotes.data, proposals.data, propVotes.data, matches, today, club.timezone]);

  async function propose(s: Suggestion) {
    setProposing(`${s.date}|${s.time}`);
    try {
      await createProposal({
        groupId,
        createdBy: myId,
        date: s.date,
        startTime: s.time,
        courts: 1,
        clubName: club.name ?? null,
      });
      proposals.reload();
      propVotes.reload();
      toast.success("Voorstel geplaatst — bekijk het op de Plannen-tab.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setProposing(null);
    }
  }

  const loading = week.loading || proposals.loading;

  return (
    <section className="card">
      <h2 className="card__title">Suggesties</h2>
      <p className="proposals__hint">
        De beste momenten om komende week te spelen — op basis van vrije banen
        bij {club.name}, wie al aangaf te kunnen, en wanneer jullie meestal
        spelen.
      </p>

      {loading && <p className="empty">Momenten zoeken…</p>}
      {!loading && suggestions.length === 0 && (
        <p className="empty">
          Geen vrije momenten gevonden deze week. Kijk op de Plannen-tab voor
          het volledige overzicht.
        </p>
      )}

      <ul className="proposal-list">
        {suggestions.map((s) => (
          <li key={`${s.date}|${s.time}`} className="proposal">
            <div className="proposal__head">
              <span className="proposal__when">
                {shortDay(s.date)} · {s.time}
              </span>
              <span className="proposal__meta">{s.reasons.join(" · ")}</span>
            </div>
            <div className="proposal__actions">
              <button
                className="btn btn--sm btn--primary"
                disabled={proposing !== null}
                onClick={() => propose(s)}
              >
                {proposing === `${s.date}|${s.time}` ? "Bezig…" : "Stel voor"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default SuggestionsCard;
