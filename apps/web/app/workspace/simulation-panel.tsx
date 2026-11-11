"use client";
import { useEffect, useRef, useState } from "react";
import { EvidenceView } from "../evidence-view";
import { api, write, type Item } from "./api";
import Scene, { scenarioNames } from "../scene";
import FactorControls from "../factor-controls";
import {
  type Assumptions,
  freshAssumptions,
  totalCost,
  sameAssumptions,
  draftErrors,
} from "../simulation-assumptions";

type Result = {
  key: string;
  items: Item[];
  kind: "saved" | "preview";
  run: string;
};
export default function SimulationPanel({
  shipmentId,
  org,
  completedAnalysis,
  initialRun,
  shipmentLabel,
  origin,
  destination,
  onPropose,
  onSaved,
}: {
  shipmentId: string;
  org: string;
  completedAnalysis?: string;
  initialRun?: string;
  shipmentLabel?: string;
  origin?: string;
  destination?: string;
  onPropose: (source: { run: string; scenario: Item } | null) => void;
  onSaved?: () => void;
}) {
  const savedResult = useRef<Result | null>(null);
  const [draft, setDraft] = useState<Assumptions | null>(null);
  const [baseline, setBaseline] = useState<Assumptions | null>(null);
  const [baselineRun, setBaselineRun] = useState("");
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [previewStatus, setPreviewStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const epoch = useRef(0),
    locked = useRef(false);
  const key = draft ? JSON.stringify(draft) : "";
  const valid = !!draft && Object.keys(draftErrors(draft)).length === 0;
  const current = valid && result?.key === key ? result : null;
  const selectedDraft = draft?.scenarios.find((s) => s.type === selected);
  const selectedResult = current?.items.find((s) => s.type === selected);
  useEffect(() => {
    let active = true;
    const operationEpoch = epoch;
    async function restore() {
      try {
        if (initialRun) {
          const [r, s] = await Promise.all([
            api(`/simulations/${initialRun}`, org),
            api(`/simulations/${initialRun}/scenarios`, org),
          ]);
          if (!active) return;
          if (r.simulation.analysis_id !== completedAnalysis)
            throw new Error(
              "Saved run belongs to another analysis. Select the source analysis again.",
            );
          const parameters = r.simulation.parameters as Assumptions;
          if (
            !parameters?.scenarios?.length ||
            !parameters.ranking_weights ||
            !s.items.length
          )
            throw new Error(
              "Saved run assumptions or results are unavailable. Reload or start a new analysis cycle; no defaults have been substituted.",
            );
          const first = s.items.find((item: Item) =>
            parameters.scenarios.some((v) => v.type === item.type),
          );
          if (!first)
            throw new Error("Saved scenarios do not match their assumptions.");
          setDraft(structuredClone(parameters));
          setBaseline(structuredClone(parameters));
          setBaselineRun(initialRun);
          setSelected(String(first.type));
          savedResult.current = {
            key: JSON.stringify(parameters),
            items: s.items,
            kind: "saved",
            run: initialRun,
          };
          setResult(savedResult.current);
        } else {
          const [a, s] = await Promise.all([
            api(`/analyses/${completedAnalysis}`, org),
            api(`/shipments/${shipmentId}`, org),
          ]);
          if (!active) return;
          const parameters = {
            ...freshAssumptions(),
            analysis_id: a.analysis.id,
            dataset_id: a.analysis.dataset_id,
            policy_version_id: a.analysis.policy_version_id,
            currency: s.shipment.currency,
          };
          setDraft(parameters);
          setBaseline(structuredClone(parameters));
          setSelected(parameters.scenario_types[0]);
        }
      } catch (e) {
        if (active) setError(String(e));
      } finally {
        if (active) setLoading(false);
      }
    }
    void restore();
    return () => {
      active = false;
      operationEpoch.current++;
    };
  }, [initialRun, completedAnalysis, shipmentId, org]);
  useEffect(() => {
    if (!valid || !key || savedResult.current?.key === key || saving) return;
    const payload: Assumptions = JSON.parse(key);
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewStatus("Calculating preview...");
      try {
        const data = await api(
          `/shipments/${shipmentId}/simulation-preview`,
          org,
          { ...write("POST", payload), signal: controller.signal },
        );
        if (!active) return;
        if (
          !Array.isArray(data.items) ||
          !data.items.length ||
          data.analysis_id !== payload.analysis_id
        ) {
          throw new Error(
            "The preview response did not contain results for this analysis.",
          );
        }
        setResult({ key, items: data.items, kind: "preview", run: "" });
        setPreviewStatus("");
      } catch (e) {
        if (active)
          setPreviewStatus(
            `Preview unavailable. Your assumptions are retained. Retry calculation. ${String(e)}`,
          );
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, retry, org, shipmentId, saving, valid]);
  function change(value: Assumptions) {
    setDraft(value);
    if (savedResult.current?.key === JSON.stringify(value))
      setResult(savedResult.current);
    setPreviewStatus("Draft changed; waiting to calculate preview...");
    setError("");
    onPropose(null);
  }
  function chooseScenario(type: string) {
    setSelected(type);
    onPropose(null);
  }
  async function save() {
    if (!draft || !valid || locked.current) return;
    locked.current = true;
    setSaving(true);
    setError("");
    onPropose(null);
    const version = epoch.current,
      payload = structuredClone(draft),
      sourceKey = JSON.stringify(draft);
    try {
      const r = await api(
        baselineRun
          ? `/simulations/${baselineRun}/recalculate`
          : `/shipments/${shipmentId}/simulations`,
        org,
        write("POST", payload),
      );
      const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (version !== epoch.current) return;
        const j = await api(`/jobs/${r.job.id}`, org);
        if (j.job.status === "FAILED")
          throw new Error(
            "Simulation failed. Check source evidence and retry.",
          );
        if (j.job.status === "COMPLETED") {
          const s = await api(`/simulations/${r.simulation.id}/scenarios`, org);
          if (version !== epoch.current) return;
          savedResult.current = {
            key: sourceKey,
            items: s.items,
            kind: "saved",
            run: r.simulation.id,
          };
          setResult(savedResult.current);
          setBaseline(structuredClone(payload));
          setBaselineRun(r.simulation.id);
          setSelected((previous) =>
            s.items.some((v: Item) => v.type === previous)
              ? previous
              : String(s.items[0]?.type || ""),
          );
          setPreviewStatus("");
          onSaved?.();
          return;
        }
      }
      throw new Error(
        "Calculation is taking longer than expected. Reload saved workflow to check its status before starting another run.",
      );
    } catch (e) {
      if (version === epoch.current) setError(String(e));
    } finally {
      if (version === epoch.current) {
        locked.current = false;
        setSaving(false);
      }
    }
  }
  if (loading) return <p role="status">Loading simulation assumptions...</p>;
  if (!draft || !baseline)
    return <p role="alert">{error || "No simulation source available."}</p>;
  return (
    <section className="simulation-workbench">
      <div className="section-heading">
        <h2>Explore operational alternatives</h2>
        <span className="badge">
          {saving
            ? "Saving calculation"
            : current?.kind === "saved"
              ? "Saved engine result"
              : current
                ? "Calculated preview / not saved"
                : "Draft / result not current"}
        </span>
      </div>
      <p className="context-label">
        {shipmentLabel || shipmentId} /{" "}
        {baselineRun
          ? `Baseline run ${baselineRun.slice(0, 8)}`
          : "New scenario baseline: zero estimates, unknown acceptance"}
        .{" "}
        {sameAssumptions(draft, baseline)
          ? "Baseline unchanged."
          : "Assumptions modified."}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="scenario-strip" role="group" aria-label="Select scenario">
        {draft.scenarios.map((s) => (
          <button
            key={s.type}
            type="button"
            aria-pressed={s.type === selected}
            onClick={() => chooseScenario(s.type)}
          >
            {scenarioNames[s.type]}
          </button>
        ))}
      </div>
      <div className="studio-grid">
        <Scene
          scenario={selected}
          origin={origin}
          destination={destination}
          context={
            current?.kind === "saved" && selectedResult
              ? `${shipmentLabel || shipmentId} / Run ${current.run.slice(0, 8)}`
              : `${shipmentLabel || shipmentId} / Draft preview (not saved)`
          }
          baselineCost={totalCost(
            baseline.scenarios.find((s) => s.type === selected),
          )}
          baselineDelay={String(
            baseline.scenarios.find((s) => s.type === selected)
              ?.estimated_delay_minutes ?? 0,
          )}
          cost={totalCost(selectedDraft, draft.currency)}
          delay={String(selectedDraft?.estimated_delay_minutes ?? 0)}
          currency={draft.currency}
          acceptance={selectedDraft?.receiver_acceptance}
          eligibility={String(
            selectedResult?.eligibility || "Awaiting calculation",
          )}
          missing={(
            selectedResult?.missing_information as string[] | undefined
          )?.join(", ")}
          compact
        />
        <div className="studio-inspector">
          <FactorControls
            value={draft}
            baseline={baseline}
            selected={selected}
            onChange={change}
            disabled={saving}
            baselineLabel={
              baselineRun
                ? `saved run ${baselineRun.slice(0, 8)}`
                : "new scenario defaults"
            }
          />
          <p role="status">
            {!valid
              ? "Fix the highlighted assumptions before calculating or saving."
              : saving
                ? "Simulation processing..."
                : current
                  ? current.kind === "saved"
                    ? "Saved result matches these assumptions."
                    : "Engine preview matches these assumptions. Save a run before preparing a proposal."
                  : previewStatus || "Waiting to calculate preview..."}
          </p>
          {!current && !saving && valid && (
            <button type="button" onClick={() => setRetry((v) => v + 1)}>
              Retry preview
            </button>
          )}
          <button
            type="button"
            disabled={saving || !valid}
            onClick={() => void save()}
          >
            {baselineRun ? "Recalculate as a new run" : "Run simulation"}
          </button>
          {current?.kind === "saved" &&
            selectedResult &&
            ["ELIGIBLE", "REVIEW_REQUIRED"].includes(
              String(selectedResult.eligibility),
            ) && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  onPropose({ run: current.run, scenario: selectedResult });
                  document.getElementById("review")?.focus();
                  document.getElementById("review")?.scrollIntoView();
                }}
              >
                Prepare proposal
              </button>
            )}
        </div>
      </div>
      <details>
        <summary>Compare calculated alternatives</summary>
        {!current ? (
          <p>
            Results for the previous assumptions are hidden until the current
            calculation succeeds.
          </p>
        ) : (
          <table>
            <caption>
              {current.kind === "saved" ? "Saved" : "Unsaved preview"} scenario
              comparison
            </caption>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Cost</th>
                <th>Delay</th>
                <th>Eligibility</th>
                <th>Ranking score</th>
              </tr>
            </thead>
            <tbody>
              {current.items.map((s) => (
                <tr key={String(s.type)} data-selected={s.type === selected}>
                  <td>
                    <button
                      type="button"
                      aria-pressed={s.type === selected}
                      onClick={() => chooseScenario(String(s.type))}
                    >
                      {scenarioNames[String(s.type)]}
                    </button>
                  </td>
                  <td>
                    {String(s.direct_incremental_cost)} {draft.currency}
                  </td>
                  <td>{String(s.additional_delay_minutes)} min</td>
                  <td>{String(s.eligibility)}</td>
                  <td>
                    {s.ranking_score == null
                      ? "Excluded"
                      : String(s.ranking_score)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
      <details>
        <summary>Selected scenario evidence and traceability</summary>
        <p>
          Only the backend determines eligibility. Delay does not model
          temperature deterioration; ranking weights do not change evidence.
        </p>
        <EvidenceView
          value={selectedResult || { status: "Current result unavailable" }}
        />
        <h4>Baseline assumptions</h4>
        <EvidenceView value={baseline} />
      </details>
    </section>
  );
}
