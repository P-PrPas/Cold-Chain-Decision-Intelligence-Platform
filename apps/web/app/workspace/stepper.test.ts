import { expect, test } from "vitest";
import { deriveSteps, initialStep, type StepInput } from "./stepper";

const base: StepInput = {
  hasReadyDataset: false,
  hasApprovedPolicy: false,
  hasAnalysis: false,
  analysisHasGaps: false,
  hasSavedRun: false,
  selectedEligibility: null,
  hasProposal: false,
  decisionStatus: null,
  decisionFrozen: false,
};
const by = (i: Partial<StepInput>) =>
  Object.fromEntries(
    deriveSteps({ ...base, ...i }).map((s) => [s.id, s]),
  ) as Record<string, ReturnType<typeof deriveSteps>[number]>;
const chain = {
  hasReadyDataset: true,
  hasApprovedPolicy: true,
  hasAnalysis: true,
  hasSavedRun: true,
};

test("a new shipment starts at evidence and blocks every later step with a reason", () => {
  const s = by({});
  expect(s.evidence.state).toBe("current");
  expect(s.simulate.state).toBe("blocked");
  expect(s.simulate.reason).toBe("wsBlockNoDataset");
  expect(s.qa.reason).toBe("wsBlockNoSubmission");
  expect(s.report.reason).toBe("wsBlockNoSnapshot");
  for (const step of Object.values(s))
    if (step.state === "blocked") expect(step.reason).toBeTruthy();
});

test("no approved policy: simulate is blocked and says an approved policy is needed", () => {
  const s = by({ hasReadyDataset: true });
  expect(s.simulate.state).toBe("blocked");
  expect(s.simulate.reason).toBe("wsBlockNoPolicy");
  expect(s.policy.state).toBe("current");
});

test("approved policy but no analysis keeps simulate blocked with its own reason", () => {
  const s = by({ hasReadyDataset: true, hasApprovedPolicy: true });
  expect(s.simulate.reason).toBe("wsBlockNoAnalysis");
});

test("a completed analysis keeps simulate open even if the policy list is empty", () => {
  const s = by({ hasAnalysis: true });
  expect(s.simulate.state).not.toBe("blocked");
});

test("gaps in the readings add a caution to evidence and never make a step blocked or compliant", () => {
  const s = by({
    hasReadyDataset: true,
    hasApprovedPolicy: true,
    hasAnalysis: true,
    analysisHasGaps: true,
  });
  expect(s.evidence.state).toBe("done");
  expect(s.evidence.note).toBe("wsStepNoteGaps");
  expect(s.simulate.state).toBe("current");
});

test("blocked and insufficient-data scenarios cannot be proposed", () => {
  expect(by({ ...chain, selectedEligibility: "BLOCKED" }).propose.reason).toBe(
    "wsBlockScenarioBlocked",
  );
  expect(
    by({ ...chain, selectedEligibility: "INSUFFICIENT_DATA" }).propose.reason,
  ).toBe("wsBlockScenarioUnknown");
  expect(by({ ...chain }).propose.reason).toBe("wsBlockPickScenario");
  expect(
    by({ ...chain, selectedEligibility: "REVIEW_REQUIRED" }).propose.state,
  ).toBe("current");
});

test("QA and report stay blocked until a proposal is submitted and frozen", () => {
  const draft = by({ ...chain, decisionStatus: "DRAFT" });
  expect(draft.propose.state).toBe("done");
  expect(draft.qa.state).toBe("blocked");
  expect(draft.report.state).toBe("blocked");
  const pending = by({
    ...chain,
    decisionStatus: "PENDING_QA",
    decisionFrozen: true,
  });
  expect(pending.qa.state).toBe("current");
  expect(pending.report.state).toBe("available");
});

test("a QA reviewer lands on a pending review, others on the next step", () => {
  const steps = deriveSteps({
    ...base,
    ...chain,
    decisionStatus: "PENDING_QA",
    decisionFrozen: true,
  });
  expect(initialStep(steps, ["QA"], "PENDING_QA")).toBe("qa");
  expect(initialStep(deriveSteps(base), ["LOGISTICS"], null)).toBe("evidence");
  // A saved run with nothing proposed yet: stay where the options are chosen.
  expect(initialStep(deriveSteps({ ...base, ...chain }), [], null)).toBe(
    "simulate",
  );
});
