"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EvidenceView } from "../evidence-view";
import { api, write, type Item } from "./api";
import Scene from "../scene";
import FactorControls from "../factor-controls";
import { ImpactBand } from "../impact-band";
import { useI18n } from "../i18n-provider";
import {
  acceptanceKey,
  acceptanceSymbol,
  normAcceptance,
  scenarioKey,
  scenarioShortKey,
} from "../studio/scenarios";
import { ProvenanceChip } from "../ui/provenance-chip";
import { StatusBadge, type Status } from "../ui/status-badge";
import {
  type Assumptions,
  costCategories,
  formatAmount,
  freshAssumptions,
  totalCost,
  sameAssumptions,
  draftErrors,
} from "../simulation-assumptions";
import { Callout, RuleList, sourceProvenance, useErrorText } from "./ui";

export type SimStatus = {
  /** Id of the saved run the assumptions started from or last saved, "" if none. */
  run: string;
  /** Engine eligibility of the selected scenario when a saved result matches the assumptions. */
  eligibility: string | null;
};
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
  onStatus,
  timeline,
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
  /** Reports the saved run and the engine eligibility of the selected scenario. */
  onStatus?: (status: SimStatus) => void;
  /** Evidence timeline shown under the stage, in the Studio timeline slot. */
  timeline?: ReactNode;
}) {
  const { t } = useI18n();
  const errText = useErrorText();
  const [sheet, setSheet] = useState(false);
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
            throw new Error(t("wsSimWrongAnalysis"));
          const parameters = r.simulation.parameters as Assumptions;
          if (
            !parameters?.scenarios?.length ||
            !parameters.ranking_weights ||
            !s.items.length
          )
            throw new Error(t("wsSimNoAssumptions"));
          const first = s.items.find((item: Item) =>
            parameters.scenarios.some((v) => v.type === item.type),
          );
          if (!first) throw new Error(t("wsSimMismatch"));
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
        if (active) setError(errText(e));
      } finally {
        if (active) setLoading(false);
      }
    }
    void restore();
    return () => {
      active = false;
      operationEpoch.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRun, completedAnalysis, shipmentId, org]);
  useEffect(() => {
    if (!valid || !key || savedResult.current?.key === key || saving) return;
    const payload: Assumptions = JSON.parse(key);
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewStatus(t("wsSimCalculating"));
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
          throw new Error(t("wsSimPreviewShape"));
        }
        setResult({ key, items: data.items, kind: "preview", run: "" });
        setPreviewStatus("");
      } catch (e) {
        if (active)
          setPreviewStatus(`${t("wsSimPreviewUnavailable")} ${errText(e)}`);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry, org, shipmentId, saving, valid]);
  const reportedRun = baselineRun;
  const reportedEligibility =
    current?.kind === "saved" && selectedResult
      ? String(selectedResult.eligibility)
      : null;
  useEffect(() => {
    onStatus?.({ run: reportedRun, eligibility: reportedEligibility });
  }, [reportedRun, reportedEligibility, onStatus]);
  function change(value: Assumptions) {
    setDraft(value);
    if (savedResult.current?.key === JSON.stringify(value))
      setResult(savedResult.current);
    setPreviewStatus(t("wsSimWaiting"));
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
        if (j.job.status === "FAILED") throw new Error(t("wsSimFailed"));
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
      throw new Error(t("wsSimSlow"));
    } catch (e) {
      if (version === epoch.current) setError(errText(e));
    } finally {
      if (version === epoch.current) {
        locked.current = false;
        setSaving(false);
      }
    }
  }
  if (loading)
    return (
      <p role="status" className="ws-busy">
        {t("wsSimLoading")}
      </p>
    );
  if (!draft || !baseline)
    return (
      <p role="alert" className="ws-alert">
        {error || t("wsSimNoSource")}
      </p>
    );
  const eligibility = String(selectedResult?.eligibility ?? "");
  const badgeOf = (value: string): Status =>
    (["ELIGIBLE", "REVIEW_REQUIRED", "BLOCKED", "INSUFFICIENT_DATA"].includes(
      value,
    )
      ? value
      : "NOT_EVALUATED") as Status;
  const origCost = totalCost(
    baseline.scenarios.find((s) => s.type === selected),
  );
  const cost = totalCost(selectedDraft, draft.currency);
  const delay = String(selectedDraft?.estimated_delay_minutes ?? 0);
  const costProv = [
    ...new Set(
      costCategories
        .map((c) => sourceProvenance(selectedDraft?.costs[c].source))
        .filter(Boolean),
    ),
  ] as ("estimated" | "entered")[];
  const acc = normAcceptance(selectedDraft?.receiver_acceptance);
  const canPropose =
    current?.kind === "saved" &&
    !!selectedResult &&
    ["ELIGIBLE", "REVIEW_REQUIRED"].includes(eligibility);
  const summaryLine = `${delay} ${t("unitMin")} · ${formatAmount(cost)} ${draft.currency}`;
  const saveState = saving
    ? t("wsSimSaving")
    : current?.kind === "saved"
      ? t("wsSimSavedResult")
      : current
        ? t("wsSimPreviewNotSaved")
        : t("wsSimDraftNotCurrent");
  return (
    <section
      className="simulation-workbench ws-sim"
      role="region"
      aria-label={t("wsSimExplorer")}
    >
      <div className="ws-sim-head">
        <div>
          <h2>{t("wsSimTitle")}</h2>
          <p className="context-label">
            {shipmentLabel || shipmentId} /{" "}
            {baselineRun
              ? `${t("wsSimBaselineRun")} ${baselineRun.slice(0, 8)}`
              : t("wsSimNewBaseline")}
            .{" "}
            {sameAssumptions(draft, baseline)
              ? t("wsSimUnchanged")
              : t("wsSimModified")}
          </p>
        </div>
        <span className="badge">{saveState}</span>
      </div>
      {error && (
        <p role="alert" className="ws-alert">
          {error}
        </p>
      )}
      <div className="studio-body ws-sim-body">
        <div className="rail" role="group" aria-label={t("scenarioGroup")}>
          <p className="rail-title">{t("railTitle")}</p>
          {draft.scenarios.map((s, i) => {
            const name = t(scenarioKey[s.type]);
            const r = current?.items.find((v) => v.type === s.type);
            return (
              <button
                key={s.type}
                type="button"
                className="rail-item"
                aria-pressed={s.type === selected}
                aria-label={name}
                onClick={() => chooseScenario(s.type)}
              >
                <kbd aria-hidden="true">{i + 1}</kbd>
                <span className="rail-name" aria-hidden="true">
                  <span className="full">{name}</span>
                  <span className="short">{t(scenarioShortKey[s.type])}</span>
                </span>
                <span className="rail-meta num" aria-hidden="true">
                  {s.estimated_delay_minutes} {t("unitMin")} &middot;{" "}
                  {formatAmount(totalCost(s, draft.currency))}
                </span>
                {r && (
                  <span className="rail-elig" aria-hidden="true">
                    <StatusBadge status={badgeOf(String(r.eligibility))} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="studio-stage">
          <Scene
            scenario={selected}
            origin={origin}
            destination={destination}
            context={
              current?.kind === "saved" && selectedResult
                ? `${shipmentLabel || shipmentId} / ${t("wsSimRun")} ${current.run.slice(0, 8)}`
                : `${shipmentLabel || shipmentId} / ${t("wsSimDraftPreview")}`
            }
            cost={cost}
            delay={delay}
            currency={draft.currency}
            acceptance={selectedDraft?.receiver_acceptance}
            blocked={eligibility === "BLOCKED"}
            compact
          />
        </div>
        <aside
          className="inspector"
          data-open={sheet}
          aria-label={t("resultTitle")}
        >
          <button
            type="button"
            className="sheet-handle"
            aria-expanded={sheet}
            aria-controls="ws-sheet-body"
            onClick={() => setSheet((v) => !v)}
          >
            <span className="sheet-grip" aria-hidden="true" />
            <span className="sheet-summary num">{summaryLine}</span>
            <span className="sheet-toggle">
              {sheet ? t("sheetClose") : t("sheetOpen")}
            </span>
          </button>
          <div id="ws-sheet-body" className="sheet-body">
            <div className="result-card">
              <h2>{t("resultTitle")}</h2>
              <div className="scene-impact">
                <ImpactBand
                  label={t("resultDelay")}
                  value={delay}
                  baseline={String(
                    baseline.scenarios.find((s) => s.type === selected)
                      ?.estimated_delay_minutes ?? 0,
                  )}
                  unit={t("unitMin")}
                  chip={<ProvenanceChip kind="estimated" />}
                  unavailable={t("resultUnavailable")}
                  baselineWord={t("resultBaseline")}
                  checkInput={t("wsCheckInput")}
                />
                <ImpactBand
                  label={t("resultCost")}
                  value={cost}
                  baseline={origCost}
                  unit={draft.currency}
                  money
                  chip={
                    <>
                      {costProv.map((p) => (
                        <ProvenanceChip key={p} kind={p} />
                      ))}
                    </>
                  }
                  unavailable={t("resultUnavailable")}
                  baselineWord={t("resultBaseline")}
                  checkInput={t("wsCheckInput")}
                />
              </div>
              <dl className="result-rows">
                <div>
                  <dt>{t("resultEligibility")}</dt>
                  <dd>
                    <StatusBadge status={badgeOf(eligibility)} />
                    {!selectedResult && (
                      <span className="ws-dim"> {t("wsAwaiting")}</span>
                    )}
                  </dd>
                </div>
                {selectedResult && (
                  <>
                    <div>
                      <dt>{t("wsEngineCost")}</dt>
                      <dd className="num">
                        {String(selectedResult.direct_incremental_cost)}{" "}
                        {draft.currency} <ProvenanceChip kind="calculated" />
                      </dd>
                    </div>
                    <div>
                      <dt>{t("wsRanking")}</dt>
                      <dd className="num">
                        {selectedResult.ranking_score == null
                          ? t("wsExcluded")
                          : String(selectedResult.ranking_score)}
                      </dd>
                    </div>
                  </>
                )}
                <div>
                  <dt>{t("resultReceiver")}</dt>
                  <dd>
                    <span className="acceptance-state" data-state={acc}>
                      {acceptanceSymbol[acc]} {t("receiverWord")}:{" "}
                      {t(acceptanceKey[acc])} ({t("assumedWord")})
                    </span>
                  </dd>
                </div>
              </dl>
              {selectedResult && (
                <>
                  <h3 className="ws-h3">{t("wsReasons")}</h3>
                  <RuleList rules={selectedResult.rule_results} />
                  {((selectedResult.missing_information ?? []) as string[])
                    .length > 0 && (
                    <p className="scene-missing">
                      {t("wsMissingEvidence")}:{" "}
                      {(selectedResult.missing_information as string[]).join(
                        ", ",
                      )}
                    </p>
                  )}
                </>
              )}
              <p className="result-note">{t("wsEligibilityEngineNote")}</p>
            </div>
            <FactorControls
              value={draft}
              baseline={baseline}
              selected={selected}
              onChange={change}
              disabled={saving}
              baselineLabel={
                baselineRun
                  ? `${t("wsSimSavedRunLabel")} ${baselineRun.slice(0, 8)}`
                  : t("wsSimDefaultsLabel")
              }
            />
            <div className="ws-actions ws-sim-actions">
              <p role="status" className="ws-status-line">
                {!valid
                  ? t("wsSimFix")
                  : saving
                    ? t("wsSimProcessing")
                    : current
                      ? current.kind === "saved"
                        ? t("wsSimMatchesSaved")
                        : t("wsSimMatchesPreview")
                      : previewStatus || t("wsSimWaitingCalc")}
              </p>
              {!current && !saving && valid && (
                <button
                  type="button"
                  className="quiet"
                  onClick={() => setRetry((v) => v + 1)}
                >
                  {t("wsSimRetryPreview")}
                </button>
              )}
              <button
                type="button"
                disabled={saving || !valid}
                onClick={() => void save()}
              >
                {baselineRun ? t("wsSimRecalc") : t("wsSimRunBtn")}
              </button>
              {canPropose && selectedResult && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    onPropose({ run: current!.run, scenario: selectedResult })
                  }
                >
                  {t("wsPrepareProposal")}
                </button>
              )}
              {current?.kind === "saved" &&
                selectedResult &&
                eligibility === "BLOCKED" && (
                  <Callout tone="block" title={t("statusBlocked")}>
                    {t("wsBlockScenarioBlocked")}
                  </Callout>
                )}
              {current?.kind === "saved" &&
                selectedResult &&
                eligibility === "INSUFFICIENT_DATA" && (
                  <Callout tone="warn" title={t("statusInsufficient")}>
                    {t("wsBlockScenarioUnknown")}
                  </Callout>
                )}
            </div>
          </div>
        </aside>
      </div>
      {timeline}
      <details className="ws-compare" open>
        <summary>{t("wsCompare")}</summary>
        {!current ? (
          <p>{t("wsCompareHidden")}</p>
        ) : (
          <div className="ws-table-wrap">
            <table className="ws-table">
              <caption>
                {current.kind === "saved"
                  ? t("wsCompareSaved")
                  : t("wsComparePreview")}
              </caption>
              <thead>
                <tr>
                  <th>{t("wsScenario")}</th>
                  <th>{t("resultEligibility")}</th>
                  <th>{t("resultCost")}</th>
                  <th>{t("resultDelay")}</th>
                  <th>{t("wsRanking")}</th>
                </tr>
              </thead>
              <tbody>
                {current.items.map((s) => (
                  <tr key={String(s.type)} data-selected={s.type === selected}>
                    <td data-label={t("wsScenario")}>
                      <button
                        type="button"
                        className="quiet"
                        aria-pressed={s.type === selected}
                        onClick={() => chooseScenario(String(s.type))}
                      >
                        {t(scenarioKey[String(s.type)])}
                      </button>
                    </td>
                    <td data-label={t("resultEligibility")}>
                      <StatusBadge status={badgeOf(String(s.eligibility))} />
                    </td>
                    <td data-label={t("resultCost")} className="num">
                      {String(s.direct_incremental_cost)} {draft.currency}{" "}
                      <ProvenanceChip kind="calculated" />
                    </td>
                    <td data-label={t("resultDelay")} className="num">
                      {String(s.additional_delay_minutes)} {t("unitMin")}
                    </td>
                    <td data-label={t("wsRanking")} className="num">
                      {s.ranking_score == null
                        ? t("wsExcluded")
                        : String(s.ranking_score)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
      <details>
        <summary>{t("wsSelectedEvidence")}</summary>
        <p>{t("wsEvidenceNote")}</p>
        <EvidenceView
          value={selectedResult || { status: t("wsCurrentUnavailable") }}
        />
        <h3 className="ws-h4">{t("wsBaselineAssumptions")}</h3>
        <EvidenceView value={baseline} />
      </details>
    </section>
  );
}
