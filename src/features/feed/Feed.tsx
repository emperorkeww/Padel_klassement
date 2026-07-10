import { Fragment, useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { MatchListSkeleton } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { Avatar } from "../../components/Avatar";
import {
  buildFeed,
  feedDay,
  recentlyClosedSeason,
  FEED_LIMIT,
  type FeedEvent,
  type FeedPoll,
  type Highlight,
} from "../../lib/feed";
import { formatDate, formatRelativeDay, formatTime } from "../../lib/format";
import { getGroupMatches, getRecentMatches, getTeamsMap, teamLabel } from "../matches/api";
import { MatchCard } from "../matches/MatchList";
import { getProfilesMap, displayName } from "../profiles/api";
import { getMyFriendships } from "../friends/api";
import { getMyGroups, getGroupMembers } from "../groups/api";
import { getGroupPollOptions, getGroupPolls } from "../groups/pollsApi";
import { getPlayerStandings } from "../standings/api";
import { getAllRatingHistories } from "../standings/ratingsApi";
import type { GroupMember, Match, Profile } from "../../lib/types";
import "./Feed.css";

// Feed (#120, uitgebreid in #138): wat gebeurde er bij jou en je vrienden —
// matches met highlight-chips (upset, opvallende score, reeks, rating-
// mijlpaal), geplande matches, groeps- en pollnieuws, klassementsprongen en
// seizoenskampioenen. Client-side geaggregeerd (lib/feed.ts) uit bronnen die
// er al zijn; realtime bijgewerkt. Extra bronnen laden progressief: de feed
// verschijnt zodra de kern er is en verrijkt zichzelf daarna.

/** Ruim venster aan recente uitslagen om de feed uit te filteren. */
const MATCH_WINDOW = 250;

/** Filterchips: soortgroep → event-kinds. `null` = alles. */
const FILTERS = {
  Alles: null,
  Matches: new Set<FeedEvent["kind"]>(["match", "evening", "planned"]),
  Groepen: new Set<FeedEvent["kind"]>([
    "group-created",
    "group-joined",
    "poll",
    "poll-locked",
    "poll-booked",
    "season-champion",
  ]),
  Klassement: new Set<FeedEvent["kind"]>(["rank"]),
  Sociaal: new Set<FeedEvent["kind"]>(["friendship"]),
} as const;
type FilterLabel = keyof typeof FILTERS;
const FILTER_LABELS = Object.keys(FILTERS) as FilterLabel[];

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
  // Een nieuwe uitslag verandert ook ratings en klassement: alle drie de
  // bronnen verversen, anders blijven ▲/▼-delta's en rank-items achterlopen.
  const reloadMatchSources = useCallback(() => {
    matches.reload();
    histories.reload();
    standings.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.reload, histories.reload, standings.reload]);
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
            profiles: profiles.data ?? {},
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

  // Dag-kopjes: "vandaag / gisteren / eergisteren / 8 juli".
  let lastDay = "";

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Feed</h1>
        <p className="page-subtitle">
          Wat er speelt bij jou en je vrienden — nieuwste bovenaan.
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
          {FILTER_LABELS.map((label) => (
            <button
              key={label}
              type="button"
              className={`tab ${activeFilter === label ? "is-active" : ""}`}
              onClick={() => selectFilter(label)}
            >
              {label}
              {label !== "Alles" && (
                <span className="tab__count" aria-hidden="true">
                  {countFor(label)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!loading && !error && feed.length === 0 && activeFilter !== "Alles" && (
        <div className="card">
          <EmptyState
            icon="🔎"
            title="Niets in deze categorie."
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
            Recent geen nieuws van dit soort bij jou en je vrienden.
          </EmptyState>
        </div>
      )}

      {!loading && !error && feed.length === 0 && activeFilter === "Alles" && (
        <div className="card">
          <EmptyState
            icon="📣"
            title="Nog niets te melden."
            action={
              <Link className="btn btn--primary" to="/vrienden">
                Vrienden toevoegen
              </Link>
            }
          >
            Zodra jij of je vrienden matches spelen (of er nieuwe
            vriendschappen bijkomen) zie je het hier verschijnen.
          </EmptyState>
        </div>
      )}

      {!loading && !error && feed.length > 0 && (
        <>
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
                    <FeedItem event={event} pmap={pmap} tmap={tmap} myId={myId} name={name} />
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
    case "match":
      return (
        <div className="feed-match">
          <MatchCard
            match={event.match}
            teams={tmap}
            profiles={pmap}
            perspectiveId={myId}
          />
          {(event.highlights.length > 0 || event.myDelta != null) && (
            <div className="feed-chips">
              {event.myDelta != null && event.myDelta !== 0 && (
                <span
                  className={`badge ${event.myDelta > 0 ? "badge--win" : "badge--loss"}`}
                >
                  {event.myDelta > 0 ? "▲" : "▼"} {Math.abs(event.myDelta)} rating
                </span>
              )}
              {event.highlights.map((h, i) => (
                <span key={i} className="badge badge--accent">
                  {highlightText(h, name, (tid) => teamLabel(tmap[tid], pmap))}
                </span>
              ))}
            </div>
          )}
        </div>
      );
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
    case "rank":
      return (
        <FeedLine
          icon={event.shift === "nieuw" ? "✨" : (event.shift as number) > 0 ? "⬆️" : "⬇️"}
          to="/klassement"
          avatars={[event.playerId]}
          pmap={pmap}
        >
          {event.shift === "nieuw" ? (
            <>
              {name(event.playerId)}{" "}
              {event.playerId === myId ? "staat" : "staat"} nieuw op{" "}
              <strong>#{event.rank}</strong> in het klassement.
            </>
          ) : (
            <>
              {name(event.playerId)}{" "}
              {(event.shift as number) > 0 ? "steeg" : "zakte"}{" "}
              <strong>{Math.abs(event.shift as number)} plekken</strong> naar #
              {event.rank}.
            </>
          )}
        </FeedLine>
      );
    case "season-champion":
      return (
        <FeedLine
          icon="🏆"
          to={`/groepen/${event.groupId}?tab=stand&seizoen=${event.seasonLabel}`}
          avatars={[event.playerId]}
          pmap={pmap}
        >
          {name(event.playerId)} {event.playerId === myId ? "bent" : "is"}{" "}
          kampioen van <strong>{event.groupName}</strong> ({event.seasonLabel}
          )!
        </FeedLine>
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
        ? "🥯 Broodje bal"
        : h.label === "monsterzege"
          ? "🦖 Monsterzege"
          : "😬 Nagelbijter";
    case "streak":
      return `🔥 ${name(h.playerId)} ${h.count} op rij`;
    case "duo":
      return `👯 ${team(h.teamId)} ${h.count} samen op rij`;
    case "rating":
      return `📈 ${name(h.playerId)} door de ${h.threshold}`;
  }
}

/** Eén compacte feedregel: icoon + (optionele) avatars + tekst, als link. */
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
