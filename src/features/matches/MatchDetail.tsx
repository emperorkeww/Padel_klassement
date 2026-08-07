import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { getMatch, getPlayerMatches, getTeamsByIds } from "./api";
import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { MatchBeheer } from "@/features/matches/components/MatchBeheer";
import { MatchScorebord } from "@/features/matches/components/MatchScorebord";
import { GroupLinkSection } from "@/features/matches/components/GroupLinkSection";
import { GuestSwapSection } from "@/features/matches/components/GuestSwapSection";
import { NetTouchesSection } from "@/features/matches/components/NetTouchesSection";
import { TotoSection } from "@/features/matches/components/TotoSection";
import { LefTipBlock } from "@/features/matches/components/LefTipBlock";
import { JokerBlock } from "@/features/matches/components/JokerBlock";
import { TraktatieBlock } from "@/features/matches/components/TraktatieBlock";
import { VarBlock } from "@/features/matches/components/VarBlock";
import { getGroup } from "@/features/groups/api";
import { getProfilesByIds, displayName } from "@/features/profiles/api";
import { formatDate } from "@/lib/utils/format";
import { Skeleton } from "@/ui/Skeleton";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { useBackTo } from "@/lib/hooks/useBackTo";
import { ShareMatch } from "@/features/matches/components/ShareMatch";
import { SmoesjesMachine } from "@/features/matches/components/SmoesjesMachine";
import { Lineup } from "@/features/matches/components/Lineup";
import { CHEMIE_MATCH_LIMIT } from "@/features/matches/chemistry";
import { matchRechten } from "@/features/matches/matchState";
import { roastCtx } from "@/features/coach/roastTone";
import {
  getRatingHistoriesForMatches,
  getRecentRatingHistories,
  mergeRatingHistories,
  getPlayerRatings,
} from "@/features/standings/ratingsApi";
import { getHuidigeDictator } from "@/features/standings/dictatorApi";
import { getPlayerStandings } from "@/features/standings/api";
import { spelerVanDeWeek } from "@/features/standings/spelerVanDeWeek";
import { getSeizoenskampioen } from "@/features/standings/kampioen";
import { getGlobalePias } from "@/features/standings/piasApi";
import { getGlobaleZwartePiet } from "@/features/groups/zwartePietApi";
import { currentPias } from "@/features/standings/pias";
import { onFireSpelers } from "@/features/standings/onFire";
import { iconKeyVoor, type EditieContext } from "@/features/standings/edities";
import { matchUpset, preMatchPoints } from "@/features/matches/upset";
import { matchDerby } from "@/features/matches/derby";
import { outcomeFor, playersOf } from "@/features/rating/results";
import { scoreHighlight } from "@/features/feed/feedLogic";
import "./MatchDetail.css";

