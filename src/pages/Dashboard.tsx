import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { useAsync } from "../lib/useAsync";
import { getPlayerStandings } from "../features/standings/api";
import { getRecentMatches, getTeamsMap } from "../features/matches/api";
import { getMyFriendships, categorize } from "../features/friends/api";
import { getProfilesMap, displayName } from "../features/profiles/api";
import { MatchList } from "../components/MatchList";
import "./Dashboard.css";

export function Dashboard() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const standings = useAsync(getPlayerStandings, []);
  const matches = useAsync(() => getRecentMatches(6), []);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getProfilesMap, []);
  const friendships = useAsync(getMyFriendships, []);

  const pmap = profiles.data ?? {};
  const rows = standings.data ?? [];
  const me = rows.find((p) => p.player_id === myId);
  const rankIdx = rows.findIndex((p) => p.player_id === myId);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;
  const { incoming, accepted } = categorize(friendships.data ?? [], myId);
  const myName = pmap[myId] ? displayName(pmap[myId]) : (user?.email ?? "speler");
  const top = rows.slice(0, 3);

  return (
    <div>
      <section className="hero">
        <div className="hero__text">
          <p className="hero__eyebrow">Welkom terug</p>
          <h1 className="hero__name">Hoi, {myName}</h1>
          <p className="hero__sub">
            {me
              ? `Je staat ${rank ? `op plek #${rank}` : "in het klassement"} met ${me.points} punten.`
              : "Speel je eerste match om in het klassement te komen."}
          </p>
        </div>
        <div className="hero__actions">
          <Link className="btn btn--primary" to="/matches">
            + Match loggen
          </Link>
          <Link className="btn" to="/groepen">
            Wedstrijden genereren
          </Link>
        </div>
      </section>

      <div className="stats">
        <Stat label="Punten" value={me?.points ?? 0} accent />
        <Stat label="Gespeeld" value={me?.played ?? 0} />
        <Stat label="Gewonnen" value={me?.won ?? 0} />
        <Stat label="Positie" value={rank ? `#${rank}` : "—"} />
      </div>

      <div className="grid grid--2">
        <section className="card">
          <div className="row-between" style={{ marginBottom: "1rem" }}>
            <h2 className="card__title" style={{ margin: 0 }}>
              Recente matches
            </h2>
            <Link className="profile-link" to="/matches">
              Alles →
            </Link>
          </div>
          {matches.loading ? (
            <p className="empty">Laden…</p>
          ) : (
            <MatchList
              matches={matches.data ?? []}
              teams={teams.data ?? {}}
              profiles={pmap}
            />
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="row-between" style={{ marginBottom: "1rem" }}>
              <h2 className="card__title" style={{ margin: 0 }}>
                Topspelers
              </h2>
              <Link className="profile-link" to="/klassement">
                Klassement →
              </Link>
            </div>
            {top.length === 0 ? (
              <p className="empty">Nog geen klassement.</p>
            ) : (
              <ul className="toplist">
                {top.map((p, i) => (
                  <li key={p.player_id} className="toplist__item">
                    <span className="toplist__rank">{i + 1}</span>
                    <Link className="profile-link toplist__name" to={`/spelers/${p.player_id}`}>
                      {displayName(p)}
                    </Link>
                    <span className="toplist__pts">{p.points} ptn</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="card__title">Sociaal</h2>
            <div className="stack">
              <div className="row-between">
                <span>Vrienden</span>
                <span className="badge">{accepted.length}</span>
              </div>
              <div className="row-between">
                <span>Openstaande verzoeken</span>
                <span className={`badge ${incoming.length ? "badge--accent" : ""}`}>
                  {incoming.length}
                </span>
              </div>
              <Link className="btn btn--sm" to="/vrienden">
                Vrienden beheren
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className={`stat ${accent ? "stat--accent" : ""}`}>
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

export default Dashboard;
