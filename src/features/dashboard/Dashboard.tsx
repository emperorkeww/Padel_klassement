import { useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useRefetchOnFocus } from "../../lib/useRefetchOnFocus";
import { MatchListSkeleton, Skeleton, StatsSkeleton } from "../../components/Skeleton";
import { Avatar } from "../../components/Avatar";
import { FormChips } from "../../components/FormChips";
import { CountUp } from "../../components/CountUp";
import { recentForm, winRate, winStreak } from "../../lib/results";
import { RatingChart } from "../../components/RatingChart";
import { getPlayerStandings } from "../standings/api";
import { getPlayerRatings, getRatingHistory } from "../standings/ratingsApi";
import { getRecentResults, getPlayerMatches, getTeamsMap } from "../matches/api";
import { getMyFriendships, categorize } from "../friends/api";
import { getProfilesMap, displayName } from "../profiles/api";
import { MatchList } from "../matches/MatchList";
import { PlannedMatchCard } from "../matches/PlannedMatchCard";
import { getClubAvailability } from "../availability/api";
import { useClub } from "../availability/club";
import { Timetable } from "../availability/Timetable";
import { dateInZone } from "../../lib/time";
import "./Dashboard.css";

export function Dashboard() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const standings = useAsync(getPlayerStandings, []);
  // Alleen gespeelde uitslagen: geplande matches staan al in de actiestrook
  // en bij "Jouw volgende match" — die hier herhalen is ruis.
  const matches = useAsync(() => getRecentResults(6), []);
  const myMatches = useAsync(
    () => (myId ? getPlayerMatches(myId, 30) : Promise.resolve([])),
    [myId],
  );
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getProfilesMap, []);
  const friendships = useAsync(getMyFriendships, []);
  const ratings = useAsync(getPlayerRatings, []);
  const ratingHistory = useAsync(
    () => (myId ? getRatingHistory(myId) : Promise.resolve([])),
    [myId],
  );

  const club = useClub();
  const today = dateInZone(club.timezone);
  const availability = useAsync(() => getClubAvailability(today), [today, club.id]);
  // Ververs de beschikbaarheid zodra de gebruiker terugkeert naar het tabblad.
  useRefetchOnFocus(availability.reload);

  const onMatches = useCallback(() => {
    standings.reload();
    matches.reload();
    myMatches.reload();
    teams.reload();
    ratings.reload();
    ratingHistory.reload();
    // reload-functies zijn stabiel; bewust niet de hele async-objecten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standings.reload, matches.reload, myMatches.reload, teams.reload, ratings.reload, ratingHistory.reload]);
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
  const myRating = ratings.data?.[myId]?.rating ?? null;
  const rhist = ratingHistory.data ?? [];

  // Geplande matches waarin ik meedoe: de laagste ronde eerst — dat is de
  // eerstvolgende match om te spelen (en de uitslag van in te vullen).
  const planned = (myMatches.data ?? [])
    .filter((m) => m.status !== "completed")
    .sort(
      (a, b) =>
        (a.round_number ?? Number.MAX_SAFE_INTEGER) -
          (b.round_number ?? Number.MAX_SAFE_INTEGER) ||
        a.created_at.localeCompare(b.created_at),
    );
  const nextMatch = planned[0] ?? null;
  // Komen alle openstaande uitslagen uit één groep, link dan direct naar de
  // rondes van die groep in plaats van naar de algemene matchespagina.
  const plannedGroupId =
    planned.length > 0 &&
    planned[0].group_id &&
    planned.every((m) => m.group_id === planned[0].group_id)
      ? planned[0].group_id
      : null;

  return (
    <div className="dashboard">
      <section className="hero">
        <div className="hero__main">
          <Avatar profile={myProfile} name={myName || undefined} size={56} />
          <div className="hero__text">
            <p className="hero__eyebrow">Welkom terug</p>
            <h1 className="hero__name">{myName ? `Hoi, ${myName}` : "Hoi!"}</h1>
            {standings.loading ? (
              // Geen "speel je eerste match"-flits terwijl de stand nog laadt.
              <span className="sk sk--line hero__sub-sk" aria-hidden="true" />
            ) : (
              <p className="hero__sub">
                {me
                  ? `Je staat ${rank ? `op plek #${rank}` : "in het klassement"} met ${me.points} punten.`
                  : "Speel je eerste match om in het klassement te komen."}
                {streak >= 2 && ` Je hebt er ${streak} op rij gewonnen — vamos! 🔥`}
              </p>
            )}
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
          <Link className="btn" to="/groepen">
            Rondes genereren
          </Link>
          <Link className="btn" to="/banen">
            Vrije banen
          </Link>
        </div>
      </section>

      {(planned.length > 0 || incoming.length > 0) && (
        <div className="todo-strip">
          {planned.length > 0 && (
            <Link
              className="todo-chip"
              to={plannedGroupId ? `/groepen/${plannedGroupId}` : "/matches"}
            >
              <span className="todo-chip__count">{planned.length}</span>
              {planned.length === 1
                ? "uitslag wacht op jou"
                : "uitslagen wachten op jou"}
            </Link>
          )}
          {incoming.length > 0 && (
            <Link className="todo-chip todo-chip--accent" to="/vrienden">
              <span className="todo-chip__count">{incoming.length}</span>
              {incoming.length === 1
                ? "vriendschapsverzoek"
                : "vriendschapsverzoeken"}
            </Link>
          )}
        </div>
      )}

      {nextMatch && (
        <section className="card card--next">
          <div className="card__head">
            <h2 className="card__title">Jouw volgende match</h2>
            {nextMatch.group_id && (
              <Link className="profile-link" to={`/groepen/${nextMatch.group_id}`}>
                Naar groep →
              </Link>
            )}
          </div>
          <PlannedMatchCard
            match={nextMatch}
            teams={tmap}
            profiles={pmap}
            perspectiveId={myId}
            onSaved={onMatches}
          />
        </section>
      )}

      {standings.loading ? (
        <StatsSkeleton />
      ) : (
        <div className="stats">
          <Stat label="Punten" value={me?.points ?? 0} accent />
          <Stat label="Positie" value={rank ? `#${rank}` : "—"} />
          <Stat label="Winrate" value={rate != null ? `${rate}%` : "—"} />
          <Stat label="Gespeeld" value={me?.played ?? 0} />
        </div>
      )}

      <div className="grid grid--2">
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Recente uitslagen</h2>
            <Link className="profile-link" to="/matches">
              Alles →
            </Link>
          </div>
          {matches.loading ? (
            <MatchListSkeleton count={4} />
          ) : (
            <MatchList
              matches={matches.data ?? []}
              teams={tmap}
              profiles={pmap}
              perspectiveId={myId}
              empty="Nog geen uitslagen — vul een geplande match in of log er een."
            />
          )}
        </section>

        <div className="dashboard__col">
          {/* Rating: groot getal + delta + verloop in één kaart (voorheen een
              stat-tegel én een losse grafiekkaart met dezelfde informatie). */}
          {(ratings.loading || myRating != null || rhist.length >= 2) && (
            <section className="card rating-card">
              <div className="card__head">
                <h2 className="card__title">Rating</h2>
                <Link className="profile-link" to={`/spelers/${myId}`}>
                  Mijn profiel →
                </Link>
              </div>
              {ratings.loading ? (
                <span className="sk sk--line rating-card__sk" aria-hidden="true" />
              ) : (
                <p className="rating-card__value">
                  {myRating != null ? <CountUp value={myRating} /> : "—"}
                  {rhist.length > 0 && rhist[rhist.length - 1].delta !== 0 && (
                    <span
                      className={`stat__delta ${rhist[rhist.length - 1].delta > 0 ? "is-up" : "is-down"}`}
                    >
                      {rhist[rhist.length - 1].delta > 0 ? "▲" : "▼"}
                      {Math.abs(rhist[rhist.length - 1].delta)}
                    </span>
                  )}
                </p>
              )}
              {rhist.length >= 2 ? (
                <RatingChart history={rhist} />
              ) : (
                !ratings.loading && (
                  <p className="empty empty--bare">
                    Speel meer matches om hier je ratingverloop te zien.
                  </p>
                )
              )}
            </section>
          )}

          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Topspelers</h2>
              <Link className="profile-link" to="/klassement">
                Klassement →
              </Link>
            </div>
            {top.length === 0 ? (
              <p className="empty">Nog geen klassement.</p>
            ) : (
              <ul className="toplist">
                {top.map((p, i) => (
                  <li
                    key={p.player_id}
                    className={`toplist__item ${p.player_id === myId ? "is-me" : ""}`}
                  >
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

            {/* Compacte sociale voetregel (voorheen een eigen kaart). */}
            <div className="social-foot">
              <span className="social-foot__item">
                Vrienden <span className="badge">{accepted.length}</span>
              </span>
              <span className="social-foot__item">
                Verzoeken{" "}
                <span className={`badge ${incoming.length ? "badge--accent" : ""}`}>
                  {incoming.length}
                </span>
              </span>
              <Link className="profile-link" to="/vrienden">
                Beheren →
              </Link>
            </div>
          </section>
        </div>
      </div>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Baanbeschikbaarheid vandaag</h2>
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
      <span className="stat__value">
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

export default Dashboard;