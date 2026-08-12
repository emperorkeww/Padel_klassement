import { CountUp } from "@/ui/CountUp";
import { RatingChart } from "@/features/rating/components/RatingChart";
import { tierProgress } from "@/features/rating/tiers";
import type { RatingPoint } from "@/types";

// Rating: groot getal + delta + verloop in één kaart (voorheen een stat-tegel
// én een losse grafiekkaart met dezelfde informatie). Uit Dashboard.tsx
// gelicht (#736). De TierBadge en de "Mijn profiel →"-link zijn er sinds
// #1242 uit: de divisie-badge staat in de hero-kop en de profiel-ingang is de
// avatar — deze kaart draagt het getal en zijn verloop.

export function RatingCard({
  loading,
  rating,
  /** Dag-cumulatieve ELO-beweging voor de ▲/▼-badge (#352). */
  dayDelta,
  history,
}: {
  loading: boolean;
  rating: number | null;
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
