"use client";
import type { Item } from "./workspace/api";
import { human } from "./evidence-view";
import { useI18n } from "./i18n-provider";
import { ProvenanceChip } from "./ui/provenance-chip";
import { StatusBadge, type Status } from "./ui/status-badge";
import { AnalysisBadge, RuleList } from "./workspace/ui";

const KNOWN = ["ELIGIBLE", "REVIEW_REQUIRED", "BLOCKED", "INSUFFICIENT_DATA"];

/**
 * Group a Decimal string for display without float math. Keeps every digit the
 * API sent (at least two decimals), so nothing is rounded.
 */
export function formatDecimal(value: unknown): string | null {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^-?\d+(\.\d+)?$/.test(text)) return null;
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const grouped = BigInt(whole).toLocaleString("en-US");
  return `${negative ? "-" : ""}${grouped}.${fraction.padEnd(2, "0")}`;
}
export function money(
  value: unknown,
  currency: unknown,
  missing = "Not calculated",
): string {
  const formatted = formatDecimal(value);
  return formatted === null
    ? missing
    : `${formatted} ${String(currency || "")}`.trim();
}
export default function DecisionEvidenceSummary({
  evidence,
}: {
  evidence: Item;
}) {
  const { t } = useI18n();
  const analysis = evidence.analysis as Item | undefined;
  const result = (analysis?.result || analysis || {}) as Item;
  const summary = (result.summary || {}) as Item;
  const policy = (evidence.policy || {}) as Item;
  const dataset = (evidence.dataset || {}) as Item;
  const sc = (evidence.scenario || {}) as Item;
  const scenario = (sc.result || sc) as Item;
  const rules = (result.rule_results || scenario.rule_results || []) as Item[];
  return (
    <div className="decision-summary">
      <h4>{t("wsEvSays")}</h4>
      <p className="ws-verdict">
        {result.classification ? (
          <AnalysisBadge value={result.classification} />
        ) : (
          <span className="ws-dim">{t("wsNotEvaluated")}</span>
        )}{" "}
        {KNOWN.includes(String(scenario.eligibility)) ? (
          <StatusBadge status={String(scenario.eligibility) as Status} />
        ) : (
          <span className="ws-dim">
            {human(scenario.eligibility || t("wsNoScenario"))}
          </span>
        )}
      </p>
      <dl className="evidence-grid">
        <div>
          <dt>{t("wsTempRange")}</dt>
          <dd>
            {summary.min_c == null
              ? t("hudUnknown")
              : `${summary.min_c} – ${summary.max_c} °C`}{" "}
            {summary.min_c != null && <ProvenanceChip kind="calculated" />}
          </dd>
        </div>
        <div>
          <dt>{t("wsTimeWithoutEvidence")}</dt>
          <dd>
            {summary.unknown_seconds == null
              ? t("wsNotReported")
              : `${summary.unknown_seconds} s`}
          </dd>
        </div>
        <div>
          <dt>{t("wsSnapPolicy")}</dt>
          <dd>
            {String(policy.policy_key || t("wsNotAvailable"))} /{" "}
            {String(policy.version ?? t("wsUnknownVersion"))}
          </dd>
        </div>
        <div>
          <dt>{t("wsSnapDataset")}</dt>
          <dd>{String(dataset.version ?? t("wsSeePinnedDataset"))}</dd>
        </div>
        <div>
          <dt>{t("wsScenarioCostDelay")}</dt>
          <dd>
            {money(
              scenario.direct_incremental_cost,
              scenario.currency,
              t("wsNotCalculated"),
            )}{" "}
            / {String(scenario.additional_delay_minutes ?? "—")} {t("unitMin")}
          </dd>
        </div>
      </dl>
      <h4>{t("wsReasonsLimits")}</h4>
      <RuleList rules={rules} />
      <ul>
        {((scenario.missing_information || []) as string[]).map((v) => (
          <li key={v}>{human(v)}</li>
        ))}
      </ul>
      <p>
        {t("wsReviewerMust")}
        {sc.type === "HOLD_INSPECTION" || scenario.type === "HOLD_INSPECTION"
          ? ` ${t("wsAndConfirmHold")}`
          : ""}
        . {t("wsApprovalRequires")}
      </p>
    </div>
  );
}
