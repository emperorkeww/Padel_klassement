import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useRefetchOnFocus } from "../../lib/useRefetchOnFocus";
import { useToast } from "../../components/ToastProvider";
import { MatchListSkeleton, Skeleton, StatsSkeleton } from "../../components/Skeleton";
import { Avatar } from "../../components/Avatar";
import { FormChips } from "../../components/FormChips";
import { CountUp } from "../../components/CountUp";
import { recentForm, winRate, winStreak, lossStreak, headToHead } from "../../lib/results";
import { rankShifts, type Shift } from "../../lib/rankShift";
import { deriveBadges, type Badge } from "../../lib/badges";
import { RatingChart } from "../../components/RatingChart";
import { getPlayerStandings } from "../standings/api";
import { getPlayerRatings, getRatingHistory } from "../standings/ratingsApi";
import {
  getRecentResults,
  getPlayerMatches,
  getTeamsMap,
  teamLabel,
} from "../matches/api";
import { eveningSummary } from "../../lib/eveningSummary";
import { ShareEvening } from "../groups/ShareEvening";
import { getMyFriendships, categorize } from "../friends/api";
import { getProfilesMap, displayName } from "../profiles/api";
import { getMyGroups, type GroupSummary } from "../groups/api";
import { getAttendance, type Attendance } from "../groups/attendanceApi";
import { MatchList } from "../matches/MatchList";
import { PlannedMatchCard } from "../matches/PlannedMatchCard";
import {
  getClubAvailability,
  nextFreeSlot,
  type NextFreeSlot,
} from "../availability/api";
import { useClub } from "../availability/club";
import { Timetable } from "../availability/Timetable";
import { dateInZone, minutesNowInZone } from "../../lib/time";
import {
  pushSupported,
  enablePush,
  getPushSubscription,
} from "../../lib/push";
import { errorMessage } from "../../lib/errors";
import type { Match, Team } from "../../lib/types";
import "./Dashboard.css";

