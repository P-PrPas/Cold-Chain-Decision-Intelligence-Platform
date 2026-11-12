import { describe, expect, it } from "vitest";
import { freshAssumptions, totalCost } from "../simulation-assumptions";
import { breakdownOf, percentText } from "./cost-breakdown";
import { niceCeil, placePoints } from "./chart-scale";

function scenario() {
  const s = freshAssumptions().scenarios[1];
  s.costs.additional_transport.amount = "1000.10";
  s.costs.inspection.amount = "250.05";
  s.costs.other.amount = "0.07";
  return s;
}

describe("cost breakdown", () => {
  it("sums exactly to the Decimal total with no float drift", () => {
    const b = breakdownOf(scenario(), "THB")!;
    expect(b.total).toBe("1250.22");
    expect(b.total).toBe(totalCost(scenario(), "THB"));
    const sum = b.parts.reduce((a, p) => a + p.cents, BigInt(0));
    expect(sum).toBe(b.totalCents);
    expect(b.parts.map((p) => p.amount)).toEqual([
      "1000.10",
      "250.05",
      "0.00",
      "0.00",
      "0.00",
      "0.07",
    ]);
  });
  it("lists all six categories, including zeros", () => {
    expect(breakdownOf(scenario(), "THB")!.parts).toHaveLength(6);
  });
  it("shares never exceed the whole", () => {
    const b = breakdownOf(scenario(), "THB")!;
    expect(b.parts.reduce((a, p) => a + p.bp, 0)).toBeLessThanOrEqual(10000);
  });
  it("an all-zero total has zero shares, not NaN", () => {
    const b = breakdownOf(freshAssumptions().scenarios[0], "THB")!;
    expect(b.total).toBe("0.00");
    expect(b.parts.every((p) => p.bp === 0)).toBe(true);
  });
  it("huge amounts stay exact", () => {
    const s = scenario();
    s.costs.other.amount = "9999999999999999.99";
    const b = breakdownOf(s, "THB")!;
    expect(b.parts[5].amount).toBe("9999999999999999.99");
    expect(b.total).toBe("10000000000001250.14");
  });
  it("an invalid amount means no breakdown", () => {
    const s = scenario();
    s.costs.holding.amount = "abc";
    expect(breakdownOf(s, "THB")).toBeNull();
    expect(breakdownOf(undefined, "THB")).toBeNull();
  });
  it("formats shares", () => {
    expect(percentText(10000)).toBe("100");
    expect(percentText(1250)).toBe("12.5");
    expect(percentText(0)).toBe("0");
  });
});

describe("compare chart scale", () => {
  it("rounds up to nice numbers", () => {
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(240)).toBe(250);
    expect(niceCeil(6000)).toBe(6000);
    expect(niceCeil(6001)).toBe(8000);
    expect(niceCeil(4500)).toBe(5000);
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(NaN)).toBe(1);
  });
  it("places points, leaves invalid ones out, and keeps a minimum scale", () => {
    const pts = [
      { type: "A", delay: 120, cost: "2800.00" },
      { type: "B", delay: null, cost: "10.00" },
      { type: "C", delay: 30, cost: null },
    ];
    const { xMax, yMax, place } = placePoints(pts);
    expect(xMax).toBe(300);
    expect(yMax).toBe(4000);
    expect(place(pts[0])).toEqual({ x: 120 / 300, y: 2800 / 4000 });
    expect(place(pts[1])).toBeNull();
    expect(place(pts[2])).toBeNull();
  });
  it("includes the previous positions in the scale", () => {
    const { xMax } = placePoints(
      [{ type: "A", delay: 10, cost: "1.00" }],
      [{ type: "A", delay: 5000, cost: "1.00" }],
    );
    expect(xMax).toBe(6000);
  });
});
