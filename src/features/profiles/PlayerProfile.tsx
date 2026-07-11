import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { getProfile, displayName, updateFeaturedBadges } from "./api";
import { getProfilesMap } from "./api";
import { getPlayerStanding, getPlayerStandings } from "../standings/api";
import {
  getPlayerRatings,
  getRatingHistory,
  getAllRatingHistories,
} from "../standings/ratingsApi";
import { upsetsByMatch } from "../../lib/upset";
import {
  getPlayerMatches,
  getTeamsMap,
  getCompletedMatchesBetween,
} from "../matches/api";
import { ProfileSkeleton, StatsSkeleton } from "../../components/Skeleton";
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
import { matchesInSeason, rankProgression, byRank } from "../../lib/standings";
import { ShareProfile, type ProfileShareData } from "./ShareProfile";
import { WrappedSheet } from "../wrapped/WrappedSheet";
import { matchesInYear, wrappedJaar } from "../wrapped/wrapped";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { Sheet } from "../../components/Sheet";
import { tierFor, tierProgress } from "../../lib/tiers";
import { bijnaam, neutraleBijnaam } from "../../lib/nickname";
import { roast } from "../../lib/roast";
import { THIN_GAMES } from "../groups/groupRating";
import { ProfileHero } from "./profile/ProfileHero";
import { ProfileOverview } from "./profile/ProfileOverview";
import { ProfileStats } from "./profile/ProfileStats";
import { ProfileBadges } from "./profile/ProfileBadges";
import { ProfileMatches } from "./profile/ProfileMatches";
import type { ProfileData, ProfileTab, H2HRow } from "./profile/types";
import "./PlayerProfile.css";

// Zoveel badges mag een speler maximaal uitlichten bovenaan zijn profiel.
const MAX_FEATURED = 5;

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "overzicht", label: "Overzicht" },
  { id: "statistieken", label: "Statistieken" },
  { id: "badges", label: "Badges" },
  { id: "matches", label: "Matches" },
];

