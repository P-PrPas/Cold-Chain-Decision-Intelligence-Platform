"use client";
import { useState } from "react";
import { ImpactBand } from "./impact-band";
import StudioScene from "./studio/studio-scene";
import { Player } from "./studio/player";
import {
  acceptanceSymbol,
  normAcceptance,
  scenarioNames,
} from "./studio/scenarios";
import {
  DEFAULT_JOURNEY_MINUTES,
  SCENARIO_ORDER,
  totalMinutes,
} from "./studio/sim-clock";

export { scenarioNames };

/**
 * Scene used by the connected workspace. It shows the schematic with the real
 * saved/previewed figures and the engine's eligibility text. This view has no
 * time series, so it shows the final frame with the cargo state unknown; it
 * never draws a temperature it does not have.
 */
export default function Scene({
  scenario = "CONTINUE_DELIVERY",
  origin = "Origin",
  destination = "Original receiver",
  cost,
  baselineCost = "0",
  baselineDelay = "0",
  delay,
  currency = "THB",
  acceptance = "Unknown",
  eligibility = "Not evaluated",
  context = "Scenario illustration",
  missing,
  compact = false,
}: {
  scenario?: string;
  origin?: string;
  destination?: string;
  cost?: string;
  baselineCost?: string;
  baselineDelay?: string;
  delay?: string;
  currency?: string;
  acceptance?: string;
  eligibility?: string;
  context?: string;
  missing?: string;
  compact?: boolean;
}) {
  const [player] = useState(() => {
    const total = totalMinutes([], 30);
    const p = new Player(DEFAULT_JOURNEY_MINUTES, total);
    p.seek(total);
    return p;
  });
  const [compare, setCompare] = useState(false);
  const acc = normAcceptance(acceptance);
  const blocked = eligibility.toUpperCase() === "BLOCKED";
  const views = SCENARIO_ORDER.map((type) => ({
    type,
    delayMinutes: type === scenario ? Number(delay ?? 0) : 0,
    totalCost: type === scenario && cost ? cost : "0.00",
    acceptance: type === scenario ? acc : ("UNKNOWN" as const),
    blocked: type === scenario && blocked,
  }));
  const names = [
    origin,
    "Decision point (not GPS)",
    destination,
    acc === "ACCEPTED"
      ? "Alternative receiver (accepted)"
      : acc === "REJECTED"
        ? "Alternative receiver (rejected)"
        : "Alternative receiver (unconfirmed)",
    "Controlled inspection facility",
    "Isolation / quarantine facility",
  ];
  const target =
    scenario === "HOLD_INSPECTION"
      ? 4
      : scenario === "CONDITIONAL_REROUTE"
        ? 3
        : scenario === "REJECT_QUARANTINE_DISPOSE"
          ? 5
          : 2;
  return (
    <section className="network-explorer" aria-label="Simulation explorer">
      <div className="scene-toolbar">
        <h3>{scenarioNames[scenario]}</h3>
      </div>
      <StudioScene
        player={player}
        readings={null}
        startMinute={0}
        stepMinutes={30}
        scenarios={views}
        selected={scenario}
        originLabel={origin}
        destinationLabel={destination}
        compare={compare}
        onCompare={() => setCompare((v) => !v)}
        currency={currency}
      />
      <div
        className="scene-impact"
        aria-label="Activity impact compared with baseline"
      >
        <ImpactBand
          label="Additional delay"
          value={delay}
          baseline={baselineDelay}
          unit="min"
        />
        <ImpactBand
          label="Direct cost"
          value={cost}
          baseline={baselineCost}
          unit={currency}
          money
        />
      </div>
      <div className="scene-status">
        <span className="acceptance-state" data-state={acc}>
          {acceptanceSymbol[acc]} Receiver: {acc.toLowerCase()} (assumed)
        </span>
        <span>
          Eligibility: <strong>{eligibility.replaceAll("_", " ")}</strong>
        </span>
      </div>
      {missing && <p className="scene-missing">Missing evidence: {missing}</p>}
      <details open={!compact}>
        <summary>Context and locations</summary>
        <p>
          {context}. Schematic, not GPS. No time playback or temperature
          deterioration calculation.
        </p>
        <ol className="network-legend">
          {names.map((name, i) => (
            <li key={i} className={i === target ? "selected-location" : ""}>
              <span>{i + 1}</span>
              {name}
              {i === target && <strong> / Proposed destination</strong>}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
