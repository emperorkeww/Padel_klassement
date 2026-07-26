import { Link } from "react-router-dom";
import { CountUp } from "@/ui/CountUp";
import { RatingChart } from "@/features/rating/components/RatingChart";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { tierProgress } from "@/features/rating/tiers";
import { THIN_GAMES } from "@/features/groups/groupRating";
import type { RatingPoint } from "@/types";

// Rating: groot getal + delta + verloop in één kaart (voorheen een stat-tegel
// én een losse grafiekkaart met dezelfde informatie). Uit Dashboard.tsx
// gelicht (#736).

export function RatingCard({
  myId,
  loading,
  rating,
  games,
  /** Dag-cumulatieve ELO-beweging voor de ▲/▼-badge (#352). */
  dayDelta,
  history,
}: {
  myId: string;
  loading: boolean;
  rating: number | null;
  games: number;
  dayDelta: number;
  history: RatingPoint[];
}) {
  // "Nog X tot [volgende divisie]" — alleen tonen als er een volgende tier is.
  const progress = tierProgress(rating);
  const tierNext = progress && progress.volgende ? progress : null;

  if (!(loading || rating != null || history.length >= 2)) return null;

  return (
    <section className="card rating-card">
      <div className="card__head">
        <h2 className="card__title">Rating</h2>
        <Link className="profile-link" to={`/spelers/${myId}`}>
          Mijn profiel →
        </Link>
      </div>
      {loading ? (
        <span className="sk sk--line rating-card__sk" aria-hidden="true" />
      ) : (
        <p className="rating-card__value">
          {rating != null ? <CountUp value={rating} /> : "—"}
          {dayDelta !== 0 && (
            <span className={`stat__delta ${dayDelta > 0 ? "is-up" : "is-down"}`}>
              {dayDelta > 0 ? "▲" : "▼"}
              {Math.abs(dayDelta)}
            </span>
          )}
          <TierBadge rating={rating} dimmed={games > 0 && games < THIN_GAMES} />
        </p>
      )}
      {!loading && tierNext && (
        <p className="rating-card__next">
          Nog <strong>{tierNext.puntenNodig}</strong> rating tot{" "}
          {tierNext.volgende!.emoji} {tierNext.volgende!.naam}.
        </p>
      )}
      {history.length >= 2 ? (
        <RatingChart history={history} />
      ) : (
        !loading && (
          <p className="empty empty--bare">
            Speel meer matches om hier je ratingverloop te zien.
          </p>
        )
      )}
    </section>
  );
}

export default RatingCard;
