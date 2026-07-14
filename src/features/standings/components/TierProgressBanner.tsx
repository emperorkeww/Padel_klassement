import { tierProgress } from "@/features/rating/tiers";
import { TierBadge } from "@/features/rating/components/TierBadge";

/** Persoonlijke banner: jouw divisie + hoeveel rating je nog nodig hebt voor
 *  de volgende. Zichtbaar zodra je een rating hebt. */
export function TierProgressBanner({ rating }: { rating: number | null }) {
  const prog = tierProgress(rating);
  if (!prog) return null;
  const { huidig, volgende, puntenNodig } = prog;
  return (
    <div className={`tier-progress tier-progress--${huidig.key}`} role="status">
      <span className="tier-progress__now">
        Jij: <TierBadge rating={rating} /> ({rating})
      </span>
      {volgende ? (
        <span className="tier-progress__next">
          nog <strong>{puntenNodig}</strong> rating tot {volgende.emoji}{" "}
          {volgende.naam}
        </span>
      ) : (
        <span className="tier-progress__next">de hoogste divisie — chapeau!</span>
      )}
    </div>
  );
}
