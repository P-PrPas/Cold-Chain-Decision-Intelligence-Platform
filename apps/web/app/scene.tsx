"use client";
import { useState } from "react";
export const scenarioNames: Record<string, string> = {
  CONTINUE_DELIVERY: "Continue delivery",
  HOLD_INSPECTION: "Hold for inspection",
  CONDITIONAL_REROUTE: "Conditional reroute",
  REJECT_QUARANTINE_DISPOSE: "Reject / quarantine / dispose",
};
const descriptions: Record<string, string> = {
  CONTINUE_DELIVERY:
    "Illustrates continuing to the original destination. Check the analysis and eligibility before proposing this action.",
  HOLD_INSPECTION:
    "Illustrates a controlled inspection stop. Inspection time and costs are user estimates.",
  CONDITIONAL_REROUTE:
    "Illustrates an alternative destination. Receiver acceptance and policy constraints still apply.",
  REJECT_QUARANTINE_DISPOSE:
    "Illustrates isolation from the delivery route. The actual action remains subject to evidence and QA review.",
};
export default function Scene({
  scenario = "CONTINUE_DELIVERY",
}: {
  scenario?: string;
}) {
  const [flat, setFlat] = useState(false);
  return (
    <div className="scene-shell">
      <div className="scene-toolbar">
        <span className="eyebrow">NETWORK MODEL / ILLUSTRATIVE</span>
        <button
          type="button"
          className="quiet"
          aria-pressed={flat}
          onClick={() => setFlat(!flat)}
        >
          {flat ? "Show 3D" : "Show 2D"}
        </button>
      </div>
      <div
        className={"scene-viewport " + (flat ? "flat" : "")}
        role="img"
        aria-label={`Schematic cold-chain network: ${scenarioNames[scenario] || scenario}. Not live GPS.`}
      >
        <div className={"world route-" + scenario} aria-hidden="true">
          <div className="road road-main" />
          <div className="road road-branch" />
          <div className="building origin">
            <i />
            <b />
            <span>01 / ORIGIN</span>
          </div>
          <div className="building destination">
            <i />
            <b />
            <span>02 / DELIVERY</span>
          </div>
          <div className="building inspection">
            <i />
            <b />
            <span>03 / INSPECTION</span>
          </div>
          <div className="building quarantine">
            <i />
            <b />
            <span>04 / ISOLATION</span>
          </div>
          <div className="truck">
            <i />
            <b />
            <em />
          </div>
          <div className="route-dot dot-a" />
          <div className="route-dot dot-b" />
        </div>
      </div>
      <div className="scene-caption">
        <div>
          <span className="eyebrow">SELECTED PATH</span>
          <h3>{scenarioNames[scenario] || scenario}</h3>
          <p>{descriptions[scenario]}</p>
        </div>
        <span className="badge">Schematic / No GPS</span>
      </div>
    </div>
  );
}
