import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { dateInZone } from "../../lib/time";
import { getWeekAvailability, type WeekDay } from "../availability/api";
import { weekHeatmap } from "../availability/availabilityShare";
import { useClub } from "../availability/club";
import { getGroupSlotVotes, type SlotVote } from "./planApi";
import {
  getGroupPolls,
  getGroupPollOptions,
  getGroupPollVotes,
  createPoll,
} from "./pollsApi";
import { tallyOption } from "./pollLogic";
import {
  playedMoments,
  suggestMoments,
  type Suggestion,
} from "./suggestionLogic";
import type { Match } from "../../lib/types";
import "./Proposals.css";

// Suggestiekaart: stelt de beste speelmomenten van de komende week voor op
// basis van vrije banen, wie al aangaf te kunnen (poll- en slot-stemmen),
// de speelhistoriek van de groep en eerder goed gesteunde poll-opties.
// Eén tik start er een speeldag-poll mee (als er nog geen loopt).

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

  const week = useAsync<WeekDay[]>(() => getWeekAvailability(today), [today, club.id]);
  const slotVotes = useAsync<SlotVote[]>(
    () => getGroupSlotVotes(groupId, today),
    [groupId, today],
  );
  const polls = useAsync(() => getGroupPolls(groupId), [groupId]);
  const options = useAsync(() => getGroupPollOptions(groupId), [groupId]);
  const votes = useAsync(() => getGroupPollVotes(groupId), [groupId]);
  useRealtime("play_polls", polls.reload, `group_id=eq.${groupId}`);
  useRealtime("play_poll_votes", votes.reload, `group_id=eq.${groupId}`);

  const livePolls = useMemo(
    () => (polls.data ?? []).filter((p) => p.status !== "cancelled"),
    [polls.data],
  );
  const hasRunningPoll = livePolls.some(
    (p) => p.status === "open" || p.status === "locked",
  );

  const suggestions: Suggestion[] = useMemo(() => {
    const heat = weekHeatmap(week.data ?? [], null);
    const liveIds = new Set(livePolls.map((p) => p.id));
    const allOptions = (options.data ?? []).filter((o) => liveIds.has(o.poll_id));

    // Stemmen op komende poll-opties tellen mee als "kan dan"-signaal,
    // naast de (historische) slot-stemmen uit het vroegere raster.
    const optionById = new Map(allOptions.map((o) => [o.id, o]));
    const pollVoteSignals: SlotVote[] = (votes.data ?? []).flatMap((v) => {
      const o = optionById.get(v.option_id);
      if (!o || o.date < today) return [];
      return [
        {
          group_id: v.group_id,
          player_id: v.player_id,
          date: o.date,
          start_time: o.start_time,
          status: v.status,
          updated_at: v.updated_at,
        },
      ];
    });

    // Eerdere opties met genoeg spelers = bewezen goede momenten.
    const pastPlayable = allOptions.filter(
      (o) =>
        o.date < today && tallyOption(o, votes.data ?? []).enoughPlayers,
    );

    const history = playedMoments(
      matches
        .filter((m) => m.status === "completed")
        .map((m) => m.played_at ?? m.created_at),
      club.timezone,
    );

    return suggestMoments({
      heat,
      slotVotes: [...(slotVotes.data ?? []), ...pollVoteSignals],
      history,
      pastPlayable,
      existing: allOptions.filter((o) => o.date >= today),
    });
  }, [week.data, slotVotes.data, livePolls, options.data, votes.data, matches, today, club.timezone]);

  async function startPoll(s: Suggestion) {
    try {
      await createPoll({
        groupId,
        createdBy: myId,
        options: [
          { date: s.date, startTime: s.time, duration: 90, courtsFree: s.freeCourts },
        ],
      });
      polls.reload();
      options.reload();
      toast.success("Poll gestart — de groep kan stemmen op de Plannen-tab.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const loading = week.loading || polls.loading;

  // Loopt er al een poll? Dan zijn nieuwe suggesties niet te starten;
  // verwijs er dan gewoon duidelijk naar in plaats van dode suggesties.
  if (!loading && hasRunningPoll) {
    return (
      <section className="card">
        <h2 className="card__title">Suggesties</h2>
        <p className="proposals__hint">
          Er loopt een speeldag-poll voor deze groep — nieuwe suggesties
          verschijnen zodra die is afgerond.
        </p>
        <Link
          className="btn btn--sm btn--primary"
          to={`/groepen/${groupId}?tab=plannen`}
        >
          Ga naar de poll →
        </Link>
      </section>
    );
  }

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
          Geen vrije momenten gevonden deze week. Start zelf een poll op de
          Plannen-tab.
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
                onClick={() => startPoll(s)}
              >
                Start poll met dit moment
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default SuggestionsCard;
