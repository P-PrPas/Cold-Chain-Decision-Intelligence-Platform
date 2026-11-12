/** Smallest "nice" number (1, 2, 2.5, 5 times a power of ten) at or above v. */
export function niceCeil(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10])
    if (m * base >= v - 1e-9) return m * base;
  return 10 * base;
}

/** Evenly spaced tick values from 0 to max, `count` intervals. */
export function ticks(max: number, count: number): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

export type ChartPoint = {
  type: string;
  /** null when the delay is invalid. */
  delay: number | null;
  /** Exact money string, or null when invalid. */
  cost: string | null;
};

/**
 * Place points on a 0-based linear scale. The x and y maxima are rounded up so
 * points keep their position while a slider moves within the same scale step.
 */
export function placePoints(
  points: ChartPoint[],
  extra: ChartPoint[] = [],
  minX = 240,
  minY = 1000,
) {
  const all = [...points, ...extra];
  const xs = all.flatMap((p) => (p.delay === null ? [] : [p.delay]));
  const ys = all.flatMap((p) => (p.cost === null ? [] : [Number(p.cost)]));
  // 10% headroom keeps the largest point off the frame.
  const xMax = niceCeil(Math.max(minX, ...xs) * 1.1);
  const yMax = niceCeil(Math.max(minY, ...ys) * 1.1);
  const place = (p: ChartPoint) =>
    p.delay === null || p.cost === null
      ? null
      : { x: p.delay / xMax, y: Number(p.cost) / yMax };
  return { xMax, yMax, place };
}
