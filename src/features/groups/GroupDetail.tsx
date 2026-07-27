import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { MatchListSkeleton, Skeleton } from "@/ui/Skeleton";
import { PageTabs, TabPanel, type PageTabItem } from "@/ui/PageTabs";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import { coachEmptyState } from "@/features/coach/coachMoments";
import { getGroup, getGroupMembers } from "./api";
import { getGroupMatches, getTeamsMap } from "@/features/matches/api";
import { dateInZone, dayInZone } from "@/lib/utils/time";
import { useClub } from "@/features/availability/club";
import { getGroupPlayerStandings } from "@/features/standings/api";
import {
  getPlayerRatings,
  getRatingHistoriesForMatches,
  getRecentRatingHistories,
  mergeRatingHistories,
} from "@/features/standings/ratingsApi";
import { getProfilesMap } from "@/features/profiles/api";
import { getZwartePiet } from "./zwartePietApi";
import { getMyFriendships, categorize, otherId } from "@/features/friends/api";
import { MatchHistory } from "@/features/matches/components/MatchHistory";
import { buildMatchRatings } from "@/features/groups/maandpias";
import { PlanTab } from "@/features/groups/components/PlanTab";
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
import { journeyFor } from "./journey";
import { getGroupPolls, getGroupPollOptions } from "./pollsApi";
import { GroupStandTab } from "./components/GroupStandTab";
import { GroupLedenTab } from "./components/GroupLedenTab";
import { EregalerijTab } from "@/features/seizoen/components/EregalerijTab";
import type { PlayerStanding } from "@/types";
import "./GroupDetail.css";

type View =
  | "vandaag"
  | "plannen"
  | "matches"
  | "stand"
  | "eregalerij"
  | "leden";

/** URL-key → tab. De keys "spelen" (de oude Teams-tab) en "rondes" staan in
 *  pushberichten en edge functions die al de deur uit zijn; sinds #674 wijzen
 *  ze allebei naar de samengevoegde Vandaag-tab. */
function viewFromParam(raw: string | null): View | null {
  if (
    raw === "plannen" ||
    raw === "matches" ||
    raw === "stand" ||
    raw === "eregalerij" ||
    raw === "leden"
  )
    return raw;
  if (raw === "spelen" || raw === "rondes") return "vandaag";
  return null;
}

/** Prefix voor de tab-/paneel-id's van de groepspagina. */
const TAB_ID = "groep";

