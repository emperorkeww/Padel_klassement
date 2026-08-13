import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { MatchListSkeleton, Skeleton, StandingsSkeleton } from "@/ui/Skeleton";
import { PageTabs, TabPanel, type PageTabItem } from "@/ui/PageTabs";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
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
  getRatingsAsOf,
  getRecentRatingHistories,
  mergeRatingHistories,
} from "@/features/standings/ratingsApi";
import { getProfilesMap } from "@/features/profiles/api";
import { getZwartePiet } from "./zwartePietApi";
import { getMyFriendships, categorize, otherId } from "@/features/friends/api";
import { MatchesSectie } from "@/features/matches/MatchesSectie";
import { useSpeelParams } from "@/features/matches/speelParams";
import { buildMatchRatings } from "@/features/groups/maandpias";
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
  seizoenEinddag,
} from "@/features/rating/seasons";
import { errorMessage } from "@/lib/utils/errors";
import { groupByRound, openGeplandeRonde } from "./groupDetailHelpers";
import { journeyFor } from "./journey";
import { ledenLabel } from "./groepHelpers";
import { MemberStack } from "./components/MemberStack";
import { Avatar } from "@/ui/Avatar";
import { getGroupPolls, getGroupPollOptions, pollSharePath } from "./pollsApi";
import { GroupStandTab } from "./components/GroupStandTab";
import { GroupLedenTab } from "./components/GroupLedenTab";
import { EregalerijTab } from "@/features/seizoen/components/EregalerijTab";
import type { PlayerStanding } from "@/types";
import "./GroupDetail.css";

type View = "vandaag" | "matches" | "stand" | "leden";

/** URL-key → tab. De keys "spelen" (de oude Teams-tab) en "rondes" staan in
 *  pushberichten en edge functions die al de deur uit zijn; sinds #674 wijzen
 *  ze allebei naar de samengevoegde Vandaag-tab. "plannen" hoort daar sinds
 *  #1121 ook bij: die tab bestaat niet meer (zie GroupDetail hieronder, dat
 *  een gedeelde poll eerst naar de speeldagpagina stuurt). */
function viewFromParam(raw: string | null): View | null {
  if (raw === "matches" || raw === "stand" || raw === "leden") return raw;
  if (raw === "spelen" || raw === "rondes" || raw === "plannen")
    return "vandaag";
  // De Eregalerij was een eigen tab tot #1216; die inhoud staat nu ónder de
  // stand van een afgesloten seizoen. Oude links landen dus op Stand — welk
  // seizoen daarbij hoort, kiest de pagina zelf (zie eregalerijSeizoen).
  if (raw === "eregalerij") return "stand";
  return null;
}

/** Prefix voor de tab-/paneel-id's van de groepspagina. */
const TAB_ID = "groep";

/**
 * Oude links naar de Plannen-tab (#1121).
 *
 * `?tab=plannen&poll=<id>` staat in pushberichten en gedeelde links die al de
 * deur uit zijn — die blijven jaren rondzwerven, dus de omleiding blijft staan.
 * Mét poll-id gaat hij naar de speeldagpagina; zonder valt hij stil terug op de
 * groepspagina zelf, waar `viewFromParam` "plannen" naar Vandaag stuurt.
 *
 * Bewust een wikkel om de pagina heen en geen `<Navigate>` middenin: dan zou de
 * groepspagina eerst al zijn queries opstarten voor een bezoek dat meteen weer
 * weg navigeert.
 */
export function GroupDetail() {
  const [params] = useSearchParams();
  const poll = params.get("poll");
  if (poll) return <Navigate to={pollSharePath(poll)} replace />;
  return <GroepPagina />;
}

