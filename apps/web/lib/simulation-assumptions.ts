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
function validAmount(amount: string, currency: string): boolean {
  return (
    (currency === "JPY" ? /^\d+(\.0{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(
      amount,
    ) && amount.split(".")[0].replace(/^0+/, "").length <= 16
  );
}
export function totalCost(
  scenario?: ScenarioAssumption,
  currency = "THB",
): string {
  if (
    !scenario ||
    costCategories.some(
      (key) => !validAmount(scenario.costs[key].amount, currency),
    )
  )
    return "Unavailable";
  const cents = costCategories.reduce((sum, key) => {
    const value = scenario.costs[key].amount;
    const [whole, fraction = ""] = value.split(".");
    return sum + BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  }, BigInt(0));
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, "0")}`;
}
export const costLabels: Record<CostCategory, string> = {
  additional_transport: "Additional transport",
  inspection: "Inspection cost",
  holding: "Storage cost",
  handling: "Handling cost",
  disposal: "Disposal cost",
  other: "Other costs",
};
export function draftErrors(value: Assumptions): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const s of value.scenarios) {
    if (
      !Number.isInteger(s.estimated_delay_minutes) ||
      s.estimated_delay_minutes < 0 ||
      s.estimated_delay_minutes > 525600
    )
      errors[`${s.type}.delay`] = "Enter whole minutes from 0 to 525,600.";
    for (const c of costCategories) {
      const amount = s.costs[c].amount;
      if (!validAmount(amount, value.currency))
        errors[`${s.type}.${c}`] =
          value.currency === "JPY"
            ? "Enter a non-negative whole-yen amount with at most 16 whole digits."
            : "Enter a non-negative amount with at most 16 whole digits and two decimal places.";
    }
  }
  const { cost, delay } = value.ranking_weights;
  if (
    ![cost, delay].every(
      (v) => /^\d+(\.\d+)?$/.test(v) && Number(v) >= 0 && Number(v) <= 1,
    ) ||
    !weightsSumToOne(cost, delay)
  )
    errors.weights = "Enter a cost weight from 0 to 1; the remainder is delay.";
  return errors;
}
function weightsSumToOne(cost: string, delay: string): boolean {
  const precision = Math.max(
    cost.split(".")[1]?.length || 0,
    delay.split(".")[1]?.length || 0,
  );
  const scaled = (v: string) => {
    const [whole, fraction = ""] = v.split(".");
    return BigInt(whole + fraction.padEnd(precision, "0"));
  };
  return scaled(cost) + scaled(delay) === BigInt(10) ** BigInt(precision);
}
export function formatAmount(value?: string): string {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return "Unavailable";
  const [whole, fraction = ""] = value.split(".");
  return `${BigInt(whole).toLocaleString("en-US")}.${fraction.padEnd(2, "0")}`;
}
export function sameAssumptions(a: Assumptions, b: Assumptions): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
