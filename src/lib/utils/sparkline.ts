// Pure helpers voor de sparkline in het klassement (components/Sparkline.tsx).

export const SPARK_W = 72;
export const SPARK_H = 24;
export const SPARK_PAD = 2; // halve lijndikte + marge, zodat de afgeronde uiteinden niet afknippen
export const SPARK_MAX_POINTS = 20;

/** Dunt een reeks uit tot hoogstens `max` punten, met behoud van eerste en laatste. */
export function downsample<T>(points: T[], max: number): T[] {
  if (max < 2 || points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

/** Waarden → `points`-attribuut voor een <polyline>, geschaald binnen het
 *  viewBox; een vlakke reeks wordt een horizontale middellijn. */
export function toPolylinePoints(
  values: number[],
  width = SPARK_W,
  height = SPARK_H,
  pad = SPARK_PAD,
): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;
  return values
    .map((v, i) => {
      const x = pad + (plotW * i) / (values.length - 1);
      const y = span === 0 ? height / 2 : pad + plotH * (1 - (v - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
