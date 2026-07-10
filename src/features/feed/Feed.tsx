import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { MatchListSkeleton } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { Avatar } from "../../components/Avatar";
import { buildFeed, feedDay, type FeedEvent } from "../../lib/feed";
import { formatRelativeDay } from "../../lib/format";
import { getRecentMatches, getTeamsMap } from "../matches/api";
import { MatchCard } from "../matches/MatchList";
import { getProfilesMap, displayName } from "../profiles/api";
import { getMyFriendships } from "../friends/api";
import type { Profile } from "../../lib/types";
import "./Feed.css";

// Feed (#120): wat gebeurde er recent bij jou en je vrienden — afgeronde
// matches en nieuwe vriendschappen, chronologisch met dag-kopjes. Client-side
// geaggregeerd (lib/feed.ts) uit bronnen die er al zijn; realtime bijgewerkt.

/** Ruim venster aan recente uitslagen om de feed uit te filteren. */
const MATCH_WINDOW = 250;

export function Feed() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const matches = useAsync(() => getRecentMatches(MATCH_WINDOW), []);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getProfilesMap, []);
  const friendships = useAsync(getMyFriendships, []);
  useRealtime("matches", matches.reload);
  useRealtime("friendships", friendships.reload);

  const loading =
    matches.loading || teams.loading || profiles.loading || friendships.loading;
  const error = matches.error ?? friendships.error;

  const pmap = profiles.data ?? {};
  const tmap = teams.data ?? {};
  const feed = loading
    ? []
    : buildFeed({
        matches: matches.data ?? [],
        teams: tmap,
        friendships: friendships.data ?? [],
        myId,
      });

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
                  {event.kind === "match" ? (
                    <MatchCard
                      match={event.match}
                      teams={tmap}
                      profiles={pmap}
                      perspectiveId={myId}
                    />
                  ) : (
                    <FriendshipItem
                      meId={event.meId}
                      friendId={event.friendId}
                      pmap={pmap}
                    />
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function eventKey(event: FeedEvent): string {
  return event.kind === "match"
    ? `m-${event.match.id}`
    : `f-${event.friendId}-${event.at}`;
}

function FriendshipItem({
  meId,
  friendId,
  pmap,
}: {
  meId: string;
  friendId: string;
  pmap: Record<string, Profile>;
}) {
  return (
    <Link className="feed-friend" to={`/spelers/${friendId}`}>
      <span className="feed-friend__icon" aria-hidden="true">
        🤝
      </span>
      <span className="feed-friend__avatars" aria-hidden="true">
        <Avatar profile={pmap[meId]} size={24} />
        <Avatar profile={pmap[friendId]} size={24} />
      </span>
      <span className="feed-friend__text">
        Jij en <strong>{displayName(pmap[friendId])}</strong> zijn nu vrienden.
      </span>
    </Link>
  );
}

export default Feed;
