"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, write, type Item } from "./api";
export default function Workspace() {
  const [dashboard, setDashboard] = useState<Item | null>(null);
  const [org, setOrg] = useState("");
  const [members, setMembers] = useState<Item[]>([]);
  const [shipments, setShipments] = useState<Item[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const me = await api("/auth/me");
      setMembers(me.memberships);
      setLoaded(true);
      if (org) {
        const [s, p] = await Promise.all([
          api("/shipments", org),
          api("/products", org),
        ]);
        setShipments(s.items);
        setProducts(p.items);
        setDashboard(await api("/dashboard", org));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [org]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function login() {
    setBusy(true);
    try {
      const result = await api(
        "/auth/login",
        "",
        write("POST", { return_to: "/workspace" }),
      );
      window.location.assign(result.authorization_url);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api(
        "/shipments",
        org,
        write("POST", {
          reference: form.get("reference"),
          product_id: form.get("product"),
          origin: { name: form.get("origin") },
          destination: { name: form.get("destination") },
          departure_at: new Date(String(form.get("departure"))).toISOString(),
          estimated_arrival_at: new Date(
            String(form.get("arrival")),
          ).toISOString(),
          cargo_value: form.get("value"),
          currency: "THB",
        }),
      );
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const roles = (members.find((m) => m.organization_id === org)?.roles ||
    []) as string[];
  return (
    <main>
      <Link href="/">Cold Chain</Link>
      <span className="eyebrow">OPERATIONS / WORKSPACE</span>
      <h1>
        Your cold chain.
        <br />
        <em>One clear view.</em>
      </h1>
      <p>
        Synthetic development workspace. No safety certification or autonomous
        release.
      </p>
      <p>
        <Link className="button" href="/demo">
          Try demo with prepared data
        </Link>
      </p>
      {error && (
        <p role="alert">
          {error} <button onClick={() => void load()}>Retry</button>
        </p>
      )}
      {busy && <p role="status">Loading?</p>}
      {!loaded ? (
        <button disabled={busy} onClick={() => void login()}>
          Sign in with identity provider
        </button>
      ) : (
        <>
          <button
            onClick={async () => {
              await api("/auth/logout", org, write("POST", {}));
              setLoaded(false);
              setOrg("");
              setShipments([]);
            }}
          >
            Sign out
          </button>
          <label>
            Organization
            <select
              aria-label="Organization"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
            >
              <option value="">Select organization</option>
              {members.map((m) => (
                <option
                  key={String(m.organization_id)}
                  value={String(m.organization_id)}
                >
                  {String(m.organization_id)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {org && (
        <>
          {dashboard && (
            <section>
              <h2>Organization overview</h2>
              <p>Pending QA reviews: {String(dashboard.pending_qa)}</p>
              <ul>
                {Object.entries(
                  dashboard.shipment_counts as Record<string, number>,
                ).map(([status, count]) => (
                  <li key={status}>
                    {status}: {count}
                  </li>
                ))}
              </ul>
              <details>
                <summary>Recent activity</summary>
                <pre>
                  {JSON.stringify(
                    {
                      analyses: dashboard.recent_analyses,
                      decisions: dashboard.recent_decisions,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </section>
          )}
          <h2>Create shipment</h2>
          {roles.some((r) => ["ADMIN", "LOGISTICS"].includes(r)) ? (
            <form className="shipment-form" onSubmit={create}>
              <label>
                Reference
                <input name="reference" required />
              </label>
              <label>
                Product
                <select aria-label="Product" name="product" required>
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {String(p.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Origin
                <input name="origin" required />
              </label>
              <label>
                Destination
                <input name="destination" required />
              </label>
              <label>
                Departure (local time)
                <input name="departure" type="datetime-local" required />
              </label>
              <label>
                Arrival (local time)
                <input name="arrival" type="datetime-local" required />
              </label>
              <label>
                Cargo value (THB)
                <input
                  name="value"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </label>
              <button disabled={busy}>Create shipment</button>
            </form>
          ) : (
            <p>Your role can view shipments but cannot create them.</p>
          )}
          <h2>Shipment list</h2>
          {!busy && shipments.length === 0 && <p>No shipments yet.</p>}
          <ul className="shipment-list">
            {shipments.map((s) => (
              <li key={String(s.id)}>
                <a href={`/workspace/shipments/${s.id}?org=${org}`}>
                  {String(s.reference)}
                </a>{" "}
                ? {String(s.status)} ? {String(s.cargo_value)}{" "}
                {String(s.currency)}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
