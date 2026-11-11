"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, write, downloadReport, type Item } from "./api";
export default function DecisionPanel({ org }: { org: string }) {
  const [report, setReport] = useState<Item | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Item | null>(null);
  const [explanation, setExplanation] = useState<Item | null>(null);
  async function refresh() {
    setItems((await api("/decisions", org)).items);
  }
  useEffect(() => {
    Promise.all([api("/decisions", org), api("/auth/me")])
      .then(([d, me]) => {
        setItems(d.items);
        setRoles(
          me.memberships.find((m: Item) => m.organization_id === org)?.roles ||
            [],
        );
      })
      .catch((e) => setError(String(e)));
  }, [org]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api(
        "/decisions",
        org,
        write("POST", {
          simulation_run_id: form.get("run"),
          selected_scenario_id: form.get("scenario"),
          justification: form.get("justification"),
        }),
      );
      setDetail(result.decision);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function action(item: Item, action: string) {
    const note = window.prompt("Justification / review notes");
    if (!note) return;
    let payload: Item = { justification: note };
    if (action !== "submit") {
      payload = {
        acting_role: "QA",
        review_notes: note,
        evidence_references: [],
        acknowledged_required_actions: [],
      };
      if (action === "approve") {
        const reference = window.prompt("Stored reference document ID");
        if (!reference) return;
        payload.evidence_references = ["reference:" + reference];
        payload.acknowledged_required_actions = [
          "HOLD_IN_CONTROLLED_STORAGE",
          "REVIEW_PINNED_EVIDENCE",
        ];
      }
    }
    setBusy(true);
    try {
      const result = await api(
        `/decisions/${item.id}/${action}`,
        org,
        write("POST", payload, `"decision-r${item.revision}"`),
      );
      setDetail(result.decision);
      await refresh();
    } catch (e) {
      setError(
        String(e) + " ? if revision is stale, refresh and review again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Decision proposals and QA inbox</h2>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Saving?</p>}
      <form onSubmit={create}>
        <label>
          Completed simulation ID
          <input name="run" required />
        </label>
        <label>
          Eligible or review-required scenario ID
          <input name="scenario" required />
        </label>
        <label>
          Justification
          <textarea name="justification" required />
        </label>
        <button disabled={busy}>Create draft proposal</button>
      </form>
      <button onClick={() => refresh().catch((e) => setError(String(e)))}>
        Refresh inbox
      </button>
      {items.length === 0 && <p>No decisions yet.</p>}
      <ul>
        {items.map((item) => (
          <li key={String(item.id)}>
            <button onClick={() => setDetail(item)}>{String(item.id)}</button> ?{" "}
            {String(item.status)}
            {item.status === "DRAFT" && (
              <button
                disabled={busy}
                onClick={() => void action(item, "submit")}
              >
                Submit to QA
              </button>
            )}
            {item.status === "PENDING_QA" && roles.includes("QA") && (
              <>
                <button
                  disabled={busy}
                  onClick={() => void action(item, "approve")}
                >
                  Approve internal workflow
                </button>
                <button
                  disabled={busy}
                  onClick={() => void action(item, "reject")}
                >
                  Reject
                </button>
                <button
                  disabled={busy}
                  onClick={() => void action(item, "request-changes")}
                >
                  Request changes
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {detail && (
        <details open>
          <summary>Decision evidence and history</summary>
          <p>
            Snapshot hash: {String(detail.snapshot_sha256 || "Not submitted")}
          </p>
          <pre>{JSON.stringify(detail, null, 2)}</pre>
        </details>
      )}
      {detail?.snapshot_sha256 ? (
        <section>
          <h3>Frozen PDF report</h3>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await api(
                  `/decisions/${detail.id}/reports`,
                  org,
                  write("POST", { format: "PDF", language: "en" }),
                );
                setReport(result.report);
              } catch (e) {
                setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Generate report from selected decision
          </button>
          {report && (
            <>
              <p>Report: {String(report.status)}</p>
              <button
                onClick={async () => {
                  try {
                    setReport((await api(`/reports/${report.id}`, org)).report);
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                Refresh report status
              </button>
              {report.status === "COMPLETED" && (
                <button
                  onClick={() =>
                    downloadReport(String(report.id), org).catch((e) =>
                      setError(String(e)),
                    )
                  }
                >
                  Download private PDF
                </button>
              )}
            </>
          )}
        </section>
      ) : null}
      <h3>Grounded explanation (optional)</h3>
      <p>Explanation never changes scenario eligibility or QA disposition.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          try {
            await api(
              `/simulations/${form.get("run")}/explanations`,
              org,
              write("POST", {}),
            );
            setExplanation({
              status: "QUEUED",
              simulation_run_id: form.get("run"),
            });
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        <label>
          Simulation ID
          <input name="run" required />
        </label>
        <button>Generate grounded explanation</button>
      </form>
      {explanation && (
        <>
          <button
            onClick={async () => {
              try {
                setExplanation(
                  (
                    await api(
                      `/simulations/${explanation.simulation_run_id}/explanations/latest`,
                      org,
                    )
                  ).explanation,
                );
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            Refresh explanation
          </button>
          <pre>{JSON.stringify(explanation, null, 2)}</pre>
        </>
      )}
      <p>
        Approval records an internal QA workflow only. It does not release goods
        or certify safety.
      </p>
    </section>
  );
}
