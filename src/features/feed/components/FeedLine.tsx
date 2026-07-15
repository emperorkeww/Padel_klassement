import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Avatar } from "@/ui/Avatar";
import { formatTime } from "@/lib/utils/format";
import type { Profile } from "@/types";

export function FeedLine({
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
