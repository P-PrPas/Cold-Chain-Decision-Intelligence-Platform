"use client";
import { useEffect, useRef, useState } from "react";
export const scenarioNames: Record<string, string> = {
  CONTINUE_DELIVERY: "Continue delivery",
  HOLD_INSPECTION: "Hold for inspection",
  CONDITIONAL_REROUTE: "Conditional reroute",
  REJECT_QUARANTINE_DISPOSE: "Reject / quarantine / dispose",
};
export default function Scene({
  scenario = "CONTINUE_DELIVERY",
  origin = "Origin",
  destination = "Original receiver",
  cost,
  delay,
  currency = "THB",
  acceptance = "Unknown",
  eligibility = "Not evaluated",
  context = "Scenario illustration",
  missing,
}: {
  scenario?: string;
  origin?: string;
  destination?: string;
  cost?: string;
  delay?: string;
  currency?: string;
  acceptance?: string;
  eligibility?: string;
  context?: string;
  missing?: string;
}) {
  const [mode, setMode] = useState<"3D" | "2D">("3D"),
    [zoom, setZoom] = useState(1),
    [failure, setFailure] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const target =
    scenario === "HOLD_INSPECTION"
      ? 4
      : scenario === "CONDITIONAL_REROUTE"
        ? 3
        : scenario === "REJECT_QUARANTINE_DISPOSE"
          ? 5
          : 2;
  const names = [
    origin,
    "Decision point (not GPS)",
    destination,
    acceptance.toUpperCase() === "ACCEPTED"
      ? "Alternative receiver (accepted)"
      : acceptance.toUpperCase() === "REJECTED"
        ? "Alternative receiver (rejected)"
        : "Alternative receiver (unconfirmed)",
    "Controlled inspection facility",
    "Isolation / quarantine facility",
  ];
  useEffect(() => {
    if (mode !== "3D" || !host.current) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const element = host.current;
    const fail = () => {
      setFailure(
        "3D is unavailable. The same scenario and evidence remain available in 2D.",
      );
      setMode("2D");
    };
    const contextLost = (e: Event) => {
      e.preventDefault();
      fail();
    };
    element.addEventListener("webglcontextlost", contextLost, true);
    import("./network-renderer")
      .then((m) => {
        if (!cancelled) dispose = m.mountNetwork(element, target, zoom);
      })
      .catch(() => {
        if (!cancelled) fail();
      });
    return () => {
      cancelled = true;
      dispose?.();
      element.removeEventListener("webglcontextlost", contextLost, true);
    };
  }, [mode, target, zoom]);
  return (
    <section className="network-explorer" aria-label="Simulation explorer">
      <div className="section-heading">
        <div>
          <p className="context-label">{context}</p>
          <h3>{scenarioNames[scenario]}</h3>
        </div>
        <div className="view-controls" role="group" aria-label="Scene view">
          <button
            type="button"
            aria-pressed={mode === "3D"}
            onClick={() => {
              setFailure("");
              setMode("3D");
            }}
          >
            3D
          </button>
          <button
            type="button"
            aria-pressed={mode === "2D"}
            onClick={() => setMode("2D")}
          >
            2D
          </button>
          <button type="button" onClick={() => setZoom(1)}>
            Reset view
          </button>
          {mode === "3D" && (
            <>
              <button
                type="button"
                disabled={zoom >= 1.3}
                onClick={() => setZoom((v) => Math.min(1.3, v + 0.1))}
              >
                Zoom in
              </button>
              <button
                type="button"
                disabled={zoom <= 0.7}
                onClick={() => setZoom((v) => Math.max(0.7, v - 0.1))}
              >
                Zoom out
              </button>
            </>
          )}
        </div>
      </div>
      {failure && <p role="status">{failure}</p>}
      <p className="notice">
        Schematic scenario, not live GPS or time-based simulation. Dashed line:
        original route. Solid cyan line: proposed path.
      </p>
      {mode === "3D" ? (
        <div
          ref={host}
          className="network-canvas"
          role="img"
          aria-label={`Schematic ${scenarioNames[scenario]} from ${origin}, through the decision point, to ${names[target]}. See numbered locations below.`}
        />
      ) : (
        <ol className="route-steps">
          <li>{origin}</li>
          <li>Decision point (not GPS)</li>
          <li>{names[target]}</li>
        </ol>
      )}
      <ol className="network-legend">
        {names.map((name, i) => (
          <li key={i} className={i === target ? "selected-location" : ""}>
            <span>{i + 1}</span>
            {name}
            {i === target && <strong> / Proposed destination</strong>}
          </li>
        ))}
      </ol>
      <div className="evidence-summary">
        <span>
          Cost:{" "}
          <strong>
            {cost ?? "Not calculated"} {cost ? currency : ""}
          </strong>
        </span>
        <span>
          Additional delay:{" "}
          <strong>
            {delay ?? "Not calculated"}
            {delay ? " min" : ""}
          </strong>
        </span>
        <span>
          Eligibility: <strong>{eligibility.replaceAll("_", " ")}</strong>
        </span>
      </div>
      <p>
        Receiver acceptance: {acceptance}.{" "}
        {missing
          ? `Missing evidence: ${missing}`
          : "Review the source evidence and assumptions before proposing this action."}
      </p>
    </section>
  );
}
