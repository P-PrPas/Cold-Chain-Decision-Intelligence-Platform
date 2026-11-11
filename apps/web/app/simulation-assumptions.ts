export const scenarioTypes = [
  "CONTINUE_DELIVERY",
  "HOLD_INSPECTION",
  "CONDITIONAL_REROUTE",
  "REJECT_QUARANTINE_DISPOSE",
];
export const costCategories = [
  "additional_transport",
  "inspection",
  "holding",
  "handling",
  "disposal",
  "other",
] as const;
export type CostCategory = (typeof costCategories)[number];
export type ScenarioAssumption = {
  type: string;
  estimated_delay_minutes: number;
  receiver_acceptance: string;
  costs: Record<CostCategory, { amount: string; source: string }>;
};
export type Assumptions = {
  analysis_id: string;
  dataset_id: string;
  policy_version_id: string;
  currency: string;
  scenario_types: string[];
  scenarios: ScenarioAssumption[];
  ranking_weights: { cost: string; delay: string };
};
export function freshAssumptions(): Assumptions {
  return {
    analysis_id: "",
    dataset_id: "",
    policy_version_id: "",
    currency: "THB",
    scenario_types: [...scenarioTypes],
    scenarios: scenarioTypes.map((type) => ({
      type,
      estimated_delay_minutes: 0,
      receiver_acceptance: "UNKNOWN",
      costs: Object.fromEntries(
        costCategories.map((name) => [
          name,
          { amount: "0.00", source: "USER_ESTIMATE" },
        ]),
      ) as ScenarioAssumption["costs"],
    })),
    ranking_weights: { cost: "0.60", delay: "0.40" },
  };
}
export function totalCost(scenario?: ScenarioAssumption): string {
  if (!scenario) return "0.00";
  const cents = costCategories.reduce((sum, key) => {
    const value = scenario.costs[key].amount;
    if (!/^\d+(\.\d{0,2})?$/.test(value)) return sum;
    const [whole, fraction = ""] = value.split(".");
    return sum + BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  }, BigInt(0));
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, "0")}`;
}
export function sameAssumptions(a: Assumptions, b: Assumptions): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
