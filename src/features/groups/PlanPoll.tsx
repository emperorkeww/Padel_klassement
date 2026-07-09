import { useMemo, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { addDays, dateInZone } from "../../lib/time";
import { icsEvent, downloadIcs } from "../../lib/ics";
import { bookingUrl, getWeekAvailability, type WeekDay } from "../availability/api";
import { dayStarts } from "../availability/availabilityShare";
import { useClub } from "../availability/club";
import { displayName } from "../profiles/api";
import {
  getGroupPolls,
  getGroupPollOptions,
  getGroupPollVotes,
  createPoll,
  setPollVote,
  clearPollVote,
  lockPoll,
  markPollBooked,
  cancelPoll,
  remindPoll,
  type PlayPoll,
  type PollOption,
  type PollVote,
  type PollVoteStatus,
  type NewPollOption,
} from "./pollsApi";
import {
  activePoll,
  optionState,
  pollOptions,
  tallyOption,
  type OptionState,
} from "./pollLogic";
import type { Profile } from "../../lib/types";
import "./Proposals.css";

// Speeldag-poll: de doodle van de Plannen-tab. Een lid stelt 1-5 momenten
// voor — gekozen uit échte vrije slots — de groep stemt per optie, en de
// maker/eigenaar legt het winnende moment vast en boekt op Playtomic.

const VOTE_LABEL: Record<PollVoteStatus, string> = {
  yes: "Ik kan",
  maybe: "Misschien",
  no: "Kan niet",
};
const STATE_LABEL: Record<OptionState, string> = {
  haalbaar: "haalbaar",
  krap: "krap — precies genoeg banen",
  onhaalbaar: "onhaalbaar — te weinig banen vrij",
  onbekend: "beschikbaarheid onbekend",
};
const MAX_OPTIONS = 5;
const DURATIONS = [60, 90, 120] as const;

// 's Middags formatteren zodat DST de datum niet kantelt.
function fmtDate(date: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("nl-BE", opts).format(new Date(`${date}T12:00:00`));
}
const longDay = (date: string) =>
  fmtDate(date, { weekday: "long", day: "numeric", month: "long" });
const shortDay = (date: string) =>
  fmtDate(date, { weekday: "short", day: "numeric", month: "short" });

/** "20:15" → "20:00": lookup-sleutel voor het halfuur-raster. */
function floorHalfHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${m < 30 ? "00" : "30"}`;
}

const optKey = (o: { date: string; startTime: string }) => `${o.date}|${o.startTime}`;

/* ------------------------------------------------------------------ */
/* Sectie: haalt de data op en kiest tussen poll-kaart en wizard.      */
/* ------------------------------------------------------------------ */

export function PollSection({
  groupId,
  profiles,
  myId,
  isOwner,
}: {
  groupId: string;
  profiles: Record<string, Profile>;
  myId: string;
  isOwner: boolean;
}) {
  const club = useClub();
  const today = dateInZone(club.timezone);
  const [wizardOpen, setWizardOpen] = useState(false);

  const polls = useAsync<PlayPoll[]>(() => getGroupPolls(groupId), [groupId]);
  const options = useAsync<PollOption[]>(
    () => getGroupPollOptions(groupId),
    [groupId],
  );
  const votes = useAsync<PollVote[]>(() => getGroupPollVotes(groupId), [groupId]);
  useRealtime("play_polls", polls.reload, `group_id=eq.${groupId}`);
  useRealtime("play_poll_options", options.reload, `group_id=eq.${groupId}`);
  useRealtime("play_poll_votes", votes.reload, `group_id=eq.${groupId}`);

  // Vrije banen (7-daags venster): voedt de wizard én de live haalbaarheid.
  const week = useAsync<WeekDay[]>(() => getWeekAvailability(today), [today, club.id]);

  const active = useMemo(
    () => activePoll(polls.data ?? [], options.data ?? [], today),
    [polls.data, options.data, today],
  );

  function reloadAll() {
    polls.reload();
    options.reload();
    votes.reload();
  }

  if (polls.loading || options.loading) {
    return (
      <section className="card">
        <h2 className="card__title">Speeldag plannen</h2>
        <p className="empty">Poll laden…</p>
      </section>
    );
  }

  if (active) {
    return (
      <PollCard
        poll={active}
        options={pollOptions(active, options.data ?? [])}
        votes={votes.data ?? []}
        week={week.data ?? []}
        profiles={profiles}
        myId={myId}
        isOwner={isOwner}
        today={today}
        onChanged={reloadAll}
      />
    );
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Speeldag plannen</h2>
        {!wizardOpen && (
          <button
            className="btn btn--sm btn--primary"
            onClick={() => setWizardOpen(true)}
          >
            + Plan een speeldag
          </button>
        )}
      </div>
      {!wizardOpen && (
        <p className="empty">
          Geen lopende poll. Start er één: kies kandidaat-momenten uit de vrije
          banen en laat de groep stemmen.
        </p>
      )}
      {wizardOpen && (
        <PollWizard
          groupId={groupId}
          myId={myId}
          today={today}
          week={week.data ?? []}
          weekLoading={week.loading}
          onClose={() => setWizardOpen(false)}
          onCreated={() => {
            setWizardOpen(false);
            reloadAll();
          }}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Wizard: kandidaat-momenten kiezen uit de vrije slots.               */
/* ------------------------------------------------------------------ */

function PollWizard({
  groupId,
  myId,
  today,
  week,
  weekLoading,
  onClose,
  onCreated,
}: {
  groupId: string;
  myId: string;
  today: string;
  week: WeekDay[];
  weekLoading: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [duration, setDuration] = useState<number>(90);
  const [picked, setPicked] = useState<Map<string, NewPollOption>>(new Map());
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("20:00");
  const [saving, setSaving] = useState(false);

  const weekEnd = addDays(today, 6);

  // Vrije starttijden per dag, gefilterd op de gekozen duur.
  const dayChips = useMemo(
    () =>
      week.map((day) => ({
        date: day.date,
        starts: day.data ? dayStarts(day, duration) : null,
      })),
    [week, duration],
  );

  function toggle(date: string, time: string, courtsFree: number) {
    setPicked((cur) => {
      const next = new Map(cur);
      const key = `${date}|${time}`;
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= MAX_OPTIONS) {
          toast.error(`Maximaal ${MAX_OPTIONS} opties per poll.`);
          return cur;
        }
        next.set(key, { date, startTime: time, duration, courtsFree });
      }
      return next;
    });
  }

  function addManual() {
    if (!manualDate || !manualTime) return;
    if (picked.size >= MAX_OPTIONS) {
      toast.error(`Maximaal ${MAX_OPTIONS} opties per poll.`);
      return;
    }
    // Binnen het datavenster is de beschikbaarheid bekend → hard afdwingen.
    let courtsFree: number | null = null;
    if (manualDate >= today && manualDate <= weekEnd) {
      const day = dayChips.find((d) => d.date === manualDate);
      if (day?.starts) {
        const slot = day.starts.find(
          (s) => floorHalfHour(s.time) === floorHalfHour(manualTime),
        );
        courtsFree = slot ? slot.courts.length : 0;
        if (courtsFree === 0) {
          toast.error(
            "Op dit uur is er geen baan vrij — kies een ander moment.",
          );
          return;
        }
      }
    }
    setPicked((cur) => {
      const next = new Map(cur);
      next.set(`${manualDate}|${manualTime}`, {
        date: manualDate,
        startTime: manualTime,
        duration,
        courtsFree,
      });
      return next;
    });
    setManualDate("");
  }

  async function publish() {
    if (picked.size === 0) return;
    setSaving(true);
    try {
      await createPoll({
        groupId,
        createdBy: myId,
        options: [...picked.values()],
      });
      toast.success("Poll gestart — de groep kan stemmen.");
      onCreated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="poll-wizard">
      <p className="proposals__hint">
        Kies tot {MAX_OPTIONS} kandidaat-momenten. Alleen uren met een vrije
        baan zijn kiesbaar; verder vooruit plannen kan handmatig (beschikbaarheid
        dan nog onbekend).
      </p>

      <label className="proposal-form__field">
        <span>Speelduur</span>
        <select
          className="select"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        >
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} min
            </option>
          ))}
        </select>
      </label>

      {weekLoading && <p className="empty">Vrije banen laden…</p>}
      {!weekLoading &&
        dayChips.map(({ date, starts }) => (
          <div key={date} className="poll-wizard__day">
            <span className="poll-wizard__daylabel">{shortDay(date)}</span>
            {starts == null && (
              <span className="proposal__meta">geen gegevens</span>
            )}
            {starts != null && starts.length === 0 && (
              <span className="proposal__meta">niets vrij</span>
            )}
            {starts != null &&
              starts.map((s) => {
                const key = `${date}|${s.time}`;
                const on = picked.has(key);
                return (
                  <button
                    key={s.time}
                    type="button"
                    className={`btn btn--sm attendance-btn ${on ? "is-active is-yes" : ""}`}
                    aria-pressed={on}
                    onClick={() => toggle(date, s.time, s.courts.length)}
                  >
                    {s.time} · {s.courts.length}
                  </button>
                );
              })}
          </div>
        ))}

      <div className="poll-wizard__manual">
        <label className="proposal-form__field">
          <span>Ander moment (verder vooruit)</span>
          <input
            type="date"
            className="select"
            min={today}
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
          />
        </label>
        <label className="proposal-form__field">
          <span>Uur</span>
          <input
            type="time"
            className="select"
            step={1800}
            value={manualTime}
            onChange={(e) => setManualTime(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn--sm"
          disabled={!manualDate}
          onClick={addManual}
        >
          + Voeg toe
        </button>
      </div>

      {picked.size > 0 && (
        <p className="proposal__names">
          Gekozen:{" "}
          {[...picked.values()]
            .sort((a, b) => optKey(a).localeCompare(optKey(b)))
            .map(
              (o) =>
                `${shortDay(o.date)} ${o.startTime}${o.courtsFree == null ? " (onbekend)" : ""}`,
            )
            .join(" · ")}
        </p>
      )}

      <div className="proposal-form__actions">
        <button
          className="btn btn--sm btn--primary"
          disabled={saving || picked.size === 0}
          onClick={publish}
        >
          {saving ? "Bezig…" : `Start poll (${picked.size})`}
        </button>
        <button type="button" className="btn btn--sm" onClick={onClose}>
          Annuleren
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Poll-kaart: stemmen per optie, banen-balans, lock → geboekt.        */
/* ------------------------------------------------------------------ */

function PollCard({
  poll,
  options,
  votes,
  week,
  profiles,
  myId,
  isOwner,
  today,
  onChanged,
}: {
  poll: PlayPoll;
  options: PollOption[];
  votes: PollVote[];
  week: WeekDay[];
  profiles: Record<string, Profile>;
  myId: string;
  isOwner: boolean;
  today: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const club = useClub();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [remindedDone, setRemindedDone] = useState(false);

  const isManager = poll.created_by === myId || isOwner;
  const weekEnd = addDays(today, 6);
  const name = (id: string) => displayName(profiles[id]);

  /** Live vrije banen binnen het datavenster; anders de momentopname. */
  function liveFree(o: PollOption): number | null {
    if (o.date >= today && o.date <= weekEnd) {
      const day = week.find((d) => d.date === o.date);
      if (day?.data) {
        const starts = dayStarts(day, o.duration);
        const slot = starts.find(
          (s) => floorHalfHour(s.time) === floorHalfHour(o.start_time),
        );
        return slot ? slot.courts.length : 0;
      }
    }
    return o.courts_free;
  }

  async function run(fn: () => Promise<void>, done?: string) {
    setBusy(true);
    try {
      await fn();
      onChanged();
      if (done) toast.success(done);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function vote(o: PollOption, status: PollVoteStatus, mine: PollVoteStatus | null) {
    await run(() =>
      mine === status
        ? clearPollVote(o.id, myId)
        : setPollVote(o.id, poll.group_id, myId, status),
    );
  }

  async function remind() {
    setBusy(true);
    try {
      const n = await remindPoll(poll.group_id, poll.id);
      setRemindedDone(true);
      toast.success(
        n === 0 ? "Iedereen heeft al gestemd." : `${n} ${n === 1 ? "lid" : "leden"} herinnerd.`,
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const locked = poll.locked_option_id
    ? options.find((o) => o.id === poll.locked_option_id) ?? null
    : null;

  function exportIcs() {
    if (!locked) return;
    const t = tallyOption(locked, votes);
    downloadIcs(
      `padel-${locked.date}.ics`,
      icsEvent({
        title: `Padel — ${club.name}`,
        description: `Deelnemers: ${t.yes.map(name).join(", ") || "nog onbekend"}`,
        location: club.name,
        date: locked.date,
        startTime: locked.start_time,
        durationMin: locked.duration,
        uid: `vamos-poll-${poll.id}`,
      }),
    );
  }

  const statusLine =
    poll.status === "open"
      ? `Poll van ${name(poll.created_by)} — stem per moment.`
      : poll.status === "locked" && locked
        ? `Gekozen: ${longDay(locked.date)} om ${locked.start_time}. Boek de baan en markeer als geboekt.`
        : poll.status === "booked" && locked
          ? `Geboekt ✓ ${longDay(locked.date)} om ${locked.start_time} bij ${club.name}.`
          : "";

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">
          {poll.status === "booked" ? "Speeldag geboekt" : "Speeldag-poll"}
        </h2>
        {poll.status === "open" && !remindedDone && (
          <button className="btn btn--sm" disabled={busy} onClick={remind}>
            🔔 Herinner
          </button>
        )}
      </div>
      <p className="proposals__hint">{statusLine}</p>

      <ul className="proposal-list">
        {options.map((o) => {
          const t = tallyOption(o, votes);
          const free = liveFree(o);
          const state = optionState(t.yes.length, free);
          const mine =
            votes.find((v) => v.option_id === o.id && v.player_id === myId)
              ?.status ?? null;
          const isChosen = poll.locked_option_id === o.id;
          const past = o.date < today;
          return (
            <li
              key={o.id}
              className={`proposal poll-option--${state}${isChosen ? " proposal--playable" : ""}`}
            >
              <div className="proposal__head">
                <span className="proposal__when">
                  {longDay(o.date)} · {o.start_time}
                  {isChosen && " ★"}
                </span>
                <span className="proposal__meta">{o.duration} min</span>
              </div>

              <div className="proposal__status">
                <span className="badge">
                  {t.yes.length} mee → {t.needed}{" "}
                  {t.needed === 1 ? "baan" : "banen"} nodig
                </span>
                <span
                  className={`proposal__free${state === "onhaalbaar" ? " proposal__free--none" : ""}`}
                >
                  {free == null
                    ? "beschikbaarheid onbekend"
                    : `${free} vrij · ${STATE_LABEL[state]}`}
                </span>
                {t.maybe.length > 0 && (
                  <span className="proposal__maybe">{t.maybe.length} misschien</span>
                )}
              </div>

              {t.yes.length > 0 && (
                <p className="proposal__names">Kan: {t.yes.map(name).join(", ")}</p>
              )}

              <div className="proposal__actions">
                {poll.status === "open" && !past && (
                  <div role="group" aria-label="Jouw stem" className="proposal__vote">
                    {(Object.keys(VOTE_LABEL) as PollVoteStatus[]).map((s) => (
                      <button
                        key={s}
                        className={`btn btn--sm attendance-btn ${mine === s ? `is-active is-${s}` : ""}`}
                        disabled={busy}
                        onClick={() => vote(o, s, mine)}
                      >
                        {VOTE_LABEL[s]}
                      </button>
                    ))}
                  </div>
                )}
                {poll.status === "open" && isManager && (
                  <button
                    className="btn btn--sm"
                    disabled={busy || state === "onhaalbaar"}
                    title={
                      state === "onhaalbaar"
                        ? "Te weinig banen vrij voor dit aantal spelers"
                        : "Leg dit moment vast voor de groep"
                    }
                    onClick={() =>
                      run(() => lockPoll(poll.id, o.id), "Moment vastgelegd.")
                    }
                  >
                    Kies dit moment
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="proposal__actions poll-card__footer">
        <div className="proposal__links">
          {poll.status === "locked" && locked && (
            <>
              <a
                className="btn btn--sm btn--primary"
                href={bookingUrl(locked.date)}
                target="_blank"
                rel="noreferrer"
              >
                Boek op Playtomic ↗
              </a>
              {isManager && (
                <button
                  className="btn btn--sm"
                  disabled={busy}
                  onClick={() =>
                    run(() => markPollBooked(poll.id), "Speeldag geboekt ✓")
                  }
                >
                  Baan geboekt ✓
                </button>
              )}
            </>
          )}
          {poll.status === "booked" && locked && (
            <button className="btn btn--sm" onClick={exportIcs}>
              📅 Zet in agenda
            </button>
          )}
        </div>
        {isManager && poll.status !== "booked" && (
          <button
            className={`btn btn--sm proposal__withdraw${confirmCancel ? " is-confirm" : ""}`}
            disabled={busy}
            onClick={() => {
              if (!confirmCancel) {
                setConfirmCancel(true);
                return;
              }
              run(() => cancelPoll(poll.id), "Poll geannuleerd.");
            }}
            onBlur={() => setConfirmCancel(false)}
          >
            {confirmCancel ? "Zeker? Tik nogmaals" : "Annuleer poll"}
          </button>
        )}
      </div>
    </section>
  );
}

export default PollSection;
