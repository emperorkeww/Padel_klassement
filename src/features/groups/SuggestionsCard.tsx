import { useMemo } from "react";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { dateInZone } from "../../lib/time";
import { getWeekAvailability, type WeekDay } from "../availability/api";
import { weekHeatmap } from "../availability/availabilityShare";
import { useClub } from "../availability/club";
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
  type CanSignal,
  type Suggestion,
} from "./suggestionLogic";
import type { Match } from "../../lib/types";
import "./Proposals.css";

// Suggestiekaart: stelt de beste speelmomenten van de komende week voor op
// basis van vrije banen, wie al aangaf te kunnen (stemmen op poll-opties),
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
  const polls = useAsync(() => getGroupPolls(groupId), [groupId]);
  const options = useAsync(() => getGroupPollOptions(groupId), [groupId]);
  const votes = useAsync(() => getGroupPollVotes(groupId), [groupId]);
  useRealtime("play_polls", polls.reload, `group_id=eq.${groupId}`);
  useRealtime("play_poll_votes", votes.reload, `group_id=eq.${groupId}`);

  const livePolls = useMemo(
    () => (polls.data ?? []).filter((p) => p.status !== "cancelled"),
    [polls.data],
  );

  const suggestions: Suggestion[] = useMemo(() => {
    const heat = weekHeatmap(week.data ?? [], null);
    const liveIds = new Set(livePolls.map((p) => p.id));
    const allOptions = (options.data ?? []).filter((o) => liveIds.has(o.poll_id));

    // Stemmen op komende poll-opties zijn het enige "kan dan"-signaal: die
    // zijn zichtbaar en intrekbaar via de poll. (De stemmen uit het
    // verwijderde slot-raster tellen bewust niet meer mee — zie issue #121.)
    const optionById = new Map(allOptions.map((o) => [o.id, o]));
    const pollVoteSignals: CanSignal[] = (votes.data ?? []).flatMap((v) => {
      const o = optionById.get(v.option_id);
      if (!o || o.date < today) return [];
      return [
        {
          player_id: v.player_id,
          date: o.date,
          start_time: o.start_time,
          status: v.status,
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
      slotVotes: pollVoteSignals,
      history,
      pastPlayable,
      existing: allOptions.filter((o) => o.date >= today),
    });
  }, [week.data, livePolls, options.data, votes.data, matches, today, club.timezone]);

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

  // Bij een lopende poll blijven de suggesties staan (#267): je kunt in
  // dezelfde week nog een speeldag plannen. Momenten die al als poll-optie
  // bestaan filtert suggestMoments er via `existing` zelf uit.

  return (
    <section className="card">
      <h2 className="card__title">Suggesties</h2>
      <p className="proposals__hint">
        De ideale momenten voor jullie volgende match — berekend op basis van de vrije banen bij {club.name}, wie er kan en jullie vaste speelgewoontes.
      </p>

      {loading && <p className="empty">Opties berekenen…</p>}
      {!loading && suggestions.length === 0 && (
        <p className="empty">
          Alle banen zitten dicht of er zijn geen geschikte match-momenten gevonden. Start zelf een poll op de Plannen-tab!
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
                Poll starten
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default SuggestionsCard;
