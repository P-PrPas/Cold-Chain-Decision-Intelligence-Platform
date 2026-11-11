"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, write, downloadReport, type Item } from "./api";
import { EvidenceView, human } from "../evidence-view";
import { scenarioNames } from "../scene";
export type ProposalSource = { run: string; scenario: Item };
export default function DecisionPanel({
  org,
  shipmentId,
  proposal,
}: {
  org: string;
  shipmentId: string;
  proposal: ProposalSource | null;
}) {
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
  const refresh = useCallback(async () => {
    const all: Item[] = [];
    let cursor: string | null = null;
    do {
      const data = await api(
        `/decisions?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        org,
      );
      all.push(...data.items);
      cursor = data.next_cursor;
    } while (cursor);
    const scoped = await Promise.all(
      all.map(async (d) => {
        const run = (await api(`/simulations/${d.simulation_run_id}`, org))
          .simulation;
        return run.shipment_id === shipmentId ? d : null;
      }),
    );
    setItems(scoped.filter((d): d is Item => d !== null));
  }, [org, shipmentId]);
  useEffect(() => {
    let active = true;
    Promise.all([Promise.resolve().then(refresh), api("/auth/me")])
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
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
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
      setError(
        String(e) +
          ". Your inputs are retained. Refresh the evidence if its revision has changed.",
      );
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
      await refresh();
      setMessage(
        "Draft saved. Review the evidence below before submitting to QA.",
      );
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
      await refresh();
      setMessage("Decision updated: " + human(r.decision.status));
    });
  }
  const snapshot = detail?.snapshot as Item | undefined;
  const scenario = snapshot?.scenario as Item | undefined;
  const required =
    scenario?.type === "HOLD_INSPECTION"
      ? "HOLD_IN_CONTROLLED_STORAGE"
      : "REVIEW_PINNED_EVIDENCE";
  return (
    <section>
      <h2>Proposal and QA review</h2>
      <p>
        Review evidence before submission. Approval records an internal
        workflow; it does not release goods or certify safety.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {busy && <p role="status">Saving or retrieving evidence...</p>}
      {proposal ? (
        <details open>
          <summary>
            Selected proposal:{" "}
            {scenarioNames[String(proposal.scenario.type)] ||
              human(proposal.scenario.type)}
          </summary>
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
              Why is this the appropriate action?
              <textarea name="notes" required maxLength={4000} />
            </label>
            <button disabled={busy}>Save draft for review</button>
          </form>
        </details>
      ) : (
        <p>
          Select a permissible scenario from a completed simulation to prepare a
          proposal.
        </p>
      )}
      <div className="section-heading">
        <h3>Shipment decisions</h3>
        <button
          className="quiet"
          disabled={busy}
          onClick={() => void perform(refresh)}
        >
          Refresh decisions
        </button>
      </div>
      {!items.length && <p>No decisions for this shipment.</p>}
      <ul className="decision-list">
        {items.map((d) => (
          <li key={String(d.id)}>
            <button
              className="quiet"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await openDecision(d);
                })
              }
            >
              {human(d.status)} /{" "}
              {new Date(String(d.created_at)).toLocaleString()}
            </button>
            <p>{String(d.justification)}</p>
          </li>
        ))}
      </ul>
      {detail && (
        <div
          className="review-detail"
          key={String(detail.id) + String(detail.revision)}
        >
          <h3>{human(detail.status)} decision</h3>
          <p>{String(detail.justification)}</p>
          <p>
            Revision {String(detail.revision)}.{" "}
            {detail.snapshot_sha256
              ? "Evidence snapshot is frozen."
              : "Evidence will be frozen when submitted."}
          </p>
          {draftEvidence && (
            <details open>
              <summary>Source evidence for this draft (not yet frozen)</summary>
              <EvidenceView value={draftEvidence} />
            </details>
          )}
          {snapshot && (
            <>
              <h4>Pinned evidence</h4>
              <EvidenceView
                value={{
                  shipment: (snapshot.shipment as Item)?.reference,
                  scenario: human(scenario?.type),
                  dataset_version: (snapshot.dataset as Item)?.version,
                  policy: (snapshot.policy as Item)?.policy_key,
                  policy_version: (snapshot.policy as Item)?.version,
                }}
              />
              {["analysis", "scenario", "policy"].map((key) => (
                <details key={key}>
                  <summary>{human(key)} evidence</summary>
                  <EvidenceView value={snapshot[key]} />
                </details>
              ))}
            </>
          )}
          {((detail.status === "DRAFT" && detail.submitted_by === user) ||
            (detail.status === "PENDING_QA" && roles.includes("QA"))) && (
            <form onSubmit={review}>
              {detail.status === "DRAFT" ? (
                <p>
                  Submitting freezes the source evidence for independent QA
                  review.
                </p>
              ) : (
                <label>
                  Review outcome
                  <select
                    value={reviewAction}
                    onChange={(e) => setReviewAction(e.target.value)}
                  >
                    <option value="request-changes">Request changes</option>
                    <option value="reject">Reject proposal</option>
                    <option value="approve">Approve internal workflow</option>
                  </select>
                </label>
              )}
              <label>
                {detail.status === "DRAFT"
                  ? "Submission justification"
                  : "Review notes"}
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
                    Supporting reference document (maximum 10 MB)
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
                      ? "I confirm the required hold in controlled storage."
                      : "I have reviewed the pinned evidence."}
                  </label>
                </>
              )}
              <label className="check-label">
                <input type="checkbox" required />I have reviewed the evidence
                and understand this action.
              </label>
              <button disabled={busy}>
                {detail.status === "DRAFT"
                  ? "Submit to QA"
                  : "Confirm review outcome"}
              </button>
            </form>
          )}
          {Boolean(detail.review_notes) && (
            <>
              <h4>Reviewer notes</h4>
              <p>{String(detail.review_notes)}</p>
              <EvidenceView value={detail.review_evidence} />
            </>
          )}
          {Boolean(detail.snapshot_sha256) && (
            <>
              <h4>Frozen report</h4>
              <button
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    const r = await api(
                      `/decisions/${detail.id}/reports`,
                      org,
                      write("POST", { format: "PDF", language: "en" }),
                    );
                    setReport(r.report);
                    setMessage(
                      "Report requested. Refresh its status to check completion.",
                    );
                  })
                }
              >
                Generate PDF report
              </button>
              {report && (
                <>
                  <p>Report: {human(report.status)}</p>
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
                    Refresh report status
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
                      Download PDF
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
      {detail && (
        <details>
          <summary>Optional grounded explanation</summary>
          <p>Explains the selected run without changing eligibility.</p>
          <button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                await api(
                  `/simulations/${detail.simulation_run_id}/explanations`,
                  org,
                  write("POST", {}),
                );
                setMessage("Explanation requested. Refresh to check progress.");
              })
            }
          >
            Generate explanation
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
            Refresh explanation
          </button>
          {explanation && <EvidenceView value={explanation} />}
        </details>
      )}
    </section>
  );
}
