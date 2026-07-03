import { useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { Avatar } from "../../components/Avatar";
import { errorMessage } from "../../lib/errors";
import { tap } from "../../lib/haptics";
import { downloadIcs, icsEvent } from "../../lib/ics";
import { displayName } from "../profiles/api";
import { useClub } from "../availability/club";
import {
  getAttendance,
  setAttendance,
  type AttendanceStatus,
} from "./attendanceApi";
import type { GroupMember, Profile } from "../../lib/types";

// "Wie speelt er?" — RSVP per speeldag. Elke tik schrijft alleen je eigen
// rij; de rest van de groep ziet het live binnenkomen via realtime.

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  yes: "✓ Ik speel mee",
  maybe: "? Misschien",
  no: "✗ Niet",
};

const MARK: Record<AttendanceStatus, string> = { yes: "✓", maybe: "?", no: "✗" };

function localToday(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function AttendanceCard({
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
  const toast = useToast();
  const club = useClub();
  const today = localToday();
  const [date, setDate] = useState(today);
  const attendance = useAsync(() => getAttendance(groupId, date), [groupId, date]);
  useRealtime("attendance", attendance.reload, `group_id=eq.${groupId}`);

  const byPlayer = new Map(
    (attendance.data ?? []).map((r) => [r.player_id, r.status]),
  );
  const mine = byPlayer.get(myId) ?? null;
  const yes = members.filter((m) => byPlayer.get(m.player_id) === "yes").length;
  const courts = Math.floor(yes / 4);

  /** ICS-download voor de gekozen speeldag (event voor de hele dag). */
  function addToCalendar() {
    downloadIcs(
      `padel-speeldag-${date}.ics`,
      icsEvent({
        title: "Padel: speeldag",
        location: club.name,
        date,
        uid: `matchday-${groupId}-${date}@vamos-padel`,
      }),
    );
    tap();
  }

  async function choose(status: AttendanceStatus) {
    try {
      await setAttendance(groupId, myId, date, status);
      tap();
      attendance.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Wie speelt er?</h2>
        <input
          type="date"
          className="select attendance-date"
          aria-label="Speeldag"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="attendance-my" role="group" aria-label="Jouw status">
        {(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((s) => (
          <button
            key={s}
            className={`btn btn--sm attendance-btn ${mine === s ? `is-active is-${s}` : ""}`}
            onClick={() => choose(s)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <ul className="attendance-list">
        {members.map((m) => {
          const s = byPlayer.get(m.player_id);
          return (
            <li
              key={m.player_id}
              className={`attendance-member is-${s ?? "unknown"}`}
            >
              <Avatar profile={profiles[m.player_id]} size={22} />
              <span className="attendance-member__name">
                {displayName(profiles[m.player_id])}
              </span>
              <span className="attendance-member__mark" aria-hidden="true">
                {s ? MARK[s] : "·"}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="attendance-foot">
        {yes === 0
          ? "Nog niemand aangemeld."
          : `${yes} speler${yes === 1 ? "" : "s"} aangemeld${
              yes >= 4
                ? ` — genoeg voor ${courts} baan${courts === 1 ? "" : "en"}`
                : ` — nog ${4 - yes} nodig voor een baan`
            }.`}{" "}
        <Link className="profile-link" to={`/banen?datum=${date}`}>
          Vrije banen op deze dag →
        </Link>{" "}
        <button className="agenda-btn" onClick={addToCalendar}>
          Zet in agenda
        </button>
      </p>
    </section>
  );
}

export default AttendanceCard;
