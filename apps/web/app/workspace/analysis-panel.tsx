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
    ])
      .then(([p, d]) => {
        setPolicies(p.items);
        setDatasets(d.items);
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
      <ul>
        {policies.map((p) => (
          <li key={String(p.id)}>
            {String(p.policy_key)} v{String(p.version)} ? {String(p.status)}
            <details>
              <summary>Rule evidence</summary>
              <pre>{JSON.stringify(p.rules, null, 2)}</pre>
            </details>
            {p.status === "DRAFT" && (
              <button
                disabled={busy}
                onClick={() => void transition(p, "submit-review")}
              >
                Submit review
              </button>
            )}
            {p.status === "PENDING_REVIEW" && (
              <button
                disabled={busy}
                onClick={() => void transition(p, "approve")}
              >
                QA approve
              </button>
            )}
            {p.status === "APPROVED" && (
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
