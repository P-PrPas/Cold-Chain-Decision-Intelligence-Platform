"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import "../../../studio/studio.css";
import "../../workspace.css";
import DecisionPanel, {
  type DecisionView,
  type ProposalSource,
} from "@/app/workspace/decision-panel";
import SimulationPanel, {
  type SimStatus,
} from "@/app/workspace/simulation-panel";
import AnalysisPanel from "@/app/workspace/analysis-panel";
import TemperaturePanel from "@/app/workspace/temperature-panel";
import EvidenceTimeline from "@/app/workspace/evidence-timeline";
import Stepper from "@/app/workspace/step-nav";
import {
  deriveSteps,
  initialStep,
  type StepId,
  type StepInput,
} from "@/app/workspace/stepper";
import { api, write, ApiError, type Item } from "@/app/workspace/api";
import { money } from "@/components/decision-summary";
import { useI18n } from "@/i18n/provider";
import {
  Callout,
  OpStatusBadge,
  Skeleton,
  useErrorText,
  useFmt,
  useStatusLabel,
} from "@/app/workspace/ui";

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["READY", "CANCELLED"],
  READY: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["CLOSED"],
};
const OP_KEY = {
  DRAFT: "wsOpDraft",
  READY: "wsOpReady",
  IN_TRANSIT: "wsOpTransit",
  ARRIVED: "wsOpArrived",
  CLOSED: "wsOpClosed",
  CANCELLED: "wsOpCancelled",
} as const;

