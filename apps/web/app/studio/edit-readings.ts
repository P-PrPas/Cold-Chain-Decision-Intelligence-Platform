import type { Reading } from "./sim-clock";

/** Sandbox-only bounds for an edited reading. They are not product limits. */
export const EDIT_MIN = -30;
export const EDIT_MAX = 40;

export function clampReading(value: number): number {
  const v = Number.isFinite(value) ? value : 0;
  return Math.round(Math.min(EDIT_MAX, Math.max(EDIT_MIN, v)) * 10) / 10;
}

/**
 * A copy of the readings with one slot changed. null marks "no reading": the
 * slot is unknown and is never filled from its neighbours.
 */
export function withReading(
  readings: Reading[],
  index: number,
  value: number | null,
): Reading[] {
  if (index < 0 || index >= readings.length) return readings;
  const next = readings.slice();
  next[index] = value === null ? null : clampReading(value);
  return next;
}

/**
 * Value for a slot that is switched back on: the demo value if there was one,
 * otherwise a neutral 4.0 that the person then adjusts. It is entered data and
 * is not derived from neighbouring readings.
 */
export function restoredValue(demo: Reading[], index: number): number {
  const v = demo[index];
  return typeof v === "number" ? v : 4;
}

export function sameReadings(a: Reading[], b: Reading[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Vertical scale of the timeline chart; padded while editing so points can move past the ends. */
export function readingScale(readings: Reading[], pad: number) {
  const known = readings.filter((v): v is number => v !== null);
  return {
    lo: Math.floor(Math.min(...known, 3)) - 1 - pad,
    hi: Math.ceil(Math.max(...known, 6)) + 1 + pad,
  };
}

/** Value for a pointer at `yPercent` (0 top, 100 bottom) of the chart track. */
export function valueAtY(
  yPercent: number,
  scale: { lo: number; hi: number },
): number {
  const raw = scale.hi - ((yPercent - 16) / 66) * (scale.hi - scale.lo);
  return clampReading(raw);
}
