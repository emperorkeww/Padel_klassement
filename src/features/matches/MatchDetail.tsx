import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useToast } from "../../components/ToastProvider";
import {
  formatSetScores,
  getMatch,
  getTeamsByIds,
  readSetScores,
  teamLabel,
  updateMatchScore,
} from "./api";
import { PlannedMatchCard } from "./PlannedMatchCard";
import { getGroup } from "../groups/api";
import { getProfilesByIds, displayName } from "../profiles/api";
import { formatDate } from "../../lib/format";
import { tap } from "../../lib/haptics";
import { Avatar } from "../../components/Avatar";
import { Skeleton } from "../../components/Skeleton";
import { ScoreStepper } from "../../components/ScoreStepper";
import { ShareMatch } from "./ShareMatch";
import { errorMessage } from "../../lib/errors";
import type { Match, Profile, Team } from "../../lib/types";
import "./MatchDetail.css";

export function MatchDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const match = useAsync(() => getMatch(id), [id]);
  // Alleen de twee teams en vier spelers van déze match ophalen, niet de
  // volledige teams- en profielentabellen.
  const teamIds = match.data ? [match.data.team_a_id, match.data.team_b_id] : [];
  const teamKey = teamIds.join(",");
  const teams = useAsync(() => getTeamsByIds(teamIds), [teamKey]);
  const playerIds = teamIds.flatMap((tid) => {
    const t = teams.data?.[tid];
    return t ? [t.player1_id, t.player2_id] : [];
  });
  const playerKey = playerIds.join(",");
  const profiles = useAsync(() => getProfilesByIds(playerIds), [playerKey]);
  const [editing, setEditing] = useState(false);

  if (match.loading)
    return (
      // Speelt het scorebord na: twee teamvakken met de score in het midden.
      <div className="card md-board" aria-hidden="true">
        <div className="md-status">
          <span className="sk sk--pill" />
          <span className="sk sk--pill" />
        </div>
        <div className="md-versus">
          <div className="md-team">
            <Skeleton rows={2} />
          </div>
          <div className="md-score">
            <span className="sk sk--line" style={{ width: 72, height: 36 }} />
          </div>
          <div className="md-team">
            <Skeleton rows={2} />
          </div>
        </div>
      </div>
    );
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
  // Per-set uitslag (optioneel), bv. "6-4 3-6 7-5".
  const setLine = formatSetScores(readSetScores(m));
  // Geplande match: dezelfde inline invoer als op de kaart, mits je meedoet of
  // hem hebt aangemaakt (de server dwingt de rechten sowieso af).
  const amParticipant =
    !!user &&
    [teamA, teamB].some(
      (t) => t && (t.player1_id === user.id || t.player2_id === user.id),
    );
  const showPlanned =
    !done && (amParticipant || (!!user && m.created_by === user.id));

  return (
    <div>
      <header className="page-head">
        {/* Het scorebord ís de kop; voor screenreaders en de outline toch een h1. */}
        <h1 className="sr-only">Matchdetail</h1>
        <div className="row-between">
          <button className="btn btn--sm" onClick={() => navigate(-1)}>
            ← Terug
          </button>
          {done && <ShareMatch match={m} teams={tmap} profiles={pmap} />}
        </div>
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
                {/* Het winnende cijfer kleurt mee: wie won zie je in de score zelf. */}
                <span className={done && aWon ? "is-winside" : ""}>{m.score_a}</span>
                <span className="md-score__dash">–</span>
                <span className={done && bWon ? "is-winside" : ""}>{m.score_b}</span>
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

        {setLine && (
          <div className="md-sets">
            <span className="md-sets__label">Sets</span>
            <span className="set-breakdown">
              {setLine.split(" ").map((s, i) => (
                <span key={i} className="set-breakdown__set">
                  {s}
                </span>
              ))}
            </span>
          </div>
        )}

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

      {showPlanned && (
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Uitslag invullen</h2>
          </div>
          {/* Dezelfde inline invoer als bij "Te spelen": score/sets opslaan,
              agenda, tijd wijzigen en verwijderen. Rechten worden serverzijdig
              afgedwongen. Na verwijderen navigeren we terug. */}
          <PlannedMatchCard
            match={m}
            teams={tmap}
            profiles={pmap}
            perspectiveId={user?.id}
            onSaved={() => match.reload()}
            onDeleted={() => navigate(-1)}
          />
        </section>
      )}
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
      tap();
      toast.success("Score bijgewerkt.");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="md-editor">
      <div className="md-editor__inputs">
        {/* Geen <label>-wrapper: die zou kliks naar de eerste stepper-knop
            sturen; het aria-label op het veld dekt de toegankelijkheid. */}
        <div className="md-editor__field">
          <span>{labelA}</span>
          <ScoreStepper value={sa} onChange={setSa} label={`Score ${labelA}`} />
        </div>
        <span className="matchlist__vs">–</span>
        <div className="md-editor__field">
          <span>{labelB}</span>
          <ScoreStepper value={sb} onChange={setSb} label={`Score ${labelB}`} />
        </div>
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
            {p?.id ? (
              <Link className="profile-link" to={`/spelers/${p.id}`}>
                {displayName(p)}
              </Link>
            ) : (
              <span>{displayName(p)}</span>
            )}
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
  // Klikbaar: de badge is meteen de weg terug naar de groep (en zijn stand).
  return (
    <Link className="badge badge--link" to={`/groepen/${groupId}`}>
      {group.data?.name ?? "Groep"} →
    </Link>
  );
}

export default MatchDetail;