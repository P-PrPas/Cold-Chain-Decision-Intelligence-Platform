"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { money } from "../decision-summary";
import Link from "next/link";
import { api, write, type Item } from "./api";
export default function Workspace() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [organizationNames, setOrganizationNames] = useState<
    Record<string, string>
  >({});
  const requestVersion = useRef(0);
  const [dataKey, setDataKey] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [dashboardData, setDashboard] = useState<Item | null>(null);
  const [org, setOrg] = useState("");
  const [members, setMembers] = useState<Item[]>([]);
  const [shipmentRows, setShipments] = useState<Item[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scope = JSON.stringify([org, query, filter]);
  const shipments = dataKey === scope ? shipmentRows : [];
  const dashboard = dataKey === scope ? dashboardData : null;
  const load = useCallback(
    async (cursor?: string) => {
      const request = ++requestVersion.current;
      const key = JSON.stringify([org, query, filter]);
      setBusy(true);
      setError("");
      try {
        const me = await api("/auth/me");
        if (request !== requestVersion.current) return;
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
        if (request !== requestVersion.current) return;
        setOrganizationNames(Object.fromEntries(names));
        if (!org && me.memberships.length === 1)
          setOrg(me.memberships[0].organization_id);
        setLoaded(true);
        if (org) {
          const params = new URLSearchParams({
            q: query,
            status: filter,
            limit: "25",
          });
          if (cursor) params.set("cursor", cursor);
          const [s, p, d] = await Promise.all([
            api(`/shipments?${params}`, org),
            api("/products?limit=100", org),
            api("/dashboard", org),
          ]);
          if (request !== requestVersion.current) return;
          setShipments((old) => (cursor ? [...old, ...s.items] : s.items));
          setProducts(p.items);
          setDashboard(d);
          setNextCursor(s.next_cursor);
          setDataKey(key);
        }
      } catch (e) {
        if (request === requestVersion.current) setError(String(e));
      } finally {
        if (request === requestVersion.current) setBusy(false);
      }
    },
    [org, query, filter],
  );
  useEffect(() => {
    const version = requestVersion;
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      version.current++;
    };
  }, [load]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(sessionStorage.getItem("queue-query") || "");
      setFilter(sessionStorage.getItem("queue-filter") || "");
    }, 0);
    return () => clearTimeout(timer);
  }, []);
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
    const operation = requestVersion.current;
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
      if (operation !== requestVersion.current) return;
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
          <button
            disabled={busy || dataKey !== scope}
            onClick={() => setCreating(!creating)}
          >
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
            <Link href="/studio">Open sample workspace</Link>
          </details>
          <label>
            Organization
            <select
              aria-label="Organization"
              value={org}
              onChange={(e) => {
                if (e.target.value === org) return;
                requestVersion.current++;
                setDataKey("");
                setError("");
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
              Search all shipments
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  requestVersion.current++;
                  setError("");
                  setQuery(e.target.value);
                  sessionStorage.setItem("queue-query", e.target.value);
                }}
                placeholder="Reference or route"
              />
            </label>
            <label>
              Operational status
              <select
                value={filter}
                onChange={(e) => {
                  requestVersion.current++;
                  setError("");
                  setFilter(e.target.value);
                  sessionStorage.setItem("queue-filter", e.target.value);
                }}
              >
                <option value="">All statuses</option>
                {[
                  "DRAFT",
                  "READY",
                  "IN_TRANSIT",
                  "ARRIVED",
                  "CLOSED",
                  "CANCELLED",
                ].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>
          <ul className="shipment-list">
            {shipments.map((s) => (
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
                  <small>Cargo value</small>
                  <br />
                  {money(s.cargo_value, s.currency)}
                </span>
                <Link href={`/workspace/shipments/${s.id}?org=${org}`}>
                  {s.status === "DRAFT"
                    ? "Prepare evidence"
                    : s.status === "CANCELLED" || s.status === "CLOSED"
                      ? "View history"
                      : "Inspect shipment"}
                </Link>
              </li>
            ))}
          </ul>
          {!busy && dataKey === scope && !error && shipments.length === 0 && (
            <p>No shipments match this search.</p>
          )}
          {dataKey === scope && nextCursor && (
            <button disabled={busy} onClick={() => void load(nextCursor)}>
              Load more shipments
            </button>
          )}
          {org && dataKey !== scope && !error && (
            <p role="status">Loading this organization and search...</p>
          )}
          <p className="notice">
            Queue status is operational, not a safety assessment. Open a
            shipment for evidence and policy results.
          </p>
          {creating && dataKey === scope && (
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
