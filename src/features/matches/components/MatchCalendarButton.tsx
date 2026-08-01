import { useState } from "react";
import { Sheet } from "@/ui/Sheet";
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

/** "Zet in agenda" als icoonknop in de kop van de geplande-match-kaart. De
 *  duurkeuze (60/90/120 min) hoort bij het agenderen zelf en zit daarom in
 *  een compacte sheet achter de knop, niet permanent op de kaart. Zonder
 *  gepland tijdstip is de duur niet relevant (event voor de hele dag) en
 *  downloadt de knop direct. */
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
  const [open, setOpen] = useState(false);

  function addToCalendar(duration: MatchDuration) {
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
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="iconbtn"
        aria-label="Zet in agenda"
        title="Zet in agenda"
        aria-haspopup={m.played_at ? "dialog" : undefined}
        onClick={() => (m.played_at ? setOpen(true) : addToCalendar(90))}
      >
        <IconAgenda />
      </button>
      {m.played_at && (
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title="Zet in agenda"
          compact
        >
          <div className="agenda-durations">
            {MATCH_DURATIONS.map((d) => (
              <button key={d} className="btn" onClick={() => addToCalendar(d)}>
                {d} minuten
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

/** Agenda-icoon in de lijnstijl van de app (#941). De knop droeg een 📅-emoji,
 *  en die viel uit de toon naast de getekende iconen van de navigatie — en valt
 *  bovendien per platform anders uit. Zelfde maat en streekdikte als
 *  DashboardLayout's iconenset. */
function IconAgenda() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export default MatchCalendarButton;