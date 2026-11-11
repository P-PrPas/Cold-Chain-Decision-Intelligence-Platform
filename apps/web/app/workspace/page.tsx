"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, write, type Item } from "./api";
export default function Workspace() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [organizationNames, setOrganizationNames] = useState<
    Record<string, string>
  >({});
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
      const names = await Promise.all(
        me.memberships.map(async (m: Item) => {
          const r = await api(
            "/organizations/current",
            String(m.organization_id),
          );
          return [String(m.organization_id), String(r.organization.name)];
        }),
      );
      setOrganizationNames(Object.fromEntries(names));
      if (!org && me.memberships.length === 1)
        setOrg(me.memberships[0].organization_id);
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
      setCreating(false);
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
      <div className="page-heading">
        <div>
          <h1>Shipment queue</h1>
          <p>Open a shipment to inspect evidence and continue its review.</p>
        </div>
        {org && (
          <button onClick={() => setCreating(!creating)}>
            {creating ? "Close new shipment" : "Create shipment"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert">
          {error} <button onClick={() => void load()}>Retry</button>
        </p>
      )}
      {busy && <p role="status">Loading...</p>}
      {!loaded ? (
        <button disabled={busy} onClick={() => void login()}>
          Sign in with identity provider
        </button>
      ) : (
        <>
          <details className="account-menu">
            <summary>Account</summary>
            <button
              className="quiet"
              onClick={async () => {
                try {
                  await api("/auth/logout", org, write("POST", {}));
                  setLoaded(false);
                  setOrg("");
                  setShipments([]);
                  setDashboard(null);
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Sign out
            </button>
            <Link href="/demo">Open sample workspace</Link>
          </details>
          <label>
            Organization
            <select
              aria-label="Organization"
              value={org}
              onChange={(e) => {
                if (e.target.value === org) return;
                setShipments([]);
                setProducts([]);
                setDashboard(null);
                setOrg(e.target.value);
              }}
            >
              <option value="">Select organization</option>
              {members.map((m) => (
                <option
                  key={String(m.organization_id)}
                  value={String(m.organization_id)}
                >
                  {organizationNames[String(m.organization_id)] ||
                    "Organization"}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {org && (
        <>
          {dashboard && (
            <div className="queue-summary">
              <span>
                Pending QA reviews{" "}
                <strong>{String(dashboard.pending_qa)}</strong>
              </span>
              {Object.entries(
                dashboard.shipment_counts as Record<string, number>,
              ).map(([status, count]) => (
                <span key={status}>
                  {status.replaceAll("_", " ").toLowerCase()}{" "}
                  <strong>{count}</strong>
                </span>
              ))}
            </div>
          )}
          <div className="queue-filters">
            <label>
              Search loaded shipments
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Reference or route"
              />
            </label>
            <label>
              Operational status
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {[...new Set(shipments.map((s) => String(s.status)))].map(
                  (status) => (
                    <option key={status}>{status}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <ul className="shipment-list">
            {shipments
              .filter(
                (s) =>
                  (!filter || s.status === filter) &&
                  JSON.stringify([s.reference, s.origin, s.destination])
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((s) => (
                <li key={String(s.id)}>
                  <div>
                    <Link href={`/workspace/shipments/${s.id}?org=${org}`}>
                      {String(s.reference)}
                    </Link>
                    <p>
                      {String((s.origin as Item)?.name || "Origin")} /{" "}
                      {String((s.destination as Item)?.name || "Destination")}
                    </p>
                  </div>
                  <span className="badge">
                    {String(s.status).replaceAll("_", " ")}
                  </span>
                  <span>
                    {String(s.cargo_value)} {String(s.currency)}
                  </span>
                  <Link href={`/workspace/shipments/${s.id}?org=${org}`}>
                    Review evidence
                  </Link>
                </li>
              ))}
          </ul>
          {!busy &&
            !shipments.some(
              (s) =>
                (!filter || s.status === filter) &&
                JSON.stringify([s.reference, s.origin, s.destination])
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            ) && (
              <p>No matching shipments. Clear filters or create a shipment.</p>
            )}
          <p className="notice">
            Queue status is operational, not a safety assessment. Open a
            shipment for evidence and policy results.
          </p>
          {creating && (
            <div>
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
            </div>
          )}
        </>
      )}
    </main>
  );
}
