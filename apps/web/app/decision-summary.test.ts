import { describe, expect, it } from "vitest";
import { formatDecimal, money } from "./decision-summary";

describe("money formatting is Decimal safe", () => {
  it("groups thousands and keeps two decimals", () => {
    expect(money("120000.00", "THB")).toBe("120,000.00 THB");
    expect(money("5", "THB")).toBe("5.00 THB");
  });
  it("does not round or lose digits beyond float precision", () => {
    expect(formatDecimal("9007199254740993.10")).toBe(
      "9,007,199,254,740,993.10",
    );
    expect(formatDecimal("0.125")).toBe("0.125");
  });
  it("shows the fallback for missing or malformed values", () => {
    expect(money(null, "THB", "n/a")).toBe("n/a");
    expect(money("12,00", "THB", "n/a")).toBe("n/a");
    expect(money("NaN", "THB", "n/a")).toBe("n/a");
  });
});
