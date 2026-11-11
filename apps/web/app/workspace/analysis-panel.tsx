"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, write, type Item } from "./api";
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
  if (!observations.length) return null;
  return (
    <aside role="alert" aria-label="Observed temperature requires QA review">
      <h4>Out-of-range temperature evidence — QA review required</h4>
      <p>
        This includes observed temperature violations, not just missing data.
        Evidence outside or crossing the shipment window requires reconciling
        the trip times and reanalysis before release. Duration totals cover only
        the pinned shipment window.
      </p>
      <ul>
        {observations.map((observation, index) => (
          <li key={index}>
            Sensor {String(observation.sensor_id)}:{" "}
            {String(observation.temperature_c)} °C at {String(observation.at)} —{" "}
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
}: {
  shipmentId: string;
  productId: string;
  org: string;
}) {
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
    setPolicies(p.items);
    setDatasets(d.items);
  }
  useEffect(() => {
    Promise.all([
      api(`/quality-policies?product_id=${productId}`, org),
      api(`/shipments/${shipmentId}/temperature-datasets`, org),
      api("/auth/me"),
    ])
      .then(([p, d, me]) => {
        setPolicies(p.items);
        setDatasets(d.items);
        setRoles(
          me.memberships.find(
            (m: { organization_id: string }) => m.organization_id === org,
          )?.roles || [],
        );
      })
      .catch((e) => setError(String(e)));
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
          }
        })
        .catch((e) => {
          setError(String(e));
          setJob("");
          setBusy(false);
        });
    }, 1500);
    return () => clearInterval(timer);
  }, [job, org, analysisId]);
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
      setError(String(e));
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
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function transition(policy: Item, action: string) {
    const note = window.prompt("Review note / reason");
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
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      setError(String(e));
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Quality policy and analysis</h2>
      <p>
        Rules require independent QA review and source evidence. Never infer
        real safety limits from synthetic examples.
      </p>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Processing?</p>}
      <button
        disabled={busy}
        onClick={() => refresh().catch((e) => setError(String(e)))}
      >
        Refresh policies and datasets
      </button>
      {canAuthor && (
        <details>
          <summary>Author a draft policy</summary>
          <label>
            Reference document
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
                  setError(String(error));
                }
              }}
            />
          </label>
          <p>Reference: {reference || "Not uploaded"}</p>
          <form onSubmit={create}>
            <label>
              Policy key
              <input name="key" required />
            </label>
            <label>
              Version
              <input
                name="version"
                type="number"
                min="1"
                defaultValue="1"
                required
              />
            </label>
            <label>
              Effective from
              <input name="effective" type="datetime-local" required />
            </label>
            <label>
              Versioned rules (JSON)
              <textarea
                rows={14}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
              />
            </label>
            <button disabled={busy}>Save draft</button>
          </form>
        </details>
      )}
      <ul>
        {policies.map((p) => (
          <li key={String(p.id)}>
            {String(p.policy_key)} v{String(p.version)} ? {String(p.status)}
            <details>
              <summary>Rule evidence</summary>
              <pre>{JSON.stringify(p.rules, null, 2)}</pre>
            </details>
            {p.status === "DRAFT" && canAuthor && (
              <details>
                <summary>Edit draft v{String(p.version)}</summary>
                <form
                  key={String(p.revision)}
                  onSubmit={(event) => void editDraft(event, p)}
                >
                  <label>
                    Reference document ID
                    <input
                      name="reference"
                      defaultValue={String(p.reference_document_id || "")}
                    />
                  </label>
                  <label>
                    Effective from (UTC)
                    <input
                      name="effective_from"
                      required
                      defaultValue={String(p.effective_from)}
                    />
                  </label>
                  <label>
                    Effective to (UTC, optional)
                    <input
                      name="effective_to"
                      defaultValue={String(p.effective_to || "")}
                    />
                  </label>
                  <label>
                    Draft rules (JSON)
                    <textarea
                      name="rules"
                      rows={14}
                      required
                      defaultValue={JSON.stringify(p.rules, null, 2)}
                    />
                  </label>
                  <button disabled={busy}>Save draft changes</button>
                </form>
              </details>
            )}
            {p.status === "DRAFT" && canAuthor && (
              <button
                disabled={busy}
                onClick={() => void transition(p, "submit-review")}
              >
                Submit review
              </button>
            )}
            {p.status === "PENDING_REVIEW" && roles.includes("QA") && (
              <button
                disabled={busy}
                onClick={() => void transition(p, "approve")}
              >
                QA approve
              </button>
            )}
            {p.status === "APPROVED" && roles.includes("QA") && (
              <button
                disabled={busy}
                onClick={() => void transition(p, "retire")}
              >
                Retire
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={run}>
        <label>
          Ready dataset
          <select name="dataset" required>
            <option value="">Select</option>
            {datasets
              .filter((d) => d.status === "READY")
              .map((d) => (
                <option key={String(d.id)} value={String(d.id)}>
                  Dataset v{String(d.version)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Approved policy
          <select name="policy" required>
            <option value="">Select</option>
            {policies
              .filter((p) => p.status === "APPROVED")
              .map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {String(p.policy_key)} v{String(p.version)}
                </option>
              ))}
          </select>
        </label>
        <button disabled={busy}>Analyze pinned evidence</button>
      </form>
      {analysis && (
        <>
          <h3>
            Analysis: {String(analysis.classification || analysis.status)}
          </h3>
          <p>Analysis ID: {String(analysis.id)}</p>
          <p>Input digest: {String(analysis.input_sha256)}</p>
          <TemperatureEvidence
            observations={
              (
                analysis.summary as {
                  unbounded_out_of_range_observations?: Item[];
                }
              )?.unbounded_out_of_range_observations || []
            }
          />
          <pre>
            {JSON.stringify(
              {
                summary: analysis.summary,
                rule_results: analysis.rule_results,
                unknown_intervals: analysis.unknown_intervals,
                excursions: analysis.excursions,
              },
              null,
              2,
            )}
          </pre>
        </>
      )}
    </section>
  );
}
