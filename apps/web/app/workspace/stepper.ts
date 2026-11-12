import type { DictKey } from "../i18n";

export const STEP_IDS = [
  "evidence",
  "policy",
  "simulate",
  "propose",
  "qa",
  "report",
] as const;
export type StepId = (typeof STEP_IDS)[number];

/** done: finished. current: the next thing to do. available: can be opened. blocked: cannot be opened yet. */
export type StepState = "done" | "current" | "available" | "blocked";

export type StepInput = {
  hasReadyDataset: boolean;
  hasApprovedPolicy: boolean;
  /** A completed analysis is selected for this shipment. */
  hasAnalysis: boolean;
  /** Analysis summary reports unknown time or an INDETERMINATE classification. */
  analysisHasGaps: boolean;
  /** A saved (not preview) simulation run exists for the selected analysis. */
  hasSavedRun: boolean;
  /** Engine eligibility of the scenario chosen in the simulation, when a saved run is current. */
  selectedEligibility: string | null;
  /** A proposal is selected in this session. */
  hasProposal: boolean;
  /** Latest decision status for this shipment, if any. */
  decisionStatus: string | null;
  /** The latest decision carries a frozen snapshot (submitted). */
  decisionFrozen: boolean;
};

export type StepInfo = {
  id: StepId;
  state: StepState;
  /** Why the step cannot be opened. Present only when blocked. */
  reason?: DictKey;
  /** A caution on a step that is open or done. */
  note?: DictKey;
};

const REVIEWED = ["APPROVED", "REJECTED", "CHANGES_REQUESTED"];

export function deriveSteps(i: StepInput): StepInfo[] {
  const decided = !!i.decisionStatus;
  const reviewed = !!i.decisionStatus && REVIEWED.includes(i.decisionStatus);
  const executable =
    i.selectedEligibility === "ELIGIBLE" ||
    i.selectedEligibility === "REVIEW_REQUIRED";

  const raw: {
    id: StepId;
    done: boolean;
    reason?: DictKey;
    note?: DictKey;
  }[] = [
    {
      id: "evidence",
      done: i.hasReadyDataset,
      note:
        i.hasReadyDataset && i.analysisHasGaps ? "wsStepNoteGaps" : undefined,
    },
    {
      id: "policy",
      done: i.hasAnalysis,
      note:
        !i.hasReadyDataset && i.hasApprovedPolicy
          ? "wsStepNoteNeedsDataset"
          : undefined,
    },
    {
      id: "simulate",
      done: i.hasSavedRun,
      // A completed analysis already pins its dataset and policy; the server
      // re-checks that chain whenever a run or a proposal is saved.
      reason: i.hasAnalysis
        ? undefined
        : !i.hasReadyDataset
          ? "wsBlockNoDataset"
          : !i.hasApprovedPolicy
            ? "wsBlockNoPolicy"
            : "wsBlockNoAnalysis",
    },
    {
      id: "propose",
      done: decided,
      reason:
        decided || i.hasProposal
          ? undefined
          : !i.hasSavedRun
            ? "wsBlockNoRun"
            : i.selectedEligibility === "BLOCKED"
              ? "wsBlockScenarioBlocked"
              : i.selectedEligibility === "INSUFFICIENT_DATA"
                ? "wsBlockScenarioUnknown"
                : !executable
                  ? "wsBlockPickScenario"
                  : undefined,
    },
    {
      id: "qa",
      done: reviewed,
      reason: i.decisionFrozen ? undefined : "wsBlockNoSubmission",
    },
    {
      id: "report",
      done: false,
      reason: i.decisionFrozen ? undefined : "wsBlockNoSnapshot",
    },
  ];
  let currentTaken = false;
  return raw.map((s) => {
    if (s.reason) return { id: s.id, state: "blocked", reason: s.reason };
    if (s.done) return { id: s.id, state: "done", note: s.note };
    if (!currentTaken) {
      currentTaken = true;
      return { id: s.id, state: "current", note: s.note };
    }
    return { id: s.id, state: "available", note: s.note };
  });
}

/**
 * First view for a shipment. A QA reviewer lands on a pending review; everyone
 * else lands on the next step to do. Chosen once; later data never moves the view.
 */
export function initialStep(
  steps: StepInfo[],
  roles: string[],
  decisionStatus: string | null,
): StepId {
  if (
    decisionStatus === "PENDING_QA" &&
    roles.includes("QA") &&
    steps.find((s) => s.id === "qa")?.state !== "blocked"
  )
    return "qa";
  return (
    steps.find((s) => s.state === "current")?.id ??
    steps.find((s) => s.state === "available")?.id ??
    [...steps].reverse().find((s) => s.state !== "blocked")?.id ??
    "evidence"
  );
}
