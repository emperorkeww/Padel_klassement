import { tierFor, tierTitle } from "../lib/tiers";
import "./TierBadge.css";

/**
 * Divisie-badge (#127): toont de tier die bij een rating hoort ("Goud II").
 * Rendert niets zonder rating (nooit gespeeld). `dimmed` beslist de beller —
 * conventie: rating op minder dan THIN_GAMES matches (zelfde als .rating-thin).
 */
export function TierBadge({
  rating,
  dimmed = false,
  size = "md",
}: {
  rating: number | null;
  dimmed?: boolean;
  size?: "md" | "sm";
}) {
  const tier = tierFor(rating);
  if (!tier) return null;
  return (
    <span
      className={`tier-badge tier-badge--${tier.key}${size === "sm" ? " tier-badge--sm" : ""}${dimmed ? " is-dim" : ""}`}
      title={tierTitle(tier)}
    >
      <span className="tier-badge__dot" aria-hidden="true" />
      {tier.label}
    </span>
  );
}

export default TierBadge;