function GroepPagina() {
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
  // Tabtitel op de groepsnaam (#910).
  usePageTitle(group.data?.name ?? null);
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

  // Speeldag-polls: voeden de reis-status in de kop (#917) en de speeldag-
  // context op Vandaag. Het plannen zelf verhuisde naar de agenda (#1121).
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
  // De matchlijst zoals de Historie-tab hem krijgt: onze eigen, complete lijst
  // met onze eigen reload eronder (#1298).
  const matchesBron = useMemo(
    () => ({
      data: matches.data,
      loading: matches.loading,
      error: matches.error,
      reload: onMatches,
    }),
    [matches.data, matches.loading, matches.error, onMatches],
  );
  // Alleen reageren op wijzigingen binnen déze groep, niet op elke match
  // die ergens anders wordt gelogd.
  useRealtime("matches", onMatches, `group_id=eq.${id}`);
  useRealtime("group_members", members.reload, `group_id=eq.${id}`);
  useRealtime("match_predictions", onPredictions, `group_id=eq.${id}`);

  const toast = useToast();
  // Periodefilter van de Historie-tab (#1212). Dezelfde hook als de Spelen-hub,
  // zodat er één schrijver op de querystring blijft: hij patcht `?periode=`
  // bovenop wat er staat en laat `?tab=` en `?seizoen=` ongemoeid.
  const speel = useSpeelParams();
  const [busy, setBusy] = useState(false);
  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === "vandaag") next.delete("tab");
    else next.set("tab", v);
    setParams(next, { replace: true });
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
  // Padel is 2v2: onder de vier leden kun je nog niet spelen, dus dan hoort
  // uitnodigen vanaf elke tab bereikbaar te zijn (#917). Pas oordelen als de
  // leden geladen zijn, anders flitst de knop bij elk bezoek even voorbij.
  const kleineGroep = !members.loading && memberList.length < 4;
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
  // Het jongste afgesloten kwartaal waarin gespeeld is (listSeasons geeft
  // nieuwste eerst). Bewust niet via eregalerij() — die rekent per kwartaal de
  // volledige stand én de pias uit, en dat hoort pas als je zo'n seizoen kiest.
  const laatsteAfgesloten =
    seasons.find(
      (s) => isSeasonClosed(s) && matchesInSeason(completedMatches, s).length > 0,
    ) ?? null;
  // De eregalerij hoort bij een afgesloten seizoen: kies je het lopende
  // kwartaal of "Alle tijden", dan is er geen kampioen om te vieren (#1216).
  const eregalerijSeizoen =
    season && isSeasonClosed(season) ? season : null;
  // Rating × afgesloten seizoen (#1298): de ratingstand negeerde het seizoen
  // volledig, dus onder de eregalerij van toen stonden de ratings van nu. De
  // stand van tóén komt van de server — één rij per speler, dezelfde RPC als
  // de tijdmachine in het klassement (#731); uit de gedeelde historie plukken
  // kan niet, dat is een venster van de laatste matches en geen archief.
  const eindDag = eregalerijSeizoen ? seizoenEinddag(eregalerijSeizoen) : null;
  const seizoenRatings = useAsync(
    () => (eindDag ? getRatingsAsOf(eindDag) : Promise.resolve(null)),
    [eindDag],
    { enabled: standSeen },
  );
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
  // Ronde met openstaande uitslagen (blokkeert Mexicano in MakeTeams). Over de
  // hele groep, net als de RPC (#1271): een ronde die vorige week is blijven
  // hangen blokkeert evengoed, en die staat niet in `rounds` van vandaag.
  const openRound = openGeplandeRonde(matches.data ?? [], club.timezone);

  // Reisstatus voor de kop (#917): dezelfde functie als de hub, zodat er niet
  // twee definities van "wanneer wordt er weer gespeeld" ontstaan. Null zolang
  // de polls laden — de rest van de kop staat er dan al.
  const journey =
    polls.loading || pollOpts.loading
      ? null
      : journeyFor(polls.data ?? [], pollOpts.data ?? [], today, Date.now());
  // De landingstab van #674 A3 koos tussen Plannen en Vandaag, en wachtte
  // daarvoor met renderen tot de polls binnen waren. Met alleen Vandaag over
  // (#1121) valt er niets te kiezen en hoeft die wachttijd er ook niet meer te
  // zijn: wie een uitslag komt invullen ziet de pagina meteen.
  const view: View = urlView ?? "vandaag";

  /**
   * Oude links naar de Eregalerij-tab (#1216).
   *
   * Die tab bestaat niet meer: de galerij staat onder de stand van een
   * afgesloten seizoen. `viewFromParam` stuurt zo'n link al naar Stand; hier
   * kiezen we het seizoen erbij, want anders belooft de link een eregalerij en
   * krijg je de stand van vandaag. Eén schrijfbeurt voor beide sleutels — twee
   * losse setParams in dezelfde tick overschrijven elkaar.
   *
   * Pas zodra de matches binnen zijn: daarvóór is er geen seizoen om te kiezen.
   */
  const eregalerijLink = params.get("tab") === "eregalerij";
  const laatsteAfgeslotenId = laatsteAfgesloten?.id ?? null;
  useEffect(() => {
    if (!eregalerijLink || matches.loading) return;
    const next = new URLSearchParams(params);
    next.set("tab", "stand");
    if (laatsteAfgeslotenId && !next.get("seizoen"))
      next.set("seizoen", laatsteAfgeslotenId);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eregalerijLink, matches.loading, laatsteAfgeslotenId]);

  // Eenrichtingsschakelaar: vanaf het eerste bezoek aan Stand blijft de zware
  // klassement-data laden, ook als je later weer wegklikt (#674 C2).
  useEffect(() => {
    if (view === "stand") setStandOpened(true);
  }, [view]);

  // Tabs in reis-volgorde (#106, #674 A1): vandaag → stand. Het plannen zelf
  // begint sinds #1121 op de agenda, over al je groepen heen.
  // Tellers alleen tonen als er iets te tellen valt; ze zitten in de
  // toegankelijke naam van de tab ("Groep, 6") — zie PageTabs.
  const tabs: PageTabItem<View>[] = [
    { id: "vandaag", label: "Vandaag", count: rounds.length || undefined },
    {
      id: "matches",
      label: "Historie",
      count: completedMatches.length || undefined,
    },
    { id: "stand", label: "Stand" },
    // Heette "Leden", maar de tab draagt ook het uitnodigen, de
    // groepsinstellingen en het verwijderen/verlaten (#1298). De URL-key blijft
    // `leden`: die staat in gedeelde links, en labels en keys zijn hier sinds
    // #673 bewust losgekoppeld.
    { id: "leden", label: "Groep", count: memberList.length || undefined },
  ];

  if (group.loading)
    return (
      <div className="card">
        <Skeleton rows={2} />
        <MatchListSkeleton count={2} />
      </div>
    );
  if (!group.data)
    return (
      <ErrorRetry
        melding="Deze groep bestaat niet (meer) of je hebt er geen toegang toe."
        actie={
          <Link className="btn btn--sm" to="/spelen">
            Alle groepen
          </Link>
        }
      />
    );

  return (
    <div>
      {/* Terugnavigatie hoort bóven de kop (#946) — sinds #1299 draagt de shell
          hem: de topbalk op mobiel, boven de inhoud op desktop. De losse
          "← Alle groepen"-link die hier stond was de vierde eigen terugvorm in
          de app en is daarmee vervallen. */}
      {/* De kop droeg alleen naam plus eigenaar-badge, terwijl de groepskaart
          op de hub wél avatar, ledenrij en reisstatus toont (#917) — de
          groepspagina voelde daardoor minder "van de groep" dan het overzicht
          ervan. Dezelfde bouwstenen dus, met journeyFor als één bron voor
          "wanneer wordt er weer gespeeld". Die status staat hier ook op
          Historie of Stand, waar je hem eerder helemaal kwijt was. */}
      <header className="page-head group-head">
        <div className="row-between">
          <div className="group-head__id">
            <Avatar name={group.data.name} size={44} />
            <div className="group-head__tekst">
              <h1 className="page-title">
                {group.data.name}
                {isOwner && (
                  <span className="badge badge--accent group-head__owner">
                    eigenaar
                  </span>
                )}
              </h1>
              <p className="group-head__meta">
                <MemberStack
                  ids={memberList.map((m) => m.player_id)}
                  profiles={pmap}
                />

                <span>{ledenLabel(memberList.length)}</span>
                {journey && (
                  /* De wikkel pakt op telefoonbreedte de hele regel, de pil
                     erin houdt z'n eigen breedte (#975) — zonder wikkel rekte
                     de pil zelf mee tot een balk over het hele scherm.

                     De pil wijst naar de agenda zodra hij om een handeling
                     vraagt ("stem mee", "boek de baan", "Plan een speeldag →").
                     Dat is wat `journey.tab` al die tijd zei en niemand las
                     (#1298): de kop beloofde met een pijl een bestemming en was
                     een gewone <span>, terwijl de groepspagina sinds #1121
                     helemaal geen route naar plannen meer had. Wijst de reis
                     naar vandaag, dan is de pil een mededeling over deze dag —
                     die blijft tekst, precies zoals hij er staat. */
                  <span className="group-head__journey-rij">
                    {journey.tab === "agenda" ? (
                      <Link
                        className={`group-head__journey group-head__journey--${journey.tone}`}
                        to="/agenda"
                      >
                        {journey.icon && (
                          <span aria-hidden="true">{journey.icon}</span>
                        )}
                        {journey.label}
                      </Link>
                    ) : (
                      <span
                        className={`group-head__journey group-head__journey--${journey.tone}`}
                      >
                        {journey.icon && (
                          <span aria-hidden="true">{journey.icon}</span>
                        )}
                        {journey.label}
                      </span>
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="btn-row group-head__acties">
            {/* Uitnodigen is dé actie in een jonge groep, maar zat weggestopt
                op de Leden-tab (#917). Padel is 2v2: vanaf vier leden kun je
                spelen en is het geen dringende actie meer. */}
            {kleineGroep && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => setView("leden")}
              >
                Leden uitnodigen
              </button>
            )}
          </div>
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
                  intensiteit: group.data.roast_intensiteit ?? "radioactief",
                  schild: myProfile.roast_schild ?? false,
                },
              })}
            </span>
          </CoachBubble>
          <p className="empty-group__hint">
            Nodig vrienden uit via de Groep-tab om deze groep tot leven te
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

      {/* Tabs in reis-volgorde (#106): spelen → stand.
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
            polls={polls.data ?? []}
            pollOptions={pollOpts.data ?? []}
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

        {/* Eén matchlijst per groep (#1212). Deze tab monteerde MatchHistory
            rechtstreeks, zonder periodefilter en zonder "Te spelen" — een
            armere kopie van wat /spelen?groep=<id> al toont. #1123 hief de
            losse Matches-tab op om precies die verdubbeling weg te nemen;
            hier stond ze nog. De sectie is er sinds #1123 op gebouwd: hij
            bezit zijn data, de pagina bezit de URL.

            De groepskeuze-rij blijft weg (vaste groep, `groepen` leeg) en de
            zwevende +Match-knop ook: loggen is binnen de groep de taak van de
            Vandaag-tab.

            De matchlijst komt van deze pagina (#1298): die is compleet en al
            geladen, terwijl de sectie er anders een tweede, globale en op 100
            afgekapte lijst naast zet. Herladen loopt via onMatches, zodat een
            uitslag die je hier invult ook de stand en de Piet bijwerkt. */}
        {view === "matches" && (
          <MatchesSectie
            groepId={id}
            onGroep={() => {}}
            periode={speel.periode}
            onPeriode={speel.zetPeriode}
            onWisFilters={speel.wisFilters}
            titel="Gespeelde matches"
            zonderNieuweMatch
            bron={matchesBron}
          />
        )}

        {/* Eerste keer Stand: de klassement-data komt nu pas binnen (#674 C2),
            dus een skeleton in plaats van een lege tabel. Bij een reload (data
            staat er al) blijft de bestaande stand gewoon staan. */}
        {view === "stand" && standings.data === null && standings.loading && (
          <div className="card">
            {/* De stand is een ranglijst, geen vier kale regels (#949). */}
            <StandingsSkeleton rows={5} />
          </div>
        )}

        {view === "stand" && !(standings.data === null && standings.loading) && (
          <GroupStandTab
            matches={matches.data ?? []}
            completedMatches={completedMatches}
            teams={tmap}
            profiles={pmap}
            ratings={ratings.data ?? {}}
            seizoenRatings={seizoenRatings.data ?? null}
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

        {/* De eregalerij ís de stand, alleen die van vroeger (#1216). Ze stond
            als vijfde tab naast Stand, terwijl de seizoenskiezer daar al
            belooft dat je door de tijd kunt bladeren. Nu houdt hij die belofte:
            kies een afgesloten kwartaal en de kampioen, de awards en het
            recordboek staan onder de eindstand. Het lopende seizoen en "Alle
            tijden" tonen niets extra's — en rekenen dus ook niets uit. */}
        {view === "stand" && eregalerijSeizoen && (
          <EregalerijTab
            matches={matches.data ?? []}
            teams={tmap}
            profiles={pmap}
            ratingsByMatch={piasRatings}
            histories={hmap}
            groepsnaam={group.data!.name}
            myId={myId}
            seizoenId={eregalerijSeizoen.id}
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
