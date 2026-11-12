import {
  costCategories,
  totalCost,
  type CostCategory,
  type ScenarioAssumption,
} from "@/lib/simulation-assumptions";

export type CostPart = {
  key: CostCategory;
  /** Exact Decimal string, two places. */
  amount: string;
  cents: bigint;
  /** Share of the total in basis points (1/100 of a percent), floored. */
  bp: number;
  source: string;
};

export type CostBreakdown = {
  total: string;
  totalCents: bigint;
  parts: CostPart[];
};

function centsOf(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

export function moneyOfCents(cents: bigint): string {
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, "0")}`;
}

/**
 * The six cost categories of a scenario. All arithmetic is on integer cents;
 * floats are never used for money. null when any amount is invalid.
 */
export function breakdownOf(
  scenario: ScenarioAssumption | undefined,
  currency: string,
): CostBreakdown | null {
  const total = totalCost(scenario, currency);
  if (!scenario || total === "Unavailable") return null;
  const totalCents = centsOf(total);
  const parts = costCategories.map((key) => {
    const cents = centsOf(scenario.costs[key].amount);
    return {
      key,
      amount: moneyOfCents(cents),
      cents,
      bp:
        totalCents > BigInt(0)
          ? Number((cents * BigInt(10000)) / totalCents)
          : 0,
      source: scenario.costs[key].source,
    };
  });
  return { total, totalCents, parts };
}

/** Shared share text such as "12.5": whole and tenth of a percent. */
export function percentText(bp: number): string {
  const tenths = Math.round(bp / 10);
  const whole = Math.floor(tenths / 10);
  const frac = tenths % 10;
  return frac === 0 ? String(whole) : `${whole}.${frac}`;
}
