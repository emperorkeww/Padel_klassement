import { useMemo, useState, type FormEvent } from "react";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { dateInZone } from "../../lib/time";
import { bookingUrl } from "../availability/api";
import { useClub } from "../availability/club";
import { displayName } from "../profiles/api";
import {
  getGroupProposals,
  getGroupProposalVotes,
  createProposal,
  deleteProposal,
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

// 's Middags formatteren zodat DST de datum niet kantelt.
function longDay(date: string): string {
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
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
  const [time, setTime] = useState("20:00");
  const [courts, setCourts] = useState(1);
  const [saving, setSaving] = useState(false);
  // Twee-taps intrekken: eerste tik vraagt bevestiging, tweede tik verwijdert.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const proposals = useAsync<PlayProposal[]>(
    () => getGroupProposals(groupId, today),
    [groupId, today],
  );
  const votes = useAsync(() => getGroupProposalVotes(groupId), [groupId]);
  // Live: nieuwe voorstellen en reacties van anderen verschijnen meteen.
  useRealtime("play_proposals", proposals.reload, `group_id=eq.${groupId}`);
  useRealtime("play_proposal_votes", votes.reload, `group_id=eq.${groupId}`);

  const upcoming = useMemo(
    () => upcomingProposals(proposals.data ?? [], today),
    [proposals.data, today],
  );

  const name = (id: string) => displayName(profiles[id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!date || !time) return;
    setSaving(true);
    try {
      await createProposal({
        groupId,
        createdBy: myId,
        date,
        startTime: time,
        courts,
        clubName: club.name ?? null,
      });
      proposals.reload();
      votes.reload();
      setFormOpen(false);
      setDate("");
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
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="proposal-form__field">
            <span>Uur</span>
            <input
              type="time"
              className="select"
              required
              step={1800}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
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
