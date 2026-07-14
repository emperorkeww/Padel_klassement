import { Fragment, useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { MatchListSkeleton } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { Avatar } from "../../components/Avatar";
import { CoachAvatar, type CoachMood } from "../../components/CoachAvatar";
import { CoachAbout } from "../../components/CoachAbout";
import { Sheet } from "../../components/Sheet";
import { COMMENTATOR } from "@/features/coach/roastTone";
import { readFlag, writeFlag } from "@/lib/utils/localFlag";
import { CoachIntro } from "./CoachIntro";
import {
  buildFeed,
  feedDay,
  feedPrivacyFilter,
  recentlyClosedSeason,
  FEED_LIMIT,
  type FeedEvent,
  type FeedPoll,
  type Highlight,
} from "@/features/feed/feedLogic";
import { formatDate, formatRelativeDay, formatTime } from "@/lib/utils/format";
import { getGroupMatches, getRecentMatches, getTeamsMap, readSetScores, teamLabel } from "../matches/api";
import { getMySmoesjes } from "../matches/smoesjesApi";
import { kiesOordeel } from "@/features/matches/excuses";
import { MatchCard } from "../matches/MatchList";
import { getProfilesMap, displayName } from "../profiles/api";
import { getMyFriendships } from "../friends/api";
import { getMyGroups, getGroupMembers } from "../groups/api";
import { getGroupPollOptions, getGroupPolls } from "../groups/pollsApi";
import { getPlayerStandings } from "../standings/api";
import { getAllRatingHistories } from "../standings/ratingsApi";
import { getPiasWeeks } from "../standings/piasApi";
import { coachOpmerking, coachStemming } from "./coachFeed";
import { coachAvond } from "./coachEvening";
import { eveningSummary, type EveningSummary } from "@/features/feed/eveningSummary";
import { getZwartePiet } from "../groups/zwartePietApi";
import type {
  GroupMember,
  Match,
  Profile,
  RoastIntensiteit,
  Team,
} from "@/types";
import "./Feed.css";

// Feed (#120, uitgebreid in #138): wat gebeurde er bij jou en je vrienden —
// matches met highlight-chips (upset, opvallende score, reeks, rating-
// mijlpaal), geplande matches, groeps- en pollnieuws, klassementsprongen en
// seizoenskampioenen. Client-side geaggregeerd (lib/feed.ts) uit bronnen die
// er al zijn; realtime bijgewerkt. Extra bronnen laden progressief: de feed
// verschijnt zodra de kern er is en verrijkt zichzelf daarna.

/** Ruim venster aan recente uitslagen om de feed uit te filteren. */
const MATCH_WINDOW = 250;

/** Filterchips: soortgroep → event-kinds. `null` = alles. Categorieën spiegelen
 *  de nieuwe kaart-hiërarchie (#232): de vroeger overladen "Groepen" is
 *  opgesplitst in Klassement (+ kampioen), een eigen Roast en een slanke Groepen. */
const FILTERS = {
  Alles: null,
  Matches: new Set<FeedEvent["kind"]>(["match", "evening", "planned"]),
  Klassement: new Set<FeedEvent["kind"]>(["rank", "season-champion"]),
  Roast: new Set<FeedEvent["kind"]>(["pias-week", "maand-pias", "zwarte-piet", "smoes"]),
  Groepen: new Set<FeedEvent["kind"]>([
    "group-created",
    "group-joined",
    "poll",
    "poll-locked",
    "poll-booked",
  ]),
  Sociaal: new Set<FeedEvent["kind"]>(["friendship"]),
} as const;
type FilterLabel = keyof typeof FILTERS;
const FILTER_LABELS = Object.keys(FILTERS) as FilterLabel[];

/** Categoriekleur-stip per filter — spiegelt de highlight-kaarten (#232). */
const FILTER_CAT: Partial<Record<FilterLabel, "match" | "rank" | "roast">> = {
  Matches: "match",
  Klassement: "rank",
  Roast: "roast",
};

export function Feed() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  // Kernbronnen (bepalen de laadstaat, zoals voorheen).
  const matches = useAsync(() => getRecentMatches(MATCH_WINDOW), []);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getProfilesMap, []);
  const friendships = useAsync(getMyFriendships, []);
  useRealtime("friendships", friendships.reload);

  // Verrijkende bronnen (progressief; buildFeed werkt ook zonder).
  const histories = useAsync(getAllRatingHistories, []);
  const standings = useAsync(getPlayerStandings, []);
  // Pias van de week per groep (serverside aangeduid; de trigger herrekent bij
  // elke uitslag). Alle groepen tegelijk — RLS beperkt tot de eigen groepen.
  const piasWeeks = useAsync(getPiasWeeks, []);
  // De huidige Zwarte Piet-drager per groep (#185), voor de overdracht-items.
  const shame = useAsync(getZwartePiet, []);
  // Geplaatste smoezen in je groepen (#296), voor de smoes-items op de feed.
  const smoesjes = useAsync(getMySmoesjes, []);
  useRealtime("match_smoesjes", smoesjes.reload);
  // Een nieuwe uitslag verandert ook ratings, klassement, de pias-aanduiding én
  // de Zwarte Piet: al die bronnen verversen, anders lopen ze achter.
  const reloadMatchSources = useCallback(() => {
    matches.reload();
    histories.reload();
    standings.reload();
    piasWeeks.reload();
    shame.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.reload, histories.reload, standings.reload, piasWeeks.reload, shame.reload]);
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

  // Seizoenskampioenen: alleen kort na een kwartaalwissel de groepsmatches
  // erbij halen (duurdere query's; kampioenen zijn kwartaalnieuws).
  const championSeason = useMemo(() => recentlyClosedSeason(new Date()), []);
  const groupMatches = useAsync(async () => {
    if (!championSeason) return {};
    const list = groups.data ?? [];
    const perGroup = await Promise.all(
      list.map(async (g) => [g.id, await getGroupMatches(g.id)] as const),
    );
    return Object.fromEntries(perGroup) as Record<string, Match[]>;
     
  }, [groupKey, championSeason?.id]);

  const loading =
    matches.loading || teams.loading || profiles.loading || friendships.loading;
  const error = matches.error ?? friendships.error;

  const [limit, setLimit] = useState(FEED_LIMIT);

  // Coach Rudy (#212): eenmalige kennismaking (localStorage-vlag per gebruiker)
  // en de "Over Coach Rudy"-popup vanaf de ⓘ op de bubble.
  const coachIntroKey = `coach-intro-gezien:${myId}`;
  const [coachIntroWeg, setCoachIntroWeg] = useState(() => !!readFlag(coachIntroKey));
  const dismissCoachIntro = () => {
    writeFlag(coachIntroKey);
    setCoachIntroWeg(true);
  };
  const [coachAboutOpen, setCoachAboutOpen] = useState(false);

  // Het actieve filter leeft in de URL (?filter=matches): het overleeft zo
  // navigeren + terugknop en een gefilterde feed is deelbaar als link.
  const [params, setParams] = useSearchParams();
  const filterParam = params.get("filter");
  const activeFilter =
    FILTER_LABELS.find((l) => l.toLowerCase() === filterParam) ?? "Alles";
  const selectFilter = (label: FilterLabel) => {
    const next = new URLSearchParams(params);
    if (label === "Alles") next.delete("filter");
    else next.set("filter", label.toLowerCase());
    setParams(next, { replace: true });
    setLimit(FEED_LIMIT);
  };

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
            histories: histories.data ?? undefined,
            standings: standings.data ?? undefined,
            groups: groups.data ?? undefined,
            membersByGroup: groupExtras.data?.membersByGroup,
            pollsByGroup: groupExtras.data?.pollsByGroup,
            groupMatchesByGroup: groupMatches.data ?? undefined,
            piasWeeks: Object.values(piasWeeks.data ?? {}).flat(),
            shameTransfers: Object.values(shame.data ?? {}),
            smoesjes: smoesjes.data ?? [],
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
      histories.data,
      standings.data,
      groups.data,
      groupExtras.data,
      groupMatches.data,
      piasWeeks.data,
      shame.data,
      smoesjes.data,
      profiles.data,
    ],
  );
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
    pmap[myId]?.roast_intensiteit ?? "gemeen";
  const intensiteitVoor = (): RoastIntensiteit => mijnIntensiteit;

  // Dag-kopjes: "vandaag / gisteren / eergisteren / 8 juli".
  let lastDay = "";
  // Eén gedeelde set per render: zo herhaalt Coach Rudy geen enkele quip binnen
  // de zichtbare feed (anti-herhaling, #201). Deterministisch dankzij de vaste
  // feed-volgorde.
  const gebruiktCoach = new Set<string>();

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
    const summary = eveningSummary(dagMatches, tmap, ev.day, histories.data ?? undefined);
    const coachLines = coachAvond(summary, `${ev.groupId}|${ev.day}`, {
      intensiteit: mijnIntensiteit,
      profiles: pmap,
      naam: name,
      gebruikt: gebruiktCoach,
    });
    return { summary, coachLines };
  };

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Feed</h1>
        <p className="page-subtitle">
          Alle roddels, heroïsche zeges en beschamende chokes van je maten op één hoop.
        </p>
      </header>

      {loading && (
        <div className="card">
          <MatchListSkeleton count={4} />
        </div>
      )}
      {!loading && error && <p className="msg msg--error">{error}</p>}

      {!loading && !error && (
        <div className="tabs feed__filters">
          {FILTER_LABELS.map((label) => {
            const cat = FILTER_CAT[label];
            return (
              <button
                key={label}
                type="button"
                className={`tab ${activeFilter === label ? "is-active" : ""}`}
                onClick={() => selectFilter(label)}
              >
                {cat && (
                  <span className="tab__dot" data-cat={cat} aria-hidden="true" />
                )}
                {label}
                {label !== "Alles" && (
                  <span className="tab__count" aria-hidden="true">
                    {countFor(label)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

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

      {!loading && !error && feed.length === 0 && activeFilter === "Alles" && (
        <div className="card">
          <EmptyState
            icon="📣"
            title="Muisstille feed."
            action={
              <Link className="btn btn--primary" to="/vrienden">
                Vrienden zoeken
              </Link>
            }
          >
            Nog geen sappige updates. Zodra jij of je vrienden de baan op gaan of connecties leggen, verschijnt de actie hier!
          </EmptyState>
        </div>
      )}

      {!loading && !error && feed.length > 0 && (
        <>
          {!coachIntroWeg && <CoachIntro onDismiss={dismissCoachIntro} />}
          <ol className="feed" aria-label="Recente gebeurtenissen">
            {feed.map((event) => {
              const day = feedDay(event);
              const showDay = day !== lastDay;
              lastDay = day;
              return (
                <Fragment key={eventKey(event)}>
                  {showDay && (
                    <li className="feed__day" aria-hidden="true">
                      {formatRelativeDay(event.at)}
                    </li>
                  )}
                  <li className="feed__item">
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
                </Fragment>
              );
            })}
          </ol>
          {remaining > 0 && (
            <div className="feed__more">
              <button
                type="button"
                className="btn"
                onClick={() => setLimit((l) => l + FEED_LIMIT)}
              >
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
          />
        </Sheet>
      )}
    </div>
  );
}

function eventKey(event: FeedEvent): string {
  switch (event.kind) {
    case "match":
      return `m-${event.match.id}`;
    case "planned":
      return `p-${event.match.id}`;
    case "friendship":
      return `f-${event.a}-${event.b}-${event.at}`;
    case "group-created":
      return `gc-${event.groupId}`;
    case "group-joined":
      return `gj-${event.groupId}-${event.playerId}`;
    case "poll":
      return `poll-${event.groupId}-${event.at}`;
    case "poll-locked":
    case "poll-booked":
      return `${event.kind}-${event.groupId}-${event.at}`;
    case "evening":
      return `e-${event.groupId}-${event.day}`;
    case "rank":
      return `r-${event.playerId}-${event.at}`;
    case "season-champion":
      return `sc-${event.groupId}-${event.seasonLabel}`;
    case "maand-pias":
      return `mp-${event.groupId}-${event.periodeLabel}`;
    case "pias-week":
      return `pw-${event.groupId}-${event.weekStart}`;
    case "zwarte-piet":
      return `zp-${event.groupId}-${event.at}`;
    case "smoes":
      return `sm-${event.matchId}-${event.playerId}`;
  }
}

function FeedItem({
  event,
  pmap,
  tmap,
  myId,
  name,
}: {
  event: FeedEvent;
  pmap: Record<string, Profile>;
  tmap: Parameters<typeof MatchCard>[0]["teams"];
  myId: string;
  name: (pid: string) => string;
}) {
  switch (event.kind) {
    case "smoes":
      return null; // smoezen renderen via SmoesCard, niet via FeedItem
    case "match":
      return <FeedMatch event={event} tmap={tmap} pmap={pmap} name={name} />;
    case "friendship": {
      // Eigen vriendschap: "Jij en X"; die van groepsgenoten: "X en Y".
      const involvesMe = event.a === myId || event.b === myId;
      const other = event.a === myId ? event.b : event.a;
      return (
        <FeedLine
          icon="🤝"
          to={`/spelers/${involvesMe ? other : event.a}`}
          avatars={[event.a, event.b]}
          pmap={pmap}
          at={event.at}
        >
          {involvesMe ? (
            <>
              Jij en <strong>{displayName(pmap[other])}</strong> zijn nu
              vrienden.
            </>
          ) : (
            <>
              <strong>{displayName(pmap[event.a])}</strong> en{" "}
              <strong>{displayName(pmap[event.b])}</strong> zijn nu vrienden.
            </>
          )}
        </FeedLine>
      );
    }
    case "planned":
      return (
        <FeedLine
          icon="🗓️"
          to={`/matches/${event.match.id}`}
          pmap={pmap}
          at={event.at}
        >
          Nieuwe match gepland op{" "}
          <strong>{formatDate(event.match.played_at)}</strong>.
        </FeedLine>
      );
    case "group-created":
      return (
        <FeedLine
          icon="👥"
          to={`/groepen/${event.groupId}`}
          avatars={event.playerId ? [event.playerId] : []}
          pmap={pmap}
          at={event.at}
        >
          {event.playerId ? (
            <>
              {name(event.playerId)} startte de groep{" "}
              <strong>{event.groupName}</strong>.
            </>
          ) : (
            <>
              Nieuwe groep: <strong>{event.groupName}</strong>.
            </>
          )}
        </FeedLine>
      );
    case "group-joined":
      return (
        <FeedLine
          icon="👥"
          to={`/groepen/${event.groupId}`}
          avatars={[event.playerId]}
          pmap={pmap}
          at={event.at}
        >
          {name(event.playerId)} {event.playerId === myId ? "bent" : "is"} lid
          geworden van <strong>{event.groupName}</strong>.
        </FeedLine>
      );
    case "poll":
      return (
        <FeedLine
          icon="🗳️"
          to={`/groepen/${event.groupId}?tab=plannen`}
          pmap={pmap}
          at={event.at}
        >
          Speeldag-poll gestart in <strong>{event.groupName}</strong> — stem
          mee!
        </FeedLine>
      );
    case "poll-locked":
    case "poll-booked":
      return (
        <FeedLine
          icon={event.kind === "poll-locked" ? "📌" : "✅"}
          to={`/groepen/${event.groupId}?tab=plannen`}
          pmap={pmap}
          at={event.at}
        >
          {event.kind === "poll-locked" ? "Speeldag ligt vast" : "Baan geboekt"}
          {event.date && (
            <>
              : <strong>{formatDate(event.date)}
              {event.time ? ` om ${event.time}` : ""}</strong>
            </>
          )}{" "}
          — <strong>{event.groupName}</strong>
        </FeedLine>
      );
    case "evening":
      return (
        <div className="feed-match">
          <FeedLine
            icon="🎾"
            to={`/groepen/${event.groupId}`}
            avatars={event.topPlayerId ? [event.topPlayerId] : []}
            pmap={pmap}
          >
            Speelavond in <strong>{event.groupName}</strong>: {event.count}{" "}
            matches
            {event.topPlayerId && (
              <>
                {" "}
                — {name(event.topPlayerId)}{" "}
                {event.topPlayerId === myId ? "was" : "was"} avondkoning
              </>
            )}
            {event.bestDuoTeamId && (
              <>
                , beste duo <strong>{teamLabel(tmap[event.bestDuoTeamId], pmap)}</strong>
              </>
            )}
            .
          </FeedLine>
          {event.highlights.length > 0 && (
            <div className="feed-chips">
              {event.highlights.map((h, i) => (
                <span key={i} className="badge badge--accent">
                  {highlightText(h, name, (tid) => teamLabel(tmap[tid], pmap))}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    case "rank": {
      const nieuw = event.shift === "nieuw";
      const omhoog = !nieuw && (event.shift as number) > 0;
      return (
        <FeedHighlight
          cat="rank"
          icon={nieuw ? "✨" : omhoog ? "⬆️" : "⬇️"}
          label={`Klassement · ${nieuw ? "nieuw" : omhoog ? "stijger" : "daler"}`}
          to="/klassement"
          at={event.at}
        >
          {nieuw ? (
            <>
              {name(event.playerId)} staat nieuw op <strong>#{event.rank}</strong>.
            </>
          ) : (
            <>
              {name(event.playerId)} {omhoog ? "steeg" : "zakte"}{" "}
              <strong>{Math.abs(event.shift as number)} plekken</strong> naar #{event.rank}.
            </>
          )}
        </FeedHighlight>
      );
    }
    case "season-champion":
      return (
        <FeedHighlight
          cat="champ"
          icon="🏆"
          label="Seizoenskampioen"
          to={`/groepen/${event.groupId}?tab=stand&seizoen=${event.seasonLabel}`}
          at={event.at}
        >
          {name(event.playerId)} {event.playerId === myId ? "bent" : "is"} kampioen van{" "}
          <strong>{event.groupName}</strong> ({event.seasonLabel})!
        </FeedHighlight>
      );
    case "maand-pias":
      {
        const beschermd = pmap[event.playerId]?.roast_schild ?? false;
        return (
          <FeedHighlight cat="roast" icon={beschermd ? "📊" : "🤡"} label={beschermd ? "Opvallende maand" : "Pias van de maand"} to={`/groepen/${event.groupId}`} at={event.at}>
            {beschermd ? (
              <>
                {name(event.playerId)} had een <strong>opvallende maand</strong> ({event.periodeLabel}): {event.detail}.
              </>
            ) : event.playerId === myId ? (
              <>
                Jij bent de <strong>pias van de maand</strong> ({event.periodeLabel}): je {event.detail}.
              </>
            ) : (
              <>
                {name(event.playerId)} is de <strong>pias van de maand</strong> ({event.periodeLabel}):{" "}
                {event.detail}.
              </>
            )}
          </FeedHighlight>
        );
      }
    case "pias-week":
      {
        const beschermd = pmap[event.playerId]?.roast_schild ?? false;
        return (
          <FeedHighlight cat="roast" icon={beschermd ? "📊" : "🤡"} label={beschermd ? "Opvallende week" : "Pias van de week"} to={`/groepen/${event.groupId}`} at={event.at}>
            {beschermd ? (
              <>
                {name(event.playerId)} had een <strong>opvallende week</strong> in {event.groupName}:
                verloor als favoriet ({Math.round(event.winChance * 100)}% kans).
              </>
            ) : event.playerId === myId ? (
              <>
                Jij bent de <strong>pias van de week</strong> in {event.groupName}: verloor als
                torenhoge favoriet ({Math.round(event.winChance * 100)}%).
              </>
            ) : (
              <>
                {name(event.playerId)} is de <strong>pias van de week</strong> in {event.groupName}:
                verloor als torenhoge favoriet ({Math.round(event.winChance * 100)}%).
              </>
            )}
          </FeedHighlight>
        );
      }
    case "zwarte-piet":
      {
        const beschermd = pmap[event.toPlayerId]?.roast_schild ?? false;
        if (beschermd) {
          return (
            <FeedHighlight cat="roast" icon="📊" label="Schande-token" to={`/groepen/${event.groupId}`} at={event.at}>
              {name(event.toPlayerId)} kreeg het <strong>schande-token</strong> in {event.groupName}
              {event.fromPlayerId ? ` van ${name(event.fromPlayerId)}` : ""}: {event.detail}.
            </FeedHighlight>
          );
        }
      }
      return (
        <FeedHighlight cat="roast" icon="🃏" label="Zwarte Piet" to={`/groepen/${event.groupId}`} at={event.at}>
          {event.toPlayerId === myId ? "Jij pakte" : `${name(event.toPlayerId)} pakte`} de{" "}
          <strong>Zwarte Piet</strong> in {event.groupName}
          {event.fromPlayerId ? ` af van ${name(event.fromPlayerId)}` : ""}: {event.detail}.
        </FeedHighlight>
      );
  }
}

/** Chip-tekst per highlight; namen/teams komen uit de meegegeven resolvers. */
function highlightText(
  h: Highlight,
  name: (pid: string) => string,
  team: (teamId: string) => string,
): string {
  switch (h.type) {
    case "upset":
      return `🎯 ${team(h.winnerTeamId)} verrasten (${Math.round(h.chance * 100)}% kans)`;
    case "score":
      return h.label === "bagel"
        ? "🥯 6-0 Droog"
        : h.label === "monsterzege"
          ? "🦖 Monsterzege"
          : "😬 Nagelbijter";
    case "streak":
      return `🔥 ${name(h.playerId)} ${h.count} op rij`;
    case "duo":
      return `👯 ${team(h.teamId)} ${h.count} samen op rij`;
    case "rating":
      return `📈 ${name(h.playerId)} door de ${h.threshold}`;
    case "tier":
      return h.richting === "promotie"
        ? `${h.emoji} ${name(h.playerId)} promoveert naar ${h.label}`
        : `${h.emoji} ${name(h.playerId)} zakt naar ${h.label}`;
  }
}

/** Eén compacte feedregel: icoon + (optionele) avatars + tekst, als link. */
/** Coach Rudy's commentaar onder een feed-item: een nette speech-bubble met
 *  zijn micro-avatar en naam. Rendert niets als hij bij dit item zwijgt. */
function CoachInfoButton({ onInfo }: { onInfo: () => void }) {
  return (
    <button
      type="button"
      className="coach-comment__info"
      onClick={onInfo}
      aria-haspopup="dialog"
      aria-label="Over Coach Rudy"
      title="Over Coach Rudy"
    >
      ⓘ
    </button>
  );
}

function CoachComment({
  tekst,
  mood,
  onInfo,
}: {
  tekst: string | null;
  mood: CoachMood;
  onInfo: () => void;
}) {
  if (!tekst) return null;
  return (
    <div className="coach-comment">
      <CoachAvatar size={34} mood={mood} className="coach-comment__face" />
      <div className="coach-comment__bubble">
        <span className="coach-comment__head">
          <span className="coach-comment__name">{COMMENTATOR.naam}</span>
          <CoachInfoButton onInfo={onInfo} />
        </span>
        <span className="coach-comment__text">{tekst}</span>
      </div>
    </div>
  );
}

/** Coach Rudy's avondverslag (#204): dezelfde speech-bubble, maar met een korte
 *  monoloog van meerdere zinnen. Rendert niets zonder verslag. */
function CoachMonologue({
  lines,
  mood,
  onInfo,
}: {
  lines: string[];
  mood: CoachMood;
  onInfo: () => void;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="coach-comment">
      <CoachAvatar size={34} mood={mood} className="coach-comment__face" />
      <div className="coach-comment__bubble">
        <span className="coach-comment__head">
          <span className="coach-comment__name">
            {COMMENTATOR.naam} · avondverslag
          </span>
          <CoachInfoButton onInfo={onInfo} />
        </span>
        {lines.map((l, i) => (
          <span key={i} className="coach-comment__text">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Rijk speelavond-blok (#232 PR C): mini-eindstand van de avond + beste duo,
 *  met Coach Rudy's avondverslag eronder — i.p.v. één compacte regel. */
function EveningCard({
  event,
  data,
  mood,
  pmap,
  tmap,
  name,
  onInfo,
}: {
  event: Extract<FeedEvent, { kind: "evening" }>;
  data: { summary: EveningSummary; coachLines: string[] };
  mood: CoachMood;
  pmap: Record<string, Profile>;
  tmap: Parameters<typeof MatchCard>[0]["teams"];
  name: (pid: string) => string;
  onInfo: () => void;
}) {
  const { summary, coachLines } = data;
  const top = summary.rows.slice(0, 4);
  return (
    <div className="feed-evening">
      <Link className="feed-evening__head" to={`/groepen/${event.groupId}`}>
        <span className="feed-evening__tok" aria-hidden="true">🎾</span>
        <span className="feed-evening__title">Speelavond · {event.count} matches</span>
        <span className="feed-evening__group">{event.groupName}</span>
      </Link>
      {top.length > 0 && (
        <ol className="ev-stand">
          {top.map((r, i) => (
            <li className="ev-row" key={r.playerId}>
              <span className="ev-row__pos">{i + 1}</span>
              <Avatar profile={pmap[r.playerId]} size={22} />
              <span className="ev-row__nm">{name(r.playerId)}</span>
              <span className="ev-row__wl">
                {r.won}–{r.lost}
              </span>
              <span className="ev-row__pt">{r.points} ptn</span>
            </li>
          ))}
        </ol>
      )}
      {summary.bestDuo && (
        <p className="ev-duo">
          👯 Beste duo: <strong>{teamLabel(tmap[summary.bestDuo.teamId], pmap)}</strong> —{" "}
          {summary.bestDuo.won} {summary.bestDuo.won === 1 ? "winst" : "winsten"} samen.
        </p>
      )}
      <CoachMonologue lines={coachLines} mood={mood} onInfo={onInfo} />
    </div>
  );
}

/** Smoes-kaart (#296): de verliezer plaatste een excuus onder Coach Rudy's stem.
 *  Bewust twéé duidelijk verschillende bubbels — de speler zélf (eigen avatar +
 *  naam in een neutrale bubbel met 🙈-chip) en Coach Rudy's jury-oordeel in zijn
 *  eigen coach-bubbel eronder — zodat een smoes nooit te verwarren is met Rudy's
 *  gewone commentaar. Het oordeel is deterministisch uit de smoes afgeleid en
 *  respecteert het roast-schild van de speler. */
function SmoesCard({
  event,
  pmap,
  tmap,
  name,
  onInfo,
}: {
  event: Extract<FeedEvent, { kind: "smoes" }>;
  pmap: Record<string, Profile>;
  tmap: Record<string, Team>;
  name: (pid: string) => string;
  onInfo: () => void;
}) {
  const beschermd = pmap[event.playerId]?.roast_schild ?? false;
  const oordeel = kiesOordeel(event.smoes, beschermd);
  // Rudy's mysterie volgt zijn oordeel: goedgekeurd → trots, afgekeurd → gemeen.
  const mood: CoachMood =
    beschermd || oordeel.gradatie === "matig"
      ? "portret"
      : oordeel.gradatie === "goedgekeurd"
        ? "trots"
        : "gemeen";
  // Bij wélke nederlaag hoort de smoes: tegenstander + score vanuit het verloren
  // team, zodat de kaart niet los in de feed hangt.
  const m = event.match;
  const nederlaag =
    m && m.winner_team_id
      ? (() => {
          const verliezerTeam =
            m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id;
          const tegenstander = teamLabel(tmap[m.winner_team_id], pmap);
          const heeftScore = m.score_a != null && m.score_b != null;
          const eigen = verliezerTeam === m.team_a_id ? m.score_a : m.score_b;
          const tegen = verliezerTeam === m.team_a_id ? m.score_b : m.score_a;
          return { tegenstander, score: heeftScore ? `${eigen}–${tegen}` : null };
        })()
      : null;
  return (
    <div className="feed-smoes">
      <Link className="feed-smoes__head" to={`/matches/${event.matchId}`}>
        <span className="feed-smoes__tok" aria-hidden="true">🙈</span>
        <span className="feed-smoes__headbody">
          <span className="feed-smoes__title">Smoes van de nederlaag</span>
          {nederlaag && (
            <span className="feed-smoes__match">
              verloor{nederlaag.score ? ` ${nederlaag.score}` : ""} van{" "}
              <strong>{nederlaag.tegenstander}</strong>
            </span>
          )}
        </span>
        <span className="feed-smoes__group">{event.groupName}</span>
      </Link>
      {/* De speler zelf verzint een excuus. */}
      <div className="smoes-bubble">
        <Avatar profile={pmap[event.playerId]} size={34} />
        <div className="smoes-bubble__body">
          <span className="smoes-bubble__name">
            {name(event.playerId)}
            <span className="smoes-bubble__tag">🙈 Smoes</span>
          </span>
          <span className="smoes-bubble__text">“{event.smoes}”</span>
        </div>
      </div>
      {/* Coach Rudy's jury-oordeel — de bestaande coach-bubbel. */}
      <div className="coach-comment">
        <CoachAvatar size={34} mood={mood} className="coach-comment__face" />
        <div className="coach-comment__bubble">
          <span className="coach-comment__head">
            <span className="coach-comment__name">{COMMENTATOR.naam} · jury</span>
            <CoachInfoButton onInfo={onInfo} />
          </span>
          <span
            className={`coach-comment__text smoes-oordeel smoes-oordeel--${oordeel.gradatie}`}
          >
            {oordeel.tekst}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Één teamkant in de match-kaart: avatars boven de teamnaam (#232). */
function TeamCol({
  team,
  pmap,
  won,
  label,
}: {
  team: Team | undefined;
  pmap: Record<string, Profile>;
  won: boolean;
  label: string;
}) {
  const ids = team ? [team.player1_id, team.player2_id] : [];
  return (
    <div className={`fmatch__team ${won ? "is-win" : ""}`}>
      <span className="fmatch__avs">
        {ids.map((id) => (
          <Avatar key={id} profile={pmap[id]} size={24} short />
        ))}
      </span>
      <span className="fmatch__nm">{label}</span>
    </div>
  );
}

/** Match-kaart in de feed (#232): chip-header, avatars boven de teamnaam, grote
 *  centrale score met winnaar-accent en de set-uitslag als chips eronder. */
function FeedMatch({
  event,
  tmap,
  pmap,
  name,
}: {
  event: Extract<FeedEvent, { kind: "match" }>;
  tmap: Record<string, Team>;
  pmap: Record<string, Profile>;
  name: (pid: string) => string;
}) {
  const m = event.match;
  const done = m.status === "completed";
  const aWon = done && m.winner_team_id === m.team_a_id;
  const bWon = done && m.winner_team_id === m.team_b_id;
  const scored = m.score_a != null && m.score_b != null;
  const sets = readSetScores(m) ?? [];
  const teamLbl = (tid: string) => teamLabel(tmap[tid], pmap);
  return (
    <Link className="fmatch" to={`/matches/${m.id}`}>
      <div className="fmatch__head">
        {event.myDelta != null && event.myDelta !== 0 && (
          <span className={`badge ${event.myDelta > 0 ? "badge--win" : "badge--loss"}`}>
            {event.myDelta > 0 ? "▲" : "▼"} {Math.abs(event.myDelta)} rating
          </span>
        )}
        {event.highlights.map((h, i) => (
          <span key={i} className="fmatch__chip">
            {highlightText(h, name, teamLbl)}
          </span>
        ))}
        <span className="fmatch__time">{formatTime(event.at)}</span>
      </div>
      <div className="fmatch__board">
        <TeamCol team={tmap[m.team_a_id]} pmap={pmap} won={aWon} label={teamLbl(m.team_a_id)} />
        <div className="fmatch__score">
          {scored ? (
            <>
              <span className={aWon ? "w" : ""}>{m.score_a}</span>
              <span className="d">–</span>
              <span className={bWon ? "w" : ""}>{m.score_b}</span>
            </>
          ) : (
            <span className="fmatch__vs">{done ? "gespeeld" : "vs"}</span>
          )}
        </div>
        <TeamCol team={tmap[m.team_b_id]} pmap={pmap} won={bWon} label={teamLbl(m.team_b_id)} />
      </div>
      {sets.length > 0 && (
        <div className="fmatch__sets">
          {sets.map((s, i) => (
            <span key={i} className="fmatch__set">
              {s[0]}–{s[1]}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

/** Highlight-kaart (#232): een groot moment (klassement/roast/kampioen) als
 *  geaccentueerde kaart in de kleur van zijn categorie — i.p.v. dezelfde
 *  compacte regel als routine-items. */
function FeedHighlight({
  cat,
  icon,
  label,
  to,
  at,
  children,
}: {
  cat: "rank" | "champ" | "roast";
  icon: string;
  label: string;
  to: string;
  at?: string;
  children: ReactNode;
}) {
  return (
    <Link className="feed-hi" data-cat={cat} to={to}>
      <span className="feed-hi__tok" aria-hidden="true">
        {icon}
      </span>
      <span className="feed-hi__body">
        <span className="feed-hi__label">{label}</span>
        <span className="feed-hi__title">{children}</span>
      </span>
      {at && <span className="feed-hi__time">{formatTime(at)}</span>}
    </Link>
  );
}

function FeedLine({
  icon,
  to,
  avatars = [],
  pmap,
  at,
  children,
}: {
  icon: string;
  to: string;
  avatars?: string[];
  pmap: Record<string, Profile>;
  /** Klok-tijd rechts; alleen meegeven bij een écht gebeurtenismoment
      (rank/kampioen hebben een kunstmatige tijd en tonen er dus geen). */
  at?: string;
  children: ReactNode;
}) {
  return (
    <Link className="feed-line" to={to}>
      <span className="feed-line__icon" aria-hidden="true">
        {icon}
      </span>
      {avatars.length > 0 && (
        <span className="feed-line__avatars" aria-hidden="true">
          {avatars.map((pid) => (
            <Avatar key={pid} profile={pmap[pid]} size={24} />
          ))}
        </span>
      )}
      <span className="feed-line__text">{children}</span>
      {at && (
        <time className="feed-line__time" dateTime={at}>
          {formatTime(at)}
        </time>
      )}
    </Link>
  );
}

export default Feed;
