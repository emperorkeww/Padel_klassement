import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useRefetchOnFocus } from "@/lib/hooks/useRefetchOnFocus";
import { Skeleton, StatsSkeleton } from "@/ui/Skeleton";
import { Avatar } from "@/ui/Avatar";
import { CoachAvatar } from "@/features/coach/components/CoachAvatar";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import { COMMENTATOR } from "@/features/coach/roastTone";
import { coachBriefing, coachEmptyState, PROMOTIE_DREMPEL } from "@/features/coach/coachMoments";
import { klassementFeiten } from "@/features/coach/klassementFeiten";
import { verliesreeksTegen } from "@/features/coach/coachStats";
import { FormChips } from "@/features/rating/components/FormChips";
import { CountUp } from "@/ui/CountUp";
import { inTeam, recentForm, winRate, winStreak, lossStreak } from "@/features/rating/results";
import { deriveBadges } from "@/features/profiles/badges";
import { getPiasWeeks } from "@/features/standings/piasApi";
import { isoParts } from "@/features/standings/pias";
import { RatingChart } from "@/features/rating/components/RatingChart";
import { getPlayerStandings } from "@/features/standings/api";
import {
  getPlayerRatings,
  getRatingHistory,
  getAllRatingHistories,
} from "@/features/standings/ratingsApi";
import {
  getRecentResults,
  getPlayerMatches,
  getTeamsMap,
  teamLabel,
} from "@/features/matches/api";
import { eveningSummary } from "@/features/feed/eveningSummary";
import { ShareEvening } from "@/features/groups/components/ShareEvening";
import { PiasCard } from "@/features/groups/components/PiasCard";
import { getZwartePiet } from "@/features/groups/zwartePietApi";
import { piasDetail } from "@/features/groups/maandpias";
import { BIG_DADDY_EMOJI } from "@/features/dashboard/bigDaddy";
import { DICTATOR_EMOJI, dictatorPropaganda } from "@/features/dashboard/dictator";
import { getHuidigeDictator } from "@/features/standings/dictatorApi";
import { getMyFriendships, categorize } from "@/features/friends/api";
import { getProfilesMap, displayName } from "@/features/profiles/api";
import { WrappedSheet } from "@/features/wrapped/components/WrappedSheet";
import {
  matchesInYear,
  toonWrappedBanner,
  wrappedJaar,
} from "@/features/wrapped/wrapped";
import { getMyGroups } from "@/features/groups/api";
import { TeamSide } from "@/features/matches/components/MatchList";
import { getClubAvailability, nextFreeSlot } from "@/features/availability/api";
import { useClub } from "@/features/availability/club";
import { dateInZone, minutesNowInZone } from "@/lib/utils/time";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { tierFor, tierProgress } from "@/features/rating/tiers";
import { byRank } from "@/features/rating/standings";
import { deltaToday } from "@/features/standings/ratingDelta";
import { THIN_GAMES } from "@/features/groups/groupRating";
import { readFlag, writeFlag } from "./flags";
import {
  cachedName,
  rememberName,
  matchWhen,
  loadOpenPolls,
  pickPollBanner,
  pollDay,
  pickRival,
  rivalVerdict,
  rivalVerdictLabel,
  deriveEvening,
} from "./dashboardHelpers";
import { WeekMissions } from "./components/WeekMissions";
import { HeroCrest } from "./components/HeroCrest";
import { BadgeStrip } from "./components/BadgeStrip";
import { OnboardStep } from "./components/OnboardStep";
import { NextFreeLine } from "./components/NextFreeLine";
import { InstallPrompt } from "./components/InstallPrompt";
import { PushPrompt } from "./components/PushPrompt";
import { Stat } from "./components/Stat";
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
  // Zwarte Piet-dragers per eigen groep (#287): voor de titel-hoek in de hero.
  const zwartePiet = useAsync(getZwartePiet, []);
  // Pias-alarm (#643): de serverside aangeduide piassen van mijn groepen —
  // dezelfde bron als banner, feed en FUT-kaart.
  const piasWeeks = useAsync(getPiasWeeks, []);
  const ratings = useAsync(getPlayerRatings, []);
  const ratingHistory = useAsync(
    () => (myId ? getRatingHistory(myId) : Promise.resolve([])),
    [myId],
  );
  // Volledige rating-historie (gecacht) voor upset-chips + grootste-upset (#85).
  const histories = useAsync(getAllRatingHistories, []);
  // De zittende dictator (#613): server-side uit de troon-replay (#545). Kleurt
  // de eigen hero keizerlijk als jíj op De Troon zit, en dooft de Big Daddy-
  // styling zodra de troon bezet is — zelfde uitsluiting als het klassement.
  const dictator = useAsync(getHuidigeDictator, []);

  const club = useClub();
  const today = dateInZone(club.timezone);
  const availability = useAsync(() => getClubAvailability(today), [today, club.id]);
  // Ververs de beschikbaarheid zodra de gebruiker terugkeert naar het tabblad.
  useRefetchOnFocus(availability.reload);

  // Lopende speeldag-polls per eigen groep; hangt af van welke groepen we
  // al kennen, dus opnieuw ophalen zodra die lijst binnen is.
  const groupKey = (groups.data ?? []).map((g) => g.id).join(",");
  const openPolls = useAsync(() => loadOpenPolls(groups.data ?? []), [groupKey]);

  const onMatches = useCallback(() => {
    standings.reload();
    results.reload();
    myMatches.reload();
    teams.reload();
    ratings.reload();
    ratingHistory.reload();
    zwartePiet.reload();
    // De troon kan wisselen na een match (kroning/afzetting via de replay).
    dictator.reload();
    // reload-functies zijn stabiel; bewust niet de hele async-objecten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standings.reload, results.reload, myMatches.reload, teams.reload, ratings.reload, ratingHistory.reload, zwartePiet.reload, dictator.reload]);
  useRealtime("matches", onMatches);
  useRealtime("friendships", friendships.reload);
  useRealtime("play_polls", openPolls.reload);
  useRealtime("play_poll_votes", openPolls.reload);

  const pmap = profiles.data ?? {};
  const tmap = teams.data ?? {};
  const rows = standings.data ?? [];
  const me = rows.find((p) => p.player_id === myId);
  // Positie volgt het klassement, dat op rating (Elo) is gesorteerd — niet op
  // punten. Zelfde volgorde als de Leaderboard: rating ↓, dan de punten-
  // tie-break bij gelijke/ontbrekende rating.
  const rmap = ratings.data ?? {};
  const eloRanked = [...rows].sort(
    (a, b) =>
      (rmap[b.player_id]?.rating ?? -Infinity) -
        (rmap[a.player_id]?.rating ?? -Infinity) ||
      byRank(
        { points: a.points, goal_diff: a.goal_diff, won: a.won },
        { points: b.points, goal_diff: b.goal_diff, won: b.won },
      ),
  );
  const rankIdx = eloRanked.findIndex((p) => p.player_id === myId);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;
  const { incoming, accepted } = categorize(friendships.data ?? [], myId);
  const myProfile = pmap[myId];
  // Titels voor de rechterbovenhoek van de hero (#287): de kroon als je #1 van
  // het klassement bent (Big Daddy), de Zwarte Piet als je in een van je
  // groepen het rondgaande schande-token draagt, en de Pias als je in een van
  // je groepen de aangeduide pias van de lópende week bent — sinds #643 uit
  // dezelfde serverbron als banner, feed en FUT-kaart, zodat het alarm nooit
  // een pias roept die nergens anders bestaat. Bij een roast-schild tonen we
  // de neutrale 📊-variant, consistent met de kaarten.
  // Hero-thema (#613): ben ik zelf de zittende dictator, dan kleurt de hero
  // keizerlijk; een bezette troon dooft bovendien de Big Daddy-kroon — ook als
  // de dictator iemand anders is (Podium.tsx doet hetzelfde). Zolang de troon-
  // query laadt blijft de hero neutraal, zodat er geen kleurflits optreedt.
  const isDictator = !!dictator.data && dictator.data.profileId === myId;
  const isBigDaddy = rank === 1 && !dictator.loading && !dictator.data;
  const isZwartePiet = Object.values(zwartePiet.data ?? {}).some(
    (h) => h.holderId === myId,
  );
  const huidigeWeek = isoParts(new Date()).weekStart;
  const mijnWeekPias =
    Object.values(piasWeeks.data ?? {})
      .flat()
      .find((r) => r.weekStart === huidigeWeek && r.playerId === myId) ?? null;
  const isWeekPias = mijnWeekPias != null;
  const roastSchild = myProfile?.roast_schild ?? false;
  // Naam direct tonen zonder e-mail-flits: zolang de profielen laden valt de
  // begroeting terug op de gecachete naam van een eerder bezoek.
  const myName = myProfile
    ? displayName(myProfile)
    : (cachedName(myId) ?? (profiles.loading ? "" : (user?.email ?? "speler")));
  useEffect(() => {
    if (myProfile) rememberName(myId, displayName(myProfile));
  }, [myProfile, myId]);

  const myGames = myMatches.data ?? [];
  const form = recentForm(myGames, tmap, myId);
  const streak = winStreak(myGames, tmap, myId);
  // Verliesreeks (alleen relevant zonder lopende winstreak) voor een
  // neutraal-motiverende hero-boodschap.
  const losing = lossStreak(myGames, tmap, myId);
  const rate = me ? winRate(me.won, me.played) : null;
  const myRating = ratings.data?.[myId]?.rating ?? null;
  const myRatingGames = ratings.data?.[myId]?.games ?? 0;
  // "Nog X tot [volgende divisie]" — alleen tonen als er een volgende tier is.
  const myProgress = tierProgress(myRating);
  const myTierNext =
    myProgress && myProgress.volgende ? myProgress : null;
  const rhist = ratingHistory.data ?? [];
  // Dag-cumulatieve ELO-beweging voor de ▲/▼-badge (#352), niet de laatste match.
  const dayDelta = deltaToday(rhist, club.timezone);

  // Alleen echt gespeelde matches: de RPC-filter dekt dit al, maar client-side
  // filteren houdt afgeleide weergaven robuust (o.a. in tests).
  const completed = (results.data ?? []).filter((m) => m.status === "completed");

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
  const pollPick = pickPollBanner(openPolls.data ?? [], myId, Date.now());

  // Speelavond-terugblik: uitslagen van de laatste speeldag (vandaag/gisteren).
  const evening = deriveEvening(completed, club.timezone);
  const eveningGroup = evening
    ? (groups.data ?? []).find((g) => g.id === evening.groupId)
    : null;
  // Echte avondstand (top-spelers + beste duo) voor de speelavond-kaart.
  const eveningMatches = evening
    ? completed.filter((m) => m.group_id === evening.groupId)
    : [];
  const eveningSum = evening
    ? eveningSummary(eveningMatches, tmap, evening.day, histories.data ?? undefined)
    : null;
  const eveningMedals = ["🥇", "🥈", "🥉"];

  // Eerstvolgende vrije baan bij de club (vandaag).
  const nextFree = availability.data
    ? nextFreeSlot(availability.data, null, minutesNowInZone(club.timezone))
    : null;

  // Onboarding: pas beslissen als de bronnen binnen zijn, zodat de checklist
  // niet even flitst voor een bestaande speler.
  const [onbDismissed, setOnbDismissed] = useState(() => readFlag("onboarding-dismissed"));

  // Padel Wrapped (#115): banner in het eindejaarsvenster, weg te klikken per
  // jaar. De sheet hergebruikt de al geladen data (nieuwste 100 matches —
  // in het bannervenster zijn de jaarmatches per definitie recent).
  const wrappedYr = wrappedJaar(new Date());
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [wrappedDismissed, setWrappedDismissed] = useState(() =>
    readFlag(`wrapped-${wrappedYr}-dismissed`),
  );
  const toonWrapped =
    toonWrappedBanner(new Date()) &&
    !wrappedDismissed &&
    matchesInYear(myGames, wrappedYr).length > 0;
  const dismissWrapped = () => {
    writeFlag(`wrapped-${wrappedYr}-dismissed`);
    setWrappedDismissed(true);
  };
  const hasFriend = accepted.length > 0;
  const myGroups = groups.data ?? [];
  const hasGroup = myGroups.length > 0;
  const hasPlayed = (me?.played ?? 0) > 0;
  // Hero-CTA voor wedstrijden genereren (#73): het label moet kloppen met waar
  // je landt. Genereren gebeurt op de Spelen-tab van een groep, dus met precies
  // één groep sturen we daar direct heen; zonder groep is "genereren" een loze
  // belofte, dus wordt het een "maak een groep"-call-to-action; met meerdere
  // groepen kies je eerst op de lijst. Tijdens het laden een neutrale fallback
  // om geen valse belofte te tonen.
  const generateCta = groups.loading
    ? { to: "/groepen", label: "Wedstrijden genereren" }
    : myGroups.length === 0
      ? { to: "/groepen", label: "Maak een groep" }
      : myGroups.length === 1
        ? {
            to: `/groepen/${myGroups[0].id}?tab=spelen`,
            label: "Wedstrijden genereren",
          }
        : { to: "/groepen", label: "Wedstrijden genereren" };
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
  const nextMatchGroupName = nextMatch?.group_id
    ? ((groups.data ?? []).find((g) => g.id === nextMatch.group_id)?.name ?? null)
    : null;
  // Coach Rudy's ochtendpraatje (#213): één regel over vandaag, gevoed door je
  // reeks/positie/volgende match. Het dashboard is persoonlijk (niet groep-
  // gescoopt), dus het volgt jóuw eigen profiel-intensiteit (#183) — net als de
  // feed — en respecteert je roast-schild. De klassement-feiten (#411) geven de
  // briefing zijn positie-tier: troon, jager, middenmoot, kelder of nieuw.
  // #579 — persoonlijke briefing-feiten uit al geladen data:
  // Volgende match tegen je vaste rivaal (met een lopende onderlinge verliesreeks)?
  const rivaalMatch = (() => {
    if (!rival || !nextMatch) return null;
    const mijnA = inTeam(tmap[nextMatch.team_a_id], myId);
    const mijnB = inTeam(tmap[nextMatch.team_b_id], myId);
    const tegenTeam = mijnA
      ? tmap[nextMatch.team_b_id]
      : mijnB
        ? tmap[nextMatch.team_a_id]
        : undefined;
    if (!tegenTeam || !inTeam(tegenTeam, rival.oppId)) return null;
    const verliesreeks = verliesreeksTegen(myGames, tmap, myId, rival.oppId, nextMatch);
    if (verliesreeks < 2) return null;
    return { naam: displayName(pmap[rival.oppId]), verliesreeks };
  })();
  // Promotie binnen handbereik.
  const promotieNabij =
    myTierNext?.volgende &&
    myTierNext.puntenNodig != null &&
    myTierNext.puntenNodig > 0 &&
    myTierNext.puntenNodig <= PROMOTIE_DREMPEL
      ? {
          divisie: myTierNext.volgende.naam,
          emoji: myTierNext.volgende.emoji,
          punten: myTierNext.puntenNodig,
        }
      : null;
  // Badge op een haar na klaar.
  const badgeNabij =
    nextBadge?.voortgang
      ? {
          naam: nextBadge.naam,
          emoji: nextBadge.emoji,
          nu: nextBadge.voortgang.nu,
          doel: nextBadge.voortgang.doel,
        }
      : null;
  const coachBriefingTekst = me
    ? coachBriefing({
        rank,
        streak,
        losing,
        heeftMatch: !!nextMatch,
        rivaalMatch,
        promotieNabij,
        dayDelta,
        vorm: form,
        badgeNabij,
        klassement: klassementFeiten(
          eloRanked.map((p) => ({
            playerId: p.player_id,
            naam: displayName(pmap[p.player_id] ?? p),
            rating: rmap[p.player_id]?.rating ?? null,
            games: rmap[p.player_id]?.games ?? 0,
          })),
          myId,
          "globaal",
        ),
        seed: `${myId}-${new Date().toISOString().slice(0, 10)}`,
        ctx: {
          intensiteit: myProfile?.roast_intensiteit ?? "gemeen",
          schild: myProfile?.roast_schild ?? false,
        },
      })
    : null;
  // Komen alle openstaande uitslagen uit één groep, link dan direct naar de
  // rondes van die groep in plaats van naar de algemene matchespagina.
  const plannedGroupId =
    planned.length > 0 &&
    planned[0].group_id &&
    planned.every((m) => m.group_id === planned[0].group_id)
      ? planned[0].group_id
      : null;

  // Mislukte kernquery → echte foutstaat i.p.v. lege stats en onboarding-
  // teksten die doen alsof de data weg is (issue #67). Baanbeschikbaarheid
  // heeft verderop zijn eigen melding en blijft hier bewust buiten.
  const coreQueries = [
    standings,
    results,
    myMatches,
    teams,
    profiles,
    friendships,
    groups,
    ratings,
    ratingHistory,
  ];
  const coreError = coreQueries.find((q) => q.error)?.error ?? null;
  if (coreError) {
    return (
      <div className="dashboard">
        <section className="hero">
          <div className="hero__main">
            <Avatar profile={myProfile} name={myName || undefined} size={56} />
            <div className="hero__text">
              <p className="hero__eyebrow">Welkom terug</p>
              <h1 className="hero__name">{myName ? `Hoi, ${myName}` : "Hoi!"}</h1>
            </div>
          </div>
        </section>
        <section className="card">
          <p className="msg msg--error">
            Het dashboard kon niet laden: {coreError}
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              for (const q of coreQueries) if (q.error) q.reload();
            }}
          >
            Opnieuw proberen
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* De hero draagt de status van de speler zelf (#613): keizerlijk donker
          voor de zittende dictator, roze/goud voor de Big Daddy. Kleur is nooit
          de enige indicator — de HeroCrest-chips hieronder blijven staan. */}
      <section
        className={`hero${
          isDictator
            ? " hero--dictator"
            : isBigDaddy
              ? " hero--bigdaddy"
              : ""
        }`}
      >
        <div className="hero__main">
          <Avatar profile={myProfile} name={myName || undefined} size={56} />
          <div className="hero__text">
            <p className="hero__eyebrow">Racket in de aanslag?</p>
            <h1 className="hero__name">
              {myName ? `Hoi, ${myName}` : "Hoi!"}
              <TierBadge
                rating={myRating}
                dimmed={myRatingGames > 0 && myRatingGames < THIN_GAMES}
              />
            </h1>
            {standings.loading ? (
              // Geen "speel je eerste match"-flits terwijl de stand nog laadt.
              <span className="sk sk--line hero__sub-sk" aria-hidden="true" />
            ) : (
              <p className="hero__sub">
                {me
                  ? `Je bezet momenteel plek #${rank || "?"} in het klassement met een rating van ${myRating || "1000"}.`
                  : myProfile
                    ? coachEmptyState({
                        type: "dashboard",
                        seed: `${myId}-empty-dashboard`,
                        ctx: {
                          intensiteit: myProfile.roast_intensiteit ?? "gemeen",
                          schild: myProfile.roast_schild ?? false,
                        },
                      })
                    : "Kom in beweging en speel je eerste match om het klassement te bestormen!"}
              </p>
            )}
            {(isDictator ||
              isBigDaddy ||
              isZwartePiet ||
              isWeekPias ||
              earnedBadges.length > 0) && (
              <div className="hero__titles" aria-label="Jouw titels en badges">
                {isDictator && (
                  <HeroCrest
                    variant="dictator"
                    emoji={DICTATOR_EMOJI}
                    label="El Padelissimo"
                    uitleg={`Zittende dictator — ${dictatorPropaganda(myId)}.`}
                  />
                )}
                {isBigDaddy && (
                  <HeroCrest
                    variant="bigdaddy"
                    emoji={BIG_DADDY_EMOJI}
                    label="Big Daddy"
                    uitleg="#1 van het klassement — de baas van de baan."
                  />
                )}
                {isZwartePiet && (
                  <HeroCrest
                    variant="piet"
                    emoji={roastSchild ? "📊" : "🃏"}
                    label={roastSchild ? "Schande-token" : "Zwarte Piet"}
                    uitleg="Jij draagt het rondgaande schande-token van de groep — tot je wint en het doorschuift."
                  />
                )}
                {isWeekPias && (
                  <HeroCrest
                    variant="pias"
                    emoji={roastSchild ? "📊" : "🤡"}
                    label={roastSchild ? "Opvallende week" : "Pias van de week"}
                    uitleg="De grootste afgang van de week — de clown van de groep."
                  />
                )}
                {earnedBadges.length > 0 && (
                  <BadgeStrip badges={earnedBadges} to={`/spelers/${myId}`} />
                )}
              </div>
            )}
            {coachBriefingTekst && !standings.loading && (
              <p className="hero__coach" role="note">
                <CoachAvatar size={26} className="hero__coach-face" />
                <span>
                  <span className="hero__coach-name">{COMMENTATOR.naam}:</span>{" "}
                  {coachBriefingTekst}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="hero__divide" aria-hidden="true" />
        <div className="hero__foot">
          {form.length > 0 && (
            <Link className="hero__form" to={`/spelers/${myId}`}>
              <span className="hero__form-label">Vorm</span>
              <FormChips form={form} />
            </Link>
          )}
          <div className="hero__actions">
            <Link className="btn btn--primary" to="/matches">
              + Match loggen
            </Link>
            <Link className="btn" to={generateCta.to}>
              {generateCta.label}
            </Link>
            <Link className="btn" to="/banen">
              Vrije banen
            </Link>
          </div>
        </div>
      </section>

      {showOnboarding && myProfile && (
        <section className="card onboard">
          <div className="card__head">
            <h2 className="card__title">Jouw weg naar de top</h2>
            <button
              className="onboard__dismiss"
              onClick={dismissOnboarding}
              aria-label="Verberg deze checklist"
            >
              ✕
            </button>
          </div>
          {/* Rudy's welkom hoort alleen bij echte nieuwkomers: wie al matches
              speelde maar bv. nog een groep mist, krijgt geen "speel je
              eerste match"-praatje (#301). */}
          {!hasPlayed && (
            <div className="onboard__coach">
              <CoachBubble mood="mild" size={24}>
                <span className="coach-sneer__text">
                  {coachEmptyState({
                    type: "dashboard",
                    seed: `${myId}-onboard`,
                    ctx: {
                      intensiteit: myProfile.roast_intensiteit ?? "gemeen",
                      schild: myProfile.roast_schild ?? false,
                    },
                  })}
                </span>
              </CoachBubble>
            </div>
          )}
          <ul className="onboard__list">
            <OnboardStep
              done={hasFriend}
              to="/vrienden"
              label="Speelmaten zoeken"
              hint="Zoek je vrienden op gebruikersnaam en daag ze direct uit."
            />
            <OnboardStep
              done={hasGroup}
              to="/groepen"
              label="Richt je eigen clubje op"
              hint="Verzamel al je speelmaatjes in een groep met een eigen, genadeloos klassement."
            />
            <OnboardStep
              done={hasPlayed}
              to="/matches"
              label="De kooi in!"
              hint="Log je eerste match of genereer direct evenwichtige teams om te knallen."
            />
          </ul>
        </section>
      )}

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

      {/* Speeldag op het overzicht: een lopende poll om op te stemmen, of de
          vastgelegde/geboekte datum als reminder bij het inloggen. */}
      {pollPick?.kind === "open" && (
        <section className="card poll-banner">
          <div className="card__head">
            <h2 className="card__title card__title--tight">
              📆 Speeldag-poll loopt · {pollPick.group.name}
            </h2>
          </div>
          <p className="poll-banner__text">
            {pollPick.optionCount === 1
              ? "Eén moment staat open"
              : `${pollPick.optionCount} momenten staan open`}
            {" · "}
            {pollPick.voterCount === 0
              ? "nog niemand stemde"
              : `${pollPick.voterCount} ${pollPick.voterCount === 1 ? "lid" : "leden"} stemden al`}
            {pollPick.iVoted ? "." : " — jij nog niet."}
          </p>
          <Link
            className={`btn btn--sm${pollPick.iVoted ? "" : " btn--primary"}`}
            to={`/groepen/${pollPick.group.id}?tab=plannen`}
          >
            {pollPick.iVoted ? "Bekijk de poll →" : "Stem nu →"}
          </Link>
        </section>
      )}
      {pollPick?.kind === "fixed" && (
        <section className="card poll-banner poll-banner--fixed">
          <div className="card__head">
            <h2 className="card__title card__title--tight">
              🎾 Speeldag {pollPick.booked ? "geboekt" : "gekozen"} ·{" "}
              {pollPick.group.name}
            </h2>
          </div>
          <p className="poll-banner__text">
            Jullie spelen {pollDay(pollPick.date)} om {pollPick.startTime}
            {pollPick.booked ? " — baan geboekt ✓" : " — baan nog te boeken."}
          </p>
          <Link
            className={`btn btn--sm${pollPick.booked ? "" : " btn--primary"}`}
            to={`/groepen/${pollPick.group.id}?tab=plannen`}
          >
            {pollPick.booked ? "Bekijk →" : "Regel de baan →"}
          </Link>
        </section>
      )}

      {/* Padel Wrapped (#115): eindejaarsbanner, 15 dec t/m 31 jan. */}
      {toonWrapped && (
        <section className="card wrapped-banner">
          <div className="card__head">
            <h2 className="card__title card__title--tight">
              Jouw jaar in padel is klaar 🎁
            </h2>
          </div>
          <p className="wrapped-banner__text">
            Bekijk je Wrapped {wrappedYr}: jouw matches, reeksen en rivalen van
            het afgelopen jaar.
          </p>
          <div className="wrapped-banner__actions">
            <button
              className="btn btn--sm btn--primary"
              aria-haspopup="dialog"
              onClick={() => setWrappedOpen(true)}
            >
              Bekijk
            </button>
            <button className="btn btn--sm" onClick={dismissWrapped}>
              Later
            </button>
          </div>
        </section>
      )}

      {wrappedOpen && (
        <WrappedSheet
          jaar={wrappedYr}
          playerId={myId}
          naam={myName}
          matches={myGames}
          teams={tmap}
          profiles={profiles.data ?? {}}
          ratingHistory={ratingHistory.data ?? []}
          rating={myRating}
          onClose={() => setWrappedOpen(false)}
        />
      )}

      {nextMatch && (
        <section className="card card--next">
          <div className="card__head">
            <h2 className="card__title">Jouw volgende match</h2>
            <Link className="profile-link" to={`/matches/${nextMatch.id}`}>
              Invullen →
            </Link>
          </div>
          {/* Bewust compact op het overzicht (#273): wie + wanneer, en één tik
              naar de match zelf voor de uitslag — de score-invoer hoort daar,
              niet op de startpagina (zeker niet op mobiel). */}
          <Link
            className="next-match"
            to={`/matches/${nextMatch.id}`}
            aria-label={`Volgende match — ${matchWhen(nextMatch, nextMatchGroupName)}`}
          >
            <div className="match-card">
              <TeamSide team={tmap[nextMatch.team_a_id]} profiles={pmap} won={false} />
              <span className="match-card__mid">
                <span className="match-card__meta">
                  {matchWhen(nextMatch, nextMatchGroupName)}
                </span>
              </span>
              <TeamSide
                team={tmap[nextMatch.team_b_id]}
                profiles={pmap}
                won={false}
                right
              />
            </div>
          </Link>
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

          {eveningSum.biggestUpset && (
            <p className="evening__upset">
              <span aria-hidden="true">🎯</span> Grootste upset:{" "}
              <strong>
                {teamLabel(tmap[eveningSum.biggestUpset.winnerTeamId], pmap)}
              </strong>{" "}
              ({Math.round(eveningSum.biggestUpset.chance * 100)}% kans)
            </p>
          )}

          {evening.isToday && (
            <div className="evening__actions">
              <ShareEvening
                groupId={eveningGroup.id}
                groupName={eveningGroup.name}
                matches={eveningMatches}
                teams={tmap}
                profiles={pmap}
                histories={histories.data ?? undefined}
                intensiteit={myProfile?.roast_intensiteit ?? "gemeen"}
              />
            </div>
          )}
        </section>
      )}

      {standings.loading ? (
        <StatsSkeleton />
      ) : (
        <div className="stats">
          {/* Divisie als badge-pill i.p.v. grote tekst: lange divisienamen
              ("Racketconsument III") passen zo netjes in de tegel (#374). */}
          <div className="stat stat--accent">
            <span className="stat__value stat__value--tier">
              {tierFor(myRating) ? <TierBadge rating={myRating} /> : "—"}
            </span>
            <span className="stat__label">Divisie</span>
          </div>
          <Stat label="Positie" value={rank ? `#${rank}` : "—"} />
          <Stat label="Winrate" value={rate != null ? `${rate}%` : "—"} />
          <Stat label="Gespeeld" value={me?.played ?? 0} />
        </div>
      )}

      {/* Gamification-kolom (rating, weekmissies, pias, badge, rivaal). Blijft
          hier tot #276 die naar het profiel/paspoort verhuist; #273 haalt enkel
          de schermduplicaten (feed, uitslagen, topspelers, banen) weg. */}
      <div className="grid">
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
                  {dayDelta !== 0 && (
                    <span
                      className={`stat__delta ${dayDelta > 0 ? "is-up" : "is-down"}`}
                    >
                      {dayDelta > 0 ? "▲" : "▼"}
                      {Math.abs(dayDelta)}
                    </span>
                  )}
                  <TierBadge
                    rating={myRating}
                    dimmed={myRatingGames > 0 && myRatingGames < THIN_GAMES}
                  />
                </p>
              )}
              {!ratings.loading && myTierNext && (
                <p className="rating-card__next">
                  Nog <strong>{myTierNext.puntenNodig}</strong> rating tot{" "}
                  {myTierNext.volgende!.emoji} {myTierNext.volgende!.naam}.
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

          {/* Pias-alarm blijft zichtbaar (#276): deze kaart verschijnt alléén
              als jíj deze week de pias bent — een tijdgevoelige waarschuwing,
              geen kaart om weg te vouwen. Sinds #643 uit de serverbron
              (pias_of_week), zodat het alarm dezelfde persoon roept als
              banner, feed en FUT-kaart. */}
          {mijnWeekPias && (
            <PiasCard
              matches={[]}
              teams={tmap}
              profiles={pmap}
              scope="week"
              restrictTo={myId}
              selfId={myId}
              pias={{
                playerId: mijnWeekPias.playerId,
                reden: mijnWeekPias.reden,
                detail: piasDetail(mijnWeekPias.reden, mijnWeekPias.waarde),
                ernst: mijnWeekPias.ernst,
                waarde: mijnWeekPias.waarde,
              }}
            />
          )}

          {/* Overige gamification samengevouwen (#276): weekmissies,
              badge-voortgang en rivaal — bereikbaar, maar niet langer
              concurrerend met de kern. De rating/divisie hierboven blijft
              zichtbaar want dát is de kern-gamification. */}
          {((!!myMatches.data && !!teams.data) ||
            !!(nextBadge && nextBadge.voortgang) ||
            !!rival) && (
            <details className="dash-extras">
              <summary className="dash-extras__summary">
                <span className="dash-extras__title">Jouw spel &amp; stats</span>
                <span className="dash-extras__hint">
                  weekmissies · badges · rivaal
                </span>
              </summary>
              <div className="dash-extras__body">
                {myMatches.data && teams.data && (
                  <WeekMissions matches={myMatches.data} teams={tmap} myId={myId} />
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
                        <span className="next-badge__hint">
                          {nextBadge.omschrijving}
                        </span>
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
                              (nextBadge.voortgang.nu / nextBadge.voortgang.doel) *
                                100,
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
                      <h2 className="card__title">Aartsrivaal ⚔️</h2>
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
                      <span
                        className={`rival__verdict rival__verdict--${rivalVerdict(rival.rec)}`}
                      >
                        {rivalVerdictLabel(rival.rec)}
                      </span>
                    </div>
                  </section>
                )}
              </div>
            </details>
          )}

      </div>

      <InstallPrompt />

      <PushPrompt userId={myId} />

      {/* Baan-teaser (#273): enkel de eerstvolgende vrije baan als reminder —
          het volledige rooster woont op de Banen-tab (één tik verder). */}
      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Vrije banen vandaag</h2>
          <Link className="profile-link" to="/banen">
            Alle dagen →
          </Link>
        </div>
        {availability.loading ? (
          <Skeleton rows={1} />
        ) : availability.error ? (
          <p className="msg msg--error">{availability.error}</p>
        ) : availability.data ? (
          <NextFreeLine slot={nextFree} />
        ) : null}
      </section>
    </div>
  );
}

export default Dashboard;
