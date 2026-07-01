import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { Skeleton } from "../../components/Skeleton";
import {
  getPlayerStandings,
  getTeamStandings,
  getGroupPlayerStandings,
} from "./api";
import { getMyGroups } from "../groups/api";
import { getTeamsMap, teamLabel } from "../matches/api";
import { getProfilesMap, displayName } from "../profiles/api";

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
  const teamsMap = useAsync(getTeamsMap, []);
  const profilesMap = useAsync(getProfilesMap, []);

  // Live bijwerken bij nieuwe/aangepaste matches.
  const refresh = useCallback(() => {
    players.reload();
    teams.reload();
    teamsMap.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.reload, teams.reload, teamsMap.reload]);
  useRealtime("matches", refresh);

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Klassement</h1>
        <p className="page-subtitle">Winst = 3 punten, gelijkspel = 1, verlies = 0.</p>
      </header>

      <KlassementUitleg />

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
              drawn: p.drawn ?? 0,
              lost: p.lost,
              points: p.points,
              goalDiff: p.goal_diff ?? 0,
            }))}
          />
        ) : (
          <StandingsTable
            loading={teams.loading}
            error={teams.error}
            rows={(teams.data ?? []).map((t) => ({
              key: t.team_id,
              isMe: false,
              name: teamLabel(teamsMap.data?.[t.team_id], profilesMap.data ?? {}),
              sub: "",
              played: t.played,
              won: t.won,
              drawn: t.drawn ?? 0,
              lost: t.lost,
              points: t.points,
              goalDiff: t.goal_diff ?? 0,
            }))}
          />
        )}
      </div>
    </div>
  );
}

function KlassementUitleg() {
  return (
    <details className="explainer">
      <summary>Hoe werkt het klassement?</summary>
      <div className="explainer__body">
        <dl>
          <div>
            <dt>Punten</dt>
            <dd>
              Elke gewonnen match levert <strong>3 punten</strong> op, een
              gelijkspel <strong>1</strong> en een verlies <strong>0</strong>.
              Omdat er meestal op tijd wordt gespeeld, kan een match gelijk
              eindigen — dan krijgen beide teams één punt.
            </dd>
          </div>
          <div>
            <dt>Gespeeld · Winst · Gelijk · Verlies</dt>
            <dd>
              Tellen alleen <strong>afgeronde</strong> matches. Een geplande
              Americano-match telt pas mee zodra het resultaat is ingevoerd.
            </dd>
          </div>
          <div>
            <dt>Spelers versus Teams</dt>
            <dd>
              Het spelersklassement telt jouw matches over <em>alle</em> teams
              waarin je speelde — ook bij wisselende partners in een Americano. Het
              teamklassement telt per vast spelerspaar.
            </dd>
          </div>
          <div>
            <dt>Volgorde</dt>
            <dd>
              Eerst op punten (hoog naar laag). Bij een gelijke stand telt het{" "}
              <strong>scoresaldo</strong> (punten voor min tegen), daarna het
              aantal gewonnen matches, en ten slotte de naam (alfabetisch).
            </dd>
          </div>
          <div>
            <dt>Groepsfilter</dt>
            <dd>
              <strong>Alle groepen</strong> toont al je afgeronde matches samen.
              Kies een groep om enkel de matches binnen die groep te tellen.
            </dd>
          </div>
        </dl>
      </div>
    </details>
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
  drawn: number;
  lost: number;
  points: number;
  goalDiff: number;
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
  if (loading) return <Skeleton rows={5} />;
  if (error) return <p className="msg msg--error">{error}</p>;
  if (rows.length === 0)
    return <p className="empty">Nog geen afgeronde matches.</p>;

  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: "2rem" }}>#</th>
            <th>Naam</th>
            <th className="num col-sec">Gespeeld</th>
            <th className="num">Winst</th>
            <th className="num col-sec">Gelijk</th>
            <th className="num">Verlies</th>
            <th className="num col-sec">Saldo</th>
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
              <td className="num col-sec">{r.played}</td>
              <td className="num">{r.won}</td>
              <td className="num col-sec">{r.drawn}</td>
              <td className="num">{r.lost}</td>
              <td className="num col-sec">{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
              <td className="num">
                <strong>{r.points}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Leaderboard;
