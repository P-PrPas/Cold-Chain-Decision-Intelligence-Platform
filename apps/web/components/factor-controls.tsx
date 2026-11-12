"use client";
import { useId, useState } from "react";
import { useI18n } from "@/i18n/provider";
import type { DictKey } from "@/i18n";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import {
  type Assumptions,
  type CostCategory,
  costCategories,
  totalCost,
  draftErrors,
  formatAmount,
} from "@/lib/simulation-assumptions";

const COST_KEYS: Record<CostCategory, DictKey> = {
  additional_transport: "fcCostTransport",
  inspection: "fcCostInspection",
  holding: "fcCostHolding",
  handling: "fcCostHandling",
  disposal: "fcCostDisposal",
  other: "fcCostOther",
};
const TAB_KEYS: Record<string, DictKey> = {
  Delay: "fcTabDelay",
  Cost: "fcTabCost",
  Receiver: "fcTabReceiver",
  Advanced: "fcTabAdvanced",
};
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
  const { t } = useI18n();
  const [group, setGroup] = useState("Delay");
  const errors = draftErrors(value);
  const [category, setCategory] = useState<CostCategory>("other");
  const scenario = value.scenarios.find((s) => s.type === selected);
  const original = baseline.scenarios.find((s) => s.type === selected);
  if (!scenario) return <p>{t("fcNone")}</p>;
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
      <legend>{t("sheetOpen")}</legend>
      <div className="factor-tabs" role="group" aria-label={t("fcGroups")}>
        {/* Ranking weights apply only after engine eligibility, which the sandbox never runs. */}
        {(demo
          ? ["Delay", "Cost", "Receiver"]
          : ["Delay", "Cost", "Receiver", "Advanced"]
        ).map((name) => (
          <button
            type="button"
            key={name}
            aria-pressed={group === name}
            onClick={() => setGroup(name)}
          >
            {t(TAB_KEYS[name])}
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
          {t("fcDelayLabel")}
          <input
            aria-label={t("fcDelaySlider")}
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
            aria-label={t("fcDelayLabel")}
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
          {errors[`${selected}.delay`] ? t("fcErrDelay") : ""}
        </span>
        <small>
          {t("resultBaseline")} {original?.estimated_delay_minutes ?? 0}{" "}
          {t("unitMin")} · {t("fcNoModel")}
        </small>
      </div>
      <div hidden={group !== "Cost"}>
        <label>
          {t("fcCostComponent")}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CostCategory)}
          >
            {costCategories.map((c) => (
              <option key={c} value={c}>
                {t(COST_KEYS[c])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("fcComponentEstimate")} ({value.currency})
          <input
            aria-label={t("fcCostSlider")}
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
            aria-label={t("fcCostAmount")}
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
          {errors[`${selected}.${category}`]
            ? value.currency === "JPY"
              ? t("fcErrYen")
              : t("fcErrAmount")
            : ""}
        </span>
        <small>
          {t("fcTotal")} {formatAmount(totalCost(scenario, value.currency))}{" "}
          {value.currency} · {t("resultBaseline")}{" "}
          {formatAmount(totalCost(original, value.currency))} {value.currency}
        </small>
      </div>
      <div hidden={group !== "Receiver"}>
        <label>
          {t("fcReceiverLabel")}
          <select
            value={scenario.receiver_acceptance}
            onChange={(e) => edit({ receiver_acceptance: e.target.value })}
          >
            <option value="UNKNOWN">{t("fcRecvUnknown")}</option>
            <option value="ACCEPTED">{t("fcRecvAccepted")}</option>
            <option value="REJECTED">{t("fcRecvRejected")}</option>
          </select>
        </label>
        <small>{t("fcRecvNote")}</small>
      </div>
      {!demo && (
        <div hidden={group !== "Advanced"}>
          <label>
            {t("fcWeight")}
            <input
              aria-label={t("fcWeightSlider")}
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
              aria-label={t("fcWeight")}
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
            {errors.weights ? t("fcErrWeights") : ""}
          </span>
          <small>
            {t("fcDelayWeight")} {value.ranking_weights.delay}.{" "}
            {t("fcWeightNote")}
          </small>
        </div>
      )}
      <button
        type="button"
        className="quiet"
        onClick={() => onChange(structuredClone(baseline))}
      >
        {t("fcReset")}
      </button>
      <details>
        <summary>{t("fcDetails")}</summary>
        <p>
          {t("resultBaseline")}: {baselineLabel}. {t("fcEditedNote")}
        </p>
        <p>
          {t("fcLimits")
            .replace("{max}", costMax.toLocaleString("en-US"))
            .replace("{cur}", value.currency)}
        </p>
        <dl className="cost-breakdown">
          {costCategories.map((c) => (
            <div key={c}>
              <dt>{t(COST_KEYS[c])}</dt>
              <dd>
                <span className="num">
                  {scenario.costs[c].amount} {value.currency}
                </span>{" "}
                {scenario.costs[c].source === "USER_ESTIMATE" ? (
                  <>
                    <ProvenanceChip kind="estimated" /> {t("fcUserEstimate")}
                  </>
                ) : scenario.costs[c].source === "CONFIRMED" ? (
                  <>
                    <ProvenanceChip kind="entered" /> {t("fcConfirmed")}
                  </>
                ) : (
                  scenario.costs[c].source.toLowerCase().replaceAll("_", " ")
                )}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </fieldset>
  );
}
