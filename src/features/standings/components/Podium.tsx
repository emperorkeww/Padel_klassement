import { Link } from "react-router-dom";
import { Avatar, type AvatarSource } from "@/ui/Avatar";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { BIG_DADDY_EMOJI, BIG_DADDY_TITEL, bigDaddyRoast } from "@/features/dashboard/bigDaddy";
import "./Podium.css";

// Gedeeld podium voor de top 3 van een klassement (globaal én per groep):
// goud in het midden en verhoogd, zilver links, brons rechts. De rating is
// het hoofdgetal; punten of een W·G·V-record kunnen als bijschrift mee.

export interface PodiumEntry {
  key: string;
  name: string;
  profile: AvatarSource | null;
  link?: string;
  isMe?: boolean;
  /** Hoofdgetal: de rating (null = nog geen matches → "—"). */
  rating: number | null;
  /** Ratingverandering als ▲/▼-badge (0/null = geen badge). */
  delta?: number | null;
  /** Bijschrift, bv. "9 ptn". */
  sub?: string | null;
  /** Record-regel, bv. "3W · 1G · 0V" (verborgen op smal formaat). */
  record?: string | null;
  /** Rating op weinig matches → gedimd. */
  dimmed?: boolean;
  /** Toon de divisie-badge (#127), afgeleid van `rating`. Opt-in zodat
   *  punten-podia schoon blijven. */
  tier?: boolean;
}

export function Podium({ entries }: { entries: PodiumEntry[] }) {
  const [first, second, third] = entries;
  if (!first) return null;
  // Visuele volgorde: zilver — goud — brons.
  const order = [
    { entry: second, place: 2 as const },
    { entry: first, place: 1 as const },
    { entry: third, place: 3 as const },
  ].filter((s): s is { entry: PodiumEntry; place: 1 | 2 | 3 } => !!s.entry);

  return (
    <div className="podium" aria-label="Top 3">
      {order.map(({ entry, place }) => {
        // De #1 van een rating-podium (tier: true) is de "Big Daddy": roze kroon
        // + spot. Punten/toto-podia (geen tier) blijven ongemoeid.
        const isBigDaddy = place === 1 && !!entry.tier;
        const body = (
          <>
            {isBigDaddy && (
              <span className="podium__crown">
                <span className="podium__crown-title">
                  {BIG_DADDY_EMOJI} {BIG_DADDY_TITEL}
                </span>
                <span className="podium__roast">{bigDaddyRoast(entry.key)}</span>
              </span>
            )}
            <span className="podium__medal">{place}</span>
            <Avatar
              profile={entry.profile}
              name={entry.name}
              size={place === 1 ? 56 : 44}
            />
            <span className="podium__name">{entry.name}</span>
            <span className={`podium__value${entry.dimmed ? " is-dim" : ""}`}>
              {entry.rating ?? "—"}
              {entry.delta != null && entry.delta !== 0 && (
                <span
                  className={`stat__delta ${entry.delta > 0 ? "is-up" : "is-down"}`}
                >
                  {entry.delta > 0 ? "▲" : "▼"}
                  {Math.abs(entry.delta)}
                </span>
              )}
            </span>
            {entry.tier && (
              <TierBadge
                rating={entry.rating}
                dimmed={entry.dimmed}
                size="sm"
              />
            )}
            {entry.sub && <span className="podium__sub">{entry.sub}</span>}
            {entry.record && (
              <span className="podium__record">{entry.record}</span>
            )}
          </>
        );
        const className = `podium__spot podium__spot--${place}${isBigDaddy ? " is-bigdaddy" : ""} ${entry.isMe ? "is-me" : ""}`;
        return entry.link ? (
          <Link key={entry.key} to={entry.link} className={className}>
            {body}
          </Link>
        ) : (
          <span key={entry.key} className={className}>
            {body}
          </span>
        );
      })}
    </div>
  );
}

export default Podium;
