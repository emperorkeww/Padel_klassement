import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useCacheRevision } from "@/lib/hooks/useCacheRevision";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { FeedSkeleton } from "@/ui/Skeleton";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { Aankondiging } from "@/ui/Aankondiging";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { CoachAbout } from "@/features/coach/components/CoachAbout";
import { Sheet } from "@/ui/Sheet";
import { COMMENTATOR } from "@/features/coach/roastTone";
import { readFlag, writeFlag } from "@/lib/utils/localFlag";
import { CoachIntro } from "@/features/feed/components/CoachIntro";
import { FeedFriendshipBundle } from "@/features/feed/components/FeedFriendshipBundle";
import { CoachComment } from "@/features/feed/components/CoachComment";
import { EveningCard } from "@/features/feed/components/EveningCard";
import { FeedItem } from "@/features/feed/components/FeedItem";
import { SmoesCard } from "@/features/feed/components/SmoesCard";
import { VarFeedCard } from "@/features/feed/components/VarFeedCard";
import {
  buildFeed,
  bundelVriendschappen,
  feedDay,
  feedPrivacyFilter,
  recentlyClosedMonth,
  recentlyClosedSeason,
  FEED_LIMIT,
  type FeedEvent,
  type FeedPoll,
} from "@/features/feed/feedLogic";
import {
  eventKey,
  FILTER_LABELS,
  FILTERS,
  MATCH_WINDOW,
  type FilterLabel,
} from "@/features/feed/feedHelpers";
import { FeedFilters } from "@/features/feed/components/FeedFilters";
import { celebrate } from "@/lib/utils/confetti";
import { formatRelativeDay, aantalTekst } from "@/lib/utils/format";
import { getGroupMatches, getRecentMatches, getTeamsMap } from "@/features/matches/api";
import { getMySmoesjes } from "@/features/matches/smoesjesApi";
import { getRecentAppeals } from "@/features/matches/appealApi";
import { getMyVendettas } from "@/features/groups/vendettaApi";
import { getActiveBounties } from "@/features/standings/bountyApi";
import { getProfilesMap, displayName } from "@/features/profiles/api";
import { categorize, getMyFriendships } from "@/features/friends/api";
import { getMyGroups, getGroupMembers } from "@/features/groups/api";
import { getGroupPollOptions, getGroupPolls } from "@/features/groups/pollsApi";
import { getPlayerStandings } from "@/features/standings/api";
import {
  getPlayerRatings,
  getRatingHistoriesForMatches,
  getRecentRatingHistories,
  mergeRatingHistories,
} from "@/features/standings/ratingsApi";
import { getPiasWeeks } from "@/features/standings/piasApi";
import { coachOpmerking, coachStemming } from "./coachFeed";
import { coachAvond } from "./coachEvening";
import { eveningSummary, type EveningSummary } from "@/features/feed/eveningSummary";
import { getZwartePiet } from "@/features/groups/zwartePietApi";
import { jokerKaartRegel } from "@/features/matches/jokers";
import { getJokersForMatches } from "@/features/matches/jokersApi";
import type {
  GroupMember,
  Match,
  RoastIntensiteit,
} from "@/types";
import "./Feed.css";

// Feed (#120, uitgebreid in #138): wat gebeurde er bij jou en je vrienden —
// matches met highlight-chips (upset, opvallende score, reeks, rating-
// mijlpaal), geplande matches, groeps- en pollnieuws, klassementsprongen en
// seizoenskampioenen. Client-side geaggregeerd (lib/feed.ts) uit bronnen die
// er al zijn; realtime bijgewerkt. Extra bronnen laden progressief: de feed
// verschijnt zodra de kern er is en verrijkt zichzelf daarna.

