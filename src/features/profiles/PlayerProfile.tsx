import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { getProfile, displayName } from "./api";
import { getProfilesMap } from "./api";
import { getPlayerStanding } from "../standings/api";
import { getPlayerRatings, getRatingHistory } from "../standings/ratingsApi";
import { getPlayerMatches, getTeamsMap } from "../matches/api";
import { MatchList } from "../matches/MatchList";
import { Skeleton } from "../../components/Skeleton";
import { Avatar } from "../../components/Avatar";
import { FormChips } from "../../components/FormChips";
import { CountUp } from "../../components/CountUp";
import { RatingChart } from "../../components/RatingChart";
import {
  recentForm,
  winRate,
  winStreak,
  longestStreak,
  biggestWin,
  bestPartner,
  headToHead,
} from "../../lib/results";
import { deriveBadges } from "../../lib/badges";
import { formatDate } from "../../lib/format";
import "./PlayerProfile.css";

// Aantal recente matches dat we op het profiel tonen (de volledige historie
// wordt geladen voor de statistieken, maar niet allemaal uitgelijst).
const RECENT_SHOWN = 8;

export function PlayerProfile() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const isMe = user?.id === id;

  const profile = useAsync(() => getProfile(id), [id]);
  const standing = useAsync(() => getPlayerStanding(id), [id]);
  // Ruime limiet: streak/H2H/grootste zege rekenen op de volledige historie.
  const matches = useAsync(() => getPlayerMatches(id, 200), [id]);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getProfilesMap, []);
  const ratings = useAsync(getPlayerRatings, []);
  const ratingHistory = useAsync(() => getRatingHistory(id), [id]);

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
  const best = longestStreak(mlist, tmap, id);
  const bigWin = biggestWin(mlist, tmap, id);
  const rate = s ? winRate(s.won, s.played) : null;
  const partner = bestPartner(mlist, tmap, id);
  const myRating = ratings.data?.[id]?.rating ?? null;
  const rhist = ratingHistory.data ?? [];
  const badges = deriveBadges(mlist, tmap, id, ratings.data ?? undefined);

  // Onderlinge stand, gesorteerd op aantal duels (meest gespeeld eerst).
  const h2h = [...headToHead(mlist, tmap, id).entries()]
    .map(([oppId, rec]) => ({ oppId, ...rec }))
    .sort((a, b) => b.played - a.played);

  return (
    <div>
      <header className="page-head">
        <Link className="btn btn--sm" to="/vrienden">
          ← Vrienden
        </Link>
      </header>

      <section className="card profile-hero">
        {/* Zelfde view-transition-naam als de aangetikte klassement-avatar:
            de foto groeit vloeiend door naar deze grote variant. */}
        <span style={{ viewTransitionName: "player-avatar", display: "inline-flex" }}>
          <Avatar profile={p} size={72} />
        </span>
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
        <Stat
          label="Rating"
          value={myRating ?? "—"}
          delta={rhist.length > 0 ? rhist[rhist.length - 1].delta : null}
        />
        <Stat label="Punten" value={s?.points ?? 0} />
        <Stat label="Winrate" value={rate != null ? `${rate}%` : "—"} />
        <Stat label="Gespeeld" value={s?.played ?? 0} />
      </div>

      {rhist.length >= 2 && (
        <section className="card">
          <h2 className="card__title">Rating-verloop</h2>
          <RatingChart history={rhist} />
        </section>
      )}

      {(best > 0 || bigWin) && (
        <section className="card">
          <h2 className="card__title">Prestaties</h2>
          <div className="achievements">
            {best > 0 && (
              <div className="achievement">
                <span className="achievement__icon">🔥</span>
                <div>
                  <span className="achievement__value">{best}</span>
                  <span className="achievement__label">Langste winreeks</span>
                </div>
              </div>
            )}
            {bigWin && (
              <Link
                className="achievement achievement--link"
                to={`/matches/${bigWin.match.id}`}
              >
                <span className="achievement__icon">🏆</span>
                <div>
                  <span className="achievement__value">
                    {bigWin.match.score_a}–{bigWin.match.score_b}
                  </span>
                  <span className="achievement__label">
                    Grootste zege · {formatDate(bigWin.match.played_at ?? bigWin.match.created_at)}
                  </span>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      {mlist.length > 0 && (
        <section className="card">
          <h2 className="card__title">Badges</h2>
          <ul className="badges">
            {badges.map((b) => (
              <li key={b.id} className="badges__item" title={b.omschrijving}>
                <span
                  className={`badge badges__pill${b.behaald ? " badge--accent" : " badges__pill--dim"}`}
                >
                  <span className="badges__emoji" aria-hidden="true">
                    {b.emoji}
                  </span>
                  {b.naam}
                  {!b.behaald && b.voortgang && (
                    <span className="badges__progress">
                      {b.voortgang.nu}/{b.voortgang.doel}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {h2h.length > 0 && (
        <section className="card">
          <h2 className="card__title">Onderlinge stand</h2>
          <ul className="h2h">
            {h2h.map((row) => (
              <li key={row.oppId} className="h2h__row">
                <Link className="h2h__player" to={`/spelers/${row.oppId}`}>
                  <Avatar profile={pmap[row.oppId]} size={28} />
                  <span className="h2h__name">{displayName(pmap[row.oppId])}</span>
                </Link>
                <span className="h2h__record">
                  <span className="h2h__w">{row.won}</span>
                  <span className="h2h__sep">–</span>
                  {row.drawn > 0 && (
                    <>
                      <span className="h2h__d">{row.drawn}</span>
                      <span className="h2h__sep">–</span>
                    </>
                  )}
                  <span className="h2h__l">{row.lost}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="card__title">Recente matches</h2>
        {matches.loading && <Skeleton rows={3} />}
        {matches.error && <p className="msg msg--error">{matches.error}</p>}
        {!matches.loading && (
          <MatchList
            matches={mlist.slice(0, RECENT_SHOWN)}
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

function Stat({
  label,
  value,
  delta,
}: {
  label: string;
  value: number | string;
  delta?: number | null;
}) {
  return (
    <div className="stat">
      <span className="stat__value">
        {typeof value === "number" ? <CountUp value={value} /> : value}
        {delta != null && delta !== 0 && (
          <span className={`stat__delta ${delta > 0 ? "is-up" : "is-down"}`}>
            {delta > 0 ? "▲" : "▼"}
            {Math.abs(delta)}
          </span>
        )}
      </span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

export default PlayerProfile;
