import { useMemo, useState, type FormEvent } from "react";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { addDays, dateInZone, minutesNowInZone } from "../../lib/time";
import {
  bookingUrl,
  getClubAvailability,
  getWeekAvailability,
  type DayAvailability,
  type WeekDay,
} from "../availability/api";
import { freeStartTimes, weekHeatmap } from "../availability/availabilityShare";
import { useClub } from "../availability/club";
import { displayName } from "../profiles/api";
import {
  getGroupProposals,
  getGroupProposalVotes,
  createProposal,
  deleteProposal,
  remindProposal,
  setProposalVote,
  clearProposalVote,
  type PlayProposal,
  type ProposalStatus,
} from "./proposalsApi";
import { tallyProposal, upcomingProposals } from "./proposalLogic";
import { PLAYERS_PER_COURT } from "./planGrid";
import type { Profile } from "../../lib/types";
import "./Proposals.css";

// Speelvoorstellen: iemand stelt een concreet moment voor ("donderdag 20:00?")
// en de rest reageert. De initiatief-gedreven voorkant van het plannen; het
// fijnmazige slot-raster (PlanTogether) blijft als geavanceerde weergave.

const STATUS_LABEL: Record<ProposalStatus, string> = {
  yes: "Ik doe mee",
  maybe: "Misschien",
  no: "Kan niet",
};

/** Sentinel in de uur-select voor "zelf een uur intikken". */
const CUSTOM_TIME = "custom";

