import { useCallback, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { MatchListSkeleton, Skeleton } from "@/ui/Skeleton";
import { getGroup, getGroupMembers } from "./api";
import { getGroupMatches, getTeamsMap } from "@/features/matches/api";
import { dateInZone } from "@/lib/utils/time";
import { useClub } from "@/features/availability/club";
import { getGroupPlayerStandings } from "@/features/standings/api";
import { getPlayerRatings, getAllRatingHistories } from "@/features/standings/ratingsApi";
import { getProfilesMap } from "@/features/profiles/api";
import { getZwartePiet } from "./zwartePietApi";
import { getMyFriendships, categorize, otherId } from "@/features/friends/api";
import { MatchHistory } from "@/features/matches/components/MatchHistory";
import { buildMatchRatings } from "@/features/groups/maandpias";
import { PlanTab } from "@/features/groups/components/PlanTab";
import { SpelenTab } from "@/features/groups/components/SpelenTab";
import { VandaagTab } from "@/features/groups/components/VandaagTab";
import { computePlayerStandings, matchesInSeason } from "@/features/rating/standings";
import { upsetsByMatch } from "@/features/matches/upset";
import { computePredictionStandings } from "@/features/matches/predictions";
import {
  getGroupPredictions,
  getGroupPredictionStandings,
} from "@/features/matches/predictionsApi";
import {
  isSeasonClosed,
  listSeasons,
  seasonFromId,
} from "@/features/rating/seasons";
import { errorMessage } from "@/lib/utils/errors";
import { groupByRound } from "./groupDetailHelpers";
import { GroupStandTab } from "./components/GroupStandTab";
import { GroupLedenTab } from "./components/GroupLedenTab";
import type { PlayerStanding } from "@/types";
import "./GroupDetail.css";

type View = "rondes" | "plannen" | "spelen" | "matches" | "stand" | "leden";

export function GroupDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const group = useAsync(() => getGroup(id), [id]);
  const members = useAsync(() => getGroupMembers(id), [id]);
  const matches = useAsync(() => getGroupMatches(id), [id]);
  const standings = useAsync(() => getGroupPlayerStandings(id), [id]);
  const piet = useAsync(getZwartePiet, []);
  const profiles = useAsync(getProfilesMap, []);
  const teams = useAsync(getTeamsMap, []);
  const friendships = useAsync(getMyFriendships, []);

  // Voor het rating-klassement op de Stand-tab (#52).
  const ratings = useAsync(getPlayerRatings, []);
  const histories = useAsync(getAllRatingHistories, []);

  // Toto (#116): tips + voorspellersklassement van deze groep.
  const predictions = useAsync(() => getGroupPredictions(id), [id]);
  const predictionStandings = useAsync(
    () => getGroupPredictionStandings(id),
    [id],
  );

  const onPredictions = useCallback(() => {
    predictions.reload();
    predictionStandings.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictions.reload, predictionStandings.reload]);

  const onMatches = useCallback(() => {
    matches.reload();
    standings.reload();
    teams.reload();
    ratings.reload();
    histories.reload();
    // De Zwarte Piet verhuist ook bij een uitslag/correctie (#185).
    piet.reload();
    // Een uitslag of correctie beoordeelt ook de tips (grading-trigger).
    onPredictions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.reload, standings.reload, teams.reload, ratings.reload, histories.reload, piet.reload, onPredictions]);
  // Alleen reageren op wijzigingen binnen déze groep, niet op elke match
  // die ergens anders wordt gelogd.
  useRealtime("matches", onMatches, `group_id=eq.${id}`);
  useRealtime("group_members", members.reload, `group_id=eq.${id}`);
  useRealtime("match_predictions", onPredictions, `group_id=eq.${id}`);

  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // De actieve tab leeft in de URL: refresh-bestendig en deelbaar
  // ("kijk even bij de stand").
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const view: View =
    rawTab === "stand" ||
    rawTab === "leden" ||
    rawTab === "plannen" ||
    rawTab === "spelen" ||
    rawTab === "matches"
      ? rawTab
      : "rondes";
  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === "rondes") next.delete("tab");
    else next.set("tab", v);
    setParams(next, { replace: true });
  };
  const pmap = useMemo(() => profiles.data ?? {}, [profiles.data]);
  const tmap = useMemo(() => teams.data ?? {}, [teams.data]);
  // Upsets per match-id (#85) uit de al geladen rating-historie.
  const upsets = useMemo(
    () => upsetsByMatch(matches.data ?? [], tmap, histories.data ?? {}),
    [matches.data, tmap, histories.data],
  );
  const memberList = members.data ?? [];
  // De huidige Zwarte Piet-drager van déze groep (#185), of null als de Piet vrij is.
  const zwartePiet = piet.data?.[id] ?? null;
  const isOwner = group.data?.created_by === myId;

  const memberIds = new Set(memberList.map((m) => m.player_id));
  const { accepted } = categorize(friendships.data ?? [], myId);
  const addableFriendIds = accepted
    .map((f) => otherId(f, myId))
    .filter((pid) => !memberIds.has(pid));

  // Groepsseizoenen (kwartalen) voor de stand — dezelfde logica als het globale
  // klassement, maar client-side berekend uit de matches van deze groep.
  const season = seasonFromId(params.get("seizoen") ?? "");
  const setSeasonId = (sid: string) => {
    const next = new URLSearchParams(params);
    if (sid) next.set("seizoen", sid);
    else next.delete("seizoen");
    setParams(next, { replace: true });
  };
  const completedMatches = (matches.data ?? []).filter(
    (m) => m.status === "completed",
  );
  // Pre-match ratings voor de choke-detectie van de pias van de maand.
  const piasRatings = useMemo(
    () => buildMatchRatings(histories.data ?? {}),
    [histories.data],
  );
  const firstMatchDate = completedMatches.reduce<string | null>((min, m) => {
    const d = m.played_at ?? m.created_at;
    return min === null || d < min ? d : min;
  }, null);
  const seasons = firstMatchDate ? listSeasons(new Date(firstMatchDate)) : [];
  const seasonStandings: PlayerStanding[] | null = season
    ? computePlayerStandings(
        matchesInSeason(completedMatches, season),
        tmap,
        pmap,
      )
    : null;
  const shownStandings = season ? (seasonStandings ?? []) : (standings.data ?? []);
  const champion =
    season && isSeasonClosed(season) && shownStandings.length > 0
      ? shownStandings[0]
      : null;

  // Voorspellersklassement: all-time uit de view; per seizoen client-side uit
  // de tips van de matches in dat kwartaal — zelfde hybride als de punten.
  const shownPredictionStandings = (() => {
    if (!season) return predictionStandings.data ?? [];
    const inSeason = new Set(
      matchesInSeason(completedMatches, season).map((m) => m.id),
    );
    return computePredictionStandings(
      (predictions.data ?? []).filter((p) => inSeason.has(p.match_id)),
      pmap,
    );
  })();

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      members.reload();
      matches.reload();
      standings.reload();
      teams.reload();
      profiles.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Reis-CTA: alles van vandaag gespeeld → door naar de stand (#106).
  const club = useClub();
  const today = dateInZone(club.timezone);
  const todaysMatches = (matches.data ?? []).filter(
    (m) => (m.played_at ?? m.created_at).slice(0, 10) === today,
  );
  const dayDone =
    todaysMatches.length > 0 &&
    todaysMatches.every((m) => m.status === "completed");

  // De Vandaag-tab toont enkel de rondes van vandaag; de volledige historie
  // staat op de Matches-tab (#342).
  const rounds = groupByRound(todaysMatches);
  // Ronde met openstaande uitslagen (blokkeert Mexicano in MakeTeams).
  const openRound = rounds.find(({ list }) =>
    list.some((m) => m.status !== "completed"),
  );

  if (group.loading)
    return (
      <div className="card">
        <Skeleton rows={2} />
        <MatchListSkeleton count={2} />
      </div>
    );
  if (!group.data)
    return (
      <p className="msg msg--error">Groep niet gevonden of geen toegang.</p>
    );

  return (
    <div>
      <header className="page-head">
        <div className="row-between">
          <h1 className="page-title">{group.data.name}</h1>
          <Link className="btn btn--sm" to="/spelen?hub=1">
            ← Spelen
          </Link>
        </div>
        <p className="page-subtitle">
          {memberList.length} leden{isOwner ? " · jij bent eigenaar" : ""}
        </p>
      </header>

      {/* Tabs in reis-volgorde (#106): plannen → spelen → stand. */}
      <div className="tabs">
        <button
          className={`tab ${view === "plannen" ? "is-active" : ""}`}
          onClick={() => setView("plannen")}
        >
          Plannen
        </button>
        <button
          className={`tab ${view === "rondes" ? "is-active" : ""}`}
          onClick={() => setView("rondes")}
        >
          Vandaag
          {rounds.length > 0 && (
            <span className="tab__count" aria-hidden="true">
              {rounds.length}
            </span>
          )}
        </button>
        <button
          className={`tab ${view === "spelen" ? "is-active" : ""}`}
          onClick={() => setView("spelen")}
        >
          Spelen
        </button>
        <button
          className={`tab ${view === "matches" ? "is-active" : ""}`}
          onClick={() => setView("matches")}
        >
          Matches
          {completedMatches.length > 0 && (
            <span className="tab__count" aria-hidden="true">
              {completedMatches.length}
            </span>
          )}
        </button>
        <button
          className={`tab ${view === "stand" ? "is-active" : ""}`}
          onClick={() => setView("stand")}
        >
          Stand
        </button>
        <button
          className={`tab ${view === "leden" ? "is-active" : ""}`}
          onClick={() => setView("leden")}
        >
          Leden
          {memberList.length > 0 && (
            <span className="tab__count" aria-hidden="true">
              {memberList.length}
            </span>
          )}
        </button>
      </div>

      {view === "rondes" && (
        /* Wedstrijden en uitslagen invullen primair, dagoverzicht
           ondersteunend; afsluitkaart zodra alles binnen is (#377). */
        <VandaagTab
          groupName={group.data.name}
          myId={myId}
          isOwner={isOwner}
          matches={matches.data ?? []}
          rounds={rounds}
          dayDone={dayDone}
          today={today}
          teams={tmap}
          profiles={pmap}
          histories={histories.data ?? {}}
          upsets={upsets}
          zwartePiet={zwartePiet}
          intensiteit={group.data?.roast_intensiteit ?? "gemeen"}
          onMatches={onMatches}
          onShowSpelen={() => setView("spelen")}
          onShowStand={() => setView("stand")}
        />
      )}

      {view === "spelen" && (
        /* Teams maken primair, losse partij secundair; reis-CTA naar
           Vandaag zodra er wedstrijden klaarstaan (#364). */
        <SpelenTab
          groupId={id}
          myId={myId}
          members={memberList}
          profiles={pmap}
          matches={matches.data ?? []}
          todaysMatches={todaysMatches}
          teams={tmap}
          openRound={openRound ?? null}
          busy={busy}
          intensiteit={group.data.roast_intensiteit ?? "gemeen"}
          onMatches={onMatches}
          onGuestCreated={profiles.reload}
          onShowRondes={() => setView("rondes")}
        />
      )}

      {view === "plannen" && (
        /* Eén fase-gedreven flow (#349): fasebalk + suggesties + focus-poll
           + secundaire speeldagen, met de wizard als bottom-sheet. */
        <PlanTab
          groupId={id}
          groupName={group.data.name}
          members={memberList}
          profiles={pmap}
          myId={myId}
          isOwner={isOwner}
          matches={matches.data ?? []}
        />
      )}

      {view === "matches" && (
        <MatchHistory
          title="Gespeelde matches"
          matches={completedMatches}
          teams={tmap}
          profiles={pmap}
          myId={myId}
          upsets={upsets}
          canManage={isOwner}
          onChanged={onMatches}
          loading={matches.loading}
          error={matches.error}
          emptyAll={
            <p className="empty">
              Nog geen gespeelde matches in deze groep — log er een op de
              Vandaag-tab.
            </p>
          }
        />
      )}

      {view === "stand" && (
        <GroupStandTab
          matches={matches.data ?? []}
          completedMatches={completedMatches}
          teams={tmap}
          profiles={pmap}
          ratings={ratings.data ?? {}}
          histories={histories.data ?? {}}
          memberList={memberList}
          myId={myId}
          season={season}
          setSeasonId={setSeasonId}
          seasons={seasons}
          shownStandings={shownStandings}
          champion={champion}
          shownPredictionStandings={shownPredictionStandings}
          group={group.data!}
          piasRatings={piasRatings}
          zwartePiet={zwartePiet}
        />
      )}

      {view === "leden" && (
        <GroupLedenTab
          groupId={id}
          myId={myId}
          isOwner={isOwner}
          busy={busy}
          act={act}
          memberList={memberList}
          profiles={pmap}
          zwartePiet={zwartePiet}
          group={group.data!}
          reloadGroup={group.reload}
          addableFriendIds={addableFriendIds}
        />
      )}
    </div>
  );
}

export default GroupDetail;
