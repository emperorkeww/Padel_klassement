import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { getProfile, displayName, updateFeaturedBadges } from "./api";
import { getProfilesMap } from "./api";
import { getPlayerStanding, getPlayerStandings } from "../standings/api";
import { getPlayerRatings, getRatingHistory } from "../standings/ratingsApi";
import { bestWeekday, monthlyWinRate, opponentExtremes } from "../../lib/trends";
import {
  getPlayerMatches,
  getTeamsMap,
  getCompletedMatchesBetween,
} from "../matches/api";
import { MatchList } from "../matches/MatchList";
import { MatchListSkeleton, ProfileSkeleton, StatsSkeleton } from "../../components/Skeleton";
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
  headToHead,
  outcomeFor,
} from "../../lib/results";
import { headToHead as onderlingeBalans, bestPartner } from "./headToHead";
import { deriveBadges } from "../../lib/badges";
import { listSeasons, seasonFromId } from "../../lib/seasons";
import { matchesInSeason, rankProgression } from "../../lib/standings";
import { RankChart } from "../../components/RankChart";
import { formatDate } from "../../lib/format";
import { ShareProfile, type ProfileShareData } from "./ShareProfile";
import { WrappedSheet } from "../wrapped/WrappedSheet";
import { matchesInYear, wrappedJaar } from "../wrapped/wrapped";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { TierBadge } from "../../components/TierBadge";
import { tierFor } from "../../lib/tiers";
import { THIN_GAMES } from "../groups/groupRating";
import "./PlayerProfile.css";

// Aantal recente matches dat we op het profiel tonen (de volledige historie
// wordt geladen voor de statistieken, maar niet allemaal uitgelijst).
const RECENT_SHOWN = 8;

// Zoveel badges mag een speler maximaal uitlichten bovenaan zijn profiel.
const MAX_FEATURED = 5;