export default function ShipmentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const errText = useErrorText();
  const fmt = useFmt();
  const statusLabel = useStatusLabel();
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
  const [error, setError] = useState<unknown>(null);
  const [org, setOrg] = useState("");
  const [productName, setProductName] = useState("");
  const [roles, setRoles] = useState<string[] | null>(null);
  const [datasets, setDatasets] = useState<Item[] | null>(null);
  const [policies, setPolicies] = useState<Item[] | null>(null);
  const [decisions, setDecisions] = useState<Item[] | null>(null);
  const [analysisData, setAnalysisData] = useState<Item | null>(null);
  const [readings, setReadings] = useState<Item[]>([]);
  const [sim, setSim] = useState<SimStatus>({ run: "", eligibility: null });
  const [selectedStep, setSelectedStep] = useState<StepId | null>(null);
  const [firstStep, setFirstStep] = useState<StepId | null>(null);
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
        setWorkflowError(`${t("wsHistoryRefreshFailed")} ${errText(e)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      .catch((e) => setError(e));
    api("/auth/me")
      .then((me) =>
        setRoles(
          me.memberships.find((m: Item) => m.organization_id === selected)
            ?.roles || [],
        ),
      )
      .catch(() => setRoles([]));
  }, [id]);
  const productId = item ? String(item.product_id) : "";
  useEffect(() => {
    if (!productId || !org) return;
    let active = true;
    api(`/products/${productId}`, org)
      .then((d) => {
        if (active && d.product?.name) setProductName(String(d.product.name));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [productId, org]);
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
        if (active) setWorkflowError(errText(e));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // Pull the selected analysis once so the stepper and timeline can state what it reports.
  useEffect(() => {
    if (!completedAnalysis || !org) return;
    let active = true;
    api(`/analyses/${completedAnalysis}`, org)
      .then((d) => {
        if (active) setAnalysisData(d.analysis ?? null);
      })
      .catch(() => {
        if (active) setAnalysisData(null);
      });
    return () => {
      active = false;
    };
  }, [completedAnalysis, org]);
  async function transition(status: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await api(
        `/shipments/${id}`,
        org,
        write("PATCH", { status }, `"shipment-r${item?.revision}"`),
      );
      setItem(data.shipment);
      setPendingStatus("");
      setNotice(t("wsStatusUpdated"));
      setCompletedAnalysis("");
      setProposal(null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const onPropose = useCallback((source: ProposalSource | null) => {
    setProposal(source);
    if (source) setSelectedStep("propose");
  }, []);
  useEffect(() => {
    if (proposal) document.getElementById("review")?.focus();
  }, [proposal]);

  const summary = (analysisData?.summary ?? {}) as Item;
  const hasAnalysis = !!completedAnalysis;
  const latestDecision = (decisions?.[0] ??
    (savedWorkflow?.decision as Item | null) ??
    null) as Item | null;
  const savedRunForAnalysis =
    hasAnalysis &&
    (savedWorkflow?.simulation as Item | null)?.analysis_id ===
      completedAnalysis;
  const input: StepInput = {
    hasReadyDataset: !!datasets?.some((d) => d.status === "READY"),
    hasApprovedPolicy: !!policies?.some((p) => p.status === "APPROVED"),
    hasAnalysis,
    analysisHasGaps:
      hasAnalysis &&
      (Number(summary.unknown_seconds) > 0 ||
        String(analysisData?.classification) === "INDETERMINATE"),
    hasSavedRun: hasAnalysis && (!!sim.run || savedRunForAnalysis),
    selectedEligibility: hasAnalysis ? sim.eligibility : null,
    hasProposal: !!proposal,
    decisionStatus: latestDecision ? String(latestDecision.status) : null,
    decisionFrozen: !!latestDecision?.snapshot_sha256,
  };
  const steps = deriveSteps(input);
  const gate =
    !!item &&
    roles !== null &&
    datasets !== null &&
    policies !== null &&
    decisions !== null &&
    (savedWorkflow !== null || !!workflowError);
  if (gate && firstStep === null)
    setFirstStep(initialStep(steps, roles, input.decisionStatus));
  const step: StepId = selectedStep ?? firstStep ?? "evidence";
  const ready = !!item && gate && firstStep !== null;
  const onDatasets = useCallback((items: Item[]) => setDatasets(items), []);
  const onPolicies = useCallback((items: Item[]) => setPolicies(items), []);
  const onDecisions = useCallback((items: Item[]) => setDecisions(items), []);
  const decisionView: DecisionView | null =
    step === "propose" || step === "qa" || step === "report" ? step : null;
  const status = error instanceof ApiError ? error.status : 0;
  const workflow = savedWorkflow ?? {};
  const latest = workflow.decision as Item | null | undefined;
  const simReason = steps.find((s) => s.id === "simulate")?.reason;

  return (
    <main className="studio ws ws-detail" id="content">
      <nav className="ws-crumb" aria-label={t("wsCrumb")}>
        <Link href="/workspace">{t("wsShipments")}</Link>
      </nav>
      <header className="studio-head">
        <div className="studio-id">
          <h1>
            <span className="num">
              {item ? String(item.reference) : t("wsShipment")}
            </span>
            {productName && (
              <span className="studio-product">{productName}</span>
            )}
          </h1>
          {item && (
            <p className="studio-route">
              <span>
                {t("studioRoute")}:{" "}
                {String((item.origin as Item)?.name || t("nodeOrigin"))} &rarr;{" "}
                {String((item.destination as Item)?.name || t("nodeReceiver"))}
              </span>
              <OpStatusBadge status={String(item.status)} />
              <span className="num">
                {money(
                  item.cargo_value,
                  item.currency,
                  String(item.cargo_value),
                )}
              </span>
              <span className="ws-dim">
                {t("wsRevision")} {String(item.revision)}
              </span>
            </p>
          )}
        </div>
        {item && (
          <div className="studio-actions">
            <details
              className="ws-menu"
              onKeyDown={(e) => {
                if (e.key !== "Escape" || !e.currentTarget.open) return;
                e.preventDefault();
                e.currentTarget.open = false;
                e.currentTarget.querySelector("summary")?.focus();
              }}
            >
              <summary>{t("wsChangeStatus")}</summary>
              <div className="ws-menu-body">
                <label>
                  <span>{t("wsNextState")}</span>
                  <select
                    value={pendingStatus}
                    disabled={busy}
                    onChange={(e) => setPendingStatus(e.target.value)}
                  >
                    <option value="">{t("wsSelectTransition")}</option>
                    {TRANSITIONS[String(item.status)]?.map((s) => (
                      <option key={s} value={s}>
                        {t(OP_KEY[s as keyof typeof OP_KEY])}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="ws-note">{t("wsOpNotQa")}</p>
                {pendingStatus && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void transition(pendingStatus);
                    }}
                  >
                    <p>
                      {t("wsChangeFrom")}{" "}
                      <strong>
                        {t(OP_KEY[String(item.status) as keyof typeof OP_KEY])}
                      </strong>{" "}
                      {t("wsChangeTo")}{" "}
                      <strong>
                        {t(OP_KEY[pendingStatus as keyof typeof OP_KEY])}
                      </strong>
                      ?
                    </p>
                    <label className="check-label">
                      <input type="checkbox" required />
                      {t("wsConfirmOpChange")}
                      {pendingStatus === "CANCELLED"
                        ? ` ${t("wsAndCancel")}`
                        : ""}
                      .
                    </label>
                    <button disabled={busy}>{t("wsConfirmStatus")}</button>
                  </form>
                )}
              </div>
            </details>
          </div>
        )}
      </header>
      {notice && <p role="status">{notice}</p>}
      {error !== null && (
        <div role="alert" className="ws-alert">
          <span>
            {status === 401
              ? t("wsDetailSignIn")
              : status === 403
                ? t("wsDeniedBody")
                : status === 404
                  ? t("wsDetailNotFound")
                  : `${errText(error)} ${t("wsReloadForRevision")}`}
          </span>
          {status === 401 ? (
            <Link href="/workspace" className="button">
              {t("wsSignIn")}
            </Link>
          ) : (
            <button className="quiet" onClick={() => window.location.reload()}>
              {t("wsReload")}
            </button>
          )}
        </div>
      )}
      {!item && error === null && (
        <div role="status" aria-live="polite">
          <p className="ws-dim">{t("wsLoading")}</p>
          <Skeleton rows={3} />
        </div>
      )}
      {item && (
        <>
          <Stepper
            steps={steps}
            selected={step}
            onSelect={(s) => setSelectedStep(s)}
          />
          <section
            className="saved-workflow ws-saved"
            aria-label={t("wsSavedWorkflow")}
          >
            <div className="ws-saved-head">
              <h2>{t("wsSavedWorkflow")}</h2>
              <div className="ws-actions">
                <button
                  type="button"
                  className="quiet"
                  onClick={() => void refreshWorkflow()}
                >
                  {t("wsRefreshHistory")}
                </button>
                {savedWorkflow && (
                  <button
                    className="quiet"
                    onClick={() => {
                      selectAnalysis("");
                      setInitialRun("");
                    }}
                  >
                    {t("wsNewCycle")}
                  </button>
                )}
              </div>
            </div>
            {workflowError ? (
              <p role="alert" className="ws-alert">
                {t("wsCannotLoadHistory")} {workflowError}
              </p>
            ) : !savedWorkflow ? (
              <p role="status" className="ws-dim">
                {t("wsLoadingWorkflow")}
              </p>
            ) : (
              <>
                <p>
                  {t("wsLatestDecision")}:{" "}
                  <strong>
                    {latest ? statusLabel(latest.status) : t("wsNoneRecorded")}
                  </strong>
                  {latest ? (
                    <>
                      {" "}
                      <code>{String(latest.status)}</code>
                    </>
                  ) : null}
                  .{" "}
                  {workflow.approved_decision
                    ? t("wsApprovedRemains")
                    : t("wsNoApprovedDecision")}
                </p>
                <p>
                  {t("wsCompletedAnalysis")}:{" "}
                  <span className="num">
                    {(workflow.analysis as Item)?.created_at
                      ? fmt.stamp((workflow.analysis as Item).created_at)
                      : t("wsNone")}
                  </span>
                  . {t("wsCompletedSimulation")}:{" "}
                  <span className="num">
                    {(workflow.simulation as Item)?.created_at
                      ? fmt.stamp((workflow.simulation as Item).created_at)
                      : t("wsNone")}
                  </span>
                  .
                </p>
              </>
            )}
          </section>
          {!ready && (
            <div role="status" aria-live="polite">
              <p className="ws-dim">{t("wsLoading")}</p>
              <Skeleton rows={4} />
            </div>
          )}
          <div className="ws-steps" aria-busy={!ready}>
            <div id="evidence" hidden={!ready || step !== "evidence"}>
              <TemperaturePanel
                shipmentId={id}
                org={org}
                analysis={analysisData}
                onDatasets={onDatasets}
                onReadings={setReadings}
              />
            </div>
            <div id="analysis" hidden={!ready || step !== "policy"}>
              <AnalysisPanel
                shipmentId={id}
                productId={productId}
                onCompleted={analysisCompleted}
                onPolicies={onPolicies}
                selectedAnalysis={analysisData}
                org={org}
              />
            </div>
            <div id="simulation" hidden={!ready || step !== "simulate"}>
              {completedAnalysis ? (
                <SimulationPanel
                  key={`${org}:${id}:${completedAnalysis}`}
                  shipmentId={id}
                  org={org}
                  completedAnalysis={completedAnalysis}
                  initialRun={initialRun}
                  shipmentLabel={String(item.reference)}
                  origin={String(
                    (item.origin as Item)?.name || t("nodeOrigin"),
                  )}
                  destination={String(
                    (item.destination as Item)?.name || t("nodeReceiver"),
                  )}
                  onSaved={refreshWorkflow}
                  onPropose={onPropose}
                  onStatus={setSim}
                  timeline={
                    <EvidenceTimeline rows={readings} analysis={analysisData} />
                  }
                />
              ) : (
                <Callout tone="block" title={t("wsStepBlockedTitle")}>
                  {simReason ? t(simReason) : t("wsBlockNoAnalysis")}
                </Callout>
              )}
            </div>
            <div
              id="review"
              tabIndex={-1}
              aria-label={t("wsReviewRegion")}
              hidden={!ready || !decisionView}
            >
              <DecisionPanel
                key={`${org}:${id}`}
                org={org}
                shipmentId={id}
                proposal={proposal}
                view={decisionView ?? "propose"}
                onSaved={refreshWorkflow}
                onDecisions={onDecisions}
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
