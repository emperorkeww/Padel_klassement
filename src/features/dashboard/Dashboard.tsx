import { useEffect } from "react";
import { Link } from "react-router-dom";
import { recentForm, winRate, winStreak, lossStreak } from "@/features/rating/results";
import { deriveBadges } from "@/features/profiles/badges";
import { isoParts } from "@/features/standings/pias";
import { spelerVanDeWeek } from "@/features/standings/spelerVanDeWeek";
import { onFireSpelers } from "@/features/standings/onFire";
import { editieLabel, type EditieContext } from "@/features/standings/edities";
import { PiasCard } from "@/features/groups/components/PiasCard";
import { piasDetail } from "@/features/groups/maandpias";
import { categorize } from "@/features/friends/api";
import { displayName } from "@/features/profiles/api";
import { byRank } from "@/features/rating/standings";
import { deltaToday } from "@/features/standings/ratingDelta";
import {
  cachedName,
  rememberName,
  pickRival,
  heroCrestTekst,
  openstaandeUitslagen,
  pickPollBanner,
} from "./dashboardHelpers";
import { heroOverlay, heroPermanent } from "./heroThema";
import { DashboardPrompts } from "./components/DashboardPrompts";
import { EveningCard } from "./components/EveningCard";
import { PollBanner } from "./components/PollBanner";
import { StemKaart } from "./components/StemKaart";
import { kiesStemMomenten } from "./stemMomenten";
import { VarStemKaart } from "./components/VarStemKaart";
import { VENSTER_UREN } from "@/features/matches/appeal";
import { NextMatchCard } from "./components/NextMatchCard";
import { StatsRow } from "./components/StatsRow";
import { CourtTeaser } from "./components/CourtTeaser";
import { RatingCard } from "./components/RatingCard";
import { DashExtras } from "./components/DashExtras";
import { DashCijfers } from "./components/DashCijfers";
import { VandaagSkeleton } from "./components/VandaagSkeleton";
import { EmptyState } from "@/ui/EmptyState";
import { DashboardHero } from "./components/DashboardHero";
import { DashboardError } from "./components/DashboardError";
import { OnboardCard } from "./components/OnboardCard";
import { WrappedBanners } from "./components/WrappedBanners";
import { dashboardBriefing } from "./dashboardBriefing";
import { useDashboardData } from "./useDashboardData";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import "./Dashboard.css";

