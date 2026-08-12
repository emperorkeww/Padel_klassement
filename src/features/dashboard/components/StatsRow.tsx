import { StatsSkeleton } from "@/ui/Skeleton";
import { Stat } from "./Stat";

// De stattegels onder de hero. De Divisie-tegel is er sinds #1242 uit: de
// divisie-badge staat al in de hero-kop naast de naam, en twee keer dezelfde
// badge op één scherm maakt geen van beide belangrijker.

export function StatsRow({
  loading,
  rank,
  winrate,
  played,
}: {
  loading: boolean;
  rank: number | null;
  winrate: number | null;
  played: number;
}) {
  if (loading) return <StatsSkeleton count={3} />;
  return (
    <div className="stats">
      <Stat label="Positie" value={rank ? `#${rank}` : "—"} />
      <Stat label="Winrate" value={winrate != null ? `${winrate}%` : "—"} />
      <Stat label="Gespeeld" value={played} />
    </div>
  );
}

export default StatsRow;
