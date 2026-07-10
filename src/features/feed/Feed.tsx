import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { formatDate, formatRelativeDay } from "../../lib/format";
import { getGroupMatches, getRecentMatches, getTeamsMap } from "../matches/api";
import { MatchCard } from "../matches/MatchList";
import { getProfilesMap, displayName } from "../profiles/api";
import { getMyFriendships } from "../friends/api";
import { getMyGroups, getGroupMembers } from "../groups/api";
import { getGroupPolls } from "../groups/pollsApi";
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

export function Feed() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  // Kernbronnen (bepalen de laadstaat, zoals voorheen).
  const matches = useAsync(() => getRecentMatches(MATCH_WINDOW), []);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getProfilesMap, []);
  const friendships = useAsync(getMyFriendships, []);
  useRealtime("matches", matches.reload);
  useRealtime("friendships", friendships.reload);

  // Verrijkende bronnen (progressief; buildFeed werkt ook zonder).
  const histories = useAsync(getAllRatingHistories, []);
  const standings = useAsync(getPlayerStandings, []);
  const groups = useAsync(getMyGroups, []);
  const groupKey = (groups.data ?? []).map((g) => g.id).join(",");
  const groupExtras = useAsync(async () => {
    const list = groups.data ?? [];
    const perGroup = await Promise.all(
      list.map(async (g) => ({
        id: g.id,
        members: await getGroupMembers(g.id),
        polls: await getGroupPolls(g.id),
      })),
    );
    const membersByGroup: Record<string, GroupMember[]> = {};
    const pollsByGroup: Record<string, FeedPoll[]> = {};
    for (const e of perGroup) {
      membersByGroup[e.id] = e.members;
      pollsByGroup[e.id] = e.polls;
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

  const pmap = profiles.data ?? {};
  const tmap = teams.data ?? {};
  const feed = loading
    ? []
    : buildFeed({
        matches: matches.data ?? [],
        teams: tmap,
        friendships: friendships.data ?? [],
        myId,
        limit,
        histories: histories.data ?? undefined,
        standings: standings.data ?? undefined,
        groups: groups.data ?? undefined,
        membersByGroup: groupExtras.data?.membersByGroup,
        pollsByGroup: groupExtras.data?.pollsByGroup,
        groupMatchesByGroup: groupMatches.data ?? undefined,
        profiles: pmap,
      });

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

      {!loading && !error && feed.length === 0 && (
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
          {feed.length >= limit && (
            <div className="feed__more">
              <button
                type="button"
                className="btn"
                onClick={() => setLimit((l) => l + FEED_LIMIT)}
              >
                Toon meer
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
                  {highlightText(h, name)}
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
        <FeedLine icon="🗓️" to={`/matches/${event.match.id}`} pmap={pmap}>
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
        >
          Speeldag-poll gestart in <strong>{event.groupName}</strong> — stem
          mee!
        </FeedLine>
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

/** Chip-tekst per highlight; namen komen uit de meegegeven resolver. */
function highlightText(h: Highlight, name: (pid: string) => string): string {
  switch (h.type) {
    case "upset":
      return `🎯 Upset — ${Math.round(h.chance * 100)}% kans`;
    case "score":
      return h.label === "bagel"
        ? "🥯 Broodje bal"
        : h.label === "monsterzege"
          ? "🦖 Monsterzege"
          : "😬 Nagelbijter";
    case "streak":
      return `🔥 ${name(h.playerId)} ${h.count} op rij`;
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
  children,
}: {
  icon: string;
  to: string;
  avatars?: string[];
  pmap: Record<string, Profile>;
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
    </Link>
  );
}

export default Feed;
