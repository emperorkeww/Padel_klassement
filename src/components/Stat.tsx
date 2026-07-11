import { type ReactNode } from "react";
import { CountUp } from "./CountUp";

// Eén kerncijfer-tegel (rating, positie, winrate, …). Getallen tellen op met
// een korte animatie; tekst (bv. "#3" of "—") verschijnt meteen.
export function Stat({
  label,
  value,
  delta,
  primary = false,
  badge,
}: {
  label: string;
  value: number | string;
  delta?: number | null;
  /** Geaccentueerde hoofdstat (de rating springt eruit t.o.v. de rest). */
  primary?: boolean;
  /** Extra pil op een eigen regel onder de waarde (bv. de tier-badge). */
  badge?: ReactNode;
}) {
  return (
    <div className={`stat${primary ? " stat--accent" : ""}`}>
      <span className="stat__value">
        {typeof value === "number" ? <CountUp value={value} /> : value}
        {delta != null && delta !== 0 && (
          <span className={`stat__delta ${delta > 0 ? "is-up" : "is-down"}`}>
            {delta > 0 ? "▲" : "▼"}
            {Math.abs(delta)}
          </span>
        )}
      </span>
      {badge && <span className="stat__badge">{badge}</span>}
      <span className="stat__label">{label}</span>
    </div>
  );
}

export default Stat;
