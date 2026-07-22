import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { getProfile, displayName, updateFeaturedBadges } from "./api";
import { getProfilesMap } from "./api";
import { getPlayerStanding, getPlayerStandings } from "@/features/standings/api";
import {
  getPlayerRatings,
  getRatingHistory,
  getAllRatingHistories,
} from "@/features/standings/ratingsApi";
import {
  getHuidigeDictator,
  getRegeerduur,
} from "@/features/standings/dictatorApi";
import { getPlayerVendettas } from "@/features/groups/vendettaApi";
import { deltaToday } from "@/features/standings/ratingDelta";
import { useClub } from "@/features/availability/club";
import { upsetsByMatch } from "@/features/matches/upset";
import { getPlayerMatches, getTeamsMap } from "@/features/matches/api";
import { ProfileSkeleton, StatsSkeleton } from "@/ui/Skeleton";
import {
  recentForm,
  winRate,
  winStreak,
  longestStreak,
  biggestWin,
  headToHead,
  outcomeFor,
} from "@/features/rating/results";
import { headToHead as onderlingeBalans, bestPartner } from "./headToHead";
import { deriveBadges } from "@/features/profiles/badges";
import { listSeasons, seasonFromId } from "@/features/rating/seasons";
import { matchesInSeason, rankProgression, byRank } from "@/features/rating/standings";
import { ShareProfile, type ProfileShareData } from "@/features/profiles/components/ShareProfile";
import { WrappedSheet } from "@/features/wrapped/components/WrappedSheet";
import { matchesInYear, wrappedJaar } from "@/features/wrapped/wrapped";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { Sheet } from "@/ui/Sheet";
import { tierFor, tierProgress } from "@/features/rating/tiers";
import { bijnaam, neutraleBijnaam } from "@/features/profiles/nickname";
import { roast } from "@/features/profiles/roast";
import { THIN_GAMES } from "@/features/groups/groupRating";
import { ProfileHero } from "@/features/profiles/components/ProfileHero";
import { FriendButton } from "@/features/friends/components/FriendButton";
import { ProfileOverview } from "@/features/profiles/components/ProfileOverview";
import { ProfileStats } from "@/features/profiles/components/ProfileStats";
import { ProfileBadges } from "@/features/profiles/components/ProfileBadges";
import { ProfileMatches } from "@/features/profiles/components/ProfileMatches";
import { ComparisonSheet } from "@/features/profiles/components/ComparisonSheet";
import type { ProfileData, ProfileTab, H2HRow } from "@/features/profiles/components/types";
import type { Match } from "@/types";
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
  const club = useClub();

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
  // De Troon met machtsbehoud (#545): zit deze speler nú op de troon, en hoe
  // lang heeft-ie in totaal geheerst? Voedt de tier-badge (El Padelissimo alleen
  // voor de troonhouder) en het regeerduur-erepalmpje.
  const dictator = useAsync(getHuidigeDictator, []);
  const regeerduur = useAsync(() => getRegeerduur(id), [id]);
  // Volledige historie (gecacht, app-breed gedeeld) voor upset-chips (#85).
  const allHistories = useAsync(getAllRatingHistories, []);
  // Actieve vendetta's van deze speler: ⚔️-badge in de onderlinge stand (#169).
  const vendettas = useAsync(() => getPlayerVendettas(id), [id]);
  // Rang-verloop (all-time sparkline) staat sinds #461 tijdelijk uit: het werd
  // client-side uit álle ruwe matchrijen berekend, maar die zijn niet meer
  // publiek leesbaar, dus de rang zou per-kijker en dus misleidend worden. Wordt
  // in fase 2 hersteld via een SECURITY DEFINER RPC (player_rank_progression).
  const allMatches = useAsync<Match[]>(() => Promise.resolve([]), []);
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
  // Speler Duel & Vergelijker (#469): sheet die deze speler tegen de ingelogde
  // gebruiker (of elke andere) legt.
  const [compareOpen, setCompareOpen] = useState(false);
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
  // Dag-cumulatieve ELO-beweging voor de ▲/▼-badge (#352), niet de laatste match.
  const ratingDelta = deltaToday(rhist, club.timezone);
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
    avatarUrl: p.avatar_url ?? null,
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
    isDictator: dictator.data?.profileId === id,
    regeerduur: regeerduur.data ?? null,
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
    vendettaMet: new Set(
      (vendettas.data ?? []).map((v) =>
        v.challenger_id === id ? v.rival_id : v.challenger_id,
      ),
    ),
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
          {user && !isMe && (
            <button
              className="btn btn--sm"
              aria-haspopup="dialog"
              onClick={() => setCompareOpen(true)}
            >
              ⚔️ Vergelijk met mij
            </button>
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

      {compareOpen && user && (
        <ComparisonSheet
          open
          defaultLeftId={user.id}
          defaultRightId={id}
          onClose={() => setCompareOpen(false)}
        />
      )}

      <ProfileHero d={d} action={isMe ? undefined : <FriendButton targetId={id} />} />

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