export function GroupDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const myId = user?.id ?? "";

  // De actieve tab leeft in de URL: refresh-bestendig en deelbaar
  // ("kijk even bij de stand"). Staat bewust vóór de queries: een directe
  // ?tab=stand moet de stand-data meteen aanzetten (zie standSeen).
  const [params, setParams] = useSearchParams();
  const urlView = viewFromParam(params.get("tab"));

  // #674 C2 — de pagina deed dertien queries bij mount, ook als je alleen een
  // uitslag kwam invullen. Wat alleen de Stand-tab voedt wacht tot je die tab
  // opent; daarna blijft hij aan staan, zodat heen en weer klikken niets
  // herlaadt. De rating-historie blijft wél eager: die voedt ook de upsets op
  // Vandaag/Historie en het dagoverzicht.
  const [standOpened, setStandOpened] = useState(false);
  const standSeen = standOpened || urlView === "stand";

  const group = useAsync(() => getGroup(id), [id]);
  const members = useAsync(() => getGroupMembers(id), [id]);
  const matches = useAsync(() => getGroupMatches(id), [id]);
  const standings = useAsync(() => getGroupPlayerStandings(id), [id], {
    enabled: standSeen,
  });
  const piet = useAsync(getZwartePiet, []);
  const profiles = useAsync(getProfilesMap, []);
  const teams = useAsync(getTeamsMap, []);
  const friendships = useAsync(getMyFriendships, []);

  // Voor het rating-klassement op de Stand-tab (#52).
  const ratings = useAsync(getPlayerRatings, [], { enabled: standSeen });
  const histories = useAsync(getRecentRatingHistories, []);
  // Upsets (#85) en de choke-detectie van de pias rekenen met de échte
  // pre-match ratings van de matches van deze groep — ook de oudere, die buiten
  // het gedeelde venster vallen (#731). Gericht ophalen, per blok gecachet.
  const historieIds = useMemo(
    () =>
      (matches.data ?? [])
        .filter((m) => m.status === "completed")
        .map((m) => m.id),
    [matches.data],
  );
  const historieKey = historieIds.join(",");
  const matchHistories = useAsync(
    () => getRatingHistoriesForMatches(historieIds),
    [historieKey],
  );
  const hmap = useMemo(
    () => mergeRatingHistories(histories.data ?? {}, matchHistories.data ?? {}),
    [histories.data, matchHistories.data],
  );

  // Toto (#116): tips + voorspellersklassement van deze groep.
  const predictions = useAsync(() => getGroupPredictions(id), [id], {
    enabled: standSeen,
  });
  const predictionStandings = useAsync(
    () => getGroupPredictionStandings(id),
    [id],
    { enabled: standSeen },
  );

  // Speeldag-polls: voeden de Plannen-tab én de landingstab (#674 A3). Ze
  // staan hier in plaats van in PlanTab zodat de reis-status bekend is vóór
  // je een tab kiest — en zodat ze niet twee keer worden opgehaald.
  const polls = useAsync(() => getGroupPolls(id), [id]);
  const pollOpts = useAsync(() => getGroupPollOptions(id), [id]);
  useRealtime("play_polls", polls.reload, `group_id=eq.${id}`);
  useRealtime("play_poll_options", pollOpts.reload, `group_id=eq.${id}`);

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
    matchHistories.reload();
    // De Zwarte Piet verhuist ook bij een uitslag/correctie (#185).
    piet.reload();
    // Een uitslag of correctie beoordeelt ook de tips (grading-trigger).
    onPredictions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.reload, standings.reload, teams.reload, ratings.reload, histories.reload, matchHistories.reload, piet.reload, onPredictions]);
  // Alleen reageren op wijzigingen binnen déze groep, niet op elke match
  // die ergens anders wordt gelogd.
  useRealtime("matches", onMatches, `group_id=eq.${id}`);
  useRealtime("group_members", members.reload, `group_id=eq.${id}`);
  useRealtime("match_predictions", onPredictions, `group_id=eq.${id}`);

  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // Zonder ?tab bepaalt de reis-status waar je landt (#674 A3) — voorheen was
  // dat altijd Vandaag, ook op een dag zonder plan. Eén keer beslissen en
  // vasthouden: daarna is de tab van de gebruiker.
  const [landed, setLanded] = useState<View | null>(null);
  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === "vandaag") next.delete("tab");
    else next.set("tab", v);
    setParams(next, { replace: true });
    setLanded(v);
  };
  const pmap = useMemo(() => profiles.data ?? {}, [profiles.data]);
  const tmap = useMemo(() => teams.data ?? {}, [teams.data]);
  const myProfile = pmap[myId];
  // Upsets per match-id (#85) uit de al geladen rating-historie.
  const upsets = useMemo(
    () => upsetsByMatch(matches.data ?? [], tmap, hmap),
    [matches.data, tmap, hmap],
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
  const completedMatches = (matches.data ?? []).filter(
    (m) => m.status === "completed",
  );
  // Lege groep voor Coach Rudy (#301): de maker wordt door de DB automatisch
  // owner-lid, dus "leeg" is hooguit één lid. Pas oordelen als members én
  // matches geladen zijn, anders flitst de kaart tijdens het laden.
  const isNewGroup =
    !members.loading &&
    !matches.loading &&
    memberList.length <= 1 &&
    completedMatches.length === 0;
  const season = seasonFromId(params.get("seizoen") ?? "");
  const setSeasonId = (sid: string) => {
    const next = new URLSearchParams(params);
    if (sid) next.set("seizoen", sid);
    else next.delete("seizoen");
    setParams(next, { replace: true });
  };
  // Pre-match ratings voor de choke-detectie van de pias van de maand.
  const piasRatings = useMemo(
    () => buildMatchRatings(hmap),
    [hmap],
  );
  const firstMatchDate = completedMatches.reduce<string | null>((min, m) => {
    const d = m.played_at ?? m.created_at;
    return min === null || d < min ? d : min;
  }, null);
  const seasons = firstMatchDate ? listSeasons(new Date(firstMatchDate)) : [];
  // Teller op de Eregalerij-tab (#711): het aantal afgesloten kwartalen waarin
  // gespeeld is. Bewust niet via eregalerij() — die rekent per kwartaal de
  // volledige stand én de pias uit, en dat hoort achter het openen van de tab.
  const eregalerijCount = seasons.filter(
    (s) => isSeasonClosed(s) && matchesInSeason(completedMatches, s).length > 0,
  ).length;
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
    (m) => dayInZone(m.played_at ?? m.created_at, club.timezone) === today,
  );
  const dayDone =
    todaysMatches.length > 0 &&
    todaysMatches.every((m) => m.status === "completed");

  // De Vandaag-tab toont enkel de rondes van vandaag; de volledige historie
  // staat op de Historie-tab (#342).
  const rounds = groupByRound(todaysMatches);
  // Ronde met openstaande uitslagen (blokkeert Mexicano in MakeTeams).
  const openRound = rounds.find(({ list }) =>
    list.some((m) => m.status !== "completed"),
  );

  // #674 A3 — landingstab. journeyFor() wist al waar een groep in de reis zit,
  // maar dat werd alleen gebruikt voor de links op de hub; direct landen gaf
  // altijd Vandaag, óók op een dag zonder plan. We wachten met renderen tot de
  // reis bekend is (alleen zonder ?tab, dus deelbare links raken dit niet) —
  // liever één skeleton-tel langer dan een tab die onder je vinger wegspringt.
  // De keuze valt tijdens de render, niet in een effect: anders zie je één
  // frame lang Vandaag voordat hij naar Plannen springt.
  const landingTab: View | null = (() => {
    if (polls.loading || pollOpts.loading || matches.loading) return null;
    // Wedstrijden van vandaag winnen het van de poll: wie ad hoc speelt heeft
    // geen poll, maar hoort wel op Vandaag te landen. Bij een mislukte
    // poll-query vallen we terug op het oude gedrag.
    if (rounds.length > 0 || polls.error || pollOpts.error) return "vandaag";
    const j = journeyFor(polls.data ?? [], pollOpts.data ?? [], today, Date.now());
    return j.tab === "plannen" ? "plannen" : "vandaag";
  })();
  // Eigen keuze (?tab of een tik) gaat vóór de reis-status.
  const view: View = urlView ?? landed ?? landingTab ?? "vandaag";
  const landingPending = !urlView && landed === null && landingTab === null;
  // Zodra de tab in beeld staat leggen we hem vast: een poll die verloopt of
  // via realtime binnenkomt mag de tab niet meer onder je vinger wegtrekken.
  useEffect(() => {
    if (!urlView && landed === null && landingTab !== null) setLanded(landingTab);
  }, [urlView, landed, landingTab]);

  // Eenrichtingsschakelaar: vanaf het eerste bezoek aan Stand blijft de zware
  // klassement-data laden, ook als je later weer wegklikt (#674 C2).
  useEffect(() => {
    if (view === "stand") setStandOpened(true);
  }, [view]);

  // Tabs in reis-volgorde (#106, #674 A1): plannen → vandaag → stand.
  // Tellers alleen tonen als er iets te tellen valt; ze zitten in de
  // toegankelijke naam van de tab ("Leden, 6") — zie PageTabs.
  const tabs: PageTabItem<View>[] = [
    { id: "plannen", label: "Plannen" },
    { id: "vandaag", label: "Vandaag", count: rounds.length || undefined },
    {
      id: "matches",
      label: "Historie",
      count: completedMatches.length || undefined,
    },
    { id: "stand", label: "Stand" },
    // Eregalerij (#711) staat ná de stand: eerst het heden, dan de
    // geschiedenis. De teller is het aantal afgesloten seizoenen met een
    // kampioen — nul betekent geen teller (en een uitnodigende leegstand).
    {
      id: "eregalerij",
      label: "Eregalerij",
      count: eregalerijCount || undefined,
    },
    { id: "leden", label: "Leden", count: memberList.length || undefined },
  ];

  if (group.loading || landingPending)
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
      {/* Het ledental stond hier én als teller op de Leden-tab (#674 B4); de
          tab houdt het, de kop houdt alleen de eigenaar-badge. */}
      <header className="page-head">
        <div className="row-between">
          <h1 className="page-title">
            {group.data.name}
            {isOwner && (
              <span className="badge badge--accent group-head__owner">
                eigenaar
              </span>
            )}
          </h1>
          {/* Altijd zichtbaar (#761). #674 A4 verborg deze knop bij één groep,
              omdat /spelen je dan tóch meteen hierheen stuurt en de hub dus
              alleen een kaart toonde die terugleidt. Maar de hub draagt ook
              "+ Nieuwe groep" — de enige plek met die actie — en dit is de
              enige link naar /spelen?hub=1: wie één groep had, zat vast. De
              hub met één kaart is de goedkopere prijs. */}
          <Link className="btn btn--sm" to="/spelen?hub=1">
            ← Alle groepen
          </Link>
        </div>
      </header>

      {/* Lege groep: Rudy verwelkomt en zet de toon (#301) */}
      {isNewGroup && myProfile && (
        <section className="card empty-group">
          <CoachBubble mood="portret" size={32}>
            <span className="coach-sneer__text">
              {coachEmptyState({
                type: "group",
                seed: `${group.data.id}-empty`,
                ctx: {
                  intensiteit: group.data.roast_intensiteit ?? "gemeen",
                  schild: myProfile.roast_schild ?? false,
                },
              })}
            </span>
          </CoachBubble>
          <p className="empty-group__hint">
            Nodig vrienden uit via de Leden-tab om deze groep tot leven te
            brengen.
          </p>
          {/* Sinds #776 nodigt elk lid uit, dus deze knop is niet meer
              owner-only. */}
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setView("leden")}
          >
            Leden uitnodigen
          </button>
        </section>
      )}

      {/* Tabs in reis-volgorde (#106): plannen → spelen → stand.
          Labels ≠ URL-keys (#673): de keys (spelen/matches) staan in
          pushberichten en edge functions en blijven daarom ongewijzigd.
          Echte tab-semantiek + horizontaal schuivende balk sinds #674. */}
      <PageTabs
        tabs={tabs}
        value={view}
        onChange={setView}
        ariaLabel="Groepsonderdelen"
        idPrefix={TAB_ID}
      />

      <TabPanel id={view} idPrefix={TAB_ID}>
        {view === "vandaag" && (
          /* Eén tab voor de hele speeldag (#674): teams maken, spelen en
             uitslagen invullen, met de afsluitkaart zodra alles binnen is. */
          <VandaagTab
            groupId={id}
            group={group.data!}
            myId={myId}
            isOwner={isOwner}
            members={memberList}
            matches={matches.data ?? []}
            rounds={rounds}
            openRound={openRound ?? null}
            dayDone={dayDone}
            today={today}
            timezone={club.timezone}
            teams={tmap}
            profiles={pmap}
            histories={hmap}
            upsets={upsets}
            zwartePiet={zwartePiet}
            busy={busy}
            onMatches={onMatches}
            onGuestCreated={profiles.reload}
            onShowStand={() => setView("stand")}
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
            polls={polls}
            options={pollOpts}
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

        {/* Eerste keer Stand: de klassement-data komt nu pas binnen (#674 C2),
            dus een skeleton in plaats van een lege tabel. Bij een reload (data
            staat er al) blijft de bestaande stand gewoon staan. */}
        {view === "stand" && standings.data === null && standings.loading && (
          <div className="card">
            <Skeleton rows={4} />
          </div>
        )}

        {view === "stand" && !(standings.data === null && standings.loading) && (
          <GroupStandTab
            matches={matches.data ?? []}
            completedMatches={completedMatches}
            teams={tmap}
            profiles={pmap}
            ratings={ratings.data ?? {}}
            histories={hmap}
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

        {view === "eregalerij" && (
          <EregalerijTab
            matches={matches.data ?? []}
            teams={tmap}
            profiles={pmap}
            ratingsByMatch={piasRatings}
            histories={hmap}
            groepsnaam={group.data!.name}
            myId={myId}
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
      </TabPanel>
    </div>
  );
}

export default GroupDetail;
