import { useState } from "react";
import { tap } from "@/lib/utils/haptics";
import {
  downloadIcs,
  icsEvent,
  localDate,
  localTime,
  MATCH_DURATIONS,
  type MatchDuration,
} from "@/lib/utils/ics";
import { useClub } from "@/features/availability/club";
import type { Match, Profile, Team } from "@/types";
import { teamLabel } from "@/features/matches/api";
import "./MatchCalendarButton.css";

/** "Zet in agenda" voor een (geplande) match, met kiesbare duur (60/90/120 min).
 *  Getimed als er een tijdstip gepland is, anders een event voor de hele dag. */
export function MatchCalendarButton({
  match: m,
  teams,
  profiles,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
}) {
  const club = useClub();
  const [duration, setDuration] = useState<MatchDuration>(90);

  function addToCalendar() {
    const when = new Date(m.played_at ?? m.created_at);
    const date = localDate(when);
    downloadIcs(
      `padel-${date}.ics`,
      icsEvent({
        title: `Padel: ${teamLabel(teams[m.team_a_id], profiles)} vs ${teamLabel(teams[m.team_b_id], profiles)}`,
        description:
          m.round_number != null ? `Ronde ${m.round_number}` : undefined,
        location: club.name,
        date,
        startTime: m.played_at ? localTime(when) : undefined,
        durationMin: duration,
        uid: `match-${m.id}@vamos-padel`,
      }),
    );
    tap();
  }

  return (
    <span className="agenda-control">
      <button className="agenda-btn" onClick={addToCalendar}>
        Zet in agenda
      </button>
      {/* Duur alleen relevant voor een getimed event. */}
      {m.played_at && (
        <label className="agenda-duration">
          <span className="sr-only">Duur</span>
          <select
            className="input agenda-duration__select"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) as MatchDuration)}
            aria-label="Duur van de match"
          >
            {MATCH_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
      )}
    </span>
  );
}

export default MatchCalendarButton;
