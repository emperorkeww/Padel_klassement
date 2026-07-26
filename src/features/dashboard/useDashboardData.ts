import { useCallback } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync, type AsyncState } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useRefetchOnFocus } from "@/lib/hooks/useRefetchOnFocus";
import { getPlayerStandings } from "@/features/standings/api";
import {
  getPlayerRatings,
  getRatingHistory,
  getRecentRatingHistories,
} from "@/features/standings/ratingsApi";
import { getRecentResults, getPlayerMatches, getTeamsMap } from "@/features/matches/api";
import { getZwartePiet } from "@/features/groups/zwartePietApi";
import { getPiasWeeks } from "@/features/standings/piasApi";
import { getHuidigeDictator } from "@/features/standings/dictatorApi";
import { getMyFriendships } from "@/features/friends/api";
import { getProfilesMap } from "@/features/profiles/api";
import { getMyGroups, type GroupSummary } from "@/features/groups/api";
import { getClubAvailability } from "@/features/availability/api";
import { useClub, type Club } from "@/features/availability/club";
import { dateInZone } from "@/lib/utils/time";
import { deriveEvening, loadOpenPolls } from "./dashboardHelpers";
import type { Match, PlayerRating, PlayerStanding, Profile, RatingPoint, Team } from "@/types";

// De datalaag van het overzicht (#736). Stond tot nu toe boven in Dashboard.tsx,
// tussen de afgeleide waarden en de opmaak; hier staat op één plek wat het
// scherm ophaalt, in welke volgorde, en wat er lui blijft tot het nodig is.
//
// Het aantal queries dat dit bij mount afvuurt is vastgepind in
// Dashboard.queries.test.tsx — die test legt ook per bron uit waaróm hij er is.

export type DashboardData = ReturnType<typeof useDashboardData>;

export function useDashboardData() {
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

  // Alleen echt gespeelde matches: de RPC-filter dekt dit al, maar client-side
  // filteren houdt afgeleide weergaven robuust (o.a. in tests).
  const completed = (results.data ?? []).filter((m) => m.status === "completed");
  // Speelavond-terugblik: uitslagen van de laatste speeldag (vandaag/gisteren).
  const evening = deriveEvening(completed, club.timezone);

  // Volledige rating-historie (gecacht) voor upset-chips + grootste-upset (#85).
  // De avondsamenvatting kijkt naar de matches van vandaag; die zitten per
  // definitie in ieders recente venster (#731).
  //
  // Alleen ophalen als de avondkaart er ook echt is (#736): dat is de enige
  // consument, en die rendert alleen op een dag dat er gespeeld is. `enabled`
  // springt één keer van false naar true zodra de uitslagen binnen zijn, en
  // nooit terug — dus geen herlaadlus.
  const histories = useAsync(getRecentRatingHistories, [], {
    enabled: evening != null,
  });

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
  const retryCore = () => {
    for (const q of coreQueries) if (q.error) q.reload();
  };

  return {
    myId,
    user,
    club,
    // Ruwe bronnen.
    standings: standings as AsyncState<PlayerStanding[]>,
    results,
    myMatches: myMatches as AsyncState<Match[]>,
    teams: teams as AsyncState<Record<string, Team>>,
    profiles: profiles as AsyncState<Record<string, Profile>>,
    friendships,
    groups: groups as AsyncState<GroupSummary[]>,
    zwartePiet,
    piasWeeks,
    ratings: ratings as AsyncState<Record<string, PlayerRating>>,
    ratingHistory: ratingHistory as AsyncState<RatingPoint[]>,
    histories,
    dictator,
    availability,
    openPolls,
    // Afgeleid uit de uitslagen; hier omdat `histories` eraan hangt.
    completed,
    evening,
    // Foutafhandeling van de kernbronnen.
    coreError,
    retryCore,
    coreLoading: standings.loading || friendships.loading || groups.loading,
  };
}

export type { Club };
