import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { getProfile, displayName } from "./api";
import { getProfilesMap } from "./api";
import { getPlayerStanding } from "../standings/api";
import { getPlayerMatches, getTeamsMap } from "../matches/api";
import { MatchList } from "../matches/MatchList";
import "./PlayerProfile.css";

export function PlayerProfile() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const isMe = user?.id === id;

  const profile = useAsync(() => getProfile(id), [id]);
  const standing = useAsync(() => getPlayerStanding(id), [id]);
  const matches = useAsync(() => getPlayerMatches(id), [id]);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getProfilesMap, []);

  if (profile.loading) return <p className="empty">Laden…</p>;
  if (!profile.data)
    return <p className="msg msg--error">Speler niet gevonden.</p>;

  const p = profile.data;
  const s = standing.data;
  const initials = displayName(p).slice(0, 1).toUpperCase();

  return (
    <div>
      <header className="page-head">
        <Link className="btn btn--sm" to="/vrienden">
          ← Vrienden
        </Link>
      </header>

      <section className="card profile-hero">
        <div className="profile-hero__avatar">
          {p.avatar_url ? <img src={p.avatar_url} alt="" /> : initials}
        </div>
        <div>
          <h1 className="profile-hero__name">
            {displayName(p)}
            {isMe && <span className="badge badge--accent">jij</span>}
          </h1>
          <p className="profile-hero__handle">@{p.username}</p>
        </div>
      </section>

      <div className="stats">
        <Stat label="Punten" value={s?.points ?? 0} />
        <Stat label="Gespeeld" value={s?.played ?? 0} />
        <Stat label="Gewonnen" value={s?.won ?? 0} />
        <Stat label="Verloren" value={s?.lost ?? 0} />
      </div>

      <section className="card">
        <h2 className="card__title">Recente matches</h2>
        {matches.loading && <p className="empty">Laden…</p>}
        {matches.error && <p className="msg msg--error">{matches.error}</p>}
        {!matches.loading && (
          <MatchList
            matches={matches.data ?? []}
            teams={teams.data ?? {}}
            profiles={profiles.data ?? {}}
            empty="Deze speler heeft nog geen matches gespeeld."
          />
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

export default PlayerProfile;
