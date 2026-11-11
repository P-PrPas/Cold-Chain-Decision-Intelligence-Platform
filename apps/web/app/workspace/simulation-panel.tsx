"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, write, type Item } from "./api";
const types = [
  "CONTINUE_DELIVERY",
  "HOLD_INSPECTION",
  "CONDITIONAL_REROUTE",
  "REJECT_QUARANTINE_DISPOSE",
];
export default function SimulationPanel({
  shipmentId,
  org,
}: {
  shipmentId: string;
  org: string;
}) {
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
      <h2>What-if comparison</h2>
      <p>
        Costs below are user estimates; probability and expected loss remain
        unknown. Every proposed action requires QA review.
      </p>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Simulation processing?</p>}
      <form onSubmit={submit}>
        <label>
          Completed analysis ID
          <input name="analysis" required />
        </label>
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
            <legend>{type}</legend>
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
        <p>Current simulation ID: {run}. Previous runs remain unchanged.</p>
      )}
      {scenarios.length > 0 && (
        <table>
          <caption>
            Scenario comparison ? lower score ranks first among eligible options
            only
          </caption>
          <thead>
            <tr>
              <th>Action</th>
              <th>Eligibility</th>
              <th>Cost</th>
              <th>Delay</th>
              <th>Score</th>
              <th>Scenario ID</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={String(s.id)}>
                <td>{String(s.type)}</td>
                <td>{String(s.eligibility)}</td>
                <td>
                  {String(s.direct_incremental_cost)} {String(s.currency)}
                </td>
                <td>{String(s.additional_delay_minutes)} minutes</td>
                <td>
                  {s.ranking_score === null
                    ? "Excluded"
                    : String(s.ranking_score)}
                </td>
                <td>{String(s.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {parameters && (
        <details>
          <summary>Pinned assumptions</summary>
          <pre>{JSON.stringify(parameters, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
