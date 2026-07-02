import { Link, useParams } from "react-router-dom";
import { useAsync } from "../../lib/useAsync";
import {
  getMatch,
  getMatchPoints,
  getTeamsMap,
  teamLabel,
} from "./api";
import { getGroup } from "../groups/api";
import { getProfilesMap, displayName } from "../profiles/api";
import { formatDate } from "../../lib/format";
import { Avatar } from "../../components/Avatar";
import type { Profile, Team } from "../../lib/types";
import "./MatchDetail.css";

export function MatchDetail() {
  const { id = "" } = useParams();

  const match = useAsync(() => getMatch(id), [id]);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getProfilesMap, []);
  const points = useAsync(() => getMatchPoints(id), [id]);

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

  // Punt-samenvatting (indien punt-voor-punt geregistreerd).
  const pts = points.data ?? [];
  const ptsA = pts.filter((p) => p.won_by_team_id === m.team_a_id).length;
  const ptsB = pts.filter((p) => p.won_by_team_id === m.team_b_id).length;
  const golden = pts.filter((p) => p.is_golden_point).length;

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
      </section>

      {pts.length > 0 && (
        <section className="card">
          <h2 className="card__title">Puntenverloop</h2>
          <div className="stack">
            <div className="row-between">
              <span>{teamLabel(teamA, pmap)}</span>
              <span className="badge">{ptsA} punten</span>
            </div>
            <div className="row-between">
              <span>{teamLabel(teamB, pmap)}</span>
              <span className="badge">{ptsB} punten</span>
            </div>
            {golden > 0 && (
              <div className="row-between">
                <span>Gouden punten</span>
                <span className="badge badge--accent">{golden}</span>
              </div>
            )}
          </div>
        </section>
      )}
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