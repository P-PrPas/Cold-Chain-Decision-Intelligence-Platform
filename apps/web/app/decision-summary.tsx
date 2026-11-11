import type { Item } from "./workspace/api";
import { human } from "./evidence-view";
export function money(value: unknown, currency: unknown): string {
  const number = Number(value);
  return value != null && Number.isFinite(number)
    ? `${number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${String(currency || "")}`
    : "Not calculated";
}
export default function DecisionEvidenceSummary({
  evidence,
}: {
  evidence: Item;
}) {
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
      <h4>What the evidence says</h4>
      <p>
        <strong>
          {human(
            result.classification ||
              scenario.risk_classification ||
              "Not evaluated",
          )}
        </strong>{" "}
        / {human(scenario.eligibility || "No scenario selected")}
      </p>
      <dl className="evidence-grid">
        <div>
          <dt>Temperature range</dt>
          <dd>
            {summary.min_c == null
              ? "Unknown"
              : `${summary.min_c} to ${summary.max_c} Celsius`}
          </dd>
        </div>
        <div>
          <dt>Time without evidence</dt>
          <dd>
            {summary.unknown_seconds == null
              ? "Not reported"
              : `${summary.unknown_seconds} seconds`}
          </dd>
        </div>
        <div>
          <dt>Policy version</dt>
          <dd>
            {String(policy.policy_key || "Not available")} /{" "}
            {String(policy.version ?? "Unknown version")}
          </dd>
        </div>
        <div>
          <dt>Dataset version</dt>
          <dd>{String(dataset.version ?? "See pinned dataset reference")}</dd>
        </div>
        <div>
          <dt>Scenario cost / delay</dt>
          <dd>
            {money(scenario.direct_incremental_cost, scenario.currency)} /{" "}
            {String(scenario.additional_delay_minutes ?? "Unknown")} minutes
          </dd>
        </div>
      </dl>
      <h4>Reasons and limitations</h4>
      <ul>
        {rules
          .filter((r) => r.matched)
          .map((r, i) => (
            <li key={i}>
              {human(r.rule_id || r.code || r.effect)}: {human(r.effect)}
            </li>
          ))}
        {!rules.some((r) => r.matched) && (
          <li>
            No matched rule reason reported. This does not itself certify
            safety.
          </li>
        )}
        {((scenario.missing_information || []) as string[]).map((v) => (
          <li key={v}>{human(v)}</li>
        ))}
      </ul>
      <p>
        Reviewer must inspect the pinned evidence
        {sc.type === "HOLD_INSPECTION" || scenario.type === "HOLD_INSPECTION"
          ? " and confirm the required hold in controlled storage"
          : ""}
        . Approval requires supporting reference evidence and an independent
        authorized reviewer where configured.
      </p>
    </div>
  );
}