export function PlayerProfile() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMe = user?.id === id;

  const profile = useAsync(() => getProfile(id), [id]);
  const standing = useAsync(() => getPlayerStanding(id), [id]);
  // Volledige stand voor de klassementpositie (#N), net als het dashboard.
  const standings = useAsync(getPlayerStandings, []);
  // Ruime limiet: streak/H2H/grootste zege rekenen op de volledige historie.
  const matches = useAsync(() => getPlayerMatches(id, 200), [id]);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getProfilesMap, []);
  const ratings = useAsync(getPlayerRatings, []);
  const ratingHistory = useAsync(() => getRatingHistory(id), [id]);
  // Alle afgeronde matches, nodig om de klassementspositie op elke speeldag te
  // herrekenen (rang-verloop). Vast bereik → gedeelde cache met het klassement.
  const allMatches = useAsync(
    () =>
      getCompletedMatchesBetween(
        "2000-01-01T00:00:00Z",
        "2100-01-01T00:00:00Z",
      ),
    [],
  );
  // Rang-verloop: positie in het klassement ná elke eigen speeldag (all-time).
  // Als hook vóór eventuele vroege returns, met stabiele async-data als deps.
  const rankPoints = useMemo(
    () =>
      rankProgression(
        allMatches.data ?? [],
        teams.data ?? {},
        profiles.data ?? {},
        id,
      ),
    [allMatches.data, teams.data, profiles.data, id],
  );

  // Seizoensfilter: all-time is de standaard; een kwartaal beperkt vorm,
  // winrate, badges en de onderlinge stand tot die periode.
  const [seasonId, setSeasonId] = useState("");
  // Onderlinge stand: standaard de top 5 (meest gespeeld), met een toggle.
  const [showAllH2H, setShowAllH2H] = useState(false);
  // Aangetikte badge: opent een pop-up met naam, uitleg en voortgang (werkt
  // ook op touch, waar de title-tooltip onbereikbaar is).
  const [openBadge, setOpenBadge] = useState<string | null>(null);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  // Escape sluit de badge-pop-up; de pagina eronder scrollt niet mee.
  useEffect(() => {
    if (!openBadge) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenBadge(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openBadge]);
  // Optimistische kopie van de uitgelichte badges: null = nog niets gewijzigd,
  // dan geldt de waarde uit het geladen profiel.
  const [featuredOverride, setFeaturedOverride] = useState<string[] | null>(null);
  const toast = useToast();

  if (profile.loading)
    return (
      <div>
        <div className="card">
          <ProfileSkeleton />
        </div>
        <StatsSkeleton />
      </div>
    );
  if (!profile.data)
    return <p className="msg msg--error">Speler niet gevonden.</p>;

  const p = profile.data;
  const s = standing.data;
  const tmap = teams.data ?? {};
  const pmap = profiles.data ?? {};
  const mlist = matches.data ?? [];

  // Seizoenskiezer: alle kwartalen sinds de eerste match van deze speler.
  const seasons =
    mlist.length > 0
      ? listSeasons(
          new Date(
            mlist.reduce((min, m) => {
              const d = m.played_at ?? m.created_at;
              return d < min ? d : min;
            }, mlist[0].played_at ?? mlist[0].created_at),
          ),
        )
      : [];
  const season = seasonFromId(seasonId);
  // De matches waarop de afgeleide stats rekenen: heel de historie, of één
  // kwartaal wanneer een seizoen gekozen is.
  const scoped = season ? matchesInSeason(mlist, season) : mlist;

  const form = recentForm(scoped, tmap, id);
  const streak = winStreak(scoped, tmap, id);
  const best = longestStreak(scoped, tmap, id);
  const bigWin = biggestWin(scoped, tmap, id);
  const partner = bestPartner(scoped, tmap, id);
  const myRating = ratings.data?.[id]?.rating ?? null;
  const myGames = ratings.data?.[id]?.games ?? 0;
  const thinRating = myGames > 0 && myGames < THIN_GAMES;
  const rhist = ratingHistory.data ?? [];
  const badges = deriveBadges(scoped, tmap, id, ratings.data ?? undefined);

  // Uitgelichte badges staan los van het seizoensfilter — het is een keuze op
  // profielniveau — dus resolven we ze tegen de volledige historie.
  const badgesAllTime = season
    ? deriveBadges(mlist, tmap, id, ratings.data ?? undefined)
    : badges;
  const earnedAllTime = new Set(
    badgesAllTime.filter((b) => b.behaald).map((b) => b.id),
  );
  const allTimeById = new Map(badgesAllTime.map((b) => [b.id, b]));
  const featuredIds = featuredOverride ?? p.featured_badges ?? [];
  // Alleen geldige, daadwerkelijk behaalde badges tonen, in de gekozen volgorde.
  const featuredBadges = featuredIds
    .map((bid) => allTimeById.get(bid))
    .filter((b): b is (typeof badgesAllTime)[number] => !!b && b.behaald);

  // Badge uit-/aanvinken als uitgelicht; optimistisch, met terugval bij fout.
  function toggleFeatured(badgeId: string) {
    const current = featuredIds;
    const has = current.includes(badgeId);
    if (!has && current.length >= MAX_FEATURED) {
      toast.error(`Je kan maximaal ${MAX_FEATURED} badges uitlichten.`);
      return;
    }
    const next = has
      ? current.filter((x) => x !== badgeId)
      : [...current, badgeId];
    setFeaturedOverride(next);
    updateFeaturedBadges(id, next).catch((err) => {
      setFeaturedOverride(current);
      toast.error(errorMessage(err));
    });
  }

  // Klassementpositie (#N): dezelfde afleiding als het dashboard — index in de
  // volledige stand. Blijft all-time; het klassement kent geen per-kwartaal-rij.
  const rankIdx = (standings.data ?? []).findIndex((r) => r.player_id === id);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;

  // Winrate/gespeeld: binnen een seizoen uit de gefilterde matches, anders uit
  // de (all-time) serverstand.
  let scopedPlayed = 0;
  let scopedWon = 0;
  for (const m of scoped) {
    const o = outcomeFor(m, tmap, id);
    if (!o) continue;
    scopedPlayed++;
    if (o === "W") scopedWon++;
  }
  const rate = season
    ? winRate(scopedWon, scopedPlayed)
    : s
      ? winRate(s.won, s.played)
      : null;
  const playedCount = season ? scopedPlayed : (s?.played ?? 0);

  // Onderlinge balans tussen de ingelogde gebruiker en de bekeken speler.
  const balans =
    user && !isMe ? onderlingeBalans(scoped, tmap, user.id, id) : null;
  const vsGespeeld = balans?.alsTegenstanders.gespeeld ?? 0;
  const samenGespeeld = balans?.alsPartners.samen ?? 0;

  // Onderlinge stand, gesorteerd op aantal duels (meest gespeeld eerst).
  const h2h = [...headToHead(scoped, tmap, id).entries()]
    .map(([oppId, rec]) => ({ oppId, ...rec }))
    .sort((a, b) => b.played - a.played);
  // Nemesis = de tegenstander tegen wie je het vaakst verloor; favoriet = de
  // tegenstander tegen wie je het vaakst won. Los uitgelicht boven de lijst.
  type H2HRow = (typeof h2h)[number];
  const nemesis = h2h.reduce<H2HRow | null>(
    (top, r) => (r.lost > 0 && (!top || r.lost > top.lost) ? r : top),
    null,
  );
  const favoriet = h2h.reduce<H2HRow | null>(
    (top, r) => (r.won > 0 && (!top || r.won > top.won) ? r : top),
    null,
  );
  const h2hShown = showAllH2H ? h2h : h2h.slice(0, 5);

  // Belangrijkste behaalde badge (laatste in de reeks = meest gevorderd) voor
  // op de deel-kaart.
  // Terugval op de all-time-lijst: uitgelichte badges kunnen buiten het
  // gekozen seizoen behaald zijn en ontbreken dan in `badges`.
  const openBadgeInfo = openBadge
    ? (badges.find((b) => b.id === openBadge) ??
      allTimeById.get(openBadge) ??
      null)
    : null;
  const earned = badges.filter((b) => b.behaald);
  const topBadge =
    earned.length > 0
      ? {
          emoji: earned[earned.length - 1].emoji,
          naam: earned[earned.length - 1].naam,
        }
      : null;
  const shareData: ProfileShareData = {
    name: displayName(p),
    rating: myRating,
    tier: tierFor(myRating),
    rank,
    form,
    topBadge,
  };

  // Padel Wrapped (#115): jaarrond terugvindbaar op het eigen profiel zodra
  // er in het beschikbare jaar gespeeld is (vanaf 15 dec = het lopende jaar).
  const wrappedYr = wrappedJaar(new Date());
  const heeftWrapped =
    isMe && matchesInYear(mlist, wrappedYr).length > 0;

  return (
    <div>
      <header className="page-head profile-head">
        {/* Terug naar waar je vandaan kwam (klassement, vrienden, …). */}
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => navigate(-1)}
        >
          ← Terug
        </button>
        <div className="profile-head__tools">
          {seasons.length > 0 && (
            <select
              className="select select--filter"
              aria-label="Seizoen"
              value={season?.id ?? ""}
              onChange={(e) => setSeasonId(e.target.value)}
            >
              <option value="">Alle tijden</option>
              {seasons.map((s2) => (
                <option key={s2.id} value={s2.id}>
                  {s2.label}
                </option>
              ))}
            </select>
          )}
          {heeftWrapped && (
            <button
              className="btn btn--sm"
              aria-haspopup="dialog"
              onClick={() => setWrappedOpen(true)}
            >
              🎁 Wrapped {wrappedYr}
            </button>
          )}
          <ShareProfile
            data={shareData}
            label={isMe ? "↗ Deel mijn profiel" : "↗ Deel profiel"}
          />
        </div>
      </header>

      {wrappedOpen && heeftWrapped && (
        <WrappedSheet
          jaar={wrappedYr}
          playerId={id}
          naam={displayName(p)}
          matches={mlist}
          teams={tmap}
          profiles={pmap}
          ratingHistory={rhist}
          onClose={() => setWrappedOpen(false)}
        />
      )}

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
            <TierBadge rating={myRating} dimmed={thinRating} />
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

      {featuredBadges.length > 0 && (
        <section className="card">
          <h2 className="card__title">Uitgelichte badges</h2>
          <ul className="badges">
            {featuredBadges.map((b) => (
              <li key={b.id} className="badges__item">
                <button
                  type="button"
                  className="badge badges__pill badge--accent"
                  title={b.omschrijving}
                  aria-haspopup="dialog"
                  onClick={() => setOpenBadge(b.id)}
                >
                  <span className="badges__emoji" aria-hidden="true">
                    {b.emoji}
                  </span>
                  {b.naam}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="stats">
        <Stat
          label="Rating"
          value={myRating ?? "—"}
          delta={rhist.length > 0 ? rhist[rhist.length - 1].delta : null}
        />
        <Stat label="Positie" value={rank ? `#${rank}` : "—"} />
        <Stat label="Punten" value={s?.points ?? 0} />
        <Stat label="Winrate" value={rate != null ? `${rate}%` : "—"} />
        <Stat label="Gespeeld" value={playedCount} />
      </div>

      {rhist.length >= 2 && (
        <section className="card">
          <h2 className="card__title">Rating-verloop</h2>
          <RatingChart history={rhist} />
        </section>
      )}

      {rankPoints.length >= 2 && (
        <section className="card">
          <h2 className="card__title">Positie-verloop</h2>
          <p className="card__subtitle">
            Klassementspositie na elke speeldag — de stand is telkens berekend uit
            alle matches t/m die dag.
          </p>
          <RankChart points={rankPoints} />
        </section>
      )}

      {/* Trends (#58): win% per maand + sterkste/lastigste tegenstander en
          beste weekdag — afgeleid uit de al opgehaalde matches. */}
      {!matches.loading &&
        (() => {
          const months = monthlyWinRate(scoped, tmap, id);
          const { favorite, hardest } = opponentExtremes(scoped, tmap, id);
          const day = bestWeekday(scoped, tmap, id);
          if (months.length < 2 && !favorite && !hardest && !day) return null;
          return (
            <section className="card">
              <h2 className="card__title">Trends</h2>
              {months.length >= 2 && (
                <div
                  className="trend-months"
                  role="img"
                  aria-label={`Win-percentage per maand: ${months
                    .map((mo) => `${mo.label} ${mo.rate}%`)
                    .join(", ")}`}
                >
                  {months.map((mo) => (
                    <div key={mo.month} className="trend-month">
                      <span className="trend-month__rate">{mo.rate}%</span>
                      <span className="trend-month__barwrap" aria-hidden="true">
                        <span
                          className="trend-month__bar"
                          style={{ height: `${Math.max(mo.rate, 4)}%` }}
                          title={`${mo.won} van ${mo.played} gewonnen`}
                        />
                      </span>
                      <span className="trend-month__label">{mo.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {(favorite || hardest || day) && (
                <ul className="trend-facts">
                  {favorite && (
                    <li>
                      <span aria-hidden="true">💪</span> Sterkst tegen{" "}
                      <Link to={`/spelers/${favorite.oppId}`}>
                        {displayName(pmap[favorite.oppId])}
                      </Link>{" "}
                      — {favorite.won}–{favorite.lost} in {favorite.played}{" "}
                      duels
                    </li>
                  )}
                  {hardest && (
                    <li>
                      <span aria-hidden="true">😅</span> Lastigst:{" "}
                      <Link to={`/spelers/${hardest.oppId}`}>
                        {displayName(pmap[hardest.oppId])}
                      </Link>{" "}
                      — {hardest.won}–{hardest.lost} in {hardest.played} duels
                    </li>
                  )}
                  {day && (
                    <li>
                      <span aria-hidden="true">📅</span> Beste dag:{" "}
                      <strong>{day.label}</strong> — {day.rate}% winst over{" "}
                      {day.played} matches
                    </li>
                  )}
                </ul>
              )}
            </section>
          );
        })()}

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
                    Grootste zege · +{bigWin.margin} ·{" "}
                    {formatDate(bigWin.match.played_at ?? bigWin.match.created_at)}
                  </span>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      {balans && (
        <section className="card">
          <h2 className="card__title">Onderling</h2>
          {vsGespeeld === 0 && samenGespeeld === 0 ? (
            <p className="onderling__leeg">Nog geen gezamenlijke matches.</p>
          ) : (
            <ul className="onderling">
              {vsGespeeld > 0 && (
                <li className="onderling__rij">
                  <span className="onderling__label">Tegen elkaar</span>
                  <span className="onderling__waarde">
                    Jij won {balans.alsTegenstanders.gewonnen} van de{" "}
                    {vsGespeeld}
                  </span>
                </li>
              )}
              {samenGespeeld > 0 && (
                <li className="onderling__rij">
                  <span className="onderling__label">Samen</span>
                  <span className="onderling__waarde">
                    {samenGespeeld} {samenGespeeld === 1 ? "match" : "matches"}{" "}
                    · {winRate(balans.alsPartners.gewonnen, samenGespeeld)}%
                    gewonnen
                  </span>
                </li>
              )}
            </ul>
          )}
        </section>
      )}

      {!matches.loading && (
        <section className="card">
          <h2 className="card__title">Badges</h2>
          <p className="badges__hint">
            {badges.some((b) => b.behaald)
              ? "Tik op een badge voor de uitleg"
              : "Speel matches om deze badges te verdienen · tik op een badge voor de uitleg"}
            {isMe &&
              earnedAllTime.size > 0 &&
              " · tik op ★ om een behaalde badge uit te lichten op je profiel"}
            .
          </p>
          <ul className="badges">
            {badges.map((b) => {
              const kanUitlichten = isMe && earnedAllTime.has(b.id);
              const uitgelicht = featuredIds.includes(b.id);
              return (
                <li key={b.id} className="badges__item">
                  <button
                    type="button"
                    className={`badge badges__pill${b.behaald ? " badge--accent" : " badges__pill--dim"}`}
                    title={b.omschrijving}
                    aria-haspopup="dialog"
                    onClick={() => setOpenBadge(b.id)}
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
                  </button>
                  {kanUitlichten && (
                    <button
                      type="button"
                      className={`badges__star${uitgelicht ? " badges__star--on" : ""}`}
                      aria-pressed={uitgelicht}
                      title={
                        uitgelicht
                          ? "Uit uitgelicht halen"
                          : "Uitlichten op profiel"
                      }
                      onClick={() => toggleFeatured(b.id)}
                    >
                      {uitgelicht ? "★" : "☆"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {openBadgeInfo && (
        <div className="sheet-backdrop" onClick={() => setOpenBadge(null)}>
          <div
            className="sheet sheet--compact badge-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Badge: ${openBadgeInfo.naam}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet__head">
              <h2 className="sheet__title">Badge</h2>
              <button
                className="sheet__close"
                onClick={() => setOpenBadge(null)}
                aria-label="Sluiten"
              >
                ✕
              </button>
            </div>
            <div className="badge-sheet__body">
              <span
                className={`badge-sheet__medal${openBadgeInfo.behaald ? "" : " is-locked"}`}
                aria-hidden="true"
              >
                {openBadgeInfo.emoji}
              </span>
              <h3 className="badge-sheet__name">{openBadgeInfo.naam}</h3>
              <p className="badge-sheet__desc">{openBadgeInfo.omschrijving}</p>
              {openBadgeInfo.behaald ? (
                <span className="badge-sheet__status badge-sheet__status--done">
                  Behaald ✓
                </span>
              ) : openBadgeInfo.voortgang ? (
                <div className="badge-sheet__progress">
                  <div className="badge-sheet__bar">
                    <span
                      className="badge-sheet__fill"
                      style={{
                        width: `${Math.min(100, Math.round((openBadgeInfo.voortgang.nu / openBadgeInfo.voortgang.doel) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="badge-sheet__count">
                    {openBadgeInfo.voortgang.nu}/{openBadgeInfo.voortgang.doel}
                    {openBadgeInfo.voortgang.doel - openBadgeInfo.voortgang.nu > 0 &&
                      ` · nog ${openBadgeInfo.voortgang.doel - openBadgeInfo.voortgang.nu} te gaan`}
                  </span>
                </div>
              ) : (
                <span className="badge-sheet__status">Nog niet behaald</span>
              )}
            </div>
          </div>
        </div>
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
                {winRate(partner.gewonnen, partner.samen)}% samen gewonnen (
                {partner.samen} matches)
              </p>
            </div>
          </div>
        </section>
      )}

      {h2h.length > 0 && (
        <section className="card">
          <h2 className="card__title">Onderlinge stand</h2>

          {/* Uitgelicht: tegen wie het net niet lukt (nemesis) en tegen wie wél
              (favoriete tegenstander). */}
          {(nemesis || favoriet) && (
            <div className="h2h-highlights">
              {favoriet && (
                <div className="h2h-highlight h2h-highlight--fav">
                  <span className="h2h-highlight__tag">😎 Favoriete tegenstander</span>
                  <Link
                    className="h2h-highlight__player"
                    to={`/spelers/${favoriet.oppId}`}
                  >
                    <Avatar profile={pmap[favoriet.oppId]} size={28} />
                    <span className="h2h__name">
                      {displayName(pmap[favoriet.oppId])}
                    </span>
                  </Link>
                  <span className="h2h-highlight__meta">
                    {favoriet.won}× gewonnen van {favoriet.played}
                  </span>
                </div>
              )}
              {nemesis && nemesis.oppId !== favoriet?.oppId && (
                <div className="h2h-highlight h2h-highlight--nemesis">
                  <span className="h2h-highlight__tag">😤 Nemesis</span>
                  <Link
                    className="h2h-highlight__player"
                    to={`/spelers/${nemesis.oppId}`}
                  >
                    <Avatar profile={pmap[nemesis.oppId]} size={28} />
                    <span className="h2h__name">
                      {displayName(pmap[nemesis.oppId])}
                    </span>
                  </Link>
                  <span className="h2h-highlight__meta">
                    {nemesis.lost}× verloren van {nemesis.played}
                  </span>
                </div>
              )}
            </div>
          )}

          <ul className="h2h">
            {h2hShown.map((row) => (
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
          {h2h.length > 5 && (
            <button
              type="button"
              className="btn btn--sm h2h__toggle"
              onClick={() => setShowAllH2H((v) => !v)}
            >
              {showAllH2H
                ? "Toon minder"
                : `Toon alles (${h2h.length})`}
            </button>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="card__title">Recente matches</h2>
        {matches.loading && <MatchListSkeleton count={3} />}
        {matches.error && <p className="msg msg--error">{matches.error}</p>}
        {!matches.loading && (
          <MatchList
            matches={scoped.slice(0, RECENT_SHOWN)}
            teams={tmap}
            profiles={pmap}
            perspectiveId={id}
            empty={
              season
                ? "Geen matches in dit seizoen."
                : "Deze speler heeft nog geen matches gespeeld."
            }
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
