"use client";
import { useEffect, useRef, useState } from "react";
import { formatAmount } from "./simulation-assumptions";
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
  const engine = useRef<ReturnType<
    typeof import("./network-renderer").mountNetwork
  > | null>(null);
  const latest = useRef({
    target,
    zoom,
    destinationLabel: "",
    delay: delay || "0",
    acceptance,
  });
  useEffect(() => {
    const destinationLabel =
      target === 4
        ? "Inspection"
        : target === 5
          ? "Quarantine"
          : target === 3
            ? "Alternative receiver"
            : destination.slice(0, 24);
    latest.current = {
      target,
      zoom,
      destinationLabel,
      delay: delay || "0",
      acceptance,
    };
    engine.current?.update(latest.current);
  }, [target, zoom, destination, delay, acceptance]);
  useEffect(() => {
    if (mode !== "3D" || !host.current) return;
    let cancelled = false;
    const element = host.current;
    const fail = () => {
      setFailure(
        "3D is unavailable. The same scenario and evidence remain available in 2D.",
      );
      setMode("2D");
    };
    const contextLost = (e: Event) => {
      e.preventDefault();
      if (!cancelled) fail();
    };
    element.addEventListener("webglcontextlost", contextLost, true);
    import("./network-renderer")
      .then((m) => {
        if (cancelled) return;
        engine.current = m.mountNetwork(
          element,
          latest.current.target,
          latest.current.zoom,
        );
        engine.current.update(latest.current);
      })
      .catch(() => {
        if (!cancelled) fail();
      });
    return () => {
      cancelled = true;
      element.removeEventListener("webglcontextlost", contextLost, true);
      engine.current?.dispose();
      engine.current = null;
    };
  }, [mode]);
  return (
    <section className="network-explorer" aria-label="Simulation explorer">
      <div className="scene-toolbar">
        <h3>{scenarioNames[scenario]}</h3>
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
          <button
            type="button"
            aria-label="Reset view"
            onClick={() => setZoom(1)}
          >
            Reset
          </button>
          {mode === "3D" && (
            <>
              <button
                type="button"
                aria-label="Zoom in"
                disabled={zoom >= 1.3}
                onClick={() => setZoom((v) => Math.min(1.3, v + 0.1))}
              >
                +
              </button>
              <button
                type="button"
                aria-label="Zoom out"
                disabled={zoom <= 0.7}
                onClick={() => setZoom((v) => Math.max(0.7, v - 0.1))}
              >
                −
              </button>
            </>
          )}
        </div>
      </div>
      {failure && <p role="status">{failure}</p>}
      <p className="scene-key">
        <span className="mobile-scene-name">{scenarioNames[scenario]} · </span>
        Schematic · Dashed: original / Solid: selected
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
        <span
          className="acceptance-state"
          data-state={acceptance.toUpperCase()}
        >
          {acceptance.toUpperCase() === "ACCEPTED"
            ? "✓"
            : acceptance.toUpperCase() === "REJECTED"
              ? "×"
              : "?"}{" "}
          Receiver: {acceptance.toLowerCase()} (assumed)
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

function ImpactBand({
  label,
  value,
  baseline,
  unit,
  money = false,
}: {
  label: string;
  value?: string;
  baseline: string;
  unit: string;
  money?: boolean;
}) {
  const valid = !!value && /^\d+(\.\d+)?$/.test(value);
  const n = valid ? Number(value) : 0,
    base = Number(baseline) || 0;
  const scale = Math.max(n, base, money ? 100 : 60);
  return (
    <div className="impact-band" aria-label={label}>
      <div>
        <span>{label}</span>
        <strong>
          {valid
            ? (money ? formatAmount(value) : value) + " " + unit
            : "Unavailable"}
        </strong>
      </div>
      <svg
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: baseline ${baseline} ${unit}; current ${valid ? value : "invalid"}`}
      >
        <rect
          className="baseline-bar"
          x="0"
          y="1"
          width={(base / scale) * 100}
          height="3"
        />
        {valid && (
          <rect
            className="current-bar"
            x="0"
            y="7"
            width={(n / scale) * 100}
            height="4"
          />
        )}
      </svg>
      <small>
        Baseline {money ? formatAmount(baseline) : baseline} /{" "}
        {valid
          ? `${n >= base ? "+" : ""}${money ? (n - base).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n - base} ${unit}`
          : "Check input"}
      </small>
    </div>
  );
}
