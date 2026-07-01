import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { useAsync } from "../lib/useAsync";
import {
  getPlayerStandings,
  getTeamStandings,
  getGroupPlayerStandings,
} from "../features/standings/api";
import { getMyGroups } from "../features/groups/api";
import { displayName } from "../features/profiles/api";

type Tab = "player" | "team";

export function Leaderboard() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const [tab, setTab] = useState<Tab>("player");
  const [groupId, setGroupId] = useState<string>("");

  const groups = useAsync(getMyGroups, []);
  const players = useAsync(
    () => (groupId ? getGroupPlayerStandings(groupId) : getPlayerStandings()),
    [groupId],
  );
  const teams = useAsync(getTeamStandings, []);

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Klassement</h1>
        <p className="page-subtitle">Winst levert 3 punten op. Live berekend.</p>
      </header>

      <div className="row-between" style={{ marginBottom: "1.25rem" }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button
            className={`tab ${tab === "player" ? "is-active" : ""}`}
            onClick={() => setTab("player")}
          >
            Spelers
          </button>
          <button
            className={`tab ${tab === "team" ? "is-active" : ""}`}
            onClick={() => setTab("team")}
          >
            Teams
          </button>
        </div>

        {tab === "player" && (
          <select
            className="select"
            style={{ maxWidth: 220 }}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">Alle groepen</option>
            {(groups.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="card">
        {tab === "player" ? (
          <StandingsTable
            loading={players.loading}
            error={players.error}
            rows={(players.data ?? []).map((p) => ({
              key: p.player_id,
              isMe: p.player_id === myId,
              name: displayName(p),
              link: `/spelers/${p.player_id}`,
              sub: `@${p.username}`,
              played: p.played,
              won: p.won,
              lost: p.lost,
              points: p.points,
            }))}
          />
        ) : (
          <StandingsTable
            loading={teams.loading}
            error={teams.error}
            rows={(teams.data ?? []).map((t) => ({
              key: t.team_id,
              isMe: false,
              name: t.team_name ?? "Naamloos team",
              sub: "",
              played: t.played,
              won: t.won,
              lost: t.lost,
              points: t.points,
            }))}
          />
        )}
      </div>
    </div>
  );
}

type Row = {
  key: string;
  isMe: boolean;
  name: string;
  link?: string;
  sub: string;
  played: number;
  won: number;
  lost: number;
  points: number;
};

function StandingsTable({
  rows,
  loading,
  error,
}: {
  rows: Row[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <p className="empty">Laden…</p>;
  if (error) return <p className="msg msg--error">{error}</p>;
  if (rows.length === 0)
    return <p className="empty">Nog geen afgeronde matches.</p>;

  return (
    <table className="table">
      <thead>
        <tr>
          <th style={{ width: "2rem" }}>#</th>
          <th>Naam</th>
          <th className="num">Gespeeld</th>
          <th className="num">Winst</th>
          <th className="num">Verlies</th>
          <th className="num">Punten</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.key} className={r.isMe ? "is-me" : ""}>
            <td>{i + 1}</td>
            <td>
              {r.link ? (
                <Link className="profile-link" to={r.link}>
                  {r.name}
                </Link>
              ) : (
                r.name
              )}
              {r.sub && <span className="badge" style={{ marginLeft: 6 }}>{r.sub}</span>}
            </td>
            <td className="num">{r.played}</td>
            <td className="num">{r.won}</td>
            <td className="num">{r.lost}</td>
            <td className="num">
              <strong>{r.points}</strong>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default Leaderboard;
