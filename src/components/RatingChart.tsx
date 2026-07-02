import { useId, useRef, useState } from "react";
import type { RatingPoint } from "../lib/types";
import { formatDate } from "../lib/format";
import "./RatingChart.css";

// Hand-rolled SVG-lijngrafiek van de rating over tijd (geen chart-dependency).
// De rating na elke match wordt uitgezet; de y-as krijgt wat marge rond min/max.
// Aanwijzen/vegen toont per punt de datum, rating en delta.

const VW = 320; // viewBox-breedte
const VH = 120; // viewBox-hoogte
const PAD = { top: 12, right: 8, bottom: 8, left: 34 };

export function RatingChart({ history }: { history: RatingPoint[] }) {
  const gradId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

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

  // Van muis-/vingerpositie naar het dichtstbijzijnde datapunt.
  function pointFromEvent(e: React.PointerEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const fx = ((e.clientX - rect.left) / rect.width) * VW;
    const i = Math.round(((fx - PAD.left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const tipFor = (i: number): { title: string; delta: number | null } => {
    if (i === 0) return { title: `Start · ${values[0]}`, delta: null };
    const h = history[i - 1];
    return {
      title: `${formatDate(h.played_at)} · ${h.rating_after}`,
      delta: h.delta,
    };
  };
  const tip = hover != null ? tipFor(hover) : null;

  return (
    <div className="rating-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        className="rating-chart__svg"
        role="img"
        aria-label={`Rating-verloop: van ${first} naar ${last}`}
        preserveAspectRatio="none"
        onPointerMove={pointFromEvent}
        onPointerDown={pointFromEvent}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          {/* Gradient onder de lijn; kleur volgt het palet via CSS-variabelen. */}
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0"
              style={{
                stopColor: up ? "var(--success)" : "var(--danger)",
                stopOpacity: 0.22,
              }}
            />
            <stop
              offset="1"
              style={{
                stopColor: up ? "var(--success)" : "var(--danger)",
                stopOpacity: 0.02,
              }}
            />
          </linearGradient>
        </defs>

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
          className="rating-chart__area"
          d={areaPath}
          fill={`url(#${gradId})`}
        />
        <path
          className={`rating-chart__line ${up ? "is-up" : "is-down"}`}
          d={linePath}
          pathLength={1}
        />
        <circle
          className={`rating-chart__dot ${up ? "is-up" : "is-down"}`}
          cx={x(n - 1)}
          cy={y(last)}
          r={3}
        />

        {/* Scrubber: hulplijn + actief punt onder de vinger/cursor. */}
        {hover != null && (
          <>
            <line
              className="rating-chart__cursor"
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={VH - PAD.bottom}
            />
            <circle
              className={`rating-chart__dot ${up ? "is-up" : "is-down"}`}
              cx={x(hover)}
              cy={y(values[hover])}
              r={4}
            />
          </>
        )}
      </svg>

      {tip && hover != null && (
        <div
          className="rating-chart__tip"
          style={{
            left: `${(x(hover) / VW) * 100}%`,
            top: `${(y(values[hover]) / VH) * 100}%`,
          }}
          role="status"
        >
          {tip.title}
          {tip.delta != null && tip.delta !== 0 && (
            <span
              className={`rating-chart__tip-delta ${tip.delta > 0 ? "is-up" : "is-down"}`}
            >
              {tip.delta > 0 ? `+${tip.delta}` : tip.delta}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default RatingChart;
