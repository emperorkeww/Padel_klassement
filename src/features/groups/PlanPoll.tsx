import { useMemo, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { Avatar } from "../../components/Avatar";
import { Skeleton } from "../../components/Skeleton";
import { errorMessage } from "../../lib/errors";
import { fairTeams } from "../../lib/fairTeams";
import { addDays, dateInZone } from "../../lib/time";
import { icsEvent, downloadIcs } from "../../lib/ics";
import { bookingUrl, getWeekAvailability, type WeekDay } from "../availability/api";
import { dayStarts } from "../availability/availabilityShare";
import { useClub } from "../availability/club";
import { shareOrCopyText } from "../../lib/shareText";
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
  reopenPoll,
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
  nonVoters,
  optionState,
  pollOptions,
  tallyOption,
  type OptionState,
} from "./pollLogic";
import { createFairRound } from "./api";
import { getPlayerRatings } from "../standings/ratingsApi";
import type { GroupMember, Profile } from "../../lib/types";
import "./Proposals.css";

// Speeldag-poll: de doodle van de Plannen-tab. Wizard met dag-navigator
// (alleen échte vrije slots kiesbaar), stemmen per optie in compacte rijen
// met een ✓ ? ✗-segment, en een duidelijk fase-verloop:
// Stemmen → Gekozen → Geboekt.

const VOTE_SEGMENTS: { status: PollVoteStatus; icon: string; label: string }[] = [
  { status: "yes", icon: "✓", label: "Ik kan" },
  { status: "maybe", icon: "?", label: "Misschien" },
  { status: "no", icon: "✗", label: "Kan niet" },
];
const STATE_ICON: Record<OptionState, string> = {
  haalbaar: "✓",
  krap: "⚠",
  onhaalbaar: "✕",
  onbekend: "?",
};
const MAX_OPTIONS = 5;
const DURATIONS = [60, 90, 120] as const;
/** Avonduren als standaardvenster in de wizard. */
const EVENING_FROM = 17;

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

/* ------------------------------------------------------------------ */
/* Sectie: haalt de data op en kiest tussen poll-kaart en wizard.      */
/* ------------------------------------------------------------------ */

