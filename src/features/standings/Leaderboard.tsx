import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { Skeleton } from "../../components/Skeleton";
import { Avatar } from "../../components/Avatar";
import { FormChips } from "../../components/FormChips";
import { recentForm, winRate, type Outcome } from "../../lib/results";
import {
  getPlayerStandings,
  getTeamStandings,
  getGroupPlayerStandings,
} from "./api";
import { getMyGroups } from "../groups/api";
import { getPlayerRatings } from "./ratingsApi";
import { getRecentMatches, getTeamsMap, teamLabel } from "../matches/api";
import { getProfilesMap, displayName } from "../profiles/api";
import type { Profile } from "../../lib/types";
import "./Leaderboard.css";

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
  // Voor de vorm-kolom: recente matches client-side per speler samengevat.
  const recent = useAsync(() => getRecentMatches(250), []);
  const ratings = useAsync(getPlayerRatings, []);

  // Live bijwerken bij nieuwe/aangepaste matches.
  const refresh = useCallback(() => {
    players.reload();
    teams.reload();
    teamsMap.reload();
    recent.reload();
    ratings.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.reload, teams.reload, teamsMap.reload, recent.reload, ratings.reload]);
  useRealtime("matches", refresh);

  const pmap = profilesMap.data ?? {};
  const tmap = teamsMap.data ?? {};
  const rmap = ratings.data ?? {};
  const formFor = (playerId: string): Outcome[] =>
    recentForm(recent.data ?? [], tmap, playerId, 5);

  const playerRows = (players.data ?? []).map((p) => ({
    key: p.player_id,
    isMe: p.player_id === myId,
    name: displayName(p),
    profile: pmap[p.player_id] ?? p,
    link: `/spelers/${p.player_id}`,
    played: p.played,
    won: p.won,
    drawn: p.drawn ?? 0,
    lost: p.lost,
    points: p.points,
    goalDiff: p.goal_diff ?? 0,
    rating: rmap[p.player_id]?.rating ?? null,
    form: formFor(p.player_id),
  }));

  const teamRows = (teams.data ?? []).map((t) => ({
    key: t.team_id,
    isMe: false,
    name: teamLabel(tmap[t.team_id], pmap),
    profile: null,
    link: undefined as string | undefined,
    played: t.played,
    won: t.won,
    drawn: t.drawn ?? 0,
    lost: t.lost,
    points: t.points,
    goalDiff: t.goal_diff ?? 0,
    rating: null,
    form: [] as Outcome[],
  }));

  const rows = tab === "player" ? playerRows : teamRows;
  const loading = tab === "player" ? players.loading : teams.loading;
  const error = tab === "player" ? players.error : teams.error;
  const showPodium = tab === "player" && !loading && !error && rows.length >= 3;

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Klassement</h1>
        <p className="page-subtitle">Winst = 3 punten, gelijkspel = 1, verlies = 0.</p>
      </header>

      <KlassementUitleg />

      <div className="toolbar">
        <div className="tabs">
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
            className="select select--filter"
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

      {showPodium && <Podium rows={playerRows.slice(0, 3)} />}

      <div className="card">
        <StandingsTable rows={rows} loading={loading} error={error} showForm={tab === "player"} />
      </div>
    </div>
  );
}

/* ---------- Podium: top 3 met goud/zilver/brons ---------- */
type Row = {
  key: string;
  isMe: boolean;
  name: string;
  profile: Pick<Profile, "username" | "full_name"> & { avatar_url?: string | null } | null;
  link?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalDiff: number;
  rating: number | null;
  form: Outcome[];
};

function Podium({ rows }: { rows: Row[] }) {
  const [first, second, third] = rows;
  // Visuele volgorde: zilver — goud — brons.
  const order: { row: Row; place: 1 | 2 | 3 }[] = [
    { row: second, place: 2 },
    { row: first, place: 1 },
    { row: third, place: 3 },
  ];

  return (
    <div className="podium" aria-label="Top 3">
      {order.map(({ row, place }) => (
        <Link
          key={row.key}
          to={row.link ?? "#"}
          className={`podium__spot podium__spot--${place} ${row.isMe ? "is-me" : ""}`}
        >
          <span className="podium__medal">{place}</span>
          <Avatar profile={row.profile} name={row.name} size={place === 1 ? 56 : 44} />
          <span className="podium__name">{row.name}</span>
          <span className="podium__pts">{row.points} ptn</span>
          <span className="podium__record">
            {row.won}W · {row.drawn}G · {row.lost}V
          </span>
        </Link>
      ))}
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
            <dt>Vorm</dt>
            <dd>
              De laatste vijf uitslagen van de speler, nieuwste links:{" "}
              <strong>W</strong>inst, <strong>D</strong> (gelijk),{" "}
              <strong>L</strong> (verlies).
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

function StandingsTable({
  rows,
  loading,
  error,
  showForm,
}: {
  rows: Row[];
  loading: boolean;
  error: string | null;
  showForm: boolean;
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
            {showForm && <th className="col-sec">Vorm</th>}
            <th className="num col-sec">Gespeeld</th>
            <th className="num">Winst</th>
            <th className="num col-sec">Gelijk</th>
            <th className="num">Verlies</th>
            <th className="num col-sec">Winrate</th>
            <th className="num col-sec">Saldo</th>
            {showForm && <th className="num">Rating</th>}
            <th className="num">Punten</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const rate = winRate(r.won, r.played);
            return (
              <tr key={r.key} className={r.isMe ? "is-me" : ""}>
                <td>
                  <span className={`rank rank--${i + 1}`}>{i + 1}</span>
                </td>
                <td>
                  <span className="cell-player">
                    <Avatar profile={r.profile} name={r.name} size={26} />
                    {r.link ? (
                      <Link className="profile-link" to={r.link}>
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )}
                    {r.isMe && <span className="badge badge--accent">jij</span>}
                  </span>
                </td>
                {showForm && (
                  <td className="col-sec">
                    {r.form.length > 0 ? (
                      <FormChips form={r.form} size="sm" />
                    ) : (
                      <span className="empty empty--bare">—</span>
                    )}
                  </td>
                )}
                <td className="num col-sec">{r.played}</td>
                <td className="num">{r.won}</td>
                <td className="num col-sec">{r.drawn}</td>
                <td className="num">{r.lost}</td>
                <td className="num col-sec">
                  {rate != null ? (
                    <span className="winrate">
                      <span className="winrate__bar">
                        <span
                          className="winrate__fill"
                          style={{ width: `${rate}%` }}
                        />
                      </span>
                      {rate}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num col-sec">
                  {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                </td>
                {showForm && (
                  <td className="num">
                    {r.rating != null ? (
                      <span className="rating-cell">{r.rating}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="num">
                  <strong>{r.points}</strong>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default Leaderboard;