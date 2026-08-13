import { useEffect, useMemo, useRef, useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { dateInZone } from "@/lib/utils/time";
import { getWeekAvailability, type WeekDay } from "@/features/availability/api";
import { weekHeatmap } from "@/features/availability/availabilityShare";
import { useClub } from "@/features/availability/club";
import {
  createPoll,
  type PlayPoll,
  type PollOption,
  type PollVote,
} from "@/features/groups/pollsApi";
import { tallyOption } from "@/features/groups/pollLogic";
import {
  playedMoments,
  suggestMoments,
  type CanSignal,
  type Suggestion,
} from "@/features/groups/suggestionLogic";
import type { Match } from "@/types";
import "@/features/groups/Proposals.css";

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
  polls,
  options,
  votes,
  onStarted,
}: {
  groupId: string;
  myId: string;
  /** Alle matches van de groep (voor de speelhistoriek). */
  matches: Match[];
  /** Polls, opties en stemmen komen sinds #721 uit PlanTab: die had ze al
   *  binnen, dus deze kaart hoefde ze niet nog een tweede keer op te halen
   *  (en had zo ook een eigen, afwijkend antwoord op "loopt er een poll?"). */
  polls: PlayPoll[];
  options: PollOption[];
  votes: PollVote[];
  /** Reload-cascade van de tab na het starten van een poll. */
  onStarted: () => void;
}) {
  const club = useClub();
  const toast = useToast();
  const today = dateInZone(club.timezone);

  const week = useAsync<WeekDay[]>(() => getWeekAvailability(today), [today, club.id]);

  const livePolls = useMemo(
    () => polls.filter((p) => p.status !== "cancelled"),
    [polls],
  );

  const suggestions: Suggestion[] = useMemo(() => {
    const heat = weekHeatmap(week.data ?? [], null);
    const liveIds = new Set(livePolls.map((p) => p.id));
    const allOptions = options.filter((o) => liveIds.has(o.poll_id));

    // Stemmen op komende poll-opties zijn het enige "kan dan"-signaal: die
    // zijn zichtbaar en intrekbaar via de poll. (De stemmen uit het
    // verwijderde slot-raster tellen bewust niet meer mee — zie issue #121.)
    const optionById = new Map(allOptions.map((o) => [o.id, o]));
    const pollVoteSignals: CanSignal[] = votes.flatMap((v) => {
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
      (o) => o.date < today && tallyOption(o, votes).enoughPlayers,
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
  }, [week.data, livePolls, options, votes, matches, today, club.timezone]);

  async function startPoll(s: Suggestion) {
    try {
      await createPoll({
        groupId,
        createdBy: myId,
        // De suggestie komt uit de beschikbaarheid van de gekozen club (#322).
        club,
        options: [
          { date: s.date, startTime: s.time, duration: 90, courtsFree: s.freeCourts },
        ],
      });
      onStarted();
      toast.success("Speeldag staat open — de groep kan stemmen in de agenda.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const loading = week.loading;

  // Bij een lopende poll blijven de suggesties staan (#267): je kunt in
  // dezelfde week nog een speeldag plannen. Momenten die al als poll-optie
  // bestaan filtert suggestMoments er via `existing` zelf uit. Maar zodra er
  // een poll loopt, klapt de kaart standaard dicht — plannen is dan al bezig.
  //
  // "Loopt" = open én met een moment vanaf vandaag (#721). De oude check keek
  // enkel naar status !== "cancelled", dus een allang gespeelde poll hield de
  // kaart dicht en zette de badge "poll loopt" terwijl er niets liep.
  const lopend = useMemo(
    () =>
      polls.filter(
        (p) =>
          p.status === "open" &&
          options.some((o) => o.poll_id === p.id && o.date >= today),
      ).length,
    [polls, options, today],
  );
  const hasLivePoll = lopend > 0;

  // null = volg de poll-status; een boolean = de gebruiker koos zelf. Die
  // keuze mag niet blijven plakken: wie de kaart openzette om een poll te
  // starten, hield hem anders de hele sessie open — juist nadat plannen al
  // begonnen was. Een nieuwe lopende poll geeft de sturing terug.
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const vorigLopend = useRef(lopend);
  useEffect(() => {
    if (lopend > vorigLopend.current) setManualOpen(null);
    vorigLopend.current = lopend;
  }, [lopend]);
  const open = manualOpen ?? !hasLivePoll;

  return (
    <details
      className="card suggestions"
      open={open}
      onToggle={(e) => setManualOpen(e.currentTarget.open)}
    >
      <summary className="suggestions__summary">
        <h2 className="card__title">Suggesties</h2>
        {hasLivePoll && (
          <span className="badge badge--accent">stemmen lopen</span>
        )}
      </summary>

      <p className="proposals__hint">
        De ideale momenten voor jullie volgende match — berekend op basis van de vrije banen bij {club.name}, wie er kan en jullie vaste speelgewoontes.
      </p>

      {loading && <p className="empty">Opties berekenen…</p>}
      {!loading && suggestions.length === 0 && (
        <p className="empty">
          Alle banen zitten dicht of er zijn geen geschikte match-momenten gevonden. Zet er zelf een op vanuit de agenda!
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
                Speeldag opzetten
              </button>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default SuggestionsCard;
