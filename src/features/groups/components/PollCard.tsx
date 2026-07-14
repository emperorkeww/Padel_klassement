import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { Avatar } from "@/ui/Avatar";
import { errorMessage } from "@/lib/utils/errors";
import { fairTeams } from "@/features/groups/fairTeamsLogic";
import { addDays, dateInZone } from "@/lib/utils/time";
import { icsEvent, downloadIcs } from "@/lib/utils/ics";
import { bookingUrl, getWeekAvailability, type WeekDay } from "@/features/availability/api";
import { dayStarts } from "@/features/availability/availabilityShare";
import { ClubPicker } from "@/features/availability/components/ClubPicker";
import { shareOrCopyText } from "@/lib/utils/shareText";
import { displayName } from "@/features/profiles/api";
import {
  addPollOption,
  removePollOption,
  setPollVote,
  clearPollVote,
  lockPoll,
  setPollClub,
  markPollBooked,
  reopenPoll,
  cancelPoll,
  remindPoll,
  pollClub,
  type PlayPoll,
  type PollOption,
  type PollVote,
  type PollVoteStatus,
  type NewPollOption,
} from "@/features/groups/pollsApi";
import {
  diffPollOptions,
  nonVoters,
  optionState,
  tallyOption,
} from "@/features/groups/pollLogic";
import { createFairRound } from "@/features/groups/api";
import { getPlayerRatings } from "@/features/standings/ratingsApi";
import type { GroupMember, Profile } from "@/types";
import {
  STATE_ICON,
  VOTE_SEGMENTS,
  floorHalfHour,
  longDay,
  shortDay,
} from "../planPollHelpers";
import { PollWizard } from "./PollWizard";

/* ------------------------------------------------------------------ */
/* Poll-kaart: fase-verloop + compacte stemrijen.                      */
/* ------------------------------------------------------------------ */