// 's Middags formatteren zodat DST de datum niet kantelt.
function longDay(date: string): string {
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

/** "20:15" → "20:00": lookup-sleutel voor het halfuur-raster. */
function floorHalfHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${m < 30 ? "00" : "30"}`;
}

export function Proposals({
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
  const toast = useToast();
  const today = dateInZone(club.timezone);

  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState("");
  const [timeChoice, setTimeChoice] = useState<string>("");
  const [customTime, setCustomTime] = useState("20:00");
  const [courts, setCourts] = useState(1);
  const [saving, setSaving] = useState(false);
  // Twee-taps intrekken: eerste tik vraagt bevestiging, tweede tik verwijdert.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [reminded, setReminded] = useState<Set<string>>(new Set());

  const proposals = useAsync<PlayProposal[]>(
    () => getGroupProposals(groupId, today),
    [groupId, today],
  );
  const votes = useAsync(() => getGroupProposalVotes(groupId), [groupId]);
  // Live: nieuwe voorstellen en reacties van anderen verschijnen meteen.
  useRealtime("play_proposals", proposals.reload, `group_id=eq.${groupId}`);
  useRealtime("play_proposal_votes", votes.reload, `group_id=eq.${groupId}`);

  // Vrije banen deze week: voedt de live-indicator per voorstel.
  const week = useAsync<WeekDay[]>(() => getWeekAvailability(today), [today, club.id]);
  const heat = useMemo(() => weekHeatmap(week.data ?? [], null), [week.data]);
  const weekEnd = addDays(today, 6);

  /** Vrije banen op het moment van een voorstel, of null buiten het week-venster. */
  function freeAt(p: PlayProposal): number | null {
    if (p.date < today || p.date > weekEnd || week.data == null) return null;
    const day = heat.days.find((d) => d.date === p.date);
    if (!day || day.error) return null;
    return day.counts[floorHalfHour(p.start_time)] ?? 0;
  }

  // Hybride uur-keuze: vrije starttijden van de gekozen dag als opties,
  // met "ander uur" als ontsnapping (mét waarschuwing).
  const dayAvail = useAsync<DayAvailability | null>(
    () => (formOpen && date ? getClubAvailability(date) : Promise.resolve(null)),
    [formOpen, date, club.id],
  );
  const freeStarts = useMemo(() => {
    if (!dayAvail.data) return [];
    const nowMin =
      date === today ? minutesNowInZone(dayAvail.data.timeZone) : null;
    return freeStartTimes(dayAvail.data, null, nowMin);
  }, [dayAvail.data, date, today]);
  // Zolang er geen opties zijn (dag nog niet gekozen, laden, of niets vrij)
  // valt de keuze terug op zelf intikken.
  const effectiveChoice =
    freeStarts.length === 0
      ? CUSTOM_TIME
      : timeChoice || freeStarts[0]?.time || CUSTOM_TIME;
  const chosenTime =
    effectiveChoice === CUSTOM_TIME ? customTime : effectiveChoice;
  const customLooksBusy =
    effectiveChoice === CUSTOM_TIME &&
    date !== "" &&
    !dayAvail.loading &&
    dayAvail.data != null &&
    !freeStarts.some((s) => floorHalfHour(s.time) === floorHalfHour(customTime));

  const upcoming = useMemo(
    () => upcomingProposals(proposals.data ?? [], today),
    [proposals.data, today],
  );

  const name = (id: string) => displayName(profiles[id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!date || !chosenTime) return;
    setSaving(true);
    try {
      await createProposal({
        groupId,
        createdBy: myId,
        date,
        startTime: chosenTime,
        courts,
        clubName: club.name ?? null,
      });
      proposals.reload();
      votes.reload();
      setFormOpen(false);
      setDate("");
      setTimeChoice("");
      toast.success("Voorstel geplaatst — jij doet alvast mee.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function react(p: PlayProposal, status: ProposalStatus, mine: ProposalStatus | null) {
    setSaving(true);
    try {
      if (mine === status) {
        await clearProposalVote(p.id, myId);
      } else {
        await setProposalVote(p.id, groupId, myId, status);
      }
      votes.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function withdraw(p: PlayProposal) {
    if (confirmDelete !== p.id) {
      setConfirmDelete(p.id);
      return;
    }
    setSaving(true);
    try {
      await deleteProposal(p.id);
      proposals.reload();
      toast.success("Voorstel ingetrokken.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setConfirmDelete(null);
      setSaving(false);
    }
  }

  async function remind(p: PlayProposal) {
    setSaving(true);
    try {
      const n = await remindProposal(groupId, p.id);
      setReminded((cur) => new Set(cur).add(p.id));
      toast.success(
        n === 0
          ? "Iedereen heeft al gereageerd."
          : `${n} ${n === 1 ? "lid" : "leden"} herinnerd.`,
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Speelvoorstellen</h2>
        {!formOpen && (
          <button className="btn btn--sm btn--primary" onClick={() => setFormOpen(true)}>
            + Stel een moment voor
          </button>
        )}
      </div>
      <p className="proposals__hint">
        Stel een dag en uur voor; wie kan, doet mee. Vanaf {PLAYERS_PER_COURT}{" "}
        spelers per baan is het voorstel speelbaar.
      </p>

      {formOpen && (
        <form className="proposal-form" onSubmit={submit}>
          <label className="proposal-form__field">
            <span>Datum</span>
            <input
              type="date"
              className="select"
              required
              min={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setTimeChoice("");
              }}
            />
          </label>
          <label className="proposal-form__field">
            <span>Uur</span>
            {freeStarts.length > 0 ? (
              <select
                className="select"
                value={effectiveChoice}
                onChange={(e) => setTimeChoice(e.target.value)}
              >
                {freeStarts.map((s) => (
                  <option key={s.time} value={s.time}>
                    {s.time} · {s.courts.length}{" "}
                    {s.courts.length === 1 ? "baan" : "banen"}
                  </option>
                ))}
                <option value={CUSTOM_TIME}>Ander uur…</option>
              </select>
            ) : (
              <input
                type="time"
                className="select"
                required
                step={1800}
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
              />
            )}
          </label>
          {effectiveChoice === CUSTOM_TIME && freeStarts.length > 0 && (
            <label className="proposal-form__field">
              <span>Ander uur</span>
              <input
                type="time"
                className="select"
                required
                step={1800}
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
              />
            </label>
          )}
          <label className="proposal-form__field">
            <span>Banen</span>
            <select
              className="select"
              value={courts}
              onChange={(e) => setCourts(Number(e.target.value))}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="proposal-form__actions">
            <button className="btn btn--sm btn--primary" disabled={saving}>
              Voorstellen
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setFormOpen(false)}
            >
              Annuleren
            </button>
          </div>
          {date !== "" && dayAvail.loading && (
            <p className="proposal-form__note">Vrije banen checken…</p>
          )}
          {customLooksBusy && (
            <p className="proposal-form__note proposal-form__note--warn">
              ⚠ Op dit uur is er momenteel geen baan vrij bij {club.name}. Je
              kunt het toch voorstellen, maar boeken wordt lastig.
            </p>
          )}
          {date !== "" &&
            !dayAvail.loading &&
            dayAvail.data != null &&
            freeStarts.length === 0 && (
              <p className="proposal-form__note proposal-form__note--warn">
                ⚠ Geen vrije banen gevonden op deze dag bij {club.name}.
              </p>
            )}
        </form>
      )}

      {proposals.loading && <p className="empty">Voorstellen laden…</p>}
      {!proposals.loading && upcoming.length === 0 && !formOpen && (
        <p className="empty">
          Nog geen voorstellen. Wees de eerste: stel een moment voor!
        </p>
      )}

      <ul className="proposal-list">
        {upcoming.map((p) => {
          const t = tallyProposal(p, votes.data ?? []);
          const mine = (votes.data ?? []).find(
            (v) => v.proposal_id === p.id && v.player_id === myId,
          )?.status ?? null;
          const canWithdraw = p.created_by === myId || isOwner;
          const free = freeAt(p);
          return (
            <li key={p.id} className={`proposal${t.playable ? " proposal--playable" : ""}`}>
              <div className="proposal__head">
                <span className="proposal__when">
                  {longDay(p.date)} · {p.start_time}
                </span>
                <span className="proposal__meta">
                  {p.club_name ? `${p.club_name} · ` : ""}
                  {p.courts > 1 ? `${p.courts} banen · ` : ""}
                  door {name(p.created_by)}
                </span>
              </div>

              <div className="proposal__status">
                {t.playable ? (
                  <span className="badge badge--win">
                    Speelbaar ✓ {t.yes.length} spelers
                  </span>
                ) : (
                  <span className="badge">
                    {t.yes.length} mee · nog {t.needed} nodig
                  </span>
                )}
                {free != null && (
                  <span
                    className={`proposal__free${free === 0 ? " proposal__free--none" : ""}`}
                  >
                    {free === 0
                      ? "⚠ geen baan meer vrij"
                      : `${free} ${free === 1 ? "baan" : "banen"} vrij`}
                  </span>
                )}
                {t.maybe.length > 0 && (
                  <span className="proposal__maybe">
                    {t.maybe.length} misschien
                  </span>
                )}
              </div>

              {t.yes.length > 0 && (
                <p className="proposal__names">
                  Doet mee: {t.yes.map(name).join(", ")}
                </p>
              )}

              <div className="proposal__actions">
                <div role="group" aria-label="Jouw reactie" className="proposal__vote">
                  {(Object.keys(STATUS_LABEL) as ProposalStatus[]).map((s) => (
                    <button
                      key={s}
                      className={`btn btn--sm attendance-btn ${mine === s ? `is-active is-${s}` : ""}`}
                      disabled={saving}
                      onClick={() => react(p, s, mine)}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
                <div className="proposal__links">
                  {t.playable && (
                    <a
                      className="btn btn--sm"
                      href={bookingUrl(p.date)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Boek op Playtomic ↗
                    </a>
                  )}
                  {!t.playable && !reminded.has(p.id) && (
                    <button
                      className="btn btn--sm"
                      disabled={saving}
                      onClick={() => remind(p)}
                      title="Push naar leden die nog niet reageerden"
                    >
                      🔔 Herinner
                    </button>
                  )}
                  {canWithdraw && (
                    <button
                      className={`btn btn--sm proposal__withdraw${confirmDelete === p.id ? " is-confirm" : ""}`}
                      disabled={saving}
                      onClick={() => withdraw(p)}
                      onBlur={() => setConfirmDelete(null)}
                    >
                      {confirmDelete === p.id ? "Zeker? Tik nogmaals" : "Intrekken"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default Proposals;
