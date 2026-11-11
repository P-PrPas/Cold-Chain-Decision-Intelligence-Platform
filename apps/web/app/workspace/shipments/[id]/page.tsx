"use client";
import { use, useEffect, useState } from "react";
import TemperaturePanel from "../../temperature-panel";
import { api, write, type Item } from "../../api";
export default function ShipmentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [org, setOrg] = useState("");
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
    } catch (e) {
      setError(String(e) + ". Reload to obtain current revision.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <a href="/workspace">Shipments</a>
      <h1>{item ? String(item.reference) : "Shipment"}</h1>
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => window.location.reload()}>Reload</button>
        </p>
      )}
      {!item && !error && <p role="status">Loading?</p>}
      {item && (
        <>
          <p>
            Status: {String(item.status)} / revision {String(item.revision)}
          </p>
          <p>
            {String(item.cargo_value)} {String(item.currency)}
          </p>
          <label>
            Next operational state
            <select
              defaultValue=""
              disabled={busy}
              onChange={(e) => {
                if (e.target.value) void transition(e.target.value);
              }}
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
          <TemperaturePanel shipmentId={id} org={org} />
          <section id="workflow">
            <h2>Evidence workflow</h2>
            <p>
              Temperature and decision workflows are added in subsequent
              sprints.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
