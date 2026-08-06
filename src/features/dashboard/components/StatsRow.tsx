import { StatsSkeleton } from "@/ui/Skeleton";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { tierFor } from "@/features/rating/tiers";
import { Stat } from "./Stat";

// De vier stattegels onder de hero. Divisie als badge-pill i.p.v. grote tekst:
// lange divisienamen ("Racketconsument III") passen zo netjes in de tegel (#374).

export function StatsRow({
  loading,
  rating,
  rank,
  winrate,
  played,
}: {
  loading: boolean;
  rating: number | null;
  rank: number | null;
  winrate: number | null;
  played: number;
}) {
  if (loading) return <StatsSkeleton />;
  return (
    <div className="stats">
      {/* Zelfde vlak als de andere drie (#1074). Deze tegel droeg als enige
          --accent-soft als achtergrond, waardoor de rij van vier las als één
          gekozen tegel plus drie gewone — terwijl "Divisie" niet actief of
          belangrijker is dan "Positie". De TierBadge erin draagt de divisie-
          identiteit al, en dóét dat met zijn eigen kleur per divisie. */}
      <div className="stat">
        <span className="stat__value stat__value--tier">
          {tierFor(rating) ? <TierBadge rating={rating} /> : "—"}
        </span>
        <span className="stat__label">Divisie</span>
      </div>
      <Stat label="Positie" value={rank ? `#${rank}` : "—"} />
      <Stat label="Winrate" value={winrate != null ? `${winrate}%` : "—"} />
      <Stat label="Gespeeld" value={played} />
    </div>
  );
}

export default StatsRow;
