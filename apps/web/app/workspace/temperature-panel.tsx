"use client";
import { EvidenceView } from "@/components/evidence-view";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/provider";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { api, type Item } from "./api";
import EvidenceTimeline from "./evidence-timeline";
import { Callout, useErrorText } from "./ui";

export default function TemperaturePanel({
  shipmentId,
  org,
  analysis,
  onReady,
  onDatasets,
  onReadings,
}: {
  shipmentId: string;
  org: string;
  /** Selected completed analysis, used only to draw its unknown intervals. */
  analysis?: Item | null;
  onReady?: (ready: boolean) => void;
  /** Called once the dataset list has loaded (or failed to load) and after each refresh. */
  onDatasets?: (items: Item[]) => void;
  onReadings?: (rows: Item[]) => void;
}) {
  const { t } = useI18n();
  const errText = useErrorText();
  const [datasets, setDatasets] = useState<Item[]>([]);
  const [selected, setSelected] = useState("");
  const [rows, setRows] = useState<Item[]>([]);
  const [validation, setValidation] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState("");
  const [next, setNext] = useState<string | null>(null);
  const autoPicked = useRef(false);
  useEffect(() => {
    api(`/shipments/${shipmentId}/temperature-datasets`, org)
      .then((data) => {
        setDatasets(data.items ?? []);
        onDatasets?.(data.items ?? []);
      })
      .catch((e) => {
        setError(errText(e));
        onDatasets?.([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId, org]);
  useEffect(() => {
    if (!job) return;
    const timer = setInterval(() => {
      api(`/jobs/${job}`, org)
        .then(async (result) => {
          if (["COMPLETED", "FAILED"].includes(result.job.status)) {
            setJob("");
            setBusy(false);
            const items = (
              await api(`/shipments/${shipmentId}/temperature-datasets`, org)
            ).items;
            setDatasets(items);
            onDatasets?.(items);
            if (result.job.status === "FAILED") setError(t("wsImportFailed"));
          }
        })
        .catch((e) => {
          setError(errText(e));
          setBusy(false);
          setJob("");
        });
    }, 1500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, org, shipmentId]);
  useEffect(() => {
    onReady?.(datasets.some((d) => d.status === "READY"));
  }, [datasets, onReady]);
  useEffect(() => {
    onReadings?.(rows);
  }, [rows, onReadings]);
  // Show the newest ready dataset without an extra click. Datasets arrive newest first.
  useEffect(() => {
    if (autoPicked.current || selected) return;
    const first = datasets.find((d) => d.status === "READY");
    if (!first) return;
    autoPicked.current = true;
    void choose(String(first.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets, selected]);
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
      setError(errText(e));
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
      setError(errText(e));
      setBusy(false);
    }
  }
  const values = rows.map((r) => Number(r.temperature_c));
  const times = rows.map((r) => Date.parse(String(r.timestamp_utc)));
  return (
    <section className="ws-evidence">
      <div className="ws-panel-head">
        <h2>{t("evidenceTitle")}</h2>
        <p>{t("wsEvidenceLead")}</p>
      </div>
      {error && (
        <p role="alert" className="ws-alert">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="ws-busy">
          {job ? t("wsImportQueued") : t("wsLoading")}
        </p>
      )}
      <div className="ws-split">
        <form onSubmit={upload} className="ws-card ws-upload">
          <h3>{t("wsUploadTitle")}</h3>
          <label>
            <span>{t("wsCsvLabel")}</span>
            <input name="file" type="file" accept=".csv" required />
          </label>
          <div className="ws-row2">
            <label>
              <span>{t("wsColTimestamp")}</span>
              <input name="timestamp" defaultValue="timestamp" required />
            </label>
            <label>
              <span>{t("wsColTemperature")}</span>
              <input name="temperature" defaultValue="temperature_c" required />
            </label>
            <label>
              <span>{t("wsColSensor")}</span>
              <input name="sensor" defaultValue="sensor_id" />
            </label>
            <label>
              <span>{t("wsTimezone")}</span>
              <input name="timezone" placeholder="Asia/Bangkok" />
            </label>
            <label>
              <span>{t("wsUnit")}</span>
              <select name="unit">
                <option>C</option>
                <option>F</option>
              </select>
            </label>
          </div>
          <p className="ws-note">{t("wsUploadNote")}</p>
          <button disabled={busy}>{t("wsUploadButton")}</button>
        </form>
        <div className="ws-card">
          <h3>{t("wsDatasetsTitle")}</h3>
          <label>
            <span>{t("wsDatasetVersion")}</span>
            <select
              value={selected}
              onChange={(e) => void choose(e.target.value)}
            >
              <option value="">{t("wsSelectDataset")}</option>
              {datasets.map((d) => (
                <option key={String(d.id)} value={String(d.id)}>
                  {t("wsVersion")} {String(d.version)} / {String(d.status)}
                </option>
              ))}
            </select>
          </label>
          {datasets.length === 0 && (
            <Callout tone="info" title={t("wsNoDatasetsTitle")}>
              {t("wsNoDatasets")}
            </Callout>
          )}
          {validation && (
            <>
              <p>
                {t("wsValidation")}: <code>{String(validation.status)}</code>;{" "}
                {t("wsInvalidRows")}:{" "}
                <span className="num">
                  {String(validation.invalid_rows ?? 0)}
                </span>
              </p>
              <EvidenceView value={validation.errors} />
            </>
          )}
        </div>
      </div>
      <EvidenceTimeline rows={rows} analysis={analysis} />
      {rows.length > 0 && (
        <>
          <p className="ws-note">
            {t("wsReadingsShown")}: <span className="num">{rows.length}</span>.{" "}
            {t("wsRange")}{" "}
            <span className="num">
              {Math.min(...values)} – {Math.max(...values)} °C
            </span>{" "}
            <ProvenanceChip kind="observed" />{" "}
            <span className="num">
              {new Date(Math.min(...times)).toISOString()} –{" "}
              {new Date(Math.max(...times)).toISOString()}
            </span>{" "}
            (UTC). {t("wsOnePage")}
          </p>
          <div className="ws-table-wrap">
            <table className="ws-table ws-readings">
              <caption>{t("wsSourceReadings")}</caption>
              <thead>
                <tr>
                  <th>{t("wsSensor")}</th>
                  <th>{t("evTime")}</th>
                  <th>{t("wsCelsius")}</th>
                  <th>{t("wsSourceRow")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)}>
                    <td data-label={t("wsSensor")}>{String(r.sensor_id)}</td>
                    <td data-label={t("evTime")} className="num">
                      {String(r.timestamp_utc)}
                    </td>
                    <td data-label={t("wsCelsius")} className="num">
                      {String(r.temperature_c)}
                    </td>
                    <td data-label={t("wsSourceRow")} className="num">
                      {String(r.source_row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {next && (
            <button
              className="quiet"
              onClick={() => void choose(selected, next)}
            >
              {t("wsNextReadings")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