export function MatchDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const match = useAsync(() => getMatch(id), [id]);
  // Bij een deeplink uit een pushbericht of gedeelde link is er geen vorige
  // pagina om naar terug te gaan (#910). Het vangnet is de groep waar deze
  // match bij hoort — dat is de context waar zo'n link vandaan komt (#915);
  // zonder groep valt hij terug op het matchoverzicht.
  const terug = useBackTo(
    match.data?.group_id ? `/groepen/${match.data.group_id}` : "/spelen",
  );
  // Tabtitel op de matchdatum (#910); blijft staan zolang de match laadt.
  usePageTitle(
    match.data
      ? `Match ${formatDate(match.data.played_at ?? match.data.created_at)}`
      : null,
  );
  // Alleen de twee teams en vier spelers van déze match ophalen, niet de
  // volledige teams- en profielentabellen.
  const teamIds = match.data ? [match.data.team_a_id, match.data.team_b_id] : [];
  const teamKey = teamIds.join(",");
  const teams = useAsync(() => getTeamsByIds(teamIds), [teamKey]);
  const playerIds = teamIds.flatMap((tid) => playersOf(teams.data?.[tid]));
  const playerKey = playerIds.join(",");
  const profiles = useAsync(() => getProfilesByIds(playerIds), [playerKey]);
  // Rating-historie (gecacht, app-breed gedeeld) voor de In-Form/On-Fire-editie
  // en de sparkline-achtige cijfers op de kaart.
  const recentHistories = useAsync(getRecentRatingHistories, []);
  // Chemie van de duo's (#427): recente matches van één speler per team — de
  // gezamenlijke duo-matches zijn daar een subset van — plus de huidige
  // ratings als terugval voor de kaart-Elo bij een geplande match.
  const ratings = useAsync(getPlayerRatings, []);
  const spelerA = teams.data?.[match.data?.team_a_id ?? ""]?.player1_id;
  const spelerB = teams.data?.[match.data?.team_b_id ?? ""]?.player1_id;
  const matchesA = useAsync(
    () =>
      spelerA
        ? getPlayerMatches(spelerA, CHEMIE_MATCH_LIMIT)
        : Promise.resolve([]),
    [spelerA],
  );
  const matchesB = useAsync(
    () =>
      spelerB
        ? getPlayerMatches(spelerB, CHEMIE_MATCH_LIMIT)
        : Promise.resolve([]),
    [spelerB],
  );
  // Voor de pre-match winkans (#85) en de duo-chemie (#427) tellen de échte
  // punten van precies déze matches. Die kunnen ouder zijn dan het gedeelde
  // venster (#731), dus haal ze gericht op en leg ze over de recente historie.
  const puntIds = useMemo(
    () => [
      id,
      ...(matchesA.data ?? []).map((x) => x.id),
      ...(matchesB.data ?? []).map((x) => x.id),
    ],
    [id, matchesA.data, matchesB.data],
  );
  const puntKey = puntIds.join(",");
  const matchHistories = useAsync(
    () => getRatingHistoriesForMatches(puntIds),
    [puntKey],
  );
  const hmap = useMemo(
    () =>
      mergeRatingHistories(
        recentHistories.data ?? {},
        matchHistories.data ?? {},
      ),
    [recentHistories.data, matchHistories.data],
  );

  // Groepstoon (roast-intensiteit) voor Coach Rudy's stem in de smoesjesmachine.
  const groupId = match.data?.group_id ?? null;
  const group = useAsync(
    () => (groupId ? getGroup(groupId) : Promise.resolve(null)),
    [groupId],
  );
  // De Troon (#545): wie is de zittende dictator? Wordt doorgegeven aan Lineup
  // voor consistente tier-weergave (dictator-special alleen voor de troonhouder).
  const dictator = useAsync(getHuidigeDictator, []);
  // Speciale edities (#497) ook op het veld (#621/#625): dezelfde
  // editie-context als klassement en profiel — Icon, Kampioen en In-Form.
  // Alle bronnen gecacht en app-breed gedeeld; hooks vóór de vroege returns.
  const standings = useAsync(getPlayerStandings, []);
  const kampioen = useAsync(getSeizoenskampioen, []);
  // Pias-editie (#631): de globale pias van deze (of anders vorige) week.
  const globalePias = useAsync(getGlobalePias, []);
  // Piet-editie (#645): de globale Zwarte Piet over alle groepen heen.
  const globaleZwartePiet = useAsync(getGlobaleZwartePiet, []);
  const inForm = useMemo(() => spelerVanDeWeek(hmap), [hmap]);
  // On-Fire (#632): actieve winstreaks uit dezelfde gedeelde histories.
  const onFire = useMemo(() => onFireSpelers(hmap), [hmap]);
  const editieCtx: EditieContext = {
    dictatorId: dictator.data?.profileId ?? null,
    iconKey: iconKeyVoor(
      standings.data ?? [],
      ratings.data ?? {},
      dictator.data?.profileId ?? null,
    ),
    kampioen: kampioen.data ?? null,
    inForm,
    onFire,
    pias: currentPias(globalePias.data ?? []),
    piet: globaleZwartePiet.data ?? null,
  };

  if (match.loading)
    return (
      // Speelt het scorebord na: twee teamvakken met de score in het midden.
      <div className="card md-board" aria-hidden="true">
        <div className="md-hero">
          <div className="md-meta">
            <span className="sk sk--pill" />
            <span className="sk sk--pill" />
          </div>
          <div className="md-versus">
            <div className="md-team">
              <Skeleton rows={2} />
            </div>
            <div className="md-score">
              <span className="sk sk--line" style={{ width: 72, height: 36 }} />
            </div>
            <div className="md-team">
              <Skeleton rows={2} />
            </div>
          </div>
        </div>
      </div>
    );
  if (!match.data)
    return (
      <ErrorRetry
        melding="Deze match bestaat niet (meer) of is niet zichtbaar voor jou."
        actie={
          <Link className="btn btn--sm" to="/spelen">
            Naar matches
          </Link>
        }
      />
    );

  const m = match.data;
  const tmap = teams.data ?? {};
  const pmap = profiles.data ?? {};
  const teamA = tmap[m.team_a_id];
  const teamB = tmap[m.team_b_id];
  const done = m.status === "completed";
  const isDraw = done && m.winner_team_id === null;
  // Upset: won de underdog? (winkans vooraf < 35%, uit de echte pre-match ratings)
  const prePoints = done ? preMatchPoints(hmap, m.id) : null;
  const upset =
    done && !isDraw ? matchUpset(m, tmap, prePoints ?? undefined) : null;
  const scoreHi = done ? scoreHighlight(m) : null;
  // Derby (#169): alle spelers in dezelfde hoofddivisie. Afgerond meet aan de
  // pre-match ratings; gepland aan de huidige.
  const derby = matchDerby(m, tmap, (pid) =>
    done
      ? (prePoints?.get(pid)?.rating_before ?? null)
      : (ratings.data?.[pid]?.rating ?? null),
  );
  // Beheert de kijker de groep waar deze match in hangt? (#978) De groep is
  // hier toch al geladen (voor Rudy's roast-toon), dus dit kost geen query.
  const beheertGroep =
    !!user && !!group.data && group.data.created_by === user.id;
  // Wie wat mag, in één keer (#1144) — zie matchState.ts voor de regels en hun
  // spiegel in de RLS-policies.
  const rechten = matchRechten({
    match: m,
    teams: tmap,
    myId: user?.id ?? null,
    isGroupOwner: beheertGroep,
  });
  // Verloor de kijker deze match? → de smoesjesmachine mag verschijnen.
  const iLost = !!user && outcomeFor(m, tmap, user.id) === "L";
  // De aanmaker en de groepseigenaar kunnen de score corrigeren.
  const canEdit = done && rechten.magCorrigeren;
  // Geplande match: dezelfde inline invoer als op de kaart, mits je meedoet,
  // hem hebt aangemaakt of de groep beheert — precies de kring die de
  // RLS-policies toestaan (#413, #978).
  const showPlanned = !done && rechten.magInvullen;
  // Gasten in deze match (#681). Alleen als er één is heeft de vervang-sectie
  // zin — zo betaalt een gewone match niet voor de extra queries daarin.
  const gastenInMatch = [teamA, teamB]
    .flatMap((t) => playersOf(t))
    .filter((pid) => pmap[pid]?.is_guest);
  // Grove poort voor de beheer-inklapper (#915): zonder sessie en op een nog
  // niet gespeelde match valt er sowieso niets te beheren. Of er daarna écht
  // iets in staat beslist MatchBeheer zelf — de secties erin geven pas ná hun
  // eigen query null terug.
  const toonBeheer = done || !!user;

  // Wie voerde deze uitslag in? (#915) Die persoon en de groepsbeheerder (#978)
  // kunnen hem corrigeren; zonder dat te zeggen leest het ontbreken van de knop
  // als een bug.
  const invoerder = m.created_by ? pmap[m.created_by] : undefined;
  const invoerderNaam = invoerder
    ? displayName(invoerder)
    : "degene die hem invoerde";

  return (
    <div>
      <header className="page-head">
        {/* Het scorebord ís de kop; voor screenreaders en de outline toch een h1. */}
        <h1 className="sr-only">Matchdetail</h1>
        <div className="row-between">
          <button className="btn btn--sm" onClick={terug}>
            ← Terug
          </button>
          {done && <ShareMatch match={m} teams={tmap} profiles={pmap} />}
        </div>
      </header>

      <MatchScorebord
        match={m}
        teams={tmap}
        profiles={pmap}
        histories={hmap}
        derby={derby}
        upset={upset}
        scoreHi={scoreHi}
        canEdit={canEdit}
        benIkInvoerder={m.created_by === user?.id}
        invoerderNaam={invoerderNaam}
        onSaved={() => match.reload()}
      />

      <Lineup
        match={m}
        teams={tmap}
        profiles={pmap}
        histories={hmap}
        ratings={ratings.data ?? {}}
        matchesA={matchesA.data ?? []}
        matchesB={matchesB.data ?? []}
        edities={editieCtx}
      />

      {/* Beheer & correcties achter één inklapper (#915): administratie die je
          hooguit één keer per match doet, en die anders als drie gelijkwaardige
          kaarten met de wedstrijd zelf concurreerde. Alleen renderen als er ook
          echt iets in zit — de secties erin geven zelf null terug wanneer ze
          niet van toepassing zijn, dus zonder deze check bleef er een lege balk
          over. */}
      {toonBeheer && (
        <MatchBeheer>
          {/* Netrollers (#809): alleen de speler zelf weet er zijn aantal van,
              dus invoer achteraf op de matchpagina in plaats van in de
              invoerwizard — die wordt vaak door iemand anders ingevuld. */}
          {done && (
            <NetTouchesSection
              match={m}
              profiles={pmap}
              magInvoeren={rechten.isDeelnemer}
            />
          )}

          {/* #648: losse match achteraf aan een groep koppelen (of verhangen/
              loskoppelen). key reset de lokale select-state na een geslaagde
              wijziging, wanneer de match herlaadt met de nieuwe group_id. */}
          {user && (
            <GroupLinkSection
              key={m.group_id ?? "los"}
              match={m}
              onSaved={() => match.reload()}
            />
          )}

          {done && user && gastenInMatch.length > 0 && (
            <GuestSwapSection
              match={m}
              guestIds={gastenInMatch}
              matchPlayerIds={playerIds}
              profiles={pmap}
              myId={user.id}
              onSaved={() => match.reload()}
            />
          )}
        </MatchBeheer>
      )}

      {iLost && (
        <SmoesjesMachine
          matchId={m.id}
          ctx={roastCtx(group.data, user ? pmap[user.id] : null)}
          groupId={m.group_id}
          playerId={user?.id}
        />
      )}

      {m.group_id != null && (
        <TotoSection match={m} teams={tmap} teamProfiles={pmap} />
      )}

      {/* Lef-tip (#804) en joker (#1003): op een gespeelde match blijft alleen
          de onthulling over — wie er dubbel of niets speelde, welke kaart er
          lag en hoe het afliep. Op een nog te spelen match zitten de keuzes in
          de PlannedMatchCard hieronder. */}
      {m.group_id != null && done && (
        <>
          <LefTipBlock
            match={m}
            profiles={pmap}
            myId={user?.id ?? null}
            isDeelnemer={rechten.isDeelnemer}
            mijnKans={null}
            games={0}
          />
          <JokerBlock
            match={m}
            profiles={pmap}
            myId={user?.id ?? null}
            isDeelnemer={rechten.isDeelnemer}
            mijnKans={null}
            games={0}
          />
        </>
      )}

      {/* Drankje-inzet (#1004). Hier en niet alleen in de wizard: gegenereerde
          rondes komen daar nooit langs, en het afvinken aan de bar gebeurt per
          definitie ná de match. Het blok verbergt zichzelf als er niets staat
          en jij er niets aan mag veranderen. Geldt ook buiten een groep — een
          weddenschap tussen vrienden heeft geen groep nodig. */}
      <TraktatieBlock
        match={m}
        profiles={pmap}
        magBeheren={rechten.magInvullen}
        onSaved={() => match.reload()}
      />

      {/* Rudy's VAR (#1025): één punt betwisten, de rest stemt. Het blok
          verbergt zichzelf als er geen zaak loopt en jij er geen kunt beginnen
          — op een oude match of voor wie niet meespeelde staat er dus niets.
          Een toekenning verschuift de uitslag, vandaar de reload. */}
      <VarBlock
        match={m}
        teams={tmap}
        profiles={pmap}
        myId={user?.id ?? null}
        group={group.data}
        onChanged={() => match.reload()}
      />

      {showPlanned && (
        <section className="card">
          <div className="card__head">
            {/* Blijft "Uitslag invullen" tot de score-invoer zelf herzien is;
                de nieuwe primaire actie uit matchState landt in een volgende
                stap van #1144, samen met de sheet die erbij hoort. */}
            <h2 className="card__title">Uitslag invullen</h2>
          </div>
          {/* Dezelfde inline invoer als bij "Te spelen": score/sets opslaan,
              agenda, tijd wijzigen en verwijderen. Rechten worden serverzijdig
              afgedwongen. Na verwijderen gaan we naar het matchoverzicht:
              "terug" naar een zojuist verwijderde match slaat nergens op, dus
              hier bewust géén useBackTo maar een harde vervanging (#910). */}
          <PlannedMatchCard
            match={m}
            teams={tmap}
            profiles={pmap}
            perspectiveId={user?.id}
            onSaved={() => match.reload()}
            onDeleted={() => navigate("/spelen", { replace: true })}
          />
        </section>
      )}
    </div>
  );
}

export default MatchDetail;
