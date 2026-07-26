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
      <div className="stat stat--accent">
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
