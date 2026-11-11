"use client";
import { useId, useState } from "react";
import {
  type Assumptions,
  type CostCategory,
  costCategories,
  totalCost,
  draftErrors,
  costLabels,
  formatAmount,
} from "./simulation-assumptions";
export default function FactorControls({
  value,
  baseline,
  selected,
  onChange,
  disabled = false,
  baselineLabel,
  demo = false,
}: {
  value: Assumptions;
  baseline: Assumptions;
  selected: string;
  onChange: (value: Assumptions) => void;
  disabled?: boolean;
  baselineLabel: string;
  demo?: boolean;
}) {
  const id = useId();
  const [group, setGroup] = useState("Delay");
  const errors = draftErrors(value);
  const [category, setCategory] = useState<CostCategory>("other");
  const scenario = value.scenarios.find((s) => s.type === selected);
  const original = baseline.scenarios.find((s) => s.type === selected);
  if (!scenario) return <p>No assumptions exist for this scenario.</p>;
  function edit(patch: Partial<typeof scenario>) {
    onChange({
      ...value,
      scenarios: value.scenarios.map((s) =>
        s.type === selected ? { ...s, ...patch } : s,
      ),
    });
  }
  const amount = scenario.costs[category].amount;
  function cost(next: string) {
    edit({
      costs: {
        ...scenario!.costs,
        [category]: { amount: next, source: "USER_ESTIMATE" },
      },
    });
  }
  const delayMax = Math.min(
    525600,
    Math.max(
      240,
      original?.estimated_delay_minutes || 0,
      Number.isFinite(scenario.estimated_delay_minutes)
        ? scenario.estimated_delay_minutes
        : 0,
    ),
  );
  const costMax = Math.max(
    10000,
    Number(original?.costs[category].amount || 0),
    Number(amount) || 0,
  );
  return (
    <fieldset className="factor-controls" disabled={disabled}>
      <legend>Adjust assumptions</legend>
      <div className="factor-tabs" role="group" aria-label="Factor groups">
        {["Delay", "Cost", "Receiver", "Advanced"].map((name) => (
          <button
            type="button"
            key={name}
            aria-pressed={group === name}
            onClick={() => setGroup(name)}
          >
            {name}
            {(
              name === "Delay"
                ? errors[`${selected}.delay`]
                : name === "Cost"
                  ? costCategories.some((c) => errors[`${selected}.${c}`])
                  : name === "Advanced"
                    ? errors.weights
                    : false
            )
              ? " !"
              : ""}
          </button>
        ))}
      </div>

      <div hidden={group !== "Delay"}>
        <label>
          Additional delay (minutes)
          <input
            aria-label="Additional delay slider"
            type="range"
            min="0"
            max={delayMax}
            step="1"
            value={
              Number.isFinite(scenario.estimated_delay_minutes)
                ? scenario.estimated_delay_minutes
                : ""
            }
            onChange={(e) =>
              edit({
                estimated_delay_minutes:
                  e.target.value === "" ? NaN : Number(e.target.value),
              })
            }
          />
          <input
            type="number"
            aria-label="Additional delay (minutes)"
            aria-invalid={!!errors[`${selected}.delay`]}
            aria-describedby={`${id}-delay-error`}
            min="0"
            max="525600"
            step="1"
            required
            value={
              Number.isFinite(scenario.estimated_delay_minutes)
                ? scenario.estimated_delay_minutes
                : ""
            }
            onChange={(e) =>
              edit({
                estimated_delay_minutes:
                  e.target.value === "" ? NaN : Number(e.target.value),
              })
            }
          />
        </label>
        <span className="field-error" id={`${id}-delay-error`}>
          {errors[`${selected}.delay`]}
        </span>
        <small>
          Baseline {original?.estimated_delay_minutes ?? 0} min · No temperature
          deterioration model.
        </small>
      </div>
      <div hidden={group !== "Cost"}>
        <label>
          Cost component
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CostCategory)}
          >
            {costCategories.map((c) => (
              <option key={c} value={c}>
                {costLabels[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Component estimate ({value.currency})
          <input
            aria-label="Cost component slider"
            type="range"
            min="0"
            max={costMax}
            step={value.currency === "JPY" ? "1" : "0.01"}
            value={amount || "0"}
            onChange={(e) => cost(e.target.value)}
          />
          <input
            type="text"
            inputMode="decimal"
            aria-label="Cost component amount"
            aria-invalid={!!errors[`${selected}.${category}`]}
            aria-describedby={`${id}-cost-error`}
            min="0"
            step={value.currency === "JPY" ? "1" : "0.01"}
            required
            value={amount}
            onChange={(e) => cost(e.target.value)}
          />
        </label>
        <span className="field-error" id={`${id}-cost-error`}>
          {errors[`${selected}.${category}`]}
        </span>
        <small>
          Total {formatAmount(totalCost(scenario, value.currency))}{" "}
          {value.currency} · Baseline{" "}
          {formatAmount(totalCost(original, value.currency))} {value.currency}
        </small>
      </div>
      <div hidden={group !== "Receiver"}>
        <label>
          Receiver acceptance assumption
          <select
            value={scenario.receiver_acceptance}
            onChange={(e) => edit({ receiver_acceptance: e.target.value })}
          >
            <option value="UNKNOWN">Unknown</option>
            <option value="ACCEPTED">Assume accepted</option>
            <option value="REJECTED">Assume rejected</option>
          </select>
        </label>
        <small>
          This is an assumption, not confirmation from the receiver.
        </small>
      </div>
      <div hidden={group !== "Advanced"}>
        {demo && (
          <p className="notice">
            Preference only in this demo. Weights do not calculate a ranking
            here. Use the connected workspace for engine comparison.
          </p>
        )}
        <label>
          Cost weight (0–1)
          <input
            aria-label="Cost weight slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={value.ranking_weights.cost}
            onChange={(e) =>
              onChange({
                ...value,
                ranking_weights: {
                  cost: e.target.value,
                  delay: (1 - Number(e.target.value)).toFixed(2),
                },
              })
            }
          />
          <input
            type="number"
            aria-label="Cost weight (0–1)"
            aria-invalid={!!errors.weights}
            aria-describedby={`${id}-weight-error`}
            min="0"
            max="1"
            step="0.01"
            required
            value={value.ranking_weights.cost}
            onChange={(e) =>
              onChange({
                ...value,
                ranking_weights: {
                  cost: e.target.value,
                  delay: (1 - Number(e.target.value)).toFixed(2),
                },
              })
            }
          />
        </label>
        <span className="field-error" id={`${id}-weight-error`}>
          {errors.weights}
        </span>
        <small>
          Delay weight {value.ranking_weights.delay}. Weights affect ranking
          only, never evidence or eligibility.
        </small>
      </div>
      <button
        type="button"
        className="quiet"
        onClick={() => onChange(structuredClone(baseline))}
      >
        Reset to baseline
      </button>
      <details>
        <summary>Estimate details and limits</summary>
        <p>Baseline: {baselineLabel}. Edited values are user estimates.</p>
        <p>
          Delay: 0–525,600 whole minutes. Cost slider range: 0–
          {costMax.toLocaleString("en-US")} {value.currency}; use the amount
          field for precise estimates. This editing range is not a policy limit.
        </p>
        <dl className="cost-breakdown">
          {costCategories.map((c) => (
            <div key={c}>
              <dt>{costLabels[c]}</dt>
              <dd>
                {scenario.costs[c].amount} {value.currency} ·{" "}
                {scenario.costs[c].source === "USER_ESTIMATE"
                  ? "User estimate"
                  : scenario.costs[c].source.toLowerCase().replaceAll("_", " ")}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </fieldset>
  );
}
