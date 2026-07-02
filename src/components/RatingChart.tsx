import type { RatingPoint } from "../lib/types";
import "./RatingChart.css";

// Hand-rolled SVG-lijngrafiek van de rating over tijd (geen chart-dependency).
// De rating na elke match wordt uitgezet; de y-as krijgt wat marge rond min/max.

const VW = 320; // viewBox-breedte
const VH = 120; // viewBox-hoogte
const PAD = { top: 12, right: 8, bottom: 8, left: 34 };

export function RatingChart({ history }: { history: RatingPoint[] }) {
  if (history.length < 2) {
    return (
      <p className="empty">
        Nog te weinig matches voor een grafiek — speel er meer om je verloop te
        zien.
      </p>
    );
  }

  // Reeks = startrating (rating_before van de eerste match) + elke rating_after.
  const values = [history[0].rating_before, ...history.map((h) => h.rating_after)];
  const n = values.length;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  // 10% marge boven/onder zodat de lijn niet tegen de rand plakt.
  const yMin = min - span * 0.1;
  const yMax = max + span * 0.1;

  const plotW = VW - PAD.left - PAD.right;
  const plotH = VH - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (plotW * i) / (n - 1);
  const y = (v: number) =>
    PAD.top + plotH * (1 - (v - yMin) / (yMax - yMin));

  const linePath = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
  // Gevuld vlak onder de lijn.
  const areaPath =
    `${linePath} L ${x(n - 1).toFixed(1)} ${(VH - PAD.bottom).toFixed(1)}` +
    ` L ${x(0).toFixed(1)} ${(VH - PAD.bottom).toFixed(1)} Z`;

  const last = values[n - 1];
  const first = values[0];
  const up = last >= first;

  return (
    <div className="rating-chart">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="rating-chart__svg"
        role="img"
        aria-label={`Rating-verloop: van ${first} naar ${last}`}
        preserveAspectRatio="none"
      >
        {/* y-as labels: max en min */}
        <text className="rating-chart__tick" x={PAD.left - 6} y={y(max) + 3} textAnchor="end">
          {max}
        </text>
        <text className="rating-chart__tick" x={PAD.left - 6} y={y(min) + 3} textAnchor="end">
          {min}
        </text>
        {/* nullijn op de startrating */}
        <line
          className="rating-chart__grid"
          x1={PAD.left}
          x2={VW - PAD.right}
          y1={y(first)}
          y2={y(first)}
        />
        <path
          className={`rating-chart__area ${up ? "is-up" : "is-down"}`}
          d={areaPath}
        />
        <path
          className={`rating-chart__line ${up ? "is-up" : "is-down"}`}
          d={linePath}
        />
        <circle
          className={`rating-chart__dot ${up ? "is-up" : "is-down"}`}
          cx={x(n - 1)}
          cy={y(last)}
          r={3}
        />
      </svg>
    </div>
  );
}

export default RatingChart;
