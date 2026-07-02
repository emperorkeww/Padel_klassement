import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useToast } from "../../components/ToastProvider";
import {
  getMatch,
  getTeamsMap,
  teamLabel,
  updateMatchScore,
} from "./api";
import { getGroup } from "../groups/api";
import { getProfilesMap, displayName } from "../profiles/api";
import { formatDate } from "../../lib/format";
import { Avatar } from "../../components/Avatar";
import type { Match, Profile, Team } from "../../lib/types";
import "./MatchDetail.css";

export function MatchDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();

  const match = useAsync(() => getMatch(id), [id]);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getProfilesMap, []);
  const [editing, setEditing] = useState(false);

  if (match.loading) return <p className="empty">Laden…</p>;
  if (!match.data) return <p className="msg msg--error">Match niet gevonden.</p>;

  const m = match.data;
  const tmap = teams.data ?? {};
  const pmap = profiles.data ?? {};
  const teamA = tmap[m.team_a_id];
  const teamB = tmap[m.team_b_id];
  const done = m.status === "completed";
  const aWon = m.winner_team_id === m.team_a_id;
  const bWon = m.winner_team_id === m.team_b_id;
  const isDraw = done && m.winner_team_id === null;
  // Enkel de aanmaker kan de score corrigeren (RLS dwingt dit ook af).
  const canEdit = done && !!user && m.created_by === user.id;

  return (
    <div>
      <header className="page-head">
        <Link className="btn btn--sm" to="/matches">
          ← Matches
        </Link>
      </header>

      <section className="card md-board">
        <div className="md-status">
          <span className={`badge ${done ? "" : "badge--accent"}`}>
            {done ? "Afgerond" : "Gepland"}
          </span>
          {isDraw && <span className="badge badge--accent">Gelijkspel</span>}
          <span className="badge">
            {formatDate(m.played_at ?? m.created_at) || "—"}
          </span>
          {m.round_number != null && (
            <span className="badge">Ronde {m.round_number}</span>
          )}
          <GroupBadge groupId={m.group_id} />
        </div>

        <div className="md-versus">
          <TeamBlock
            team={teamA}
            label={teamLabel(teamA, pmap)}
            profiles={pmap}
            won={done && aWon}
          />
          <div className="md-score">
            {m.score_a != null && m.score_b != null ? (
              <span className="md-score__num">
                {m.score_a}
                <span className="md-score__dash">–</span>
                {m.score_b}
              </span>
            ) : (
              <span className="md-score__vs">vs</span>
            )}
            {done && !isDraw && m.score_a != null && m.score_b != null && (
              <span className="md-score__note">eindstand</span>
            )}
          </div>
          <TeamBlock
            team={teamB}
            label={teamLabel(teamB, pmap)}
            profiles={pmap}
            won={done && bWon}
          />
        </div>

        {canEdit && !editing && (
          <div className="md-edit-actions">
            <button className="btn btn--sm" onClick={() => setEditing(true)}>
              {m.score_a != null ? "Score aanpassen" : "Score invoeren"}
            </button>
          </div>
        )}

        {canEdit && editing && (
          <ScoreEditor
            match={m}
            labelA={teamLabel(teamA, pmap)}
            labelB={teamLabel(teamB, pmap)}
            onClose={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              match.reload();
            }}
          />
        )}
      </section>
    </div>
  );
}

/** Inline correctie van de eindscore; de winnaar volgt automatisch uit de score. */
function ScoreEditor({
  match,
  labelA,
  labelB,
  onClose,
  onSaved,
}: {
  match: Match;
  labelA: string;
  labelB: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [sa, setSa] = useState(match.score_a != null ? String(match.score_a) : "");
  const [sb, setSb] = useState(match.score_b != null ? String(match.score_b) : "");
  const [busy, setBusy] = useState(false);

  const saNum = sa === "" ? null : Number(sa);
  const sbNum = sb === "" ? null : Number(sb);
  const valid =
    saNum !== null && sbNum !== null && saNum >= 0 && sbNum >= 0;
  const preview =
    valid
      ? saNum === sbNum
        ? "Gelijkspel — beide teams krijgen 1 punt."
        : `${saNum > sbNum ? labelA : labelB} wint.`
      : null;

  async function save() {
    if (!valid) return toast.error("Vul beide scores in (0 of hoger).");
    setBusy(true);
    try {
      await updateMatchScore({
        matchId: match.id,
        winnerTeamId:
          saNum === sbNum
            ? null
            : saNum! > sbNum!
              ? match.team_a_id
              : match.team_b_id,
        scoreA: saNum!,
        scoreB: sbNum!,
      });
      toast.success("Score bijgewerkt.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="md-editor">
      <div className="md-editor__inputs">
        <label className="md-editor__field">
          <span>{labelA}</span>
          <input
            className="input"
            type="number"
            min="0"
            aria-label={`Score ${labelA}`}
            value={sa}
            onChange={(e) => setSa(e.target.value)}
          />
        </label>
        <span className="matchlist__vs">–</span>
        <label className="md-editor__field">
          <span>{labelB}</span>
          <input
            className="input"
            type="number"
            min="0"
            aria-label={`Score ${labelB}`}
            value={sb}
            onChange={(e) => setSb(e.target.value)}
          />
        </label>
      </div>
      {preview && <p className="md-editor__preview">{preview}</p>}
      <div className="md-editor__buttons">
        <button className="btn btn--sm" onClick={onClose} disabled={busy}>
          Annuleren
        </button>
        <button
          className="btn btn--primary btn--sm"
          onClick={save}
          disabled={busy || !valid}
        >
          {busy ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </div>
  );
}

function TeamBlock({
  team,
  label,
  profiles,
  won,
}: {
  team: Team | undefined;
  label: string;
  profiles: Record<string, Profile>;
  won: boolean;
}) {
  const players = team
    ? [profiles[team.player1_id], profiles[team.player2_id]]
    : [];
  return (
    <div className={`md-team ${won ? "is-win" : ""}`}>
      <div className="md-team__name">
        {label}
        {won && <span className="badge badge--win">Winnaar</span>}
      </div>
      <ul className="md-team__players">
        {players.map((p, i) => (
          <li key={p?.id ?? i}>
            <Avatar profile={p} size={24} />
            <span>{displayName(p)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupBadge({ groupId }: { groupId: string | null }) {
  const group = useAsync(() => (groupId ? getGroup(groupId) : Promise.resolve(null)), [
    groupId,
  ]);
  if (!groupId) return null;
  return <span className="badge">{group.data?.name ?? "Groep"}</span>;
}

export default MatchDetail;