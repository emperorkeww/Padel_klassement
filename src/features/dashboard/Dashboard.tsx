import { useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useRefetchOnFocus } from "../../lib/useRefetchOnFocus";
import { Skeleton } from "../../components/Skeleton";
import { Avatar } from "../../components/Avatar";
import { FormChips } from "../../components/FormChips";
import { recentForm, winRate, winStreak } from "../../lib/results";
import { getPlayerStandings } from "../standings/api";
import { getRecentMatches, getPlayerMatches, getTeamsMap } from "../matches/api";
import { getMyFriendships, categorize } from "../friends/api";
import { getProfilesMap, displayName } from "../profiles/api";
import { MatchList } from "../matches/MatchList";
import { getClubAvailability } from "../availability/api";
import { Timetable, localDate } from "../availability/Timetable";
import "./Dashboard.css";

export function Dashboard() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const standings = useAsync(getPlayerStandings, []);
  const matches = useAsync(() => getRecentMatches(6), []);
  const myMatches = useAsync(
    () => (myId ? getPlayerMatches(myId, 15) : Promise.resolve([])),
    [myId],
  );
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getProfilesMap, []);
  const friendships = useAsync(getMyFriendships, []);

  const today = localDate(0);
  const availability = useAsync(() => getClubAvailability(today), [today]);
  // Ververs de beschikbaarheid zodra de gebruiker terugkeert naar het tabblad.
  useRefetchOnFocus(availability.reload);

  const onMatches = useCallback(() => {
    standings.reload();
    matches.reload();
    myMatches.reload();
    teams.reload();
    // reload-functies zijn stabiel; bewust niet de hele async-objecten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standings.reload, matches.reload, myMatches.reload, teams.reload]);
  useRealtime("matches", onMatches);
  useRealtime("friendships", friendships.reload);

  const pmap = profiles.data ?? {};
  const tmap = teams.data ?? {};
  const rows = standings.data ?? [];
  const me = rows.find((p) => p.player_id === myId);
  const rankIdx = rows.findIndex((p) => p.player_id === myId);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;
  const { incoming, accepted } = categorize(friendships.data ?? [], myId);
  const myProfile = pmap[myId];
  // Naam direct tonen zonder e-mail-flits: zolang de profielen laden valt de
  // begroeting terug op de gecachete naam van een eerder bezoek.
  const myName = myProfile
    ? displayName(myProfile)
    : (cachedName(myId) ?? (profiles.loading ? "" : (user?.email ?? "speler")));
  useEffect(() => {
    if (myProfile) rememberName(myId, displayName(myProfile));
  }, [myProfile, myId]);
  const top = rows.slice(0, 3);

  const form = recentForm(myMatches.data ?? [], tmap, myId);
  const streak = winStreak(myMatches.data ?? [], tmap, myId);
  const rate = me ? winRate(me.won, me.played) : null;

  return (
    <div>
      <section className="hero">
        <div className="hero__main">
          <Avatar profile={myProfile} name={myName || undefined} size={56} />
          <div className="hero__text">
            <p className="hero__eyebrow">Welkom terug</p>
            <h1 className="hero__name">{myName ? `Hoi, ${myName}` : "Hoi!"}</h1>
            <p className="hero__sub">
              {me
                ? `Je staat ${rank ? `op plek #${rank}` : "in het klassement"} met ${me.points} punten.`
                : "Speel je eerste match om in het klassement te komen."}
              {streak >= 2 && ` Je hebt er ${streak} op rij gewonnen — vamos! 🔥`}
            </p>
            {form.length > 0 && (
              <p className="hero__form">
                <span className="hero__form-label">Vorm</span>
                <FormChips form={form} />
              </p>
            )}
          </div>
        </div>
        <div className="hero__actions">
          <Link className="btn btn--primary" to="/matches">
            + Match loggen
          </Link>
          <Link className="btn" to="/banen">
            Vrije banen
          </Link>
        </div>
      </section>

      <div className="stats">
        <Stat label="Punten" value={me?.points ?? 0} accent />
        <Stat label="Positie" value={rank ? `#${rank}` : "—"} />
        <Stat label="Winrate" value={rate != null ? `${rate}%` : "—"} />
        <Stat label="Gespeeld" value={me?.played ?? 0} />
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
            <Skeleton rows={4} />
          ) : (
            <MatchList
              matches={matches.data ?? []}
              teams={tmap}
              profiles={pmap}
              perspectiveId={myId}
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
                    <span className={`toplist__rank toplist__rank--${i + 1}`}>
                      {i + 1}
                    </span>
                    <Avatar profile={pmap[p.player_id] ?? p} size={28} />
                    <Link
                      className="profile-link toplist__name"
                      to={`/spelers/${p.player_id}`}
                    >
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

      <section className="card" style={{ marginTop: "1.25rem" }}>
        <div className="row-between" style={{ marginBottom: "1rem" }}>
          <h2 className="card__title" style={{ margin: 0 }}>
            Baanbeschikbaarheid vandaag
          </h2>
          <Link className="profile-link" to="/banen">
            Alle dagen →
          </Link>
        </div>
        {availability.loading ? (
          <Skeleton rows={3} />
        ) : availability.error ? (
          <p className="msg msg--error">{availability.error}</p>
        ) : availability.data ? (
          <Timetable data={availability.data} date={today} />
        ) : null}
      </section>
    </div>
  );
}

/* Laatst bekende weergavenaam per gebruiker, zodat de begroeting bij een
   volgend bezoek meteen klopt (geen flits van het e-mailadres). */
function cachedName(userId: string): string | null {
  try {
    return localStorage.getItem(`display-name:${userId}`);
  } catch {
    return null;
  }
}

function rememberName(userId: string, name: string) {
  try {
    localStorage.setItem(`display-name:${userId}`, name);
  } catch {
    /* opslag niet beschikbaar (privémodus) — geen probleem */
  }
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