import { tierFor, tierForWeergave, tierTitle } from "@/features/rating/tiers";
import "./TierBadge.css";

/**
 * Divisie-badge (#127): toont de tier die bij een rating hoort ("Goud II").
 * Rendert niets zonder rating (nooit gespeeld). `dimmed` beslist de beller —
 * conventie: rating op minder dan THIN_GAMES matches (zelfde als .rating-thin).
 * `capDictator` klemt de El-Padelissimo-tier naar GOAT (#545): buiten De Troon
 * toont niemand de dictator-tier, want die is voorbehouden aan de troonhouder.
 */
export function TierBadge({
  rating,
  dimmed = false,
  size = "md",
  capDictator = false,
}: {
  rating: number | null;
  dimmed?: boolean;
  size?: "md" | "sm";
  capDictator?: boolean;
}) {
  const tier = capDictator ? tierForWeergave(rating, false) : tierFor(rating);
  if (!tier) return null;
  return (
    <span
      className={`tier-badge tier-badge--${tier.key}${size === "sm" ? " tier-badge--sm" : ""}${dimmed ? " is-dim" : ""}`}
      title={tierTitle(tier)}
      // Het niveau apart als attribuut (#943), zodat een krappe plek — de
      // podiumkolom op 390px — de bandnaam kan wegnemen en tóch "🫧 I" kan
      // tonen in plaats van "Glazenw…". Bewust een attribuut en geen extra
      // span: de badge houdt zo één tekstknoop, en dat is waar de rest van de
      // app (en de tests) hem op vindt.
      data-niveau={tier.subLabel ?? ""}
    >
      <span className="tier-badge__icon" aria-hidden="true">
        {tier.emoji}
      </span>
      {tier.label}
    </span>
  );
}

export default TierBadge;
