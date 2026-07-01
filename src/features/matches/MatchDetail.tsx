import { Link, useParams } from "react-router-dom";
import { useAsync } from "../lib/useAsync";
import {
  getMatch,
  getMatchPoints,
  getTeamsMap,
  teamLabel,
} from "../features/matches/api";
import { getGroup } from "../features/groups/api";
import { getProfilesMap, displayName } from "../features/profiles/api";
import { formatDate } from "../lib/format";
import type { Team } from "../lib/types";
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

  // Punt-samenvatting (indien punt-voor-punt geregistreerd).
  const pts = points.data ?? [];
  const ptsA = pts.filter((p) => p.won_by_team_id === m.team_a_id).length;
  const ptsB = pts.filter((p) => p.won_by_team_id === m.team_b_id).length;
  const golden = pts.filter((p) => p.is_golden_point).length;

  const players = (t: Team | undefined) =>
    t ? [displayName(pmap[t.player1_id]), displayName(pmap[t.player2_id])] : [];

  return (
    <div>
      <header className="page-head">
        <Link className="btn btn--sm" to="/matches">
          ← Matches
        </Link>
      </header>

      <section className="card">
        <div className="md-status">
          <span className={`badge ${done ? "" : "badge--accent"}`}>
            {done ? "Afgerond" : "Gepland"}
          </span>
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
            title={teamLabel(teamA, pmap)}
            players={players(teamA)}
            won={done && aWon}
          />
          <div className="md-score">
            {m.score_a != null && m.score_b != null ? (
              <span className="md-score__num">
                {m.score_a}–{m.score_b}
              </span>
            ) : (
              <span className="md-score__vs">vs</span>
            )}
          </div>
          <TeamBlock
            title={teamLabel(teamB, pmap)}
            players={players(teamB)}
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
  title,
  players,
  won,
}: {
  title: string;
  players: string[];
  won: boolean;
}) {
  return (
    <div className={`md-team ${won ? "is-win" : ""}`}>
      <div className="md-team__name">
        {title}
        {won && <span className="badge badge--win">Winnaar</span>}
      </div>
      <ul className="md-team__players">
        {players.map((p, i) => (
          <li key={i}>{p}</li>
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
