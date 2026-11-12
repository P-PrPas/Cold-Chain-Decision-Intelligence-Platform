"use client";
import type { ReactNode } from "react";
import { useI18n } from "./i18n-provider";
import type { DictKey } from "./i18n";

export function human(value: unknown): string {
  return String(value ?? "Not available")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

/** Field names of the evidence JSON that have a translated label. Others fall back to the readable English name. */
const FIELD_KEYS: Record<string, DictKey> = {
  summary: "evfSummary",
  rule_results: "evfRuleResults",
  unknown_intervals: "evfUnknownIntervals",
  excursions: "evfExcursions",
  rule_id: "evfRuleId",
  effect: "evfEffect",
  matched: "evfMatched",
  source_ref: "evfSourceRef",
  sensor_id: "evfSensorId",
  start_at: "evfStart",
  end_at: "evfEnd",
  duration_seconds: "evfDuration",
  classification: "evfClassification",
  min_c: "evfMinC",
  max_c: "evfMaxC",
  unknown_seconds: "evfUnknownSeconds",
  excursion_count: "evfExcursionCount",
  cumulative_excursion_seconds: "evfCumulative",
  eligibility: "evfEligibility",
  cost: "evfCost",
  missing_information: "evfMissing",
  receiver_acceptance: "evfReceiver",
  additional_delay_minutes: "evfDelay",
  reasons: "evfReasons",
  status: "evfStatus",
  reason: "evfReason",
  shipment: "evfShipment",
  scenario: "evfScenario",
  dataset_version: "evfDatasetVersion",
  policy: "evfPolicy",
  policy_version: "evfPolicyVersion",
  analysis: "evfAnalysis",
  assumptions: "evfAssumptions",
  rules: "evfRules",
  currency: "evfCurrency",
  scenarios: "evfScenarios",
  ranking_weights: "evfRankingWeights",
  costs: "evfCosts",
  amount: "evfAmount",
  source: "evfSource",
};

export function EvidenceView({ value }: { value: unknown }): ReactNode {
  const { t } = useI18n();
  if (value === null || value === undefined)
    return <span>{t("evNotAvailable")}</span>;
  if (Array.isArray(value))
    return value.length ? (
      <ul className="evidence-list">
        {value.map((v, i) => (
          <li key={i}>
            <EvidenceView value={v} />
          </li>
        ))}
      </ul>
    ) : (
      <span>{t("evNone")}</span>
    );
  if (typeof value === "object")
    return (
      <dl className="evidence-grid">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <dt>{FIELD_KEYS[k] ? t(FIELD_KEYS[k]) : human(k)}</dt>
            <dd>
              <EvidenceView value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return (
    <span>
      {typeof value === "boolean"
        ? value
          ? t("evYes")
          : t("evNo")
        : String(value)}
    </span>
  );
}
