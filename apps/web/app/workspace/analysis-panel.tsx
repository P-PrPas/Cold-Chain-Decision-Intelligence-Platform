"use client";
import { EvidenceView } from "../evidence-view";
import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "../i18n-provider";
import { ProvenanceChip } from "../ui/provenance-chip";
import { api, write, type Item } from "./api";
import {
  AnalysisBadge,
  Callout,
  RuleList,
  useErrorText,
  useStatusLabel,
} from "./ui";

const draftRules = {
  schema_version: "1.0",
  required_sensor_ids: ["A"],
  max_valid_sampling_gap_seconds: 600,
  temperature_bounds: { min_c: null, max_c: null },
  continuous_excursion_limit_seconds: null,
  cumulative_excursion_limit_seconds: null,
  unknown_gap_effect: "REVIEW_REQUIRED",
  action_constraints: [],
};
export function TemperatureEvidence({
  observations,
}: {
  observations: Item[];
}) {
  const { t } = useI18n();
  if (!observations.length) return null;
  return (
    <aside role="alert" aria-label={t("wsObsAria")} className="ws-alert ws-obs">
      <h4>{t("wsObsTitle")}</h4>
      <p>{t("wsObsBody")}</p>
      <ul>
        {observations.map((observation, index) => (
          <li key={index}>
            {t("wsSensor")} {String(observation.sensor_id)}:{" "}
            {String(observation.temperature_c)} °C @ {String(observation.at)} —{" "}
            <code>{String(observation.reason)}</code>
          </li>
        ))}
      </ul>
    </aside>
  );
}
export default function AnalysisPanel({
  shipmentId,
  productId,
  org,
  selectedAnalysis,
  onCompleted,
  onPolicies,
}: {
  shipmentId: string;
  productId: string;
  onCompleted?: (id: string) => void;
  org: string;
  /** Completed analysis already selected by the page (for example the saved one). */
  selectedAnalysis?: Item | null;
  /** Called once the policy list has loaded (or failed) and after each refresh. */
  onPolicies?: (items: Item[]) => void;
}) {
  const { t } = useI18n();
  const errText = useErrorText();
  const statusLabel = useStatusLabel();
  const [policyAction, setPolicyAction] = useState<{
    policy: Item;
    action: string;
  } | null>(null);
  const [policyNote, setPolicyNote] = useState("");
  const [recentAnalyses, setRecentAnalyses] = useState<Item[]>([]);
  const [analysisCursor, setAnalysisCursor] = useState<string | null>(null);
  const [policies, setPolicies] = useState<Item[]>([]);
  const [datasets, setDatasets] = useState<Item[]>([]);
  const [rules, setRules] = useState(JSON.stringify(draftRules, null, 2));
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Item | null>(null);
  const [job, setJob] = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const canAuthor = roles.includes("ADMIN") || roles.includes("QA");
  async function refresh() {
    const [p, d] = await Promise.all([
      api(`/quality-policies?product_id=${productId}`, org),
      api(`/shipments/${shipmentId}/temperature-datasets`, org),
    ]);
    setPolicies(p.items ?? []);
    setDatasets(d.items ?? []);
    onPolicies?.(p.items ?? []);
  }
  useEffect(() => {
    Promise.all([
      api(`/quality-policies?product_id=${productId}`, org),
      api(`/shipments/${shipmentId}/temperature-datasets`, org),
      api("/auth/me"),
    ])
      .then(([p, d, me]) => {
        setPolicies(p.items ?? []);
        setDatasets(d.items ?? []);
        onPolicies?.(p.items ?? []);
        setRoles(
          me.memberships.find(
            (m: { organization_id: string }) => m.organization_id === org,
          )?.roles || [],
        );
      })
      .catch((e) => {
        setError(errText(e));
        onPolicies?.([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, productId, shipmentId]);
  useEffect(() => {
    if (!job) return;
    const timer = setInterval(() => {
      api(`/jobs/${job}`, org)
        .then(async (data) => {
          if (["COMPLETED", "FAILED"].includes(data.job.status)) {
            setJob("");
            setBusy(false);
            setAnalysis((await api(`/analyses/${analysisId}`, org)).analysis);
            if (data.job.status === "COMPLETED") onCompleted?.(analysisId);
          }
        })
        .catch((e) => {
          setError(errText(e));
          setJob("");
          setBusy(false);
        });
    }, 1500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, org, analysisId, onCompleted]);
  useEffect(() => {
    let active = true;
    api(`/shipments/${shipmentId}/analyses`, org)
      .then((d) => {
        if (active) {
          setRecentAnalyses(d.items ?? []);
          setAnalysisCursor(d.next_cursor);
        }
      })
      .catch((e) => {
        if (active) setError(errText(e));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, shipmentId]);
  async function editDraft(event: FormEvent<HTMLFormElement>, policy: Item) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(
        `/quality-policies/${policy.id}`,
        org,
        write(
          "PATCH",
          {
            product_id: productId,
            policy_key: policy.policy_key,
            version: policy.version,
            reference_document_id: form.get("reference") || null,
            effective_from: form.get("effective_from"),
            effective_to: form.get("effective_to") || null,
            rules: JSON.parse(String(form.get("rules"))),
          },
          `"policy-r${policy.revision}"`,
        ),
      );
      await refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api(
        "/quality-policies",
        org,
        write("POST", {
          product_id: productId,
          policy_key: form.get("key"),
          version: Number(form.get("version")),
          reference_document_id: reference || null,
          effective_from: new Date(String(form.get("effective"))).toISOString(),
          rules: JSON.parse(rules),
        }),
      );
      await refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }
  async function transition(policy: Item, action: string) {
    const note = policyNote;
    if (!note) return;
    setBusy(true);
    try {
      await api(
        `/quality-policies/${policy.id}/${action}`,
        org,
        write(
          "POST",
          { note, approval_note: note, reason: note },
          `"policy-r${policy.revision}"`,
        ),
      );
      await refresh();
      setPolicyAction(null);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }
  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCompleted?.("");
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const policy = policies.find((p) => p.id === form.get("policy"));
    try {
      const result = await api(
        `/shipments/${shipmentId}/analyses`,
        org,
        write("POST", {
          dataset_id: form.get("dataset"),
          policy_version_id: form.get("policy"),
          selected_sensor_ids: (
            policy?.rules as { required_sensor_ids: string[] }
          ).required_sensor_ids,
        }),
      );
      setJob(result.job.id);
      setAnalysisId(result.analysis.id);
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }
  const readyDatasets = datasets.filter((d) => d.status === "READY");
  const approved = policies.filter((p) => p.status === "APPROVED");
  const shown = analysis ?? selectedAnalysis ?? null;
  const summary = (shown?.summary ?? {}) as Item;
  return (
    <section className="ws-policy">
      <div className="ws-panel-head">
        <h2>{t("wsPolicyTitle")}</h2>
        <p>{t("wsPolicyLead")}</p>
      </div>
      {error && (
        <p role="alert" className="ws-alert">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="ws-busy">
          {t("wsProcessing")}
        </p>
      )}
      <div className="ws-split">
        <div className="ws-card">
          <div className="ws-card-head">
            <h3>{t("wsPoliciesTitle")}</h3>
            <button
              className="quiet"
              disabled={busy}
              onClick={() => refresh().catch((e) => setError(errText(e)))}
            >
              {t("wsRefreshPolicies")}
            </button>
          </div>
          {approved.length === 0 && (
            <Callout tone="warn" title={t("wsNoApprovedTitle")}>
              {t("wsNoApproved")}
            </Callout>
          )}
          <p className="ws-note">{t("wsPolicyRoles")}</p>
          {policies.length === 0 && (
            <p className="ws-dim">{t("wsNoPolicies")}</p>
          )}
          <ul className="ws-policies">
            {policies.map((p) => (
              <li key={String(p.id)} data-status={String(p.status)}>
                <div className="ws-policy-head">
                  <strong>
                    {String(p.policy_key)}{" "}
                    <span className="num">v{String(p.version)}</span>
                  </strong>
                  <span className="op-badge" data-op={String(p.status)}>
                    {statusLabel(p.status)}
                  </span>
                </div>
                <details>
                  <summary>{t("wsRuleEvidence")}</summary>
                  <EvidenceView value={p.rules} />
                </details>
                {p.status === "DRAFT" && canAuthor && (
                  <details>
                    <summary>
                      {t("wsEditDraft")} v{String(p.version)}
                    </summary>
                    <form
                      key={String(p.revision)}
                      onSubmit={(event) => void editDraft(event, p)}
                    >
                      <label>
                        <span>{t("wsRefDocId")}</span>
                        <input
                          name="reference"
                          defaultValue={String(p.reference_document_id || "")}
                        />
                      </label>
                      <label>
                        <span>{t("wsEffectiveFromUtc")}</span>
                        <input
                          name="effective_from"
                          required
                          defaultValue={String(p.effective_from)}
                        />
                      </label>
                      <label>
                        <span>{t("wsEffectiveToUtc")}</span>
                        <input
                          name="effective_to"
                          defaultValue={String(p.effective_to || "")}
                        />
                      </label>
                      <label>
                        <span>{t("wsDraftRules")}</span>
                        <textarea
                          name="rules"
                          rows={14}
                          required
                          defaultValue={JSON.stringify(p.rules, null, 2)}
                        />
                      </label>
                      <button disabled={busy}>{t("wsSaveDraftChanges")}</button>
                    </form>
                  </details>
                )}
                <div className="ws-actions">
                  {p.status === "DRAFT" && canAuthor && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        setPolicyAction({ policy: p, action: "submit-review" });
                        setPolicyNote("");
                      }}
                    >
                      {t("wsSubmitReview")}
                    </button>
                  )}
                  {p.status === "PENDING_REVIEW" && roles.includes("QA") && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        setPolicyAction({ policy: p, action: "approve" });
                        setPolicyNote("");
                      }}
                    >
                      {t("wsQaApprove")}
                    </button>
                  )}
                  {p.status === "PENDING_REVIEW" && !roles.includes("QA") && (
                    <small className="ws-dim">{t("wsNeedsQaToApprove")}</small>
                  )}
                  {p.status === "APPROVED" && roles.includes("QA") && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        setPolicyAction({ policy: p, action: "retire" });
                        setPolicyNote("");
                      }}
                    >
                      {t("wsRetire")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {policyAction && (
            <form
              className="ws-confirm"
              onSubmit={async (e) => {
                e.preventDefault();
                await transition(policyAction.policy, policyAction.action);
              }}
            >
              <h3>
                {t("wsConfirm")} {policyAction.action.replaceAll("-", " ")}:{" "}
                {String(policyAction.policy.policy_key)}
              </h3>
              <label>
                <span>{t("wsReasonNote")}</span>
                <textarea
                  required
                  value={policyNote}
                  onChange={(e) => setPolicyNote(e.target.value)}
                />
              </label>
              <label className="check-label">
                <input type="checkbox" required />
                {t("wsPolicyReviewed")}
              </label>
              <div className="ws-actions">
                <button disabled={busy}>{t("wsConfirmPolicyAction")}</button>
                <button
                  type="button"
                  className="quiet"
                  onClick={() => setPolicyAction(null)}
                >
                  {t("wsCancel")}
                </button>
              </div>
            </form>
          )}
          {canAuthor && (
            <details className="ws-author">
              <summary>{t("wsAuthorDraft")}</summary>
              <label>
                <span>{t("wsRefDocument")}</span>
                <input
                  type="file"
                  onChange={async (e) => {
                    if (!e.target.files?.[0]) return;
                    const form = new FormData();
                    form.set("file", e.target.files[0]);
                    try {
                      const result = await api("/reference-documents", org, {
                        method: "POST",
                        body: form,
                      });
                      setReference(result.reference_document.id);
                    } catch (error) {
                      setError(errText(error));
                    }
                  }}
                />
              </label>
              <p>
                {t("wsReference")}: {reference || t("wsNotUploaded")}
              </p>
              <form onSubmit={create}>
                <label>
                  <span>{t("wsPolicyKey")}</span>
                  <input name="key" required />
                </label>
                <label>
                  <span>{t("wsVersion")}</span>
                  <input
                    name="version"
                    type="number"
                    min="1"
                    defaultValue="1"
                    required
                  />
                </label>
                <label>
                  <span>{t("wsEffectiveFrom")}</span>
                  <input name="effective" type="datetime-local" required />
                </label>
                <label>
                  <span>{t("wsVersionedRules")}</span>
                  <textarea
                    rows={14}
                    value={rules}
                    onChange={(e) => setRules(e.target.value)}
                  />
                </label>
                <button disabled={busy}>{t("wsSaveDraft")}</button>
              </form>
            </details>
          )}
        </div>
        <div className="ws-card">
          <h3>{t("wsAnalysisTitle")}</h3>
          {recentAnalyses.length > 0 && (
            <label>
              <span>{t("wsResumeAnalysis")}</span>
              <select
                defaultValue=""
                disabled={busy}
                onChange={async (e) => {
                  if (!e.target.value) return;
                  onCompleted?.("");
                  setBusy(true);
                  setError("");
                  try {
                    const a = (await api(`/analyses/${e.target.value}`, org))
                      .analysis;
                    setAnalysis(a);
                    if (a.status === "COMPLETED") onCompleted?.(a.id);
                    else setError(t("wsAnalysisNotComplete"));
                  } catch (e) {
                    setError(errText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <option value="">{t("wsSelectPrevious")}</option>
                {recentAnalyses.map((a, i) => (
                  <option value={String(a.id)} key={String(a.id)}>
                    {t("wsRecentResult")} {i + 1} /{" "}
                    {String(a.classification || t("wsClassUnavailable"))}
                  </option>
                ))}
              </select>
              <small className="ws-dim">{t("wsServerChecksCurrent")}</small>
            </label>
          )}
          {analysisCursor && (
            <button
              type="button"
              className="quiet"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const data = await api(
                    `/shipments/${shipmentId}/analyses?cursor=${encodeURIComponent(analysisCursor)}`,
                    org,
                  );
                  setRecentAnalyses((items) => [...items, ...data.items]);
                  setAnalysisCursor(data.next_cursor);
                } catch (e) {
                  setError(errText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("wsOlderAnalyses")}
            </button>
          )}
          <form onSubmit={run}>
            {readyDatasets.length === 0 && (
              <Callout tone="warn">{t("wsNeedDatasetForAnalysis")}</Callout>
            )}
            <label>
              <span>{t("wsReadyDataset")}</span>
              <select name="dataset" required>
                <option value="">{t("wsSelect")}</option>
                {readyDatasets.map((d) => (
                  <option key={String(d.id)} value={String(d.id)}>
                    {t("wsDataset")} v{String(d.version)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("wsApprovedPolicy")}</span>
              <select name="policy" required>
                <option value="">{t("wsSelect")}</option>
                {approved.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {String(p.policy_key)} v{String(p.version)}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy}>{t("wsAnalyze")}</button>
          </form>
        </div>
      </div>
      {shown && (
        <div className="ws-card ws-result">
          <div className="ws-card-head">
            <h3>
              {t("wsAnalysisResult")}:{" "}
              {shown.classification ? (
                <AnalysisBadge value={shown.classification} />
              ) : (
                statusLabel(shown.status)
              )}
            </h3>
            <ProvenanceChip kind="calculated" />
          </div>
          {String(shown.classification) === "INDETERMINATE" && (
            <Callout tone="warn">{t("wsIndeterminateNote")}</Callout>
          )}
          <dl className="ws-facts">
            <div>
              <dt>{t("wsExcursions")}</dt>
              <dd className="num">{String(summary.excursion_count ?? "—")}</dd>
            </div>
            <div>
              <dt>{t("wsCumulative")}</dt>
              <dd className="num">
                {summary.cumulative_excursion_seconds == null
                  ? "—"
                  : `${summary.cumulative_excursion_seconds} s`}
              </dd>
            </div>
            <div>
              <dt>{t("wsUnknownTime")}</dt>
              <dd className="num">
                {summary.unknown_seconds == null
                  ? t("wsNotReported")
                  : `${summary.unknown_seconds} s`}
              </dd>
            </div>
            <div>
              <dt>{t("wsTempRange")}</dt>
              <dd className="num">
                {summary.min_c == null
                  ? t("hudUnknown")
                  : `${summary.min_c} – ${summary.max_c} °C`}
              </dd>
            </div>
          </dl>
          <h4>{t("wsRulesMatched")}</h4>
          <RuleList rules={shown.rule_results} />
          <details>
            <summary>{t("wsTraceability")}</summary>
            <p>
              {t("wsAnalysisRef")}: <code>{String(shown.id)}</code>
            </p>
            <p className="digest">
              {t("wsInputDigest")}: <code>{String(shown.input_sha256)}</code>
            </p>
            <p>
              {t("wsEngineVersion")}:{" "}
              <code>{String(shown.engine_version ?? "—")}</code>
            </p>
          </details>
          <TemperatureEvidence
            observations={
              (
                shown.summary as {
                  unbounded_out_of_range_observations?: Item[];
                }
              )?.unbounded_out_of_range_observations || []
            }
          />
          <details>
            <summary>{t("wsFullEvidence")}</summary>
            <EvidenceView
              value={{
                summary: shown.summary,
                rule_results: shown.rule_results,
                unknown_intervals: shown.unknown_intervals,
                excursions: shown.excursions,
              }}
            />
          </details>
        </div>
      )}
    </section>
  );
}
