import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { getProfile, displayName } from "./api";
import { getProfilesMap } from "./api";
import { getPlayerStanding } from "../standings/api";
import { getPlayerMatches, getTeamsMap } from "../matches/api";
import { MatchList } from "../matches/MatchList";
import { Skeleton } from "../../components/Skeleton";
import { Avatar } from "../../components/Avatar";
import { FormChips } from "../../components/FormChips";
import { recentForm, winRate, winStreak, bestPartner } from "../../lib/results";
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

  if (profile.loading)
    return (
      <div className="card">
        <Skeleton rows={4} />
      </div>
    );
  if (!profile.data)
    return <p className="msg msg--error">Speler niet gevonden.</p>;

  const p = profile.data;
  const s = standing.data;
  const tmap = teams.data ?? {};
  const pmap = profiles.data ?? {};
  const mlist = matches.data ?? [];

  const form = recentForm(mlist, tmap, id);
  const streak = winStreak(mlist, tmap, id);
  const rate = s ? winRate(s.won, s.played) : null;
  const partner = bestPartner(mlist, tmap, id);

  return (
    <div>
      <header className="page-head">
        <Link className="btn btn--sm" to="/vrienden">
          ← Vrienden
        </Link>
      </header>

      <section className="card profile-hero">
        <Avatar profile={p} size={72} />
        <div className="profile-hero__body">
          <h1 className="profile-hero__name">
            {displayName(p)}
            {isMe && <span className="badge badge--accent">jij</span>}
            {streak >= 2 && (
              <span className="badge badge--win">{streak} op rij 🔥</span>
            )}
          </h1>
          <p className="profile-hero__handle">@{p.username}</p>
          {form.length > 0 && (
            <div className="profile-hero__form">
              <span className="profile-hero__form-label">Vorm</span>
              <FormChips form={form} />
            </div>
          )}
        </div>
      </section>

      <div className="stats">
        <Stat label="Punten" value={s?.points ?? 0} />
        <Stat label="Gespeeld" value={s?.played ?? 0} />
        <Stat label="Winrate" value={rate != null ? `${rate}%` : "—"} />
        <Stat label="Verloren" value={s?.lost ?? 0} />
      </div>

      {partner && (
        <section className="card partner-card">
          <h2 className="card__title">Beste maatje</h2>
          <div className="partner-card__row">
            <Avatar profile={pmap[partner.partnerId]} size={40} />
            <div>
              <Link
                className="profile-link"
                to={`/spelers/${partner.partnerId}`}
              >
                {displayName(pmap[partner.partnerId])}
              </Link>
              <p className="partner-card__sub">
                Samen {partner.played} match{partner.played === 1 ? "" : "es"}{" "}
                gespeeld, {partner.wins} gewonnen.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="card__title">Recente matches</h2>
        {matches.loading && <Skeleton rows={3} />}
        {matches.error && <p className="msg msg--error">{matches.error}</p>}
        {!matches.loading && (
          <MatchList
            matches={mlist}
            teams={tmap}
            profiles={pmap}
            perspectiveId={id}
            empty="Deze speler heeft nog geen matches gespeeld."
          />
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

export default PlayerProfile;