export function Dashboard() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const standings = useAsync(getPlayerStandings, []);
  // Ruime venster van gespeelde uitslagen: voedt zowel de recente-lijst als de
  // rangverschuiving (die de hele laatste speeldag nodig heeft) en de
  // avondsamenvatting.
  const results = useAsync(() => getRecentResults(80), []);
  const myMatches = useAsync(
    () => (myId ? getPlayerMatches(myId, 100) : Promise.resolve([])),
    [myId],
  );
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getProfilesMap, []);
  const friendships = useAsync(getMyFriendships, []);
  const groups = useAsync(getMyGroups, []);
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

  // Aanwezigheid van vandaag per eigen groep; hangt af van welke groepen we al
  // kennen, dus opnieuw ophalen zodra die lijst binnen is.
  const groupKey = (groups.data ?? []).map((g) => g.id).join(",");
  const attendance = useAsync(
    () => loadTodayAttendance(groups.data ?? [], today),
    [groupKey, today],
  );

  const onMatches = useCallback(() => {
    standings.reload();
    results.reload();
    myMatches.reload();
    teams.reload();
    ratings.reload();
    ratingHistory.reload();
    // reload-functies zijn stabiel; bewust niet de hele async-objecten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standings.reload, results.reload, myMatches.reload, teams.reload, ratings.reload, ratingHistory.reload]);
  useRealtime("matches", onMatches);
  useRealtime("friendships", friendships.reload);
  useRealtime("attendance", attendance.reload);

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

  const myGames = myMatches.data ?? [];
  const form = recentForm(myGames, tmap, myId);
  const streak = winStreak(myGames, tmap, myId);
  // Verliesreeks (alleen relevant zonder lopende winstreak) voor een
  // neutraal-motiverende hero-boodschap.
  const losing = lossStreak(myGames, tmap, myId);
  const rate = me ? winRate(me.won, me.played) : null;
  const myRating = ratings.data?.[myId]?.rating ?? null;
  const rhist = ratingHistory.data ?? [];

  // Alleen echt gespeelde matches: de RPC-filter dekt dit al, maar client-side
  // filteren houdt afgeleide weergaven robuust (o.a. in tests).
  const completed = (results.data ?? []).filter((m) => m.status === "completed");
  const recentResults = completed.slice(0, 6);

  // Rangverschuiving t.o.v. vóór de laatste speeldag.
  const myShift = rankShifts(rows, completed, tmap).get(myId) ?? null;

  // Prestatiebadges (afgeleid, geen extra query): behaalde voor de hero, plus
  // de dichtstbijzijnde onbehaalde met voortgang als aanmoediging.
  const allBadges = deriveBadges(myGames, tmap, myId, ratings.data ?? undefined);
  const earnedBadges = allBadges.filter((b) => b.behaald);
  const nextBadge =
    allBadges
      .filter(
        (b) => !b.behaald && b.voortgang && b.voortgang.doel > 0 && b.voortgang.nu > 0,
      )
      .sort(
        (a, b) =>
          b.voortgang!.nu / b.voortgang!.doel -
          a.voortgang!.nu / a.voortgang!.doel,
      )[0] ?? null;

  // Vaste tegenstander: tegen wie speelde ik het vaakst (min. 3 duels)?
  const rival = pickRival(myGames, tmap, myId);

  // Aanwezigheid vandaag: de groep met de meeste ja-stemmen.
  const attendancePick = pickAttendance(attendance.data ?? [], myId);

  // Speelavond-terugblik: uitslagen van de laatste speeldag (vandaag/gisteren).
  const evening = deriveEvening(completed, club.timezone);
  const eveningGroup = evening
    ? (groups.data ?? []).find((g) => g.id === evening.groupId)
    : null;
  // Echte avondstand (top-spelers + beste duo) voor de speelavond-kaart.
  const eveningMatches = evening
    ? completed.filter((m) => m.group_id === evening.groupId)
    : [];
  const eveningSum = evening ? eveningSummary(eveningMatches, tmap, evening.day) : null;
  const eveningMedals = ["🥇", "🥈", "🥉"];

  // Eerstvolgende vrije baan bij de club (vandaag).
  const nextFree = availability.data
    ? nextFreeSlot(availability.data, null, minutesNowInZone(club.timezone))
    : null;

  // Onboarding: pas beslissen als de bronnen binnen zijn, zodat de checklist
  // niet even flitst voor een bestaande speler.
  const [onbDismissed, setOnbDismissed] = useState(() => readFlag("onboarding-dismissed"));
  const hasFriend = accepted.length > 0;
  const hasGroup = (groups.data ?? []).length > 0;
  const hasPlayed = (me?.played ?? 0) > 0;
  const coreLoading = standings.loading || friendships.loading || groups.loading;
  const showOnboarding =
    !coreLoading && !onbDismissed && !(hasFriend && hasGroup && hasPlayed);
  function dismissOnboarding() {
    setOnbDismissed(true);
    writeFlag("onboarding-dismissed");
  }

  // Geplande matches waarin ik meedoe: de laagste ronde eerst — dat is de
  // eerstvolgende match om te spelen (en de uitslag van in te vullen).
  const planned = myGames
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
                {streak >= 2
                  ? ` Je hebt er ${streak} op rij gewonnen — vamos! 🔥`
                  : losing >= 3
                    ? ` Even ${losing} op rij verloren — de volgende pak je terug. 💪`
                    : ""}
              </p>
            )}
            {form.length > 0 && (
              <Link className="hero__form" to={`/spelers/${myId}`}>
                <span className="hero__form-label">Vorm</span>
                <FormChips form={form} />
              </Link>
            )}
            {earnedBadges.length > 0 && (
              <BadgeStrip badges={earnedBadges} to={`/spelers/${myId}`} />
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

      {showOnboarding && (
        <section className="card onboard">
          <div className="card__head">
            <h2 className="card__title">Zo kom je op gang</h2>
            <button
              className="onboard__dismiss"
              onClick={dismissOnboarding}
              aria-label="Verberg deze checklist"
            >
              ✕
            </button>
          </div>
          <ul className="onboard__list">
            <OnboardStep
              done={hasFriend}
              to="/vrienden"
              label="Voeg een vriend toe"
              hint="Zoek een speler op gebruikersnaam en stuur een verzoek."
            />
            <OnboardStep
              done={hasGroup}
              to="/groepen"
              label="Maak of kies een groep"
              hint="Een groep speelt samen rondes en houdt een stand bij."
            />
            <OnboardStep
              done={hasPlayed}
              to="/matches"
              label="Speel je eerste match"
              hint="Log een uitslag of genereer een ronde in je groep."
            />
          </ul>
        </section>
      )}

      {(planned.length > 0 || incoming.length > 0 || attendancePick) && (
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
          {attendancePick && (
            <Link
              className="todo-chip todo-chip--play"
              to={`/groepen/${attendancePick.group.id}`}
            >
              <span className="todo-chip__count">{attendancePick.yes}</span>
              {attendancePick.mine
                ? `spelen mee · ${attendancePick.group.name}`
                : `spelen mee — jij nog niet · ${attendancePick.group.name}`}
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

      {evening && eveningGroup && eveningSum && (
        <section className="card card--evening">
          <div className="card__head">
            <h2 className="card__title">
              Speelavond {evening.isToday ? "vandaag" : "gisteren"}
            </h2>
            <Link className="profile-link" to={`/groepen/${evening.groupId}`}>
              Bekijk →
            </Link>
          </div>
          <p className="evening__sub">
            <strong>{eveningGroup.name}</strong>
            <span className="evening__dot" aria-hidden="true">
              ·
            </span>
            {evening.count} {evening.count === 1 ? "uitslag" : "uitslagen"}
          </p>

          {eveningSum.rows.length > 0 && (
            <ol className="evening-podium">
              {eveningSum.rows.slice(0, 3).map((row, i) => (
                <li key={row.playerId} className="evening-podium__row">
                  <span
                    className="evening-podium__rank"
                    data-rank={i + 1}
                    aria-label={`${i + 1}e`}
                  >
                    {eveningMedals[i]}
                  </span>
                  <Avatar profile={pmap[row.playerId]} size={30} />
                  <span className="evening-podium__name">
                    {displayName(pmap[row.playerId])}
                  </span>
                  <span className="evening-podium__form" aria-hidden="true">
                    <span className="evening-podium__wl">{row.won}W</span>
                    {row.drawn > 0 && (
                      <span className="evening-podium__wl">{row.drawn}G</span>
                    )}
                    <span className="evening-podium__wl">{row.lost}V</span>
                  </span>
                  <span className="evening-podium__pts">
                    <strong>{row.points}</strong> ptn
                  </span>
                </li>
              ))}
            </ol>
          )}

          {eveningSum.bestDuo && (
            <p className="evening__duo">
              <span aria-hidden="true">🏆</span> Beste duo:{" "}
              <strong>{teamLabel(tmap[eveningSum.bestDuo.teamId], pmap)}</strong>{" "}
              ({eveningSum.bestDuo.won} winst
              {eveningSum.bestDuo.won === 1 ? "" : "en"})
            </p>
          )}

          {evening.isToday && (
            <div className="evening__actions">
              <ShareEvening
                groupName={eveningGroup.name}
                matches={eveningMatches}
                teams={tmap}
                profiles={pmap}
              />
            </div>
          )}
        </section>
      )}

      {standings.loading ? (
        <StatsSkeleton />
      ) : (
        <div className="stats">
          <Stat label="Punten" value={me?.points ?? 0} accent />
          <Stat
            label="Positie"
            value={rank ? `#${rank}` : "—"}
            delta={<ShiftDelta shift={myShift} />}
          />
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
          {results.loading ? (
            <MatchListSkeleton count={4} />
          ) : (
            <MatchList
              matches={recentResults}
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

          {nextBadge && nextBadge.voortgang && (
            <section className="card next-badge">
              <div className="card__head">
                <h2 className="card__title">Volgende badge</h2>
                <Link className="profile-link" to={`/spelers/${myId}`}>
                  Alle badges →
                </Link>
              </div>
              <p className="next-badge__tally">
                {earnedBadges.length} van {allBadges.length} badges behaald
              </p>
              <div className="next-badge__row">
                <span className="next-badge__emoji" aria-hidden="true">
                  {nextBadge.emoji}
                </span>
                <span className="next-badge__body">
                  <span className="next-badge__name">{nextBadge.naam}</span>
                  <span className="next-badge__hint">{nextBadge.omschrijving}</span>
                </span>
                <span
                  className="next-badge__count"
                  title={`Voortgang voor deze badge: ${nextBadge.voortgang.nu} van ${nextBadge.voortgang.doel}`}
                >
                  {nextBadge.voortgang.nu}/{nextBadge.voortgang.doel}
                </span>
              </div>
              <div
                className="next-badge__bar"
                role="progressbar"
                aria-valuenow={nextBadge.voortgang.nu}
                aria-valuemin={0}
                aria-valuemax={nextBadge.voortgang.doel}
              >
                <span
                  className="next-badge__fill"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (nextBadge.voortgang.nu / nextBadge.voortgang.doel) * 100,
                      ),
                    )}%`,
                  }}
                />
              </div>
            </section>
          )}

          {rival && (
            <section className="card rival-card">
              <div className="card__head">
                <h2 className="card__title">Jouw rivaal</h2>
                <Link className="profile-link" to={`/spelers/${rival.oppId}`}>
                  Profiel →
                </Link>
              </div>
              <div className="rival">
                <Avatar profile={pmap[rival.oppId]} size={40} />
                <span className="rival__body">
                  <Link
                    className="profile-link rival__name"
                    to={`/spelers/${rival.oppId}`}
                  >
                    {displayName(pmap[rival.oppId])}
                  </Link>
                  <span className="rival__meta">
                    {rival.rec.played} duels · {rival.rec.won}–{rival.rec.lost}
                    {rival.rec.drawn > 0 && ` · ${rival.rec.drawn} gelijk`}
                  </span>
                </span>
                <span className={`rival__verdict rival__verdict--${rivalVerdict(rival.rec)}`}>
                  {rivalVerdictLabel(rival.rec)}
                </span>
              </div>
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

      <PushPrompt userId={myId} />

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
          <>
            <NextFreeLine slot={nextFree} />
            <Timetable data={availability.data} date={today} fromNow />
          </>
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

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* privémodus — dan geldt de keuze alleen voor deze sessie */
  }
}

/** Aanwezigheid van vandaag per eigen groep, parallel opgehaald. */
async function loadTodayAttendance(
  groups: GroupSummary[],
  date: string,
): Promise<{ group: GroupSummary; att: Attendance[] }[]> {
  if (groups.length === 0) return [];
  return Promise.all(
    groups.map((group) =>
      getAttendance(group.id, date).then((att) => ({ group, att })),
    ),
  );
}

type AttendancePick = {
  group: GroupSummary;
  yes: number;
  mine: boolean;
};

/** Groep met de meeste ja-stemmen vandaag; null als niemand ja zei. */
function pickAttendance(
  rows: { group: GroupSummary; att: Attendance[] }[],
  myId: string,
): AttendancePick | null {
  const scored = rows
    .map(({ group, att }) => ({
      group,
      yes: att.filter((a) => a.status === "yes").length,
      mine: att.some((a) => a.player_id === myId),
    }))
    .filter((x) => x.yes > 0)
    .sort((a, b) => b.yes - a.yes);
  return scored[0] ?? null;
}

type RivalRec = { won: number; drawn: number; lost: number; played: number };

/** Tegenstander met de meeste onderlinge duels (min. 3), of null. */
function pickRival(
  matches: Match[],
  teams: Record<string, Team>,
  myId: string,
): { oppId: string; rec: RivalRec } | null {
  let best: { oppId: string; rec: RivalRec } | null = null;
  for (const [oppId, rec] of headToHead(matches, teams, myId)) {
    if (rec.played < 3) continue;
    if (!best || rec.played > best.rec.played) best = { oppId, rec };
  }
  return best;
}

function rivalVerdict(rec: RivalRec): "lead" | "trail" | "even" {
  if (rec.won > rec.lost) return "lead";
  if (rec.won < rec.lost) return "trail";
  return "even";
}

function rivalVerdictLabel(rec: RivalRec): string {
  const v = rivalVerdict(rec);
  return v === "lead" ? "jij leidt" : v === "trail" ? "jij volgt" : "gelijk";
}

/** Uitslagen van de laatste speeldag als die vandaag of gisteren was. */
function deriveEvening(
  completed: Match[],
  timezone: string,
): { groupId: string; count: number; isToday: boolean; day: string } | null {
  const withGroup = completed.filter((m) => m.group_id);
  if (withGroup.length === 0) return null;
  const day = (m: Match) => (m.played_at ?? m.created_at).slice(0, 10);
  const latest = withGroup.map(day).sort().at(-1)!;
  const todayStr = dateInZone(timezone);
  const yesterdayStr = dateInZone(timezone, -1);
  if (latest !== todayStr && latest !== yesterdayStr) return null;

  const dayMatches = withGroup.filter((m) => day(m) === latest);
  const perGroup = new Map<string, number>();
  for (const m of dayMatches) {
    perGroup.set(m.group_id!, (perGroup.get(m.group_id!) ?? 0) + 1);
  }
  const [groupId, count] = [...perGroup.entries()].sort((a, b) => b[1] - a[1])[0];
  return { groupId, count, isToday: latest === todayStr, day: latest };
}

/** Behaalde badges als emoji-rij in de hero. Tikken (of hoveren/focussen)
 *  toont de naam + uitleg in één gedeelde tooltip die links van de rij is
 *  verankerd, zodat de `overflow: hidden` van de hero hem niet afknipt.
 *  De badges zelf navigeren bewust niet (op touch bestaat hover niet, dus
 *  een tik moet de uitleg tonen); de collectie zit achter de pijl-link. */
function BadgeStrip({ badges, to }: { badges: Badge[]; to: string }) {
  const [active, setActive] = useState<Badge | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const shown = badges.slice(0, 6);
  const rest = badges.length - shown.length;
  const clear = (b: Badge) => setActive((cur) => (cur === b ? null : cur));

  // Tik buiten de rij sluit de tooltip (touch kent geen mouseleave).
  useEffect(() => {
    if (!active) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setActive(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [active]);

  return (
    <div
      ref={wrapRef}
      className="hero__badges-wrap"
      onMouseLeave={() => setActive(null)}
    >
      <div
        className="hero__badges"
        role="group"
        aria-label={`Behaalde badges: ${badges.map((b) => b.naam).join(", ")}`}
      >
        {shown.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`hero__badge ${active === b ? "is-active" : ""}`}
            onClick={() => setActive((cur) => (cur === b ? null : b))}
            onMouseEnter={() => setActive(b)}
            onFocus={() => setActive(b)}
            onBlur={() => clear(b)}
            aria-label={`${b.naam}: ${b.omschrijving}`}
            aria-expanded={active === b}
          >
            {b.emoji}
          </button>
        ))}
        <Link
          className="hero__badges-more"
          to={to}
          aria-label="Alle badges bekijken"
        >
          {rest > 0 ? `+${rest}` : "→"}
        </Link>
      </div>
      {active && (
        <span className="hero__badge-tip" role="tooltip">
          <span className="hero__badge-tip-name">
            {active.emoji} {active.naam}
          </span>
          <span className="hero__badge-tip-desc">{active.omschrijving}</span>
        </span>
      )}
    </div>
  );
}

function ShiftDelta({ shift }: { shift: Shift | null }) {
  if (typeof shift !== "number" || shift === 0) return null;
  const up = shift > 0;
  return (
    <span className={`stat__delta ${up ? "is-up" : "is-down"}`}>
      {up ? "▲" : "▼"}
      {Math.abs(shift)}
    </span>
  );
}

function OnboardStep({
  done,
  to,
  label,
  hint,
}: {
  done: boolean;
  to: string;
  label: string;
  hint: string;
}) {
  return (
    <li className={`onboard__item ${done ? "is-done" : ""}`}>
      <span className="onboard__check" aria-hidden="true">
        {done ? "✓" : ""}
      </span>
      <span className="onboard__text">
        <span className="onboard__label">{label}</span>
        <span className="onboard__hint">{hint}</span>
      </span>
      {!done && (
        <Link className="btn btn--sm" to={to}>
          Start
        </Link>
      )}
    </li>
  );
}

function NextFreeLine({ slot }: { slot: NextFreeSlot | null }) {
  if (!slot) return <p className="avail-next">Vandaag niets meer vrij.</p>;
  const extra = slot.courts.length - 1;
  return (
    <p className="avail-next">
      Eerstvolgend vrij:{" "}
      <strong className="avail-next__time">{slot.time}</strong> ·{" "}
      {slot.courts[0].name}
      {extra > 0 &&
        ` (+${extra} ${extra === 1 ? "andere baan" : "andere banen"})`}
    </p>
  );
}

/** Eenmalige, wegklikbare uitnodiging om pushmeldingen aan te zetten. Toont
 *  niets als push niet ondersteund wordt, al aan staat, of eerder geweigerd/
 *  weggeklikt is. */
function PushPrompt({ userId }: { userId: string }) {
  const toast = useToast();
  const supported = pushSupported();
  const [dismissed, setDismissed] = useState(() => readFlag("push-prompt-dismissed"));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // null = nog aan het controleren; false = geen abonnement; true = al aan.
  const [alreadyOn, setAlreadyOn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supported) return;
    getPushSubscription()
      .then((sub) => setAlreadyOn(!!sub))
      .catch(() => setAlreadyOn(false));
  }, [supported]);

  const permission =
    supported && typeof Notification !== "undefined"
      ? Notification.permission
      : "denied";

  if (
    !supported ||
    dismissed ||
    done ||
    alreadyOn !== false ||
    permission !== "default"
  ) {
    return null;
  }

  async function enable() {
    setBusy(true);
    try {
      await enablePush(userId);
      toast.success("Meldingen staan aan — vamos!");
      setDone(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setDismissed(true);
    writeFlag("push-prompt-dismissed");
  }

  return (
    <section className="card push-prompt">
      <div className="push-prompt__body">
        <span className="push-prompt__icon" aria-hidden="true">
          🔔
        </span>
        <div>
          <h2 className="card__title card__title--tight">Blijf op de hoogte</h2>
          <p className="card__subtitle push-prompt__sub">
            Krijg een seintje bij nieuwe rondes, uitslagen van jouw matches en
            vriendschapsverzoeken — ook als de app dicht is.
          </p>
        </div>
      </div>
      <div className="push-prompt__actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={enable}
          disabled={busy}
        >
          {busy ? "Aanzetten…" : "Meldingen aanzetten"}
        </button>
        <button className="btn btn--sm" onClick={dismiss}>
          Niet nu
        </button>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
  delta,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  delta?: ReactNode;
}) {
  return (
    <div className={`stat ${accent ? "stat--accent" : ""}`}>
      <span className="stat__value">
        {typeof value === "number" ? <CountUp value={value} /> : value}
        {delta}
      </span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

export default Dashboard;
