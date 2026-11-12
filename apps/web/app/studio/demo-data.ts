import type { DictKey } from "@/i18n";
import {
  freshAssumptions,
  type Assumptions,
} from "@/lib/simulation-assumptions";
import type { Reading } from "./sim-clock";

/** Synthetic values only. Never real safety limits (CLAUDE.md section 2). */
export type DemoShipment = {
  id: string;
  productKey: DictKey;
  originKey: DictKey;
  destinationKey: DictKey;
  statusKey: DictKey;
  noteKey: DictKey;
  readings: Reading[];
  /** Highlighted for illustration only; not a policy determination. */
  recommended: string;
};

export const DEMO_START_MINUTE = 8 * 60;
export const DEMO_STEP_MINUTES = 30;

export const demoShipments: DemoShipment[] = [
  {
    id: "DEMO-001",
    productKey: "prodStrawberries",
    originKey: "placeChiangMai",
    destinationKey: "placeBangkok",
    statusKey: "shipStatusExcursion",
    noteKey: "demoNote1",
    readings: [3, 3.2, 3.4, 4, 6.5, 8.1, 7.2, 5.1, 3.7],
    recommended: "HOLD_INSPECTION",
  },
  {
    id: "DEMO-002",
    productKey: "prodDairy",
    originKey: "placeNakhonRatchasima",
    destinationKey: "placeBangkok",
    statusKey: "shipStatusComplete",
    noteKey: "demoNote2",
    readings: [3.1, 3.3, 3.2, 3.6, 3.5, 3.2, 3.1, 3.4, 3.3],
    recommended: "CONTINUE_DELIVERY",
  },
  {
    id: "DEMO-003",
    productKey: "prodProduce",
    originKey: "placeRayong",
    destinationKey: "placeBangkok",
    statusKey: "shipStatusMissing",
    noteKey: "demoNote3",
    readings: [4, 4.2, 4.5, null, null, null, 5.2, 4.8, 4.5],
    recommended: "HOLD_INSPECTION",
  },
];

const options = [
  { type: "CONTINUE_DELIVERY", cost: "1200.00", delay: 0 },
  { type: "HOLD_INSPECTION", cost: "2800.00", delay: 120 },
  { type: "CONDITIONAL_REROUTE", cost: "4500.00", delay: 90 },
  { type: "REJECT_QUARANTINE_DISPOSE", cost: "6000.00", delay: 180 },
];

export function demoBaseline(): Assumptions {
  const value = freshAssumptions();
  value.scenarios = value.scenarios.map((s, i) => ({
    ...s,
    estimated_delay_minutes: options[i].delay,
    costs: {
      ...s.costs,
      other: { amount: options[i].cost, source: "USER_ESTIMATE" },
    },
  }));
  return value;
}
