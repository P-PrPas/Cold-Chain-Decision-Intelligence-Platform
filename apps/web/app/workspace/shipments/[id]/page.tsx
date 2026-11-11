"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import DecisionPanel, { type ProposalSource } from "../../decision-panel";
import SimulationPanel from "../../simulation-panel";
import AnalysisPanel from "../../analysis-panel";
import TemperaturePanel from "../../temperature-panel";
import { api, write, type Item } from "../../api";
export default function ShipmentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [ready, setReady] = useState(false);
  const [proposal, setProposal] = useState<ProposalSource | null>(null);
  const [pendingStatus, setPendingStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [completedAnalysis, setCompletedAnalysis] = useState("");
  const [initialRun, setInitialRun] = useState("");
  const selectionVersion = useRef(0);
  const selectAnalysis = useCallback((analysis: string) => {
    selectionVersion.current++;
    setCompletedAnalysis(analysis);
    setProposal(null);
    setInitialRun("");
  }, []);
  const [savedWorkflow, setSavedWorkflow] = useState<Item | null>(null);
  const [workflowError, setWorkflowError] = useState("");
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [org, setOrg] = useState("");
  const historyRequest = useRef(0);
  const refreshWorkflow = useCallback(async () => {
    const request = ++historyRequest.current;
    const organization =
      new URLSearchParams(window.location.search).get("org") || "";
    try {
      const data = await api(`/shipments/${id}/workflow`, organization);
      if (request === historyRequest.current) {
        setSavedWorkflow(data);
        setWorkflowError("");
      }
    } catch (e) {
      if (request === historyRequest.current)
        setWorkflowError(
          `Saved history could not refresh. Retry history. ${String(e)}`,
        );
    }
  }, [id]);
  const analysisCompleted = useCallback(
    (analysis: string) => {
      selectAnalysis(analysis);
      if (analysis) void refreshWorkflow();
    },
    [selectAnalysis, refreshWorkflow],
  );
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const selected =
      new URLSearchParams(window.location.search).get("org") || "";
    api(`/shipments/${id}`, selected)
      .then((data) => {
        setOrg(selected);
        setItem(data.shipment);
      })
      .catch((e) => setError(String(e)));
  }, [id]);
  useEffect(() => {
    let active = true;
    const organization =
      new URLSearchParams(window.location.search).get("org") || "";
    const version = selectionVersion.current;
    const request = ++historyRequest.current;
    api(`/shipments/${id}/workflow`, organization)
      .then((data) => {
        if (!active || request !== historyRequest.current) return;
        setSavedWorkflow(data);
        const a = data.analysis;
        const run = data.simulation;
        if (a && version === selectionVersion.current) {
          setCompletedAnalysis(String(a.id));
          if (run?.analysis_id === a.id) setInitialRun(String(run.id));
        }
      })
      .catch((e) => {
        if (active) setWorkflowError(String(e));
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function transition(status: string) {
    setBusy(true);
    setError("");
    try {
      const data = await api(
        `/shipments/${id}`,
        org,
        write("PATCH", { status }, `"shipment-r${item?.revision}"`),
      );
      setItem(data.shipment);
      setPendingStatus("");
      setNotice("Operational status updated.");
      setCompletedAnalysis("");
      setProposal(null);
    } catch (e) {
      setError(String(e) + ". Reload to obtain current revision.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="content">
      <a href="/workspace">Shipments</a>
      <h1>{item ? String(item.reference) : "Shipment"}</h1>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => window.location.reload()}>Reload</button>
        </p>
      )}
      {!item && !error && <p role="status">Loading...</p>}
      {item && (
        <>
          <p>
            Status: {String(item.status)} / revision {String(item.revision)}
          </p>
          <p>
            {String(item.cargo_value)} {String(item.currency)}
          </p>
          <details>
            <summary>Change operational status</summary>
            <label>
              Next operational state
              <select
                value={pendingStatus}
                disabled={busy}
                onChange={(e) => setPendingStatus(e.target.value)}
              >
                <option value="">Select transition</option>
                {(
                  {
                    DRAFT: ["READY", "CANCELLED"],
                    READY: ["IN_TRANSIT", "CANCELLED"],
                    IN_TRANSIT: ["ARRIVED", "CANCELLED"],
                    ARRIVED: ["CLOSED"],
                  } as Record<string, string[]>
                )[String(item.status)]?.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <p>Operational state never implies QA approval.</p>
            {pendingStatus && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void transition(pendingStatus);
                }}
              >
                <p>
                  Change from {String(item.status)} to {pendingStatus}?
                </p>
                <label className="check-label">
                  <input type="checkbox" required />I confirm this operational
                  change
                  {pendingStatus === "CANCELLED"
                    ? " and cancellation of this shipment"
                    : ""}
                  .
                </label>
                <button disabled={busy}>Confirm status change</button>
              </form>
            )}
          </details>
          <section className="saved-workflow">
            <h2>Saved workflow</h2>
            <button
              type="button"
              className="quiet"
              onClick={() => void refreshWorkflow()}
            >
              Refresh saved history
            </button>
            {workflowError ? (
              <p role="alert">
                Cannot load saved history. Reload this page to retry.{" "}
                {workflowError}
              </p>
            ) : !savedWorkflow ? (
              <p role="status">Loading saved workflow...</p>
            ) : (
              <>
                <p>
                  Latest decision:{" "}
                  <strong>
                    {String(
                      (savedWorkflow.decision as Item)?.status ||
                        "None recorded",
                    )}
                  </strong>
                  .{" "}
                  {savedWorkflow.approved_decision
                    ? "An approved decision remains in history. Starting a new analysis does not replace that approval."
                    : "No current approved decision recorded."}
                </p>
                <p>
                  Completed analysis:{" "}
                  {(savedWorkflow.analysis as Item)?.created_at
                    ? new Date(
                        String((savedWorkflow.analysis as Item).created_at),
                      ).toLocaleString("en-GB", {
                        timeZone: "UTC",
                        timeZoneName: "short",
                      })
                    : "None"}
                  . Completed simulation:{" "}
                  {(savedWorkflow.simulation as Item)?.created_at
                    ? new Date(
                        String((savedWorkflow.simulation as Item).created_at),
                      ).toLocaleString("en-GB", {
                        timeZone: "UTC",
                        timeZoneName: "short",
                      })
                    : "None"}
                  .
                </p>
                <button
                  className="quiet"
                  onClick={() => {
                    selectAnalysis("");
                    setInitialRun("");
                  }}
                >
                  Start a new analysis cycle
                </button>
              </>
            )}
          </section>
          <div className="next-action">
            <strong>Next step</strong>
            <p>
              {!ready
                ? "Upload and validate temperature data to enable analysis."
                : !completedAnalysis
                  ? "Select a ready dataset and an approved policy, then analyze the evidence."
                  : !proposal
                    ? "Compare scenario eligibility, cost and delay before preparing a proposal."
                    : "Review your selected proposal before submitting it to QA."}
            </p>
          </div>
          <nav className="step-nav" aria-label="Shipment workflow">
            <a href="#evidence">01 Evidence</a>
            <a href="#analysis">
              02 Analysis /{" "}
              {completedAnalysis ? "Completed" : ready ? "Ready" : "Needs data"}
            </a>
            <a href="#simulation">
              03 Simulation / {completedAnalysis ? "Ready" : "Needs analysis"}
            </a>
            <a href="#review">04 QA & reports</a>
          </nav>
          <div id="evidence">
            <details open={!ready}>
              <summary>
                Temperature evidence /{" "}
                {ready ? "Ready dataset available" : "Upload required"}
              </summary>
              <TemperaturePanel shipmentId={id} org={org} onReady={setReady} />
            </details>
          </div>
          <div id="analysis">
            {ready ? (
              <details open={!completedAnalysis}>
                <summary>
                  Analysis /{" "}
                  {completedAnalysis
                    ? "Selected completed result"
                    : "Select evidence"}
                </summary>
                <AnalysisPanel
                  shipmentId={id}
                  productId={String(item.product_id)}
                  onCompleted={analysisCompleted}
                  org={org}
                />
              </details>
            ) : (
              <p>Add a ready temperature dataset before analysis.</p>
            )}
          </div>
          <div id="simulation">
            {completedAnalysis ? (
              <SimulationPanel
                key={`${org}:${id}:${completedAnalysis}`}
                shipmentId={id}
                org={org}
                completedAnalysis={completedAnalysis}
                initialRun={initialRun}
                shipmentLabel={String(item.reference)}
                origin={String((item.origin as Item)?.name || "Origin")}
                destination={String(
                  (item.destination as Item)?.name || "Original receiver",
                )}
                onSaved={refreshWorkflow}
                onPropose={setProposal}
              />
            ) : (
              <p>Complete an analysis to unlock scenario comparison.</p>
            )}
          </div>
          <div id="review" tabIndex={-1} aria-label="Proposal and QA review">
            <DecisionPanel
              key={`${org}:${id}`}
              org={org}
              shipmentId={id}
              proposal={proposal}
              onSaved={refreshWorkflow}
            />
          </div>
        </>
      )}
    </main>
  );
}
