import { describe, expect, it } from "vitest";
import {
  EDIT_MAX,
  EDIT_MIN,
  clampReading,
  readingScale,
  restoredValue,
  sameReadings,
  valueAtY,
  withReading,
} from "./edit-readings";
import { demoShipments } from "./demo-data";
import { findGaps, stateAt, type Reading } from "./sim-clock";

const demo: Reading[] = [3, 3.2, null, 4];

describe("editing readings", () => {
  it("clamps to the sandbox range and rounds to 0.1", () => {
    expect(clampReading(99)).toBe(EDIT_MAX);
    expect(clampReading(-99)).toBe(EDIT_MIN);
    expect(clampReading(3.14159)).toBe(3.1);
    expect(clampReading(NaN)).toBe(0);
  });
  it("changes one slot without mutating the original", () => {
    const next = withReading(demo, 1, 7.46);
    expect(next).toEqual([3, 7.5, null, 4]);
    expect(demo).toEqual([3, 3.2, null, 4]);
  });
  it("null makes the slot unknown and a gap, never an interpolated value", () => {
    const next = withReading(demo, 1, null);
    expect(next[1]).toBeNull();
    expect(findGaps(next, 480, 30)).toHaveLength(1);
    expect(findGaps(next, 480, 30)[0].startIndex).toBe(1);
    const f = stateAt(
      {
        readings: next,
        startMinute: 480,
        stepMinutes: 30,
        scenario: "HOLD_INSPECTION",
        delayMinutes: 0,
        totalCost: "0.00",
      },
      45,
    );
    expect(f.tempC).toBeNull();
    expect(f.temperatureState).toBe("unknown");
  });
  it("ignores an out-of-range index", () => {
    expect(withReading(demo, 9, 5)).toBe(demo);
  });
  it("restores the demo value, else a neutral entry", () => {
    expect(restoredValue(demo, 1)).toBe(3.2);
    expect(restoredValue(demo, 2)).toBe(4);
  });
  it("compares readings including nulls", () => {
    expect(sameReadings(demo, [...demo])).toBe(true);
    expect(sameReadings(demo, [3, 3.2, 4, 4])).toBe(false);
  });
  it("maps a pointer height back to a value on the chart scale", () => {
    const scale = readingScale(demoShipments[0].readings, 0);
    expect(valueAtY(16, scale)).toBe(scale.hi);
    expect(valueAtY(82, scale)).toBe(scale.lo);
    expect(valueAtY(-500, scale)).toBeLessThanOrEqual(EDIT_MAX);
  });
  it("pads the scale while editing", () => {
    const a = readingScale(demo, 0);
    const b = readingScale(demo, 2);
    expect(b.hi - a.hi).toBe(2);
    expect(a.lo - b.lo).toBe(2);
  });
});
