"use client";
import { EvidenceView } from "../evidence-view";
import { useEffect, useState, type FormEvent } from "react";
import { api, write, type Item } from "./api";
import Scene, { scenarioNames } from "../scene";
const types = [
  "CONTINUE_DELIVERY",
  "HOLD_INSPECTION",
  "CONDITIONAL_REROUTE",
  "REJECT_QUARANTINE_DISPOSE",
];
export default function SimulationPanel({
  shipmentId,
  org,
  completedAnalysis,
  onPropose,
}: {
  shipmentId: string;
  completedAnalysis?: string;
  onPropose: (source: { run: string; scenario: Item } | null) => void;
  org: string;
}) {
  const [selected, setSelected] = useState("CONTINUE_DELIVERY");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState("");
  const [job, setJob] = useState("");
  const [scenarios, setScenarios] = useState<Item[]>([]);
  const [parameters, setParameters] = useState<Item | null>(null);
  useEffect(() => {
    if (!job) return;
    const timer = setInterval(() => {
      api(`/jobs/${job}`, org)
        .then(async (result) => {
          if (["COMPLETED", "FAILED"].includes(result.job.status)) {
            setJob("");
            setBusy(false);
            if (result.job.status === "FAILED")
              setError("Simulation failed. Check source evidence and retry.");
            else
              setScenarios(
                (await api(`/simulations/${run}/scenarios`, org)).items,
              );
          }
        })
        .catch((e) => {
          setError(String(e));
          setJob("");
          setBusy(false);
        });
    }, 1500);
    return () => clearInterval(timer);
  }, [job, run, org]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setScenarios([]);
    onPropose(null);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const analysis = (await api(`/analyses/${form.get("analysis")}`, org))
        .analysis;
      const shipment = (await api(`/shipments/${shipmentId}`, org)).shipment;
      const payload = {
        analysis_id: analysis.id,
        dataset_id: analysis.dataset_id,
        policy_version_id: analysis.policy_version_id,
        currency: shipment.currency,
        scenario_types: types,
        scenarios: types.map((type) => ({
          type,
          estimated_delay_minutes: Number(form.get(type + "delay")),
          receiver_acceptance: form.get("receiver"),
          costs: Object.fromEntries(
            [
              "additional_transport",
              "inspection",
              "holding",
              "handling",
              "disposal",
              "other",
            ].map((name) => [
              name,
              {
                amount:
                  name === "other" ? String(form.get(type + "cost")) : "0.00",
                source: "USER_ESTIMATE",
              },
            ]),
          ),
        })),
        ranking_weights: {
          cost: String(form.get("weight")),
          delay: (1 - Number(form.get("weight"))).toFixed(2),
        },
      };
      setParameters(payload);
      const result = await api(
        run
          ? `/simulations/${run}/recalculate`
          : `/shipments/${shipmentId}/simulations`,
        org,
        write("POST", payload),
      );
      setRun(result.simulation.id);
      setJob(result.job.id);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }
  return (
    <section>
      <span className="eyebrow">03 / SIMULATION STUDIO</span>
      <h2>Compare operational alternatives</h2>
      <div
        className="scenario-tabs"
        role="group"
        aria-label="Visualize a scenario"
      >
        {types.map((type) => (
          <button
            type="button"
            key={type}
            aria-pressed={selected === type}
            onClick={() => setSelected(type)}
          >
            {scenarioNames[type]}
          </button>
        ))}
      </div>
      <Scene scenario={selected} />
      <h3>What-if comparison</h3>
      <p>
        Costs below are user estimates; probability and expected loss remain
        unknown. Every proposed action requires QA review.
      </p>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Simulation processing...</p>}
      <form onSubmit={submit}>
        <input type="hidden" name="analysis" value={completedAnalysis || ""} />
        <p>Using the completed analysis selected in the evidence step.</p>
        <label>
          Receiver acceptance
          <select name="receiver">
            <option>UNKNOWN</option>
            <option>ACCEPTED</option>
            <option>REJECTED</option>
          </select>
        </label>
        {types.map((type) => (
          <fieldset key={type}>
            <legend>{scenarioNames[type]}</legend>
            <label>
              Estimated direct cost
              <input
                name={type + "cost"}
                type="number"
                min="0"
                step="0.01"
                defaultValue="0.00"
                required
              />
            </label>
            <label>
              Additional delay (minutes)
              <input
                name={type + "delay"}
                type="number"
                min="0"
                step="1"
                defaultValue="0"
                required
              />
            </label>
          </fieldset>
        ))}
        <label>
          Cost weight (delay gets remainder)
          <input
            name="weight"
            type="number"
            min="0"
            max="1"
            step="0.01"
            defaultValue="0.60"
            required
          />
        </label>
        <button disabled={busy}>
          {run ? "Recalculate as a new run" : "Run simulation"}
        </button>
      </form>
      {run && (
        <details>
          <summary>Run traceability</summary>
          <p>Run reference: {run}. Previous runs remain unchanged.</p>
        </details>
      )}
      {scenarios.length > 0 && (
        <table>
          <caption>
            Scenario comparison: lower score ranks first among eligible options
            only
          </caption>
          <thead>
            <tr>
              <th>Action</th>
              <th>Eligibility and evidence</th>
              <th>Cost</th>
              <th>Delay</th>
              <th>Score</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={String(s.id)}>
                <td>
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => setSelected(String(s.type))}
                  >
                    {scenarioNames[String(s.type)] || String(s.type)}
                  </button>
                </td>
                <td>
                  <strong>{String(s.eligibility).replaceAll("_", " ")}</strong>
                  <details>
                    <summary>Why this outcome?</summary>
                    <EvidenceView
                      value={{
                        risk_classification: s.risk_classification,
                        receiver_acceptance: s.receiver_acceptance,
                        missing_information: s.missing_information,
                        rule_results: s.rule_results,
                      }}
                    />
                  </details>
                </td>
                <td>
                  {String(s.direct_incremental_cost)} {String(s.currency)}
                </td>
                <td>{String(s.additional_delay_minutes)} minutes</td>
                <td>
                  {s.ranking_score === null
                    ? "Excluded"
                    : String(s.ranking_score)}
                </td>
                <td>
                  {["ELIGIBLE", "REVIEW_REQUIRED"].includes(
                    String(s.eligibility),
                  ) ? (
                    <button
                      type="button"
                      onClick={() => {
                        onPropose({ run, scenario: s });
                        document.getElementById("review")?.scrollIntoView();
                      }}
                    >
                      Prepare proposal
                    </button>
                  ) : (
                    <span>Cannot propose: {String(s.eligibility)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {parameters && (
        <details>
          <summary>Pinned assumptions</summary>
          <EvidenceView value={parameters} />
        </details>
      )}
    </section>
  );
}