export function PollCard({
  poll,
  groupName,
  members,
  options,
  votes,
  profiles,
  myId,
  isOwner,
  onChanged,
}: {
  poll: PlayPoll;
  groupName: string;
  members: GroupMember[];
  options: PollOption[];
  votes: PollVote[];
  profiles: Record<string, Profile>;
  myId: string;
  isOwner: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  // De op de poll opgeslagen locatie (#322), niet de globale clubvoorkeur. De
  // clubtijd én de live vrije-banen-check volgen deze club.
  const club = pollClub(poll);
  const today = dateInZone(club.timezone);
  const weekAsync = useAsync<WeekDay[]>(
    () => getWeekAvailability(today, 7, club),
    [today, club.id],
  );
  const week = weekAsync.data ?? [];
  const weekLoading = weekAsync.loading;
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [remindedDone, setRemindedDone] = useState(false);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [showLosers, setShowLosers] = useState(false);
  // "Dagen aanpassen" (#128): wizard heropent met de bestaande momenten.
  const [editing, setEditing] = useState(false);
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
          ? "Eerlijke match klaargezet — zie Vandaag."
          : `${ids.length} eerlijke matches klaargezet — zie Vandaag.`,
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const phase = poll.status === "open" ? 0 : poll.status === "locked" ? 1 : 2;
  const steps = ["Stemmen", "Gekozen", "Geboekt"];

  // Bij locked/booked: winnaar groot, de rest ingeklapt. Bij booked blijven de
  // niet-gekozen opties zelfs helemaal verborgen (#322): je kunt toch niet meer
  // terug, dus tonen ze zou enkel verwarren.
  const winnerFirst =
    locked && poll.status !== "open"
      ? [locked, ...options.filter((o) => o.id !== locked.id)]
      : options;
  const collapsed =
    poll.status === "booked" || (poll.status === "locked" && !showLosers);

  // "Dagen aanpassen": wizard voorgevuld met de huidige momenten; het
  // verschil wordt bij bewaren als losse add/removes doorgevoerd zodat
  // stemmen op ongewijzigde momenten blijven staan.
  if (editing) {
    const initialPicked = new Map<string, NewPollOption>(
      options.map((o) => [
        `${o.date}|${o.start_time}`,
        {
          date: o.date,
          startTime: o.start_time,
          duration: o.duration,
          courtsFree: o.courts_free,
        },
      ]),
    );
    return (
      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Dagen aanpassen</h2>
        </div>
        <PollWizard
          today={today}
          week={week}
          weekLoading={weekLoading}
          club={club}
          initialPicked={initialPicked}
          submitLabel={(n) => `Bewaar dagen (${n})`}
          confirmHint={(picked) => {
            const removed = options.filter(
              (o) => !picked.has(`${o.date}|${o.start_time}`),
            );
            if (removed.length === 0) return null;
            const votesLost = removed.some((o) =>
              votes.some((v) => v.option_id === o.id),
            );
            return `${removed.length} ${removed.length === 1 ? "moment vervalt" : "momenten vervallen"}${votesLost ? ", inclusief de stemmen daarop" : ""}.`;
          }}
          onSubmit={async (_options, picked) => {
            const { toAdd, toRemoveIds } = diffPollOptions(options, picked);
            for (const optionId of toRemoveIds) {
              await removePollOption(optionId);
            }
            for (const o of toAdd) {
              await addPollOption(poll.id, poll.group_id, o);
            }
            toast.success("Dagen bijgewerkt — de stemmen op behouden momenten staan er nog.");
          }}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
        />
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Speeldag-poll</h2>
        <div className="proposal__links">
          {/* Locatie (#322): wijzigbaar zolang de poll niet geboekt is; daarna
              een vaste weergave, want de baan ligt dan vast. */}
          {isManager && poll.status !== "booked" ? (
            <ClubPicker
              value={club}
              onPick={(c) => run(() => setPollClub(poll.id, c), "Locatie gewijzigd.")}
              allowManual
              align="right"
            />
          ) : (
            <span className="poll-card__club" title="Locatie">
              📍 {club.name}
              {club.city ? ` · ${club.city}` : ""}
            </span>
          )}
          {poll.status === "open" && isManager && (
            <button
              className="btn btn--sm"
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              ✏️ Dagen aanpassen
            </button>
          )}
          {poll.status === "open" && !remindedDone && (
            <button className="btn btn--sm" disabled={busy} onClick={remind}>
              🔔 Herinner
            </button>
          )}
        </div>
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
                      className={`btn btn--sm${poll.status === "booked" && roundsMade === 0 && t.yes.length >= 4 ? " btn--primary" : ""}`}
                      disabled={busy || t.yes.length < 4}
                      title={
                        t.yes.length < 4
                          ? "Minstens 4 bevestigde spelers nodig"
                          : "Elo-gebalanceerde teams per baan, als geplande matches"
                      }
                      onClick={generateRounds}
                    >
                      ⚡ {roundsMade === 0 ? "Genereer wedstrijden" : "Nog een wedstrijd"}
                      {t.yes.length >= 4 &&
                        ` (${Math.floor(t.yes.length / 4)} ${Math.floor(t.yes.length / 4) === 1 ? "baan" : "banen"})`}
                    </button>
                    {/* Reis-CTA (#106): na het klaarzetten door naar Vandaag. */}
                    {roundsMade > 0 && (
                      <Link
                        className="btn btn--sm"
                        to={`/groepen/${poll.group_id}`}
                      >
                        Bekijk de wedstrijden →
                      </Link>
                    )}
                    {t.yes.length < 4 && (
                      <span className="winner-card__rounds-hint">
                        Nog <strong>{4 - t.yes.length}</strong>{" "}
                        {4 - t.yes.length === 1
                          ? "bevestigde speler"
                          : "bevestigde spelers"}{" "}
                        nodig voor wedstrijden
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
                  <span className="proposal__meta">
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
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {collapsed && poll.status === "locked" && options.length > 1 && (
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