export function Dashboard() {
  usePageTitle("Overzicht");
  // Alle bronnen, hun realtime-verversing en de kern-foutstaat zitten in de
  // hook (#736); hier blijft alleen wat het scherm ermee doet.
  const {
    myId,
    user,
    club,
    standings,
    myMatches,
    teams,
    profiles,
    friendships,
    groups,
    zwartePiet,
    piasWeeks,
    ratings,
    ratingHistory,
    histories,
    dictator,
    kampioen,
    availability,
    openPolls,
    completed,
    evening,
    onMatches,
    coreError,
    retryCore,
    coreLoading,
    vandaagLoading,
  } = useDashboardData();

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
  const { accepted } = categorize(friendships.data ?? [], myId);
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
  // Alle groepen waarin ik deze week de pias ben (#655): de crest noemt de
  // groep(en) bij naam, zodat duidelijk is dat dit de groeps-scope is en niet
  // de club-brede kaart-editie.
  const mijnPiasWeken = Object.values(piasWeeks.data ?? {})
    .flat()
    .filter((r) => r.weekStart === huidigeWeek && r.playerId === myId);
  const mijnWeekPias = mijnPiasWeken[0] ?? null;
  const isWeekPias = mijnWeekPias != null;
  const piasGroepNaam = mijnWeekPias
    ? ((groups.data ?? []).find((g) => g.id === mijnWeekPias.groupId)?.name ??
      null)
    : null;
  const piasWaar =
    mijnPiasWeken.length > 1
      ? `in ${mijnPiasWeken.length} van je groepen`
      : piasGroepNaam
        ? `in ${piasGroepNaam}`
        : "in je groep";
  const roastSchild = myProfile?.roast_schild ?? false;
  // De drie club-brede kaart-edities die de hero sinds #760 óók draagt. Bewust
  // met dezelfde functies als klassement, matchdetail en profiel — geen tweede
  // definitie van "wie is In-Form": spelerVanDeWeek en onFireSpelers rekenen op
  // de gedeelde historie die useDashboardData toch al laadt, de kampioen komt
  // uit getSeizoenskampioen.
  //
  // Niet via laadEditieContext() (#699), hoewel dat de hele context in één keer
  // zou geven: die haalt ook de club-brede pias en Zwarte Piet op, en de hero
  // gebruikt daarvoor juist de groeps-scope (#655/#645). Dat zouden dus twee
  // queries zijn voor data die de hero weggooit.
  const allHistories = histories.data ?? {};
  const inForm = spelerVanDeWeek(allHistories);
  const onFire = onFireSpelers(allHistories);
  const isKampioen = !!kampioen.data && kampioen.data.playerId === myId;
  const isInForm = inForm?.playerId === myId;
  const isOnFire = onFire[myId] != null;
  // Editie-regels voor de crests uit editieLabel(), zodat hero en FUT-kaart
  // dezelfde tekst tonen ("⚡ In-Form · +48"). Alleen de drie club-brede velden
  // zijn hier gevuld: editieLabel wordt in de hero nooit voor icon/pias/piet
  // aangeroepen — die drie hebben hun eigen, groeps-gescopete crest hieronder.
  const editieCtx: EditieContext = {
    dictatorId: dictator.data?.profileId ?? null,
    iconKey: null,
    kampioen: kampioen.data ?? null,
    inForm,
    onFire,
    pias: null,
    piet: null,
  };
  const editieCrest = (editie: "kampioen" | "inform" | "onfire") =>
    heroCrestTekst(editieLabel(editie, editieCtx, myId) ?? "");
  // Skin van de kaart (#613/#644/#760, herzien #771): twee assen — het permanente
  // materiaal en de tijdelijke overlay erover. De prioriteit binnen elke as en de
  // rol van het roast-schild zitten in heroThema.ts, zodat die regels getest zijn
  // en op één plek staan.
  const statusVlaggen = {
    dictator: isDictator,
    bigDaddy: isBigDaddy,
    kampioen: isKampioen,
    inForm: isInForm,
    onFire: isOnFire,
    pias: isWeekPias,
    piet: isZwartePiet,
    schild: roastSchild,
  };
  const thema = heroPermanent(statusVlaggen);
  const overlay = heroOverlay(statusVlaggen);
  // Naam direct tonen zonder e-mail-flits: zolang de profielen laden valt de
  // begroeting terug op de gecachete naam van een eerder bezoek.
  const myName = myProfile
    ? displayName(myProfile)
    : (cachedName(myId) ?? (profiles.loading ? "" : (user?.email ?? "speler")));
  useEffect(() => {
    if (myProfile) rememberName(myId, displayName(myProfile));
  }, [myProfile, myId]);

  const myGames = myMatches.data ?? [];
  // Rudy's VAR (#1025): een zaak kan alleen bestaan op een match die je zélf
  // speelde en die minder dan 24 uur oud is — dat is het venster dat
  // point_appeals_guard afdwingt. Is er zo'n match niet, dan hoeft het overzicht
  // die query helemaal niet af te vuren en blijft de meetlat uit #736 staan.
  const varVenster = myGames.some(
    (g) =>
      g.status === "completed" &&
      g.played_at != null &&
      Date.now() - new Date(g.played_at).getTime() < VENSTER_UREN * 3600_000,
  );
  const form = recentForm(myGames, tmap, myId);
  const streak = winStreak(myGames, tmap, myId);
  // Verliesreeks (alleen relevant zonder lopende winstreak) voor een
  // neutraal-motiverende hero-boodschap.
  const losing = lossStreak(myGames, tmap, myId);
  const rate = me ? winRate(me.won, me.played) : null;
  const myRating = ratings.data?.[myId]?.rating ?? null;
  const myRatingGames = ratings.data?.[myId]?.games ?? 0;
  const rhist = ratingHistory.data ?? [];
  // Dag-cumulatieve ELO-beweging voor de ▲/▼-badge (#352), niet de laatste match.
  const dayDelta = deltaToday(rhist, club.timezone);

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

  const hasFriend = accepted.length > 0;
  const myGroups = groups.data ?? [];
  const hasGroup = myGroups.length > 0;
  const hasPlayed = (me?.played ?? 0) > 0;
  // Zolang de kernbronnen laden tonen we het cijfer-blok wél: de kaarten erin
  // hebben hun eigen skeleton, en anders zou de lege staat even flitsen voor
  // iemand die allang speelt (#911).
  const toonCijfers = coreLoading || hasPlayed;

  // Mijn openstaande matches, de langst wachtende uitslag vooraan (#1210).
  // Daarvóór stond de laagste ronde bovenaan; sinds de kaart de score-sheet
  // zelf opent, is de match van gisteren dringender dan die van volgende week.
  const planned = openstaandeUitslagen(myGames);
  const nextMatch = planned[0] ?? null;
  // Heeft de "Vandaag"-zone iets te melden? Zo niet, dan blijft ook de kop weg:
  // een lege zone met alleen een label is erger dan geen zone (#911). Voor de
  // speeldagen gebruiken we dezelfde twee keuze-functies als de kaarten zelf,
  // zodat kop en inhoud niet uit elkaar kunnen lopen.
  const heeftPoll =
    pickPollBanner(openPolls.data ?? [], myId, Date.now()) != null ||
    kiesStemMomenten(openPolls.data ?? [], myId, Date.now()) != null;
  const nextMatchGroupName = nextMatch?.group_id
    ? ((groups.data ?? []).find((g) => g.id === nextMatch.group_id)?.name ?? null)
    : null;
  const coachBriefingTekst = dashboardBriefing({
    myId,
    me,
    profile: myProfile,
    rank,
    streak,
    losing,
    vorm: form,
    dayDelta,
    matches: myGames,
    teams: tmap,
    profiles: pmap,
    ratings: rmap,
    eloRanked,
    nextMatch,
    rival,
    nextBadge,
    vandaag: new Date().toISOString().slice(0, 10),
  });

  if (coreError) {
    return (
      <DashboardError
        profile={myProfile}
        naam={myName}
        error={coreError}
        onRetry={retryCore}
      />
    );
  }

  return (
    <div className="dashboard">
      <DashboardHero
        myId={myId}
        profile={myProfile}
        naam={myName}
        rating={myRating}
        ratingGames={myRatingGames}
        heeftStand={!!me}
        loading={standings.loading}
        status={{
          dictator: isDictator,
          bigDaddy: isBigDaddy,
          kampioen: isKampioen,
          inForm: isInForm,
          onFire: isOnFire,
          piet: isZwartePiet,
          pias: isWeekPias,
          piasWaar,
          schild: roastSchild,
          thema,
          overlay,
          labels: {
            kampioen: editieCrest("kampioen"),
            inform: editieCrest("inform"),
            onfire: editieCrest("onfire"),
          },
        }}
        earnedBadges={earnedBadges}
        form={form}
        briefing={coachBriefingTekst}
      />

      {/* Hier stond tot #1232 een pillenstrook (#911, #1210). Beide pillen
          wezen naar iets dat inmiddels dichterbij ligt: de matchkaart in de
          Vandaag-zone opent de score-sheet zelf en Spelen draagt sinds #1227
          de attentiestip voor de rest, en een vriendschapsverzoek komt via de
          meldingen-inbox (#1090) binnen. De hero sluit nu direct aan op de
          eerstvolgende kaart. */}

      <OnboardCard
        myId={myId}
        profile={myProfile}
        hasFriend={hasFriend}
        hasGroup={hasGroup}
        hasPlayed={hasPlayed}
        loading={coreLoading}
      />

      {/* Rudy's VAR (#1025): een zaak die op jóuw stem wacht. Bewust bóven de
          Vandaag-zone en niet erin: het stemvenster loopt maar 12 uur, en die
          zone verschijnt alleen als er ook een poll, match of avond is. De
          kaart geeft null terug zodra er niets op je stem wacht. */}
      <VarStemKaart myId={myId} enabled={varVenster} />

      {/* Wat vandaag speelt, als één zone (#911). Poll, volgende match en
          avondkaart komen elk uit een eigen bron en vielen daardoor gespreid
          binnen — telkens bovenin, terwijl je verderop al las. Nu wisselt de
          zone in één keer van skeleton naar kaarten. */}
      {(vandaagLoading || heeftPoll || nextMatch || evening) && (
        <section className="dash-zone" aria-labelledby="dash-vandaag">
          <h2 className="dash-zone__titel" id="dash-vandaag">
            Vandaag
          </h2>
          <div className="dash-zone__body">
            {vandaagLoading ? (
              <VandaagSkeleton />
            ) : (
              <>
                {/* Eerst de vraag, dan de reminder: wat op jóu wacht staat
                    boven wat al vastligt (#1196). */}
                <StemKaart
                  bundles={openPolls.data ?? []}
                  myId={myId}
                  onGestemd={openPolls.reload}
                />

                <PollBanner bundles={openPolls.data ?? []} myId={myId} />

                {nextMatch && (
                  <NextMatchCard
                    match={nextMatch}
                    groupName={nextMatchGroupName}
                    teams={tmap}
                    profiles={pmap}
                    myId={myId}
                    onSaved={onMatches}
                  />
                )}

                {evening && (
                  <EveningCard
                    evening={evening}
                    groups={groups.data ?? []}
                    completed={completed}
                    teams={tmap}
                    profiles={pmap}
                    histories={histories.data ?? undefined}
                    intensiteit={myProfile?.roast_intensiteit ?? "radioactief"}
                    timezone={club.timezone}
                  />
                )}
              </>
            )}
          </div>
        </section>
      )}

      <WrappedBanners
        myId={myId}
        myName={myName}
        matches={myGames}
        teams={tmap}
        profiles={pmap}
        ratingHistory={rhist}
        rating={myRating}
      />

      {/* Pias-alarm blijft bewust búiten de inklapper (#276): deze kaart
          verschijnt alléén als jíj deze week de pias bent — een tijdgevoelige
          waarschuwing, geen kaart om weg te vouwen. Sinds #643 uit de
          serverbron (pias_of_week), zodat het alarm dezelfde persoon roept als
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

      {/* Het hele "hoe sta ik ervoor"-blok achter één inklapper (#911): eerder
          hingen statsrij en rating los boven de gamification-inklapper (#276),
          waardoor de pagina één rij gelijkwaardige kaarten was. Wie nog niet
          gespeeld heeft krijgt geen rij nullen maar één lege staat. */}
      {toonCijfers ? (
        <DashCijfers>
          <StatsRow
            loading={standings.loading}
            rank={rank}
            winrate={rate}
            played={me?.played ?? 0}
          />

          <RatingCard
            loading={ratings.loading}
            rating={myRating}
            dayDelta={dayDelta}
            history={rhist}
          />

          <DashExtras
            myId={myId}
            matches={myMatches.data}
            teams={teams.data}
            profiles={pmap}
            badges={allBadges}
            nextBadge={nextBadge}
            rival={rival}
          />
        </DashCijfers>
      ) : (
        <section className="card">
          <EmptyState
            icon="📈"
            title="Je cijfers beginnen bij je eerste match."
            action={
              <Link className="btn btn--primary" to="/spelen?log=1">
                Uitslag invullen
              </Link>
            }
          >
            Rating, klassementspositie, weekmissies en badges verschijnen hier
            zodra er een uitslag staat. Tot die tijd valt er weinig te meten.
          </EmptyState>
        </section>
      )}

      <CourtTeaser availability={availability} timezone={club.timezone} />

      {/* Hooguit één onderbreking per bezoek (#911); de gate kiest welke. */}
      <DashboardPrompts userId={myId} />
    </div>
  );
}

export default Dashboard;
