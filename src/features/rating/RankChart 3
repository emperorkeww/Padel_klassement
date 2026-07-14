import { useRef, useState } from "react";
import { formatDate } from "@/lib/utils/format";
import "./RatingChart.css";

// Hand-rolled SVG-lijngrafiek van de klassementspositie over tijd. Zelfde stijl
// als RatingChart, maar met omgekeerde y-as: rang 1 (beste) staat bovenaan.
// Elk punt = de positie ná een speeldag, berekend uit de volledige stand t/m
// die dag (dezelfde "stand op datum"-methode).

const VW = 320;
const VH = 120;
const PAD = { top: 12, right: 8, bottom: 8, left: 34 };

export type RankPoint = { date: string; rank: number };

export function RankChart({ points }: { points: RankPoint[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <p className="empty">
        Nog te weinig speeldagen voor een verloop — speel er meer om je positie
        over tijd te zien.
      </p>
    );
  }

  const ranks = points.map((p) => p.rank);
  const n = ranks.length;
  const min = Math.min(...ranks); // beste (hoogste) positie
  const max = Math.max(...ranks); // slechtste (laagste) positie
  const span = Math.max(max - min, 1);
  // 15% marge zodat de lijn niet tegen de rand plakt.
  const topVal = min - span * 0.15;
  const botVal = max + span * 0.15;

  const plotW = VW - PAD.left - PAD.right;
  const plotH = VH - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (plotW * i) / (n - 1);
  // Kleinere rang = beter = hoger in beeld (kleinere y).
  const y = (rank: number) =>
    PAD.top + plotH * ((rank - topVal) / (botVal - topVal));

  const linePath = ranks
    .map((r, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(r).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${x(n - 1).toFixed(1)} ${(VH - PAD.bottom).toFixed(1)}` +
    ` L ${x(0).toFixed(1)} ${(VH - PAD.bottom).toFixed(1)} Z`;

  const last = ranks[n - 1];
  const first = ranks[0];
  // "Omhoog" = positie verbeterd = lagere rang.
  const up = last <= first;

  function pointFromEvent(e: React.PointerEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const fx = ((e.clientX - rect.left) / rect.width) * VW;
    const i = Math.round(((fx - PAD.left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const tip =
    hover != null
      ? `${formatDate(points[hover].date)} · #${points[hover].rank}`
      : null;

  return (
    <div className="rating-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        className="rating-chart__svg"
        role="img"
        aria-label={`Positieverloop: van #${first} naar #${last}`}
        preserveAspectRatio="none"
        onPointerMove={pointFromEvent}
        onPointerDown={pointFromEvent}
        onPointerLeave={() => setHover(null)}
      >
        {/* y-as: beste positie boven, slechtste onder. */}
        <text className="rating-chart__tick" x={PAD.left - 6} y={y(min) + 3} textAnchor="end">
          #{min}
        </text>
        <text className="rating-chart__tick" x={PAD.left - 6} y={y(max) + 3} textAnchor="end">
          #{max}
        </text>
        {/* nullijn op de startpositie */}
        <line
          className="rating-chart__grid"
          x1={PAD.left}
          x2={VW - PAD.right}
          y1={y(first)}
          y2={y(first)}
        />
        <path className="rating-chart__area" d={areaPath} fill="var(--surface-2)" />
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
              cy={y(ranks[hover])}
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
            top: `${(y(ranks[hover]) / VH) * 100}%`,
          }}
          role="status"
        >
          {tip}
        </div>
      )}
    </div>
  );
}

export default RankChart;
