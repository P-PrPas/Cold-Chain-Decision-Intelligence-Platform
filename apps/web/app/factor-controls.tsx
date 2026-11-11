"use client";
import { useState } from "react";
import {
  type Assumptions,
  type CostCategory,
  costCategories,
  totalCost,
} from "./simulation-assumptions";
export default function FactorControls({
  value,
  baseline,
  selected,
  onChange,
  disabled = false,
  baselineLabel,
}: {
  value: Assumptions;
  baseline: Assumptions;
  selected: string;
  onChange: (value: Assumptions) => void;
  disabled?: boolean;
  baselineLabel: string;
}) {
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
      scenario.estimated_delay_minutes,
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
      <p className="factor-baseline">
        Baseline: {baselineLabel}. Edited values are user estimates.
      </p>
      <label>
        Additional delay (minutes)
        <input
          aria-label="Additional delay slider"
          type="range"
          min="0"
          max={delayMax}
          step="1"
          value={scenario.estimated_delay_minutes}
          onChange={(e) =>
            edit({ estimated_delay_minutes: Number(e.target.value) })
          }
        />
        <input
          type="number"
          aria-label="Additional delay (minutes)"
          min="0"
          max="525600"
          step="1"
          required
          value={scenario.estimated_delay_minutes}
          onChange={(e) =>
            edit({ estimated_delay_minutes: Number(e.target.value) })
          }
        />
      </label>
      <small>
        Slider 0–{delayMax} min · engine limit 525,600 min. Baseline{" "}
        {original?.estimated_delay_minutes ?? 0} min. No temperature
        deterioration is calculated.
      </small>
      <label>
        Cost component
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CostCategory)}
        >
          {costCategories.map((c) => (
            <option key={c} value={c}>
              {c.replaceAll("_", " ")}
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
          type="number"
          aria-label="Cost component amount"
          min="0"
          step={value.currency === "JPY" ? "1" : "0.01"}
          required
          value={amount}
          onChange={(e) => cost(e.target.value)}
        />
      </label>
      <small>
        Slider 0–{costMax.toLocaleString("en-US")} {value.currency} is an
        editing range, not a policy limit. Source:{" "}
        {scenario.costs[category].source}. Total {totalCost(scenario)}{" "}
        {value.currency}; other categories stay unchanged.
      </small>
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
      <small>
        Delay weight {value.ranking_weights.delay}. Weights affect ranking only,
        never evidence or eligibility.
      </small>
      <button
        type="button"
        className="quiet"
        onClick={() => onChange(structuredClone(baseline))}
      >
        Reset to baseline
      </button>
      <details>
        <summary>All cost components</summary>
        <dl className="cost-breakdown">
          {costCategories.map((c) => (
            <div key={c}>
              <dt>{c.replaceAll("_", " ")}</dt>
              <dd>
                {scenario.costs[c].amount} {value.currency} ·{" "}
                {scenario.costs[c].source}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </fieldset>
  );
}
