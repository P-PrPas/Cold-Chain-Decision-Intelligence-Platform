import { describe, it, expect } from "vitest";
import {
  freshAssumptions,
  totalCost,
  draftErrors,
} from "./simulation-assumptions";
describe("draft validation protects totals and calculations", () => {
  it.each(["", "-1", "1.", "1.234", "1e4"])(
    "rejects incomplete or invalid cost %s without a partial total",
    (amount) => {
      const a = freshAssumptions();
      a.scenarios[0].costs.inspection.amount = "2.00";
      a.scenarios[0].costs.other.amount = amount;
      expect(totalCost(a.scenarios[0])).toBe("Unavailable");
      expect(Object.keys(draftErrors(a))).not.toHaveLength(0);
    },
  );
  it.each([NaN, -1, 525601, 1.5])("rejects invalid delay %s", (delay) => {
    const a = freshAssumptions();
    a.scenarios[0].estimated_delay_minutes = delay;
    expect(draftErrors(a)).toHaveProperty("CONTINUE_DELIVERY.delay");
  });
  it("keeps exact cents across components and rejects fractional yen", () => {
    const a = freshAssumptions();
    a.scenarios[0].costs.inspection.amount = "2.15";
    a.scenarios[0].costs.other.amount = "3.10";
    expect(totalCost(a.scenarios[0])).toBe("5.25");
    expect(draftErrors(a)).toEqual({});
    a.currency = "JPY";
    expect(Object.keys(draftErrors(a))).toHaveLength(2);
  });
});

it("rejects backend money overflow and non-unit weight sum", () => {
  const a = freshAssumptions();
  a.scenarios[0].costs.other.amount = "10000000000000000.00";
  expect(totalCost(a.scenarios[0])).toBe("Unavailable");
  expect(Object.keys(draftErrors(a))).not.toHaveLength(0);
  a.ranking_weights = { cost: "0.60000001", delay: "0.4" };
  expect(draftErrors(a).weights).toBeTruthy();
});