export function PollSection({
  groupId,
  groupName,
  members,
  profiles,
  myId,
  isOwner,
}: {
  groupId: string;
  groupName: string;
  members: GroupMember[];
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
        <Skeleton rows={3} />
      </section>
    );
  }

  if (active) {
    return (
      <PollCard
        poll={active}
        groupName={groupName}
        members={members}
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
          Geen lopende poll. Kies een paar momenten waarop banen vrij zijn en
          laat de groep stemmen.
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
/* Wizard: dag-navigator, alleen vrije slots kiesbaar.                 */
/* ------------------------------------------------------------------ */

const optKey = (o: { date: string; startTime: string }) => `${o.date}|${o.startTime}`;

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
  const [selectedDay, setSelectedDay] = useState(today);
  const [wholeDay, setWholeDay] = useState(false);
  const [picked, setPicked] = useState<Map<string, NewPollOption>>(new Map());
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("20:00");
  const [saving, setSaving] = useState(false);

  const weekEnd = addDays(today, 6);

  // Vrije starttijden per dag, gefilterd op duur (en standaard op avond).
  const startsByDay = useMemo(() => {
    const map = new Map<string, ReturnType<typeof dayStarts> | null>();
    for (const day of week) {
      map.set(day.date, day.data ? dayStarts(day, duration) : null);
    }
    return map;
  }, [week, duration]);

  const visibleStarts = (date: string) => {
    const starts = startsByDay.get(date);
    if (starts == null) return null;
    return wholeDay
      ? starts
      : starts.filter((s) => Number(s.time.slice(0, 2)) >= EVENING_FROM);
  };

  function toggle(date: string, time: string, courtsFree: number) {
    setPicked((cur) => {
      const next = new Map(cur);
      const key = `${date}|${time}`;
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= MAX_OPTIONS) {
          toast.error(`Maximaal ${MAX_OPTIONS} momenten per poll.`);
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
      toast.error(`Maximaal ${MAX_OPTIONS} momenten per poll.`);
      return;
    }
    // Binnen het datavenster is de beschikbaarheid bekend → hard afdwingen.
    let courtsFree: number | null = null;
    if (manualDate >= today && manualDate <= weekEnd) {
      const starts = startsByDay.get(manualDate);
      if (starts) {
        const slot = starts.find(
          (s) => floorHalfHour(s.time) === floorHalfHour(manualTime),
        );
        courtsFree = slot ? slot.courts.length : 0;
        if (courtsFree === 0) {
          toast.error("Op dit uur is er geen baan vrij — kies een ander moment.");
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

  const dayStartsVisible = visibleStarts(selectedDay);

  return (
    <div className="poll-wizard">
      <p className="proposals__hint">
        Kies tot {MAX_OPTIONS} momenten waarop een baan vrij is — de groep
        stemt daarna per moment.
      </p>

      {/* Dag-navigator. */}
      <div className="day-strip" role="tablist" aria-label="Kies een dag">
        {week.map((d) => {
          const starts = visibleStarts(d.date);
          const n = starts?.length ?? 0;
          const on = selectedDay === d.date;
          return (
            <button
              key={d.date}
              role="tab"
              aria-selected={on}
              className={`day-chip${on ? " is-active" : ""}${n === 0 ? " is-empty" : ""}`}
              onClick={() => setSelectedDay(d.date)}
            >
              <span className="day-chip__name">
                {fmtDate(d.date, { weekday: "short" }).replace(".", "")}
              </span>
              <span className="day-chip__num">
                {fmtDate(d.date, { day: "numeric" })}
              </span>
            </button>
          );
        })}
      </div>

      {/* Uren van de gekozen dag. */}
      <div className="poll-wizard__slots">
        {weekLoading && <p className="empty">Vrije banen laden…</p>}
        {!weekLoading && dayStartsVisible == null && (
          <p className="empty">Geen beschikbaarheidsgegevens voor deze dag.</p>
        )}
        {!weekLoading && dayStartsVisible != null && dayStartsVisible.length === 0 && (
          <p className="empty">
            {wholeDay ? "Niets vrij op deze dag." : "Geen vrij avondslot op deze dag."}
          </p>
        )}
        {dayStartsVisible?.map((s) => {
          const key = `${selectedDay}|${s.time}`;
          const on = picked.has(key);
          return (
            <button
              key={s.time}
              type="button"
              className={`slot-chip${on ? " is-active" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(selectedDay, s.time, s.courts.length)}
            >
              {s.time}
              <span
                className={`slot-chip__count slot-chip__count--c${Math.min(s.courts.length, 4)}`}
                title={`${s.courts.length} ${s.courts.length === 1 ? "baan" : "banen"} vrij`}
              >
                {s.courts.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="poll-wizard__controls">
        <label className="poll-wizard__toggle">
          <input
            type="checkbox"
            checked={wholeDay}
            onChange={(e) => setWholeDay(e.target.checked)}
          />
          Hele dag tonen
        </label>
        <label className="poll-wizard__toggle">
          Duur{" "}
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
      </div>

      <details className="poll-wizard__manual-details">
        <summary>Ander moment (verder vooruit)</summary>
        <div className="poll-wizard__manual">
          <label className="proposal-form__field">
            <span>Datum</span>
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
          <p className="proposal-form__note">
            Buiten deze week is de beschikbaarheid nog onbekend; de poll
            markeert dat bij het moment.
          </p>
        </div>
      </details>

      {/* Sticky selectiebalk: gekozen momenten + start-knop altijd in beeld. */}
      <div className="wizard-footer">
        <div className="wizard-footer__picked">
          {picked.size === 0 && (
            <span className="proposal__meta">Nog geen momenten gekozen.</span>
          )}
          {[...picked.values()]
            .sort((a, b) => optKey(a).localeCompare(optKey(b)))
            .map((o) => (
              <button
                key={optKey(o)}
                type="button"
                className="picked-chip"
                title="Verwijderen"
                onClick={() =>
                  setPicked((cur) => {
                    const next = new Map(cur);
                    next.delete(optKey(o));
                    return next;
                  })
                }
              >
                {shortDay(o.date)} {o.startTime}
                {o.courtsFree == null ? " ?" : ""} ×
              </button>
            ))}
        </div>
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Poll-kaart: fase-verloop + compacte stemrijen.                      */
/* ------------------------------------------------------------------ */

function PollCard({
  poll,
  groupName,
  members,
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
  groupName: string;
  members: GroupMember[];
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
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [showLosers, setShowLosers] = useState(false);
  // Optimistisch stemmen: de tik is meteen zichtbaar, de server volgt.
  const [voteOverlay, setVoteOverlay] = useState<
    Map<string, PollVoteStatus | null>
  >(new Map());

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

  /** Mijn stem op een optie, inclusief de optimistische overlay. */
  function myVote(optionId: string): PollVoteStatus | null {
    if (voteOverlay.has(optionId)) return voteOverlay.get(optionId) ?? null;
    return (
      votes.find((v) => v.option_id === optionId && v.player_id === myId)
        ?.status ?? null
    );
  }

  /** Stem zetten/wisselen: meteen zichtbaar, server volgt op de achtergrond. */
  function castVote(o: PollOption, status: PollVoteStatus) {
    const previous = myVote(o.id);
    const next = previous === status ? null : status;
    setVoteOverlay((cur) => new Map(cur).set(o.id, next));
    const call =
      next === null
        ? clearPollVote(o.id, myId)
        : setPollVote(o.id, poll.group_id, myId, next);
    call.then(onChanged).catch((err) => {
      setVoteOverlay((cur) => new Map(cur).set(o.id, previous));
      toast.error(errorMessage(err));
    });
  }

  const locked = poll.locked_option_id
    ? options.find((o) => o.id === poll.locked_option_id) ?? null
    : null;

  /** ± prijs per persoon voor een optie, uit de Playtomic-slotdata. */
  function perPersonAt(o: PollOption): string | null {
    const day = week.find((d) => d.date === o.date);
    if (!day?.data) return null;
    for (const row of day.data.courts) {
      const slotOptions = row.free.get(o.start_time);
      const match = slotOptions?.find((s) => s.duration === o.duration);
      if (match?.perPerson) return match.perPerson;
    }
    return null;
  }

  // Wie stemde nog op geen enkele optie? Maakt de herinnering gericht.
  const waiting =
    poll.status === "open"
      ? nonVoters(
          members.map((m) => m.player_id),
          options,
          votes,
        )
      : [];

  // Beste kandidaat voor de "Kies …"-knop: meeste ja's onder de haalbare.
  const bestOption = useMemo(() => {
    let best: { option: PollOption; yes: number } | null = null;
    for (const o of options) {
      const t = tallyOption(o, votes);
      const state = optionState(t.yes.length, liveFree(o));
      if (state === "onhaalbaar" || o.date < today) continue;
      if (!best || t.yes.length > best.yes) best = { option: o, yes: t.yes.length };
    }
    return best?.option ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, votes, week, today]);

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

  /** Deeltekst voor de groepschat: het vastgelegde moment + deelnemers. */
  async function shareWinner() {
    if (!locked) return;
    const t = tallyOption(locked, votes);
    const pp = perPersonAt(locked);
    const lines = [
      `🎾 Padel — ${groupName}`,
      `📅 ${longDay(locked.date)} om ${locked.start_time} (${locked.duration} min)`,
      `📍 ${club.name}${pp ? ` · ± ${pp} p.p.` : ""}`,
      t.yes.length > 0
        ? `👥 Doet mee: ${t.yes.map(name).join(", ")}`
        : "👥 Nog geen bevestigde deelnemers — stem mee in de app!",
      poll.status === "booked"
        ? "✅ Baan geboekt — tot dan!"
        : `⏳ Baan nog boeken: ${bookingUrl(locked.date)}`,
    ];
    try {
      const outcome = await shareOrCopyText({
        title: `Padel ${shortDay(locked.date)}`,
        text: lines.join("\n"),
      });
      if (outcome === "clipboard") toast.success("Tekst gekopieerd naar klembord.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(errorMessage(err));
    }
  }

  // Eén of meer rondes al gegenereerd vanuit deze kaart (sessie-lokaal).
  const [roundsMade, setRoundsMade] = useState(0);

  /**
   * Zet eerlijke rondes klaar met de ja-stemmers van het gekozen moment
   * (Elo-gebalanceerd via create_fair_round). Expliciete actie: de gebruiker
   * kiest zelf wanneer — zodra de datum vastligt en genoeg mensen bevestigden.
   */
  async function generateRounds() {
    if (!locked) return;
    setBusy(true);
    try {
      const t = tallyOption(locked, votes);
      const ratings = await getPlayerRatings();
      const teams = fairTeams(t.yes, ratings, roundsMade);
      const courts = teams.courts.map((c) => ({
        teamA: c.teamA.playerIds,
        teamB: c.teamB.playerIds,
      }));
      if (courts.length === 0) throw new Error("Geen volledige banen te vullen.");
      const ids = await createFairRound(poll.group_id, courts);
      setRoundsMade((n) => n + 1);
      onChanged();
      toast.success(
        ids.length === 1
          ? "Eerlijke match klaargezet — zie Wedstrijdrondes."
          : `${ids.length} eerlijke matches klaargezet — zie Wedstrijdrondes.`,
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const phase = poll.status === "open" ? 0 : poll.status === "locked" ? 1 : 2;
  const steps = ["Stemmen", "Gekozen", "Geboekt"];

  // Bij locked/booked: winnaar groot, de rest ingeklapt.
  const winnerFirst =
    locked && poll.status !== "open"
      ? [locked, ...options.filter((o) => o.id !== locked.id)]
      : options;
  const collapsed = poll.status !== "open" && !showLosers;

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Speeldag-poll</h2>
        {poll.status === "open" && !remindedDone && (
          <button className="btn btn--sm" disabled={busy} onClick={remind}>
            🔔 Herinner
          </button>
        )}
      </div>

      <ol className="poll-steps" aria-label="Fase van de poll">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`poll-steps__step${i === phase ? " is-active" : ""}${i < phase ? " is-done" : ""}`}
          >
            {i === phase && (
              <span aria-hidden="true" className="poll-steps__ball">
                🎾
              </span>
            )}
            {s}
          </li>
        ))}
      </ol>

      {waiting.length > 0 && (
        <p className="poll-waiting">
          Wacht op: {waiting.map(name).join(", ")}
        </p>
      )}

      <ul className="poll-rows">
        {winnerFirst.map((o, idx) => {
          if (collapsed && idx > 0) return null;
          const t = tallyOption(o, votes);
          const free = liveFree(o);
          const state = optionState(t.yes.length, free);
          const mine = myVote(o.id);
          const isChosen = poll.locked_option_id === o.id && poll.status !== "open";
          const detailOpen = openDetail === o.id;

          if (isChosen) {
            const pp = perPersonAt(o);
            return (
              <li key={o.id} className="winner-card">
                {/* Kop: baangroene band met het moment + status. */}
                <div className="winner-card__head">
                  <span className="winner-card__when">
                    🎾 {longDay(o.date)} · {o.start_time}
                  </span>
                  <span className="winner-card__status">
                    {poll.status === "booked" ? "Geboekt ✓" : "Gekozen"}
                  </span>
                </div>

                <div className="winner-card__body">
                  <p className="winner-card__meta">
                    {o.duration} min · {club.name}
                    {pp ? ` · ± ${pp} p.p.` : ""}
                  </p>

                  <div className="winner-card__players">
                    {t.yes.slice(0, 6).map((pid) => (
                      <Avatar key={pid} profile={profiles[pid]} size={26} />
                    ))}
                    <span className="winner-card__names">
                      {t.yes.length > 0
                        ? t.yes.map(name).join(", ")
                        : "Nog geen deelnemers bevestigd."}
                    </span>
                  </div>

                  <div className="winner-card__actions">
                    {poll.status === "locked" && (
                      <>
                        <a
                          className="btn btn--sm btn--primary"
                          href={bookingUrl(o.date)}
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
                              run(
                                () => markPollBooked(poll.id),
                                "Speeldag geboekt ✓",
                              )
                            }
                          >
                            Baan geboekt ✓
                          </button>
                        )}
                      </>
                    )}
                    {poll.status === "booked" && (
                      <button className="btn btn--sm" onClick={exportIcs}>
                        📅 Zet in agenda
                      </button>
                    )}
                    <button className="btn btn--sm" onClick={shareWinner}>
                      ↗ Deel
                    </button>
                  </div>

                  {/* Rondes genereren: expliciete actie zodra er genoeg
                      bevestigde spelers zijn (4 per baan). */}
                  <div className="winner-card__rounds">
                    <button
                      className={`btn btn--sm${roundsMade === 0 && t.yes.length >= 4 ? " btn--primary" : ""}`}
                      disabled={busy || t.yes.length < 4}
                      title={
                        t.yes.length < 4
                          ? "Minstens 4 bevestigde spelers nodig"
                          : "Elo-gebalanceerde teams per baan, als geplande matches"
                      }
                      onClick={generateRounds}
                    >
                      ⚡ {roundsMade === 0 ? "Genereer rondes" : "Nog een ronde"}
                      {t.yes.length >= 4 &&
                        ` (${Math.floor(t.yes.length / 4)} ${Math.floor(t.yes.length / 4) === 1 ? "baan" : "banen"})`}
                    </button>
                    {t.yes.length < 4 && (
                      <span className="winner-card__rounds-hint">
                        Nog <strong>{4 - t.yes.length}</strong>{" "}
                        {4 - t.yes.length === 1
                          ? "bevestigde speler"
                          : "bevestigde spelers"}{" "}
                        nodig voor rondes
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          }

          return (
            <li key={o.id} className="poll-row-wrap">
              <div className={`poll-row poll-option--${state}`}>
                <span className="poll-row__when">
                  {shortDay(o.date)} · {o.start_time}
                </span>
                <span className="poll-row__people" aria-hidden="true">
                  {t.yes.slice(0, 4).map((pid) => (
                    <Avatar key={pid} profile={profiles[pid]} size={22} />
                  ))}
                  {t.yes.length > 4 && (
                    <span className="poll-row__more">+{t.yes.length - 4}</span>
                  )}
                  {t.maybe.length > 0 && (
                    <span
                      className="poll-row__maybe"
                      title={`${t.maybe.length} misschien`}
                    >
                      +{t.maybe.length}?
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className={`poll-row__state poll-state--${state}`}
                  aria-label={`Haalbaarheid: ${state} — uitleg`}
                  aria-expanded={detailOpen}
                  onClick={() => setOpenDetail(detailOpen ? null : o.id)}
                >
                  {STATE_ICON[state]}
                </button>
                {poll.status === "open" && o.date >= today ? (
                  <span className="seg" role="group" aria-label="Jouw stem">
                    {VOTE_SEGMENTS.map((s) => (
                      <button
                        key={s.status}
                        className={`seg__btn${mine === s.status ? ` is-active is-${s.status}` : ""}`}
                        aria-label={s.label}
                        title={s.label}
                        onClick={() => castVote(o, s.status)}
                      >
                        {s.icon}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span className="proposal__meta poll-row__alt">
                    {o.date < today ? "voorbij" : `${t.yes.length} mee`}
                  </span>
                )}
              </div>
              {detailOpen && (
                <div className="poll-row-detail">
                  <p className="proposal__meta">
                    {t.yes.length} {t.yes.length === 1 ? "speler" : "spelers"} →{" "}
                    {t.needed} {t.needed === 1 ? "baan" : "banen"} nodig ·{" "}
                    {free == null
                      ? "beschikbaarheid onbekend"
                      : `${free} vrij (${state})`}
                    {t.maybe.length > 0 && ` · ${t.maybe.length} misschien`}
                  </p>
                  {t.yes.length > 0 && (
                    <p className="proposal__names">
                      Kan: {t.yes.map(name).join(", ")}
                    </p>
                  )}
                  {poll.status === "open" && isManager && (
                    <button
                      className="btn btn--sm"
                      disabled={busy || state === "onhaalbaar" || o.date < today}
                      onClick={() =>
                        run(() => lockPoll(poll.id, o.id), "Moment vastgelegd.")
                      }
                    >
                      Kies dit moment
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {collapsed && options.length > 1 && (
        <button
          className="btn btn--sm poll-card__showlosers"
          onClick={() => setShowLosers(true)}
        >
          Andere opties tonen ({options.length - 1})
        </button>
      )}

      <div className="proposal__actions poll-card__footer">
        {poll.status === "open" && isManager && bestOption && (
          <button
            className="btn btn--sm btn--primary"
            disabled={busy}
            onClick={() =>
              run(() => lockPoll(poll.id, bestOption.id), "Moment vastgelegd.")
            }
          >
            Kies {shortDay(bestOption.date)} · {bestOption.start_time}
          </button>
        )}
        {isManager && poll.status === "locked" && (
          <button
            className="btn btn--sm"
            disabled={busy}
            title="Terug naar de stemfase; het gekozen moment vervalt"
            onClick={() => run(() => reopenPoll(poll.id), "Stemmen heropend.")}
          >
            ↩ Heropen stemmen
          </button>
        )}
        {isManager && (
          <button
            className={`btn btn--sm proposal__withdraw${confirmCancel ? " is-confirm" : ""}`}
            disabled={busy}
            onClick={() => {
              if (!confirmCancel) {
                setConfirmCancel(true);
                return;
              }
              run(
                () => cancelPoll(poll.id),
                poll.status === "open" ? "Poll geannuleerd." : "Speeldag geannuleerd.",
              );
            }}
            onBlur={() => setConfirmCancel(false)}
          >
            {confirmCancel
              ? "Zeker? Tik nogmaals"
              : poll.status === "open"
                ? "Annuleer poll"
                : "Annuleer speeldag"}
          </button>
        )}
      </div>
    </section>
  );
}

export default PollSection;