function tabFrom(value: string | null): ProfileTab {
  return TABS.some((t) => t.id === value) ? (value as ProfileTab) : "overzicht";
}

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
  // Volledige historie (gecacht, app-breed gedeeld) voor upset-chips (#85).
  const allHistories = useAsync(getAllRatingHistories, []);
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
  // Upsets per match-id (#85) — hook vóór eventuele vroege returns.
  const upsets = useMemo(
    () => upsetsByMatch(matches.data ?? [], teams.data ?? {}, allHistories.data ?? {}),
    [matches.data, teams.data, allHistories.data],
  );

  // Tab en seizoen staan in de URL zodat deep-links en herladen blijven werken.
  const [params, setParams] = useSearchParams();
  const tab = tabFrom(params.get("tab"));
  const seasonId = params.get("seizoen") ?? "";
  function patchParams(mut: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(params);
    mut(next);
    setParams(next, { replace: true });
  }
  function setTab(next: ProfileTab) {
    patchParams((p) => (next === "overzicht" ? p.delete("tab") : p.set("tab", next)));
  }
  function setSeasonId(next: string) {
    patchParams((p) => (next ? p.set("seizoen", next) : p.delete("seizoen")));
  }

  // Aangetikte badge: opent een pop-up met naam, uitleg en voortgang (werkt
  // ook op touch, waar de title-tooltip onbereikbaar is).
  const [openBadge, setOpenBadge] = useState<string | null>(null);
  const [wrappedOpen, setWrappedOpen] = useState(false);
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
  const ratingDelta = rhist.length > 0 ? rhist[rhist.length - 1].delta : null;
  const hasRating = rhist.length >= 2;
  const hasRank = rankPoints.length >= 2;
  const badges = deriveBadges(scoped, tmap, id, ratings.data ?? undefined);
  // Eerstvolgende (niet-behaalde) badge met telbare voortgang, het verst
  // gevorderd — voedt de "volgende badge"-highlight op Overzicht.
  const nextBadge =
    badges
      .filter((b) => !b.behaald && b.voortgang)
      .sort(
        (a, b) =>
          b.voortgang!.nu / b.voortgang!.doel -
          a.voortgang!.nu / a.voortgang!.doel,
      )[0] ?? null;

  // Bijnaam + roast (#167): gedeelde grap voor de hele groep, dus deterministisch
  // geseed op het speler-id en berekend over de volledige historie (los van het
  // seizoensfilter). Plagen, geen kwetsen; roast is null als er niets te melden is.
  const roastSeed = [...id].reduce(
    (h, c) => (Math.imul(h, 33) + c.charCodeAt(0)) | 0,
    5381,
  );
  // Roast-schild (#183): wie het aanzet krijgt een neutrale bijnaam en geen
  // plaag-regel — plagen, geen kwetsen, en wie niet wil hoeft niet.
  const schild = p.roast_schild ?? false;
  const nick = schild ? neutraleBijnaam(id) : bijnaam(mlist, tmap, id);
  const roastText = schild
    ? null
    : roast(mlist, tmap, id, roastSeed, ratings.data ?? undefined);

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

  // Klassementpositie (#N) op ELO — dezelfde volgorde als het ratingklassement
  // (#52): rating aflopend, met de klassieke punten-tie-break bij gelijke of
  // ontbrekende rating.
  const ratingRank = [...(standings.data ?? [])].sort(
    (a, b) =>
      (ratings.data?.[b.player_id]?.rating ?? -Infinity) -
        (ratings.data?.[a.player_id]?.rating ?? -Infinity) || byRank(a, b),
  );
  const rankIdx = ratingRank.findIndex((r) => r.player_id === id);
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
  const h2h: H2HRow[] = [...headToHead(scoped, tmap, id).entries()]
    .map(([oppId, rec]) => ({ oppId, ...rec }))
    .sort((a, b) => b.played - a.played);
  // Nemesis = tegen wie je het vaakst verloor; favoriet = tegen wie je het
  // vaakst won. Los uitgelicht boven de lijst en op Overzicht.
  const nemesis = h2h.reduce<H2HRow | null>(
    (top, r) => (r.lost > 0 && (!top || r.lost > top.lost) ? r : top),
    null,
  );
  const favoriet = h2h.reduce<H2HRow | null>(
    (top, r) => (r.won > 0 && (!top || r.won > top.won) ? r : top),
    null,
  );

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
  const heeftWrapped = isMe && matchesInYear(mlist, wrappedYr).length > 0;

  const d: ProfileData = {
    id,
    p,
    isMe,
    nick,
    roast: roastText,
    s: s ?? null,
    myRating,
    thinRating,
    rank,
    rate,
    playedCount,
    ratingDelta,
    form,
    streak,
    best,
    bigWin,
    partner,
    tierVoortgang: tierProgress(myRating),
    nextBadge,
    hasRating,
    hasRank,
    rhist,
    rankPoints,
    scoped,
    tmap,
    pmap,
    upsets,
    season,
    matchesLoading: matches.loading,
    matchesError: matches.error,
    badges,
    featuredBadges,
    featuredIds,
    earnedAllTime,
    h2h,
    nemesis,
    favoriet,
    balans,
    vsGespeeld,
    samenGespeeld,
  };

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

      <ProfileHero d={d} />

      <nav className="tabs tabs--page" aria-label="Profielonderdelen">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? "is-active" : ""}`}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overzicht" && (
        <ProfileOverview
          d={d}
          onOpenBadge={setOpenBadge}
          onShowMatches={() => setTab("matches")}
        />
      )}
      {tab === "statistieken" && <ProfileStats d={d} />}
      {tab === "badges" && (
        <ProfileBadges
          d={d}
          onOpenBadge={setOpenBadge}
          onToggleFeatured={toggleFeatured}
        />
      )}
      {tab === "matches" && <ProfileMatches d={d} />}

      {openBadgeInfo && (
        <Sheet
          open
          onClose={() => setOpenBadge(null)}
          compact
          className="badge-sheet"
          title="Badge"
          ariaLabel={`Badge: ${openBadgeInfo.naam}`}
        >
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
        </Sheet>
      )}
    </div>
  );
}

export default PlayerProfile;
