"use client";
import { EvidenceView } from "../evidence-view";
import { useEffect, useState, type FormEvent } from "react";
import { api, type Item } from "./api";
export default function TemperaturePanel({
  shipmentId,
  org,
  onReady,
}: {
  shipmentId: string;
  org: string;
  onReady?: (ready: boolean) => void;
}) {
  const [datasets, setDatasets] = useState<Item[]>([]);
  const [selected, setSelected] = useState("");
  const [rows, setRows] = useState<Item[]>([]);
  const [validation, setValidation] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState("");
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    api(`/shipments/${shipmentId}/temperature-datasets`, org)
      .then((data) => setDatasets(data.items))
      .catch((e) => setError(String(e)));
  }, [shipmentId, org]);
  useEffect(() => {
    if (!job) return;
    const timer = setInterval(() => {
      api(`/jobs/${job}`, org)
        .then(async (result) => {
          if (["COMPLETED", "FAILED"].includes(result.job.status)) {
            setJob("");
            setBusy(false);
            setDatasets(
              (await api(`/shipments/${shipmentId}/temperature-datasets`, org))
                .items,
            );
            if (result.job.status === "FAILED")
              setError("Import failed; retry with a new upload.");
          }
        })
        .catch((e) => {
          setError(String(e));
          setBusy(false);
          setJob("");
        });
    }, 1500);
    return () => clearInterval(timer);
  }, [job, org, shipmentId]);
  useEffect(() => {
    onReady?.(datasets.some((d) => d.status === "READY"));
  }, [datasets, onReady]);
  async function choose(id: string, cursor?: string) {
    setSelected(id);
    setBusy(true);
    setError("");
    try {
      const v = await api(`/temperature-datasets/${id}/validation`, org);
      setValidation(v);
      setRows([]);
      if (v.status === "READY") {
        const result = await api(
          `/temperature-datasets/${id}/readings${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
          org,
        );
        setRows(result.items);
        setNext(result.next_cursor);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const data = new FormData();
    data.set("file", form.get("file")!);
    data.set(
      "mapping",
      JSON.stringify({
        timestamp: form.get("timestamp"),
        temperature: form.get("temperature"),
        ...(form.get("sensor") ? { sensor_id: form.get("sensor") } : {}),
      }),
    );
    if (form.get("timezone"))
      data.set("source_timezone", form.get("timezone")!);
    data.set("default_unit", form.get("unit")!);
    try {
      const result = await api(
        `/shipments/${shipmentId}/temperature-datasets`,
        org,
        {
          method: "POST",
          body: data,
          headers: { "Idempotency-Key": crypto.randomUUID() },
        },
      );
      setJob(result.job.id);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }
  const times = rows.map((r) => Date.parse(String(r.timestamp_utc)));
  const values = rows.map((r) => Number(r.temperature_c));
  const minTime = Math.min(...times),
    maxTime = Math.max(...times),
    minValue = Math.min(...values) - 1,
    maxValue = Math.max(...values) + 1;
  return (
    <section>
      <h2>Temperature evidence</h2>
      {error && <p role="alert">{error}</p>}
      {busy && (
        <p role="status">
          {job ? "Import queued or processing..." : "Loading..."}
        </p>
      )}
      <form onSubmit={upload}>
        <label>
          CSV (maximum 10 MB)
          <input name="file" type="file" accept=".csv" required />
        </label>
        <label>
          Timestamp column
          <input name="timestamp" defaultValue="timestamp" required />
        </label>
        <label>
          Temperature column
          <input name="temperature" defaultValue="temperature_c" required />
        </label>
        <label>
          Sensor column (optional)
          <input name="sensor" defaultValue="sensor_id" />
        </label>
        <label>
          Source timezone (required for naive timestamps)
          <input name="timezone" placeholder="Asia/Bangkok" />
        </label>
        <label>
          Temperature unit
          <select name="unit">
            <option>C</option>
            <option>F</option>
          </select>
        </label>
        <button disabled={busy}>Upload new dataset version</button>
      </form>
      <label>
        Dataset version
        <select value={selected} onChange={(e) => void choose(e.target.value)}>
          <option value="">Select dataset</option>
          {datasets.map((d) => (
            <option key={String(d.id)} value={String(d.id)}>
              Version {String(d.version)} / {String(d.status)}
            </option>
          ))}
        </select>
      </label>
      {datasets.length === 0 && <p>No datasets uploaded.</p>}
      {validation && (
        <>
          <p>
            Validation: {String(validation.status)}; invalid rows:{" "}
            {String(validation.invalid_rows ?? 0)}
          </p>
          <EvidenceView value={validation.errors} />
        </>
      )}
      {rows.length > 0 && (
        <>
          <div
            className="chart-scroll"
            tabIndex={0}
            role="region"
            aria-label="Temperature samples; scroll horizontally"
          >
            <svg
              viewBox="0 0 640 220"
              role="img"
              aria-label="Observed temperature samples; points are not connected across unknown intervals"
            >
              {rows.map((r, i) => (
                <circle
                  key={String(r.id)}
                  cx={
                    20 + ((times[i] - minTime) / (maxTime - minTime || 1)) * 600
                  }
                  cy={
                    200 - ((values[i] - minValue) / (maxValue - minValue)) * 180
                  }
                  r="4"
                  fill="var(--accent)"
                >
                  <title>
                    {String(r.sensor_id)}: {String(r.timestamp_utc)} /{" "}
                    {String(r.temperature_c)} C
                  </title>
                </circle>
              ))}
            </svg>
          </div>
          <p>
            Observed samples only. Gaps and risk require a pinned policy
            analysis. Showing one page; no interpolation.
          </p>
          <table>
            <caption>Source readings</caption>
            <thead>
              <tr>
                <th>Sensor</th>
                <th>UTC timestamp</th>
                <th>Celsius</th>
                <th>Source row</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td>{String(r.sensor_id)}</td>
                  <td>{String(r.timestamp_utc)}</td>
                  <td>{String(r.temperature_c)}</td>
                  <td>{String(r.source_row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {next && (
            <button onClick={() => void choose(selected, next)}>
              Next readings page
            </button>
          )}
        </>
      )}
    </section>
  );
}
