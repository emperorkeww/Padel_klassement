import type { RatingPoint } from "@/types";
import {
  SPARK_W,
  SPARK_H,
  SPARK_MAX_POINTS,
  downsample,
  toPolylinePoints,
} from "@/lib/utils/sparkline";

// Mini-lijngrafiekje (sparkline) van het ratingverloop, voor in een tabelrij.
// Puur inline SVG zonder assen of tooltip; het volledige verhaal staat op de
// profielpagina (RatingChart).

export function Sparkline({
  history,
  name,
}: {
  history: RatingPoint[];
  name: string;
}) {
  // Reeks = startrating + rating na elke match (zoals RatingChart).
  const values =
    history.length > 0
      ? [history[0].rating_before, ...history.map((h) => h.rating_after)]
      : [];
  if (values.length < 2) return null;

  return (
    <svg
      className="sparkline"
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      role="img"
      aria-label={`Ratingverloop van ${name}`}
    >
      <polyline
        points={toPolylinePoints(downsample(values, SPARK_MAX_POINTS))}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default Sparkline;