export function Feed() {
  usePageTitle("Clubblad");
  const { user } = useAuth();
  const myId = user?.id ?? "";

  // Kernbronnen (bepalen de laadstaat, zoals voorheen).
  const matches = useAsync(() => getRecentMatches(MATCH_WINDOW), []);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getProfilesMap, []);
  const friendships = useAsync(getMyFriendships, []);
  useRealtime("friendships", friendships.reload);

  // Verrijkende bronnen (progressief; buildFeed werkt ook zonder).
  const histories = useAsync(getRecentRatingHistories, []);
  // De feed rekent zowel met een venster per speler (rangsprongen, reeksen) als
  // met de punten van concrete matches (rating-delta's, upsets, avondsamen-
  // vatting). Dat tweede haalt hij gericht op voor de matches in de feed, want
  // die vallen niet gegarandeerd binnen het venster (#731).
  const feedMatchIds = useMemo(
    () =>
      (matches.data ?? [])
        .filter((m) => m.status === "completed")
        .map((m) => m.id),
    [matches.data],
  );
  const feedMatchKey = feedMatchIds.join(",");
  // Jokers van de matches in de feed (#1003): één bulk-query voor het hele
  // scherm in plaats van een fetch per kaart, net als in de historie en de
  // rondelijst. De cache-revisie trekt de regels bij als er elders een kaart
  // gespeeld of ingetrokken wordt.
  const jokersRev = useCacheRevision("match-jokers");
  const feedJokers = useAsync(
    () => getJokersForMatches(feedMatchKey ? feedMatchKey.split(",") : []),
    [feedMatchKey, jokersRev],
  );
  const matchHistories = useAsync(
    () => getRatingHistoriesForMatches(feedMatchIds),
    [feedMatchKey],
  );
  const hmap = useMemo(
    () => mergeRatingHistories(histories.data ?? {}, matchHistories.data ?? {}),
    [histories.data, matchHistories.data],
  );
  const standings = useAsync(getPlayerStandings, []);
  // Rating-snapshot: de rating-leidende rang in de klassementsprongen (#570)
  // gebruikt dezelfde bron als het klassement, niet de historie-benadering.
  const ratings = useAsync(getPlayerRatings, []);
  // Pias van de week per groep (serverside aangeduid; de trigger herrekent bij
  // elke uitslag). Alle groepen tegelijk — RLS beperkt tot de eigen groepen.
  const piasWeeks = useAsync(getPiasWeeks, []);
  // De huidige Zwarte Piet-drager per groep (#185), voor de overdracht-items.
  const shame = useAsync(getZwartePiet, []);
  // Geplaatste smoezen in je groepen (#296), voor de smoes-items op de feed.
  const smoesjes = useAsync(getMySmoesjes, []);
  useRealtime("match_smoesjes", smoesjes.reload);
  // Afgehandelde VAR-zaken (#1025): Rudy's uitspraken in de historie. RLS
  // levert alleen zaken uit je eigen matches en groepen.
  const appeals = useAsync(getRecentAppeals, []);
  useRealtime("point_appeals", appeals.reload);
  // Vendetta-contracten in je groepen (#169), voor de verhaallijn-items.
  const vendettas = useAsync(getMyVendettas, []);
  // Actieve bounty's (#805): nodig voor de "verdedigd"-chip. Een geclaimde
  // bounty staat al in de rating-historie en heeft deze bron niet nodig.
  const bounties = useAsync(getActiveBounties, []);
  useRealtime("vendettas", vendettas.reload);
  // Een nieuwe uitslag verandert ook ratings, klassement, de pias-aanduiding én
  // de Zwarte Piet: al die bronnen verversen, anders lopen ze achter.
  const reloadMatchSources = useCallback(() => {
    matches.reload();
    histories.reload();
    matchHistories.reload();
    standings.reload();
    ratings.reload();
    piasWeeks.reload();
    shame.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.reload, histories.reload, matchHistories.reload, standings.reload, ratings.reload, piasWeeks.reload, shame.reload]);
  useRealtime("matches", reloadMatchSources);
  const groups = useAsync(getMyGroups, []);
  const groupKey = (groups.data ?? []).map((g) => g.id).join(",");
  const groupExtras = useAsync(async () => {
    const list = groups.data ?? [];
    const perGroup = await Promise.all(
      list.map(async (g) => ({
        id: g.id,
        members: await getGroupMembers(g.id),
        polls: await getGroupPolls(g.id),
        options: await getGroupPollOptions(g.id),
      })),
    );
    const membersByGroup: Record<string, GroupMember[]> = {};
    const pollsByGroup: Record<string, FeedPoll[]> = {};
    for (const e of perGroup) {
      membersByGroup[e.id] = e.members;
      // Het gekozen moment (datum + tijd) van een vastgelegde/geboekte poll
      // resolven uit de optie, zodat de feed "ligt vast: vr 20:00" kan tonen.
      const optionById = new Map(e.options.map((o) => [o.id, o]));
      pollsByGroup[e.id] = e.polls.map((p) => ({
        ...p,
        locked_date:
          (p.locked_option_id && optionById.get(p.locked_option_id)?.date) ??
          null,
        locked_time:
          (p.locked_option_id &&
            optionById.get(p.locked_option_id)?.start_time) ??
          null,
      }));
    }
    return { membersByGroup, pollsByGroup };
     
  }, [groupKey]);
  useRealtime("play_polls", groupExtras.reload);

  // Seizoenskampioenen & Maand-pias: alleen kort na een kwartaalwissel of maandwissel
  // de groepsmatches erbij halen (duurdere query's). Groepen met een vendetta
  // (#169) halen we altijd op: de vendetta-stand telt over de volledige
  // historie sinds de start, niet enkel het feed-venster.
  const championSeason = useMemo(() => recentlyClosedSeason(new Date()), []);
  const closedMonth = useMemo(() => recentlyClosedMonth(new Date()), []);
  const vendettaGroupKey = [
    ...new Set((vendettas.data ?? []).map((v) => v.group_id)),
  ]
    .sort()
    .join(",");
  const groupMatches = useAsync(async () => {
    const vendettaGroups = new Set(vendettaGroupKey.split(",").filter(Boolean));
    const list = (groups.data ?? []).filter(
      (g) => championSeason || closedMonth || vendettaGroups.has(g.id),
    );
    const perGroup = await Promise.all(
      list.map(async (g) => [g.id, await getGroupMatches(g.id)] as const),
    );
    return Object.fromEntries(perGroup) as Record<string, Match[]>;
  }, [groupKey, championSeason?.id, closedMonth?.label, vendettaGroupKey]);

  const loading =
    matches.loading || teams.loading || profiles.loading || friendships.loading;
  const error = matches.error ?? friendships.error;
  // Herstelactie (#910): alleen de bron(nen) die faalden opnieuw proberen.
  const herlaad = () => {
    if (matches.error) matches.reload();
    if (friendships.error) friendships.reload();
  };

  const [limit, setLimit] = useState(FEED_LIMIT);
  // "Toon meer" liet je zelf terugzoeken waar je gebleven was (#912): de knop
  // schoof mee naar beneden en de nieuwe items kwamen eronder. We onthouden de
  // index van het eerste nieuwe item en brengen dat na de render in beeld — met
  // focus erbij, zodat ook toetsenbord- en screenreadergebruikers verder lezen
  // in plaats van terug naar de documentstart te vallen.
  const [eersteNieuwe, setEersteNieuwe] = useState<number | null>(null);
  const eersteNieuweRef = useRef<HTMLLIElement>(null);
  const toonMeer = () => {
    setEersteNieuwe(limit);
    setLimit((l) => l + FEED_LIMIT);
  };
  useEffect(() => {
    if (eersteNieuwe === null) return;
    const el = eersteNieuweRef.current;
    if (!el) return;
    // jsdom kent scrollIntoView niet.
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "start" });
    }
    el.focus({ preventScroll: true });
  }, [eersteNieuwe]);

  // Coach Rudy (#212): eenmalige kennismaking (localStorage-vlag per gebruiker)
  // en de "Over Coach Rudy"-popup vanaf de ⓘ op de bubble.
  const coachIntroKey = `coach-intro-gezien:${myId}`;
  const [coachIntroWeg, setCoachIntroWeg] = useState(() => !!readFlag(coachIntroKey));
  const dismissCoachIntro = () => {
    writeFlag(coachIntroKey);
    setCoachIntroWeg(true);
  };
  // Terughaalbaar via het ⓘ-venster (#912): de kennismaking was met één tik op
  // "Begrepen" voorgoed weg, zonder enige weg terug.
  const herhaalCoachIntro = () => {
    writeFlag(coachIntroKey, null);
    setCoachIntroWeg(false);
    setCoachAboutOpen(false);
  };
  const [coachAboutOpen, setCoachAboutOpen] = useState(false);

  // Het actieve filter leeft in de URL (?filter=matches): het overleeft zo
  // navigeren + terugknop en een gefilterde feed is deelbaar als link.
  const [params, setParams] = useSearchParams();
  const filterParam = params.get("filter");
  const activeFilter =
    FILTER_LABELS.find((l) => l.toLowerCase() === filterParam) ?? "Alles";
  // Nogmaals op de actieve chip tikken zet het filter uit (#912): dat is wat je
  // bij een schakelchip verwacht, en het klopt met de aria-pressed-staat.
  const selectFilter = (label: FilterLabel) => {
    const uit = label === "Alles" || label === activeFilter;
    const next = new URLSearchParams(params);
    if (uit) next.delete("filter");
    else next.set("filter", label.toLowerCase());
    setParams(next, { replace: true });
    setLimit(FEED_LIMIT);
  };

  // Onderscheidt "je hebt nog niemand" van "je vrienden deden niks" (#912).
  const heeftVrienden =
    categorize(friendships.data ?? [], myId).accepted.length > 0;

  const pmap = profiles.data ?? {};
  const tmap = teams.data ?? {};
  // De volledige feed één keer bouwen (gememoiseerd — buildFeed doet reeks-
  // en bundel-werk over honderden matches); filteren en de "toon meer"-limiet
  // zijn daarna goedkoop, en de chips kunnen zo tellers tonen.
  const allEvents = useMemo(
    () =>
      loading
        ? []
        : buildFeed({
            matches: matches.data ?? [],
            teams: teams.data ?? {},
            friendships: friendships.data ?? [],
            myId,
            limit: Number.MAX_SAFE_INTEGER,
            histories: hmap,
            standings: standings.data ?? undefined,
            ratings: ratings.data ?? undefined,
            groups: groups.data ?? undefined,
            membersByGroup: groupExtras.data?.membersByGroup,
            pollsByGroup: groupExtras.data?.pollsByGroup,
            groupMatchesByGroup: groupMatches.data ?? undefined,
            piasWeeks: Object.values(piasWeeks.data ?? {}).flat(),
            shameTransfers: Object.values(shame.data ?? {}),
            smoesjes: smoesjes.data ?? [],
            vendettas: vendettas.data ?? [],
            appeals: appeals.data ?? [],
            bounties: bounties.data ?? [],
            profiles: profiles.data ?? {},
            // Respecteer 'discoverable': verberg vriendschapsitems van niet-
            // vindbare spelers (#59). Soortfilter blijft de losse chip-logica.
            filter: feedPrivacyFilter(profiles.data ?? {}),
          }),
    [
      loading,
      matches.data,
      teams.data,
      friendships.data,
      myId,
      hmap,
      standings.data,
      ratings.data,
      groups.data,
      groupExtras.data,
      groupMatches.data,
      piasWeeks.data,
      shame.data,
      smoesjes.data,
      vendettas.data,
      appeals.data,
      bounties.data,
      profiles.data,
    ],
  );

  // Confetti op de feed voor eigen hoofdtier-promoties
  useEffect(() => {
    if (loading || !allEvents.length || !myId) return;
    const firstEvent = allEvents[0];
    if (
      firstEvent.kind === "tier" &&
      firstEvent.playerId === myId &&
      firstEvent.richting === "promotie"
    ) {
      const sessionKey = `feed-celebrated:${firstEvent.matchId}`;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, "1");
        celebrate();
      }
    }
  }, [allEvents, loading, myId]);

  const countFor = (label: FilterLabel) => {
    const kinds = FILTERS[label];
    return kinds
      ? allEvents.filter((e) => kinds.has(e.kind)).length
      : allEvents.length;
  };
  const activeKinds = FILTERS[activeFilter];
  const filtered = activeKinds
    ? allEvents.filter((e) => activeKinds.has(e.kind))
    : allEvents;
  const feed = filtered.slice(0, limit);
  const remaining = filtered.length - feed.length;

  // "Jij" voor jezelf, anders de weergavenaam — leest prettiger in zinnetjes.
  const name = (pid: string) =>
    pid === myId ? "Jij" : displayName(pmap[pid]);
  // Voor Coach Rudy's rivaal-quips (#200) altijd de weergavenaam (nooit "Jij"),
  // want de rivaal is een tegenstander in de derde persoon.
  const naamVoor = (pid: string) => displayName(pmap[pid]);
  const piasWeeksFlat = Object.values(piasWeeks.data ?? {}).flat();

  // Roast-toon (#183): de feed is persoonlijk, dus Coach Rudy hanteert overal
  // jóuw eigen profiel-intensiteit — niet de per-groep instelling van een
  // eigenaar (die geldt alleen in de groep-gescoopte views). We houden de
  // (groupId) => toon-vorm aan die coachFeed/coachStemming verwachten, maar
  // negeren de groep bewust.
  const mijnIntensiteit: RoastIntensiteit =
    pmap[myId]?.roast_intensiteit ?? "radioactief";
  const intensiteitVoor = (): RoastIntensiteit => mijnIntensiteit;

  // Dag-kopjes: "vandaag / gisteren / eergisteren / 8 juli". De feed is per dag
  // gegroepeerd zodat de kop sticky kan zijn (#912): een sticky element kan zijn
  // eigen containing block niet verlaten, en met één platte grid was dat precies
  // de rij van de kop zelf. `index` is de positie in de ongegroepeerde lijst —
  // die hebben we nodig om na "toon meer" het eerste nieuwe item te vinden.
  const dagen: { day: string; label: string; items: { event: FeedEvent; index: number }[] }[] =
    [];
  feed.forEach((event, index) => {
    const day = feedDay(event);
    const laatste = dagen[dagen.length - 1];
    if (laatste?.day === day) laatste.items.push({ event, index });
    else
      dagen.push({
        day,
        label: formatRelativeDay(event.at),
        items: [{ event, index }],
      });
  });
  // Eén gedeelde set per render: zo herhaalt Coach Rudy geen enkele quip binnen
  // de zichtbare feed (anti-herhaling, #201). Deterministisch dankzij de vaste
  // feed-volgorde.
  const gebruiktCoach = new Set<string>();

  /** Eén feed-rij als <li>. Als functie i.p.v. inline JSX, zodat een
   *  samengevatte vriendschapsbundel (#944) dezelfde rijen kan uitklappen. */
  const feedRij = ({ event, index }: { event: FeedEvent; index: number }) => (
    <li
      className="feed__item"
      key={eventKey(event)}
      // Het eerste item van een "toon meer"-ronde krijgt focus en scrollt in
      // beeld (#912).
      ref={index === eersteNieuwe ? eersteNieuweRef : undefined}
      tabIndex={index === eersteNieuwe ? -1 : undefined}
    >
                      {event.kind === "evening" ? (
                        <EveningCard
                          event={event}
                          data={avondData(event)}
                          mood={mijnIntensiteit}
                          pmap={pmap}
                          tmap={tmap}
                          name={name}
                          onInfo={() => setCoachAboutOpen(true)}
                        />
                      ) : event.kind === "var" ? (
                        <VarFeedCard
                          event={event}
                          profiles={pmap}
                          ctx={{
                            intensiteit: mijnIntensiteit,
                            schild:
                              pmap[event.claimantId]?.roast_schild ?? false,
                          }}
                          gebruikt={gebruiktCoach}
                        />
                      ) : event.kind === "smoes" ? (
                        <SmoesCard
                          event={event}
                          pmap={pmap}
                          tmap={tmap}
                          name={name}
                          onInfo={() => setCoachAboutOpen(true)}
                        />
                      ) : (
                        <>
                          <FeedItem
                            event={event}
                            pmap={pmap}
                            tmap={tmap}
                            myId={myId}
                            name={name}
                            joker={
                              event.kind === "match"
                                ? jokerKaartRegel({
                                    match: event.match,
                                    jokers: feedJokers.data ?? [],
                                    teams: tmap,
                                    naam: name,
                                    myId,
                                  })
                                : null
                            }
                          />
                          <CoachComment
                            tekst={coachOpmerking(event, {
                              intensiteitVoor,
                              profiles: pmap,
                              teams: tmap,
                              gebruikt: gebruiktCoach,
                              matches: matches.data ?? [],
                              naamVoor,
                              piasWeeks: piasWeeksFlat,
                            })}
                            mood={coachStemming(event, intensiteitVoor)}
                            onInfo={() => setCoachAboutOpen(true)}
                          />
                        </>
                      )}
    </li>
  );

  // Coach Rudy's avondverslag (#204): 2-3 zinnen bij een speelavond-item,
  // afgeleid uit de eveningSummary van díe groep + dag (uit de al geladen
  // matches). Respecteert intensiteit + schild en deelt de anti-herhaling.
  const avondData = (
    ev: Extract<FeedEvent, { kind: "evening" }>,
  ): { summary: EveningSummary; coachLines: string[] } => {
    const dagVan = (m: Match) => (m.played_at ?? m.created_at).slice(0, 10);
    const dagMatches = (matches.data ?? []).filter(
      (m) => m.group_id === ev.groupId && dagVan(m) === ev.day,
    );
    // ev.day komt uit feedLogic's eigen UTC-dagbundeling; dat blijft zo
    // (#783 pakt bewust alleen de groep-Vandaag-tab/globale-lijst aan).
    const summary = eveningSummary(dagMatches, tmap, ev.day, "UTC", hmap);
    const coachLines = coachAvond(summary, `${ev.groupId}|${ev.day}`, {
      intensiteit: mijnIntensiteit,
      profiles: pmap,
      naam: name,
      teams: tmap,
      gebruikt: gebruiktCoach,
    });
    return { summary, coachLines };
  };

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Clubblad</h1>
        <p className="page-subtitle">
          Alle roddels, heroïsche zeges en beschamende chokes van je maten op één hoop.
        </p>
      </header>

      {loading && <FeedSkeleton />}
      {!loading && error && (
        <ErrorRetry melding={`Het clubblad laden mislukte: ${error}`} onRetry={herlaad} />
      )}

      {!loading && !error && (
        <FeedFilters
          active={activeFilter}
          onSelect={selectFilter}
          countFor={countFor}
        />
      )}

      {/* De chip zegt wélk filter aanstaat, niet wat het oplevert (#924). */}
      <Aankondiging
        sleutel={activeFilter}
        bericht={`Filter ${activeFilter}: ${aantalTekst(filtered.length, "bericht", "berichten")}.`}
      />

      {!loading && !error && feed.length === 0 && activeFilter !== "Alles" && (
        <div className="card">
          <EmptyState
            icon="🔎"
            title="Stilte in deze categorie."
            action={
              <button
                type="button"
                className="btn"
                onClick={() => selectFilter("Alles")}
              >
                Toon alles
              </button>
            }
          >
            Niemand heeft hier onlangs iets uitgespookt. Probeer een andere filter of ga zelf een balletje slaan!
          </EmptyState>
        </div>
      )}

      {/* Twee verschillende problemen, twee verschillende antwoorden (#912):
          "zoek vrienden" klopte niet voor wie er al twintig heeft en gewoon een
          rustige week meemaakt. */}
      {!loading && !error && feed.length === 0 && activeFilter === "Alles" && (
        <div className="card">
          {heeftVrienden ? (
            <EmptyState
              icon="😴"
              title="Iedereen zit stil."
              action={
                <Link className="btn btn--primary" to="/spelen?log=1">
                  Uitslag invullen
                </Link>
              }
            >
              Je maten hebben even niets uitgespookt. Zet zelf iets op de teller —
              dan heeft Rudy tenminste weer wat te zeuren.
            </EmptyState>
          ) : (
            <EmptyState
              icon="📣"
              title="Nog niemand om te volgen."
              action={
                <Link className="btn btn--primary" to="/vrienden">
                  Vrienden zoeken
                </Link>
              }
            >
              Het clubblad toont wat jij en je vrienden uitspoken. Leg eerst een paar
              connecties, dan komt de actie vanzelf.
            </EmptyState>
          )}
        </div>
      )}

      {!loading && !error && feed.length > 0 && (
        <>
          {!coachIntroWeg && <CoachIntro onDismiss={dismissCoachIntro} />}
          <ol className="feed" aria-label="Recente gebeurtenissen">
            {dagen.map((dag) => (
              <li className="feed__dag" key={dag.day}>
                {/* Decoratief: de dag staat al in elk item zelf (#232). */}
                <div className="feed__day" aria-hidden="true">
                  {dag.label}
                </div>
                <ol className="feed__items">
                  {bundelVriendschappen(dag.items, (i) => i.event).map((rij) =>
                    "bundel" in rij ? (
                      // Acht keer "X en Y zijn nu vrienden" met hetzelfde
                      // tijdstip is een muur; één regel met de gezichten erbij
                      // laat de rest van de feed weer ademen (#944).
                      <li className="feed__item" key={`bundel-${rij.bundel.at}`}>
                        <FeedFriendshipBundle
                          bundel={rij.bundel}
                          pmap={pmap}
                          myId={myId}
                          name={name}
                        >
                          {rij.leden.map((lid) => feedRij(lid))}
                        </FeedFriendshipBundle>
                      </li>
                    ) : (
                      feedRij(rij)
                    ),
                  )}
                </ol>
              </li>
            ))}
          </ol>
          {remaining > 0 && (
            <div className="feed__more">
              <button type="button" className="btn" onClick={toonMeer}>
                Toon meer ({remaining})
              </button>
            </div>
          )}
        </>
      )}

      {coachAboutOpen && (
        <Sheet
          open
          compact
          onClose={() => setCoachAboutOpen(false)}
          title={COMMENTATOR.naam}
        >
          <CoachAbout
            showSettingsLink
            onNavigate={() => setCoachAboutOpen(false)}
            onHerhaalIntro={coachIntroWeg ? herhaalCoachIntro : undefined}
          />
        </Sheet>
      )}
    </div>
  );
}

export default Feed;
