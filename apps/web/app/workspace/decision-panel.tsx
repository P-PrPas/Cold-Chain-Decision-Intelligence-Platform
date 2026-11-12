"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, write, downloadReport, type Item } from "./api";
import DecisionEvidenceSummary from "../decision-summary";
import { EvidenceView } from "../evidence-view";
import { useI18n } from "../i18n-provider";
import { scenarioKey } from "../studio/scenarios";
import { StatusBadge, type Status } from "../ui/status-badge";
import FrozenSnapshot from "./snapshot-view";
import { Callout, RuleList, useErrorText, useFmt, useStatusLabel } from "./ui";

export type ProposalSource = { run: string; scenario: Item };
export type DecisionView = "propose" | "qa" | "report";
const KNOWN = ["ELIGIBLE", "REVIEW_REQUIRED", "BLOCKED", "INSUFFICIENT_DATA"];

export default function DecisionPanel({
  org,
  shipmentId,
  proposal,
  view,
  onSaved,
  onDecisions,
}: {
  org: string;
  shipmentId: string;
  proposal: ProposalSource | null;
  view: DecisionView;
  onSaved?: () => void;
  /** Newest-first decision list for this shipment; called after each successful load. */
  onDecisions?: (items: Item[]) => void;
}) {
  const { t, lang } = useI18n();
  const errText = useErrorText();
  const fmt = useFmt();
  const statusLabel = useStatusLabel();
  const [draftEvidence, setDraftEvidence] = useState<Item | null>(null);
  const [explanation, setExplanation] = useState<Item | null>(null);
  const [items, setItems] = useState<Item[]>([]),
    [detail, setDetail] = useState<Item | null>(null),
    [roles, setRoles] = useState<string[]>([]),
    [user, setUser] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [report, setReport] = useState<Item | null>(null),
    [reviewAction, setReviewAction] = useState("request-changes");
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const refresh = useCallback(
    async (cursor?: string) => {
      setInboxLoading(true);
      setInboxError("");
      try {
        const data = await api(
          `/decisions?shipment_id=${shipmentId}&limit=25${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
          org,
        );
        const list: Item[] = data.items ?? [];
        setItems((old) => (cursor ? [...old, ...list] : list));
        setNextCursor(data.next_cursor ?? null);
        if (!cursor) onDecisions?.(list);
      } catch (e) {
        setInboxError(errText(e));
        throw e;
      } finally {
        setInboxLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org, shipmentId, onDecisions],
  );
  useEffect(() => {
    let active = true;
    Promise.all([Promise.resolve().then(() => refresh()), api("/auth/me")])
      .then(([, me]) => {
        if (active) {
          setUser(me.user.id);
          setRoles(
            me.memberships.find((m: Item) => m.organization_id === org)
              ?.roles || [],
          );
        }
      })
      .catch((e) => {
        if (active) {
          setError(errText(e));
          onDecisions?.([]);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, refresh]);
  async function openDecision(d: Item) {
    setDetail(null);
    setDraftEvidence(null);
    setReport(null);
    const item = (await api(`/decisions/${d.id}`, org)).decision;
    if (!item.snapshot) {
      const run = (await api(`/simulations/${item.simulation_run_id}`, org))
        .simulation;
      const [analysis, policy, scenarios] = await Promise.all([
        api(`/analyses/${run.analysis_id}`, org),
        api(`/quality-policies/${run.policy_version_id}`, org),
        api(`/simulations/${run.id}/scenarios`, org),
      ]);
      setDraftEvidence({
        analysis: analysis.analysis,
        policy: policy.policy,
        scenario: scenarios.items.find(
          (v: Item) => v.id === item.selected_scenario_id,
        ),
        assumptions: run.parameters,
      });
    }
    setDetail(item);
  }
  async function perform(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      setError(`${errText(e)}. ${t("wsInputsRetained")}`);
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!proposal) return;
    const form = new FormData(e.currentTarget);
    await perform(async () => {
      const r = await api(
        "/decisions",
        org,
        write("POST", {
          simulation_run_id: proposal.run,
          selected_scenario_id: proposal.scenario.id,
          justification: form.get("notes"),
        }),
      );
      await openDecision(r.decision);
      onSaved?.();
      await refresh();
      setMessage(t("wsDraftSaved"));
    });
  }
  async function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!detail) return;
    const form = new FormData(e.currentTarget);
    await perform(async () => {
      let payload: Item = { justification: form.get("notes") };
      const action = detail.status === "DRAFT" ? "submit" : reviewAction;
      if (action !== "submit") {
        let references: string[] = [];
        const file = form.get("reference");
        if (action === "approve" && file instanceof File && file.size) {
          const upload = new FormData();
          upload.set("file", file);
          const r = await api("/reference-documents", org, {
            method: "POST",
            body: upload,
          });
          references = ["reference:" + r.reference_document.id];
        }
        payload = {
          acting_role: "QA",
          review_notes: form.get("notes"),
          evidence_references: references,
          acknowledged_required_actions: form.getAll("acknowledge"),
        };
      }
      const r = await api(
        `/decisions/${detail.id}/${action}`,
        org,
        write("POST", payload, `"decision-r${detail.revision}"`),
      );
      setDraftEvidence(null);
      setDetail(r.decision);
      onSaved?.();
      await refresh();
      setMessage(
        `${t("wsDecisionUpdated")}: ${statusLabel(r.decision.status)}`,
      );
    });
  }
  const snapshot = detail?.snapshot as Item | undefined;
  const scenario = snapshot?.scenario as Item | undefined;
  const required =
    scenario?.type === "HOLD_INSPECTION"
      ? "HOLD_IN_CONTROLLED_STORAGE"
      : "REVIEW_PINNED_EVIDENCE";
  const isQa = roles.includes("QA");
  const proposalType = String(proposal?.scenario.type ?? "");
  const title =
    view === "propose"
      ? t("wsProposeTitle")
      : view === "qa"
        ? t("wsQaTitle")
        : t("wsReportTitle");
  const lead =
    view === "propose"
      ? t("wsProposeLead")
      : view === "qa"
        ? t("wsQaLead")
        : t("wsReportLead");
  const canSubmit = detail?.status === "DRAFT" && detail.submitted_by === user;
  const canReview = detail?.status === "PENDING_QA" && isQa;
  return (
    <section className="ws-decision" data-view={view}>
      <div className="ws-panel-head">
        <h2>{title}</h2>
        <p>{lead}</p>
      </div>
      {view === "qa" && (
        <Callout tone="info" title={t("wsQaRuleTitle")}>
          {t("wsQaRule")}
        </Callout>
      )}
      {error && (
        <p role="alert" className="ws-alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {busy && (
        <p role="status" className="ws-busy">
          {t("wsDecisionBusy")}
        </p>
      )}
      {view === "propose" &&
        (proposal ? (
          <details open className="ws-card ws-proposal">
            <summary>
              {t("wsSelectedProposal")}:{" "}
              {scenarioKey[proposalType]
                ? t(scenarioKey[proposalType])
                : proposalType}
            </summary>
            <p className="ws-verdict">
              {KNOWN.includes(String(proposal.scenario.eligibility)) && (
                <StatusBadge
                  status={String(proposal.scenario.eligibility) as Status}
                />
              )}
            </p>
            <RuleList rules={proposal.scenario.rule_results} />
            <EvidenceView
              value={{
                eligibility: proposal.scenario.eligibility,
                cost: proposal.scenario.direct_incremental_cost,
                missing_information: proposal.scenario.missing_information,
                receiver_acceptance: proposal.scenario.receiver_acceptance,
                additional_delay_minutes:
                  proposal.scenario.additional_delay_minutes,
                reasons: proposal.scenario.rule_results,
              }}
            />
            <form onSubmit={create}>
              <label>
                <span>{t("wsWhyAppropriate")}</span>
                <textarea name="notes" required maxLength={4000} />
              </label>
              <button disabled={busy}>{t("wsSaveDraftForReview")}</button>
            </form>
          </details>
        ) : (
          <p className="ws-dim">{t("wsSelectPermissible")}</p>
        ))}
      <div className="ws-card">
        <div className="ws-card-head">
          <h3>{t("wsShipmentDecisions")}</h3>
          <button
            className="quiet"
            disabled={busy}
            onClick={() => void perform(() => refresh())}
          >
            {t("wsRefreshDecisions")}
          </button>
        </div>
        {inboxLoading && (
          <p role="status" className="ws-busy">
            {t("wsLoadingDecisions")}
          </p>
        )}
        {inboxError && (
          <p role="alert" className="ws-alert">
            {t("wsDecisionsFailed")} {inboxError}
          </p>
        )}
        {!inboxLoading && !inboxError && !items.length && (
          <p className="ws-dim">{t("wsNoDecisions")}</p>
        )}
        {nextCursor && (
          <button
            className="quiet"
            disabled={inboxLoading}
            onClick={() => void perform(() => refresh(nextCursor))}
          >
            {t("wsOlderDecisions")}
          </button>
        )}
        <ul className="decision-list">
          {items.map((d) => (
            <li key={String(d.id)} data-selected={detail?.id === d.id}>
              <button
                className="quiet"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await openDecision(d);
                  })
                }
              >
                {statusLabel(d.status)} / {fmt.dateTime(d.created_at)}
              </button>
              <p>{String(d.justification)}</p>
            </li>
          ))}
        </ul>
      </div>
      {detail && view !== "report" && (
        <div
          className="review-detail ws-card"
          key={String(detail.id) + String(detail.revision)}
        >
          <div className="ws-card-head">
            <h3>
              {statusLabel(detail.status)} {t("wsDecisionWord")}
            </h3>
            <span className="op-badge" data-op={String(detail.status)}>
              {String(detail.status)}
            </span>
          </div>
          <p>{String(detail.justification)}</p>
          <p className="ws-note">
            {t("wsRevision")} {String(detail.revision)}.{" "}
            {detail.snapshot_sha256 ? t("wsSnapFrozen") : t("wsSnapWillFreeze")}
          </p>
          {view === "propose" && draftEvidence && (
            <details open>
              <summary>{t("wsDraftSource")}</summary>
              <DecisionEvidenceSummary evidence={draftEvidence} />
              <details>
                <summary>{t("wsSourceTrace")}</summary>
                <EvidenceView value={draftEvidence} />
              </details>
            </details>
          )}
          {view === "qa" && snapshot && (
            <>
              <FrozenSnapshot decision={detail} />
              <h4>{t("wsPinnedEvidence")}</h4>
              <DecisionEvidenceSummary evidence={snapshot} />
              {["analysis", "scenario", "policy"].map((key) => (
                <details key={key}>
                  <summary>
                    {t(
                      key === "analysis"
                        ? "wsEvAnalysis"
                        : key === "scenario"
                          ? "wsEvScenario"
                          : "wsEvPolicy",
                    )}
                  </summary>
                  <EvidenceView value={snapshot[key]} />
                </details>
              ))}
            </>
          )}
          {view === "propose" && snapshot && (
            <p className="ws-note">{t("wsAlreadySubmitted")}</p>
          )}
          {view === "propose" && detail.status === "DRAFT" && !canSubmit && (
            <Callout tone="warn">{t("wsOnlyProposerSubmits")}</Callout>
          )}
          {view === "qa" && detail.status === "PENDING_QA" && !isQa && (
            <Callout tone="block" title={t("wsNoQaTitle")}>
              {t("wsNoQaBody")}
            </Callout>
          )}
          {view === "qa" && detail.status === "DRAFT" && (
            <Callout tone="warn">{t("wsDraftNotSubmitted")}</Callout>
          )}
          {((view === "propose" && canSubmit) ||
            (view === "qa" && canReview)) && (
            <form onSubmit={review} className="ws-review-form">
              {detail.status === "DRAFT" ? (
                <p>{t("wsSubmitFreezes")}</p>
              ) : (
                <label>
                  <span>{t("wsReviewOutcome")}</span>
                  <select
                    value={reviewAction}
                    onChange={(e) => setReviewAction(e.target.value)}
                  >
                    <option value="request-changes">
                      {t("wsRequestChanges")}
                    </option>
                    <option value="reject">{t("wsRejectProposal")}</option>
                    <option value="approve">{t("wsApproveInternal")}</option>
                  </select>
                </label>
              )}
              <label>
                <span>
                  {detail.status === "DRAFT"
                    ? t("wsSubmissionJustification")
                    : t("wsReviewNotes")}
                </span>
                <textarea
                  name="notes"
                  defaultValue={
                    detail.status === "DRAFT"
                      ? String(detail.justification)
                      : ""
                  }
                  required
                  maxLength={4000}
                />
              </label>
              {detail.status === "PENDING_QA" && reviewAction === "approve" && (
                <>
                  <label>
                    <span>{t("wsSupportingRef")}</span>
                    <input type="file" name="reference" required />
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      name="acknowledge"
                      value={required}
                      required
                    />
                    {required === "HOLD_IN_CONTROLLED_STORAGE"
                      ? t("wsConfirmHold")
                      : t("wsReviewedPinned")}
                  </label>
                </>
              )}
              <label className="check-label">
                <input type="checkbox" required />
                {t("wsReviewedUnderstand")}
              </label>
              {detail.status === "PENDING_QA" && (
                <p className="ws-note">{t("wsRecordedAs")}</p>
              )}
              <button disabled={busy}>
                {detail.status === "DRAFT"
                  ? t("wsSubmitToQa")
                  : t("wsConfirmReview")}
              </button>
            </form>
          )}
          {view === "qa" && Boolean(detail.review_notes) && (
            <div className="ws-card ws-record">
              <h4>{t("wsRecordedReview")}</h4>
              <dl className="ws-facts">
                <div>
                  <dt>{t("wsActingRole")}</dt>
                  <dd>
                    <code>QA</code>
                  </dd>
                </div>
                <div>
                  <dt>{t("wsReviewedBy")}</dt>
                  <dd>
                    <code>{String(detail.reviewed_by ?? "—")}</code>
                  </dd>
                </div>
                <div>
                  <dt>{t("wsReviewedAt")}</dt>
                  <dd className="num">{fmt.dateTime(detail.reviewed_at)}</dd>
                </div>
              </dl>
              <h4>{t("wsReviewerNotes")}</h4>
              <p>{String(detail.review_notes)}</p>
              <EvidenceView value={detail.review_evidence} />
            </div>
          )}
        </div>
      )}
      {detail && view === "report" && (
        <div className="review-detail ws-card">
          <div className="ws-card-head">
            <h3>
              {statusLabel(detail.status)} {t("wsDecisionWord")}
            </h3>
            <span className="op-badge" data-op={String(detail.status)}>
              {String(detail.status)}
            </span>
          </div>
          {Boolean(detail.snapshot_sha256) ? (
            <>
              <FrozenSnapshot decision={detail} />
              <h4>{t("wsFrozenReport")}</h4>
              <p className="ws-note">{t("wsReportFromSnapshot")}</p>
              <div className="ws-actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      const r = await api(
                        `/decisions/${detail.id}/reports`,
                        org,
                        write("POST", { format: "PDF", language: lang }),
                      );
                      setReport(r.report);
                      setMessage(t("wsReportRequested"));
                    })
                  }
                >
                  {t("wsGeneratePdf")}
                </button>
              </div>
              {report && (
                <>
                  <p>
                    {t("wsReport")}: {statusLabel(report.status)}
                  </p>
                  <div className="ws-actions">
                    <button
                      className="quiet"
                      disabled={busy}
                      onClick={() =>
                        void perform(async () =>
                          setReport(
                            (await api(`/reports/${report.id}`, org)).report,
                          ),
                        )
                      }
                    >
                      {t("wsRefreshReport")}
                    </button>
                    {report.status === "COMPLETED" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void perform(() =>
                            downloadReport(String(report.id), org),
                          )
                        }
                      >
                        {t("wsDownloadPdf")}
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <Callout tone="warn">{t("wsBlockNoSnapshot")}</Callout>
          )}
        </div>
      )}
      {view === "report" && !detail && (
        <p className="ws-dim">{t("wsPickDecisionForReport")}</p>
      )}
      {view === "report" && detail && (
        <details className="ws-card">
          <summary>{t("wsExplanationTitle")}</summary>
          <p>{t("wsExplanationNote")}</p>
          <div className="ws-actions">
            <button
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await api(
                    `/simulations/${detail.simulation_run_id}/explanations`,
                    org,
                    write("POST", {}),
                  );
                  setMessage(t("wsExplanationRequested"));
                })
              }
            >
              {t("wsGenerateExplanation")}
            </button>
            <button
              className="quiet"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  setExplanation(
                    (
                      await api(
                        `/simulations/${detail.simulation_run_id}/explanations/latest`,
                        org,
                      )
                    ).explanation,
                  );
                })
              }
            >
              {t("wsRefreshExplanation")}
            </button>
          </div>
          {explanation && (
            <>
              <p className="ws-note">{t("wsExplanationLabel")}</p>
              <EvidenceView value={explanation} />
            </>
          )}
        </details>
      )}
    </section>
  );
}
