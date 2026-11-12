"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import "./workspace.css";
import { money } from "../decision-summary";
import { useI18n } from "../i18n-provider";
import type { DictKey } from "../i18n";
import { api, write, ApiError, type Item } from "./api";
import {
  AnalysisBadge,
  Callout,
  OpStatusBadge,
  Skeleton,
  useErrorText,
  useFmt,
} from "./ui";

const STATUSES = [
  "DRAFT",
  "READY",
  "IN_TRANSIT",
  "ARRIVED",
  "CLOSED",
  "CANCELLED",
] as const;
const STATUS_KEY: Record<string, DictKey> = {
  DRAFT: "wsOpDraft",
  READY: "wsOpReady",
  IN_TRANSIT: "wsOpTransit",
  ARRIVED: "wsOpArrived",
  CLOSED: "wsOpClosed",
  CANCELLED: "wsOpCancelled",
};
type FieldErrors = Partial<
  Record<
    | "reference"
    | "product"
    | "origin"
    | "destination"
    | "departure"
    | "arrival"
    | "value",
    string
  >
>;

export default function Workspace() {
  const { t } = useI18n();
  const errText = useErrorText();
  const fmt = useFmt();
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
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const scope = JSON.stringify([org, query, filter]);
  const shipments = dataKey === scope ? shipmentRows : [];
  const dashboard = dataKey === scope ? dashboardData : null;
  const load = useCallback(
    async (cursor?: string) => {
      const request = ++requestVersion.current;
      const key = JSON.stringify([org, query, filter]);
      setBusy(true);
      setError(null);
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
        if (request === requestVersion.current) setError(e);
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
      setError(e);
      setBusy(false);
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const next: FieldErrors = {};
    if (!text("reference")) next.reference = t("wsFormRequired");
    if (!text("product")) next.product = t("wsFormRequired");
    if (!text("origin")) next.origin = t("wsFormRequired");
    if (!text("destination")) next.destination = t("wsFormRequired");
    if (!text("departure")) next.departure = t("wsFormRequired");
    if (!text("arrival")) next.arrival = t("wsFormRequired");
    else if (
      text("departure") &&
      new Date(text("arrival")) <= new Date(text("departure"))
    )
      next.arrival = t("wsFormArrivalAfter");
    const value = text("value");
    if (!value) next.value = t("wsFormRequired");
    else if (!/^\d+(\.\d{1,2})?$/.test(value)) next.value = t("wsFormValue");
    setFormError("");
    setFieldErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      event.currentTarget
        .querySelector<HTMLElement>(`[name="${first}"]`)
        ?.focus();
      return;
    }
    setBusy(true);
    const operation = requestVersion.current;
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
      if (e instanceof ApiError && e.code === "DUPLICATE_REFERENCE")
        setFieldErrors({ reference: errText(e) });
      else setFormError(errText(e));
    } finally {
      setBusy(false);
    }
  }
  const roles = (members.find((m) => m.organization_id === org)?.roles ||
    []) as string[];
  const canCreate = roles.some((r) => ["ADMIN", "LOGISTICS"].includes(r));
  const status = error instanceof ApiError ? error.status : 0;
  const firstLoad = !loaded && busy && !error;
  const signedOut = !loaded && !firstLoad && (status === 401 || !error);
  const denied = status === 403;
  const productName = (id: unknown) =>
    String(products.find((p) => p.id === id)?.name ?? "");
  const classOf = (id: unknown) =>
    (
      (dashboard?.recent_analyses ?? []) as {
        shipment_id: string;
        classification: string | null;
      }[]
    ).find((a) => a.shipment_id === id)?.classification;
  const loading = !!org && dataKey !== scope && !error;
  const empty =
    !!org && !busy && dataKey === scope && !error && shipments.length === 0;
  const filtered = !!query || !!filter;

  return (
    <main className="ws" id="content">
      <header className="ws-head">
        <div>
          <h1>{t("wsListTitle")}</h1>
          <p>{t("wsListLead")}</p>
        </div>
        <div className="ws-head-actions">
          {loaded && (
            <label className="ws-org">
              <span>{t("wsOrganization")}</span>
              <select
                aria-label={t("wsOrganization")}
                value={org}
                onChange={(e) => {
                  if (e.target.value === org) return;
                  requestVersion.current++;
                  setDataKey("");
                  setError(null);
                  setShipments([]);
                  setProducts([]);
                  setDashboard(null);
                  setCreating(false);
                  setOrg(e.target.value);
                }}
              >
                <option value="">{t("wsSelectOrganization")}</option>
                {members.map((m) => (
                  <option
                    key={String(m.organization_id)}
                    value={String(m.organization_id)}
                  >
                    {organizationNames[String(m.organization_id)] ||
                      t("wsOrganization")}
                  </option>
                ))}
              </select>
            </label>
          )}
          {org && canCreate && (
            <button
              disabled={busy || dataKey !== scope}
              aria-expanded={creating}
              onClick={() => {
                setCreating(!creating);
                setFieldErrors({});
                setFormError("");
              }}
            >
              {creating ? t("wsCloseCreate") : t("wsCreateShipment")}
            </button>
          )}
          {loaded && (
            <button
              type="button"
              className="quiet"
              onClick={async () => {
                try {
                  await api("/auth/logout", org, write("POST", {}));
                  setLoaded(false);
                  setOrg("");
                  setShipments([]);
                  setDashboard(null);
                } catch (e) {
                  setError(e);
                }
              }}
            >
              {t("wsSignOut")}
            </button>
          )}
        </div>
      </header>

      {error !== null && !denied && !(signedOut && status === 401) && (
        <div role="alert" className="ws-alert">
          <span>{errText(error)}</span>
          <button className="quiet" onClick={() => void load()}>
            {t("wsRetry")}
          </button>
        </div>
      )}

      {denied && (
        <Callout tone="block" title={t("wsDeniedTitle")}>
          {t("wsDeniedBody")}
        </Callout>
      )}

      {firstLoad && (
        <div role="status" aria-live="polite">
          <p className="ws-dim">{t("wsLoadingList")}</p>
          <Skeleton />
        </div>
      )}

      {signedOut && (
        <div className="ws-empty">
          <h2>{t("wsSignInTitle")}</h2>
          <p>{t("wsSignInBody")}</p>
          <button disabled={busy} onClick={() => void login()}>
            {t("wsSignIn")}
          </button>
          <Link href="/studio" className="ws-link">
            {t("wsOpenSample")}
          </Link>
        </div>
      )}

      {loaded && !org && !error && (
        <div className="ws-empty">
          <h2>{t("wsPickOrgTitle")}</h2>
          <p>{t("wsPickOrgBody")}</p>
        </div>
      )}

      {org && (
        <>
          {dashboard && (
            <dl className="ws-stats" aria-label={t("wsStatsLabel")}>
              <div>
                <dt>{t("wsPendingQa")}</dt>
                <dd className="num">{String(dashboard.pending_qa)}</dd>
              </div>
              {Object.entries(
                dashboard.shipment_counts as Record<string, number>,
              ).map(([s, count]) => (
                <div key={s}>
                  <dt>{STATUS_KEY[s] ? t(STATUS_KEY[s]) : s}</dt>
                  <dd className="num">{count}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="ws-filters">
            <label>
              <span>{t("wsSearch")}</span>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  requestVersion.current++;
                  setError(null);
                  setQuery(e.target.value);
                  sessionStorage.setItem("queue-query", e.target.value);
                }}
                placeholder={t("wsSearchHint")}
              />
            </label>
            <label>
              <span>{t("wsStatus")}</span>
              <select
                value={filter}
                onChange={(e) => {
                  requestVersion.current++;
                  setError(null);
                  setFilter(e.target.value);
                  sessionStorage.setItem("queue-filter", e.target.value);
                }}
              >
                <option value="">{t("wsAllStatuses")}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(STATUS_KEY[s])}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {creating && dataKey === scope && (
            <section className="ws-create" aria-labelledby="ws-create-h">
              <h2 id="ws-create-h">{t("wsCreateTitle")}</h2>
              {canCreate ? (
                <form noValidate onSubmit={create}>
                  {formError && (
                    <p role="alert" className="ws-alert">
                      {formError}
                    </p>
                  )}
                  <Field
                    name="reference"
                    label={t("wsFieldReference")}
                    error={fieldErrors.reference}
                  />
                  <Field
                    name="product"
                    label={t("wsFieldProduct")}
                    error={fieldErrors.product}
                    hint={products.length ? undefined : t("wsNoProducts")}
                  >
                    {(p) => (
                      <select {...p}>
                        <option value="">{t("wsSelectProduct")}</option>
                        {products.map((p) => (
                          <option key={String(p.id)} value={String(p.id)}>
                            {String(p.name)}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field
                    name="origin"
                    label={t("wsFieldOrigin")}
                    error={fieldErrors.origin}
                  />
                  <Field
                    name="destination"
                    label={t("wsFieldDestination")}
                    error={fieldErrors.destination}
                  />
                  <Field
                    name="departure"
                    label={t("wsFieldDeparture")}
                    error={fieldErrors.departure}
                    type="datetime-local"
                  />
                  <Field
                    name="arrival"
                    label={t("wsFieldArrival")}
                    error={fieldErrors.arrival}
                    type="datetime-local"
                  />
                  <Field
                    name="value"
                    label={t("wsFieldValue")}
                    error={fieldErrors.value}
                    type="number"
                    step="0.01"
                    min="0"
                  />
                  <div className="ws-form-actions">
                    <button disabled={busy}>{t("wsCreateShipment")}</button>
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => setCreating(false)}
                    >
                      {t("wsCancel")}
                    </button>
                  </div>
                </form>
              ) : (
                <Callout tone="warn">{t("wsCannotCreate")}</Callout>
              )}
            </section>
          )}

          {loading && (
            <div role="status" aria-live="polite">
              <p className="ws-dim">{t("wsLoadingList")}</p>
              <Skeleton />
            </div>
          )}

          {!loading && shipments.length > 0 && (
            <div
              className="ws-table-wrap"
              role="region"
              aria-label={t("wsListTitle")}
              tabIndex={0}
            >
              <table className="ws-table">
                <caption className="sr-only">{t("wsListTitle")}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t("wsColShipment")}</th>
                    <th scope="col">{t("wsColProduct")}</th>
                    <th scope="col">{t("wsColRoute")}</th>
                    <th scope="col">{t("wsColStatus")}</th>
                    <th scope="col">{t("wsColEvidence")}</th>
                    <th scope="col" className="ws-right">
                      {t("wsColValue")}
                    </th>
                    <th scope="col">{t("wsColCreated")}</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((s) => (
                    <tr key={String(s.id)}>
                      <td data-label={t("wsColShipment")}>
                        <Link
                          href={`/workspace/shipments/${s.id}?org=${org}`}
                          className="ws-ref"
                        >
                          {String(s.reference)}
                        </Link>
                        <small className="ws-dim">
                          {s.status === "DRAFT"
                            ? t("wsActionPrepare")
                            : s.status === "CANCELLED" || s.status === "CLOSED"
                              ? t("wsActionHistory")
                              : t("wsActionInspect")}
                        </small>
                      </td>
                      <td data-label={t("wsColProduct")}>
                        {productName(s.product_id) || (
                          <span className="ws-dim">—</span>
                        )}
                      </td>
                      <td data-label={t("wsColRoute")}>
                        {String((s.origin as Item)?.name || t("nodeOrigin"))}
                        <span aria-hidden="true"> → </span>
                        <span className="sr-only"> {t("wsTo")} </span>
                        {String(
                          (s.destination as Item)?.name || t("nodeReceiver"),
                        )}
                      </td>
                      <td data-label={t("wsColStatus")}>
                        <OpStatusBadge status={String(s.status)} />
                      </td>
                      <td data-label={t("wsColEvidence")}>
                        <AnalysisBadge value={classOf(s.id)} />
                      </td>
                      <td data-label={t("wsColValue")} className="ws-right num">
                        {money(s.cargo_value, s.currency, t("wsNotCalculated"))}
                      </td>
                      <td data-label={t("wsColCreated")} className="ws-dim">
                        {s.created_at ? fmt.date(s.created_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {empty && (
            <div className="ws-empty">
              <svg
                viewBox="0 0 120 56"
                width="120"
                height="56"
                aria-hidden="true"
              >
                <path
                  d="M6 40h30M52 40h24M92 40h22"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.5"
                />
                <circle
                  cx="44"
                  cy="40"
                  r="3"
                  fill="currentColor"
                  opacity="0.35"
                />
                <circle
                  cx="84"
                  cy="40"
                  r="3"
                  fill="currentColor"
                  opacity="0.35"
                />
              </svg>
              {filtered ? (
                <>
                  <h2>{t("wsNoMatchTitle")}</h2>
                  <p>{t("wsNoMatch")}</p>
                  <button
                    className="quiet"
                    onClick={() => {
                      setQuery("");
                      setFilter("");
                      sessionStorage.removeItem("queue-query");
                      sessionStorage.removeItem("queue-filter");
                    }}
                  >
                    {t("wsClearFilters")}
                  </button>
                </>
              ) : (
                <>
                  <h2>{t("wsEmptyTitle")}</h2>
                  <p>{t("wsEmptyBody")}</p>
                  {canCreate ? (
                    <button
                      onClick={() => {
                        setCreating(true);
                        setFieldErrors({});
                      }}
                    >
                      {t("wsCreateFirst")}
                    </button>
                  ) : (
                    <p>{t("wsCannotCreate")}</p>
                  )}
                </>
              )}
            </div>
          )}

          {dataKey === scope && nextCursor && (
            <button
              className="quiet ws-more"
              disabled={busy}
              onClick={() => void load(nextCursor)}
            >
              {t("wsLoadMore")}
            </button>
          )}
          <p className="ws-note">{t("wsListNote")}</p>
        </>
      )}
    </main>
  );
}

type InputProps = {
  id: string;
  name: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
};
/** Labelled field with an inline error directly below it. */
function Field({
  name,
  label,
  error,
  hint,
  type = "text",
  step,
  min,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  type?: string;
  step?: string;
  min?: string;
  children?: (props: InputProps) => React.ReactNode;
}) {
  const id = `f-${name}`;
  const props: InputProps = {
    id,
    name,
    "aria-invalid": !!error,
    "aria-describedby": error ? `${id}-err` : hint ? `${id}-hint` : undefined,
  };
  return (
    <div className="ws-field">
      <label htmlFor={id}>{label}</label>
      {children ? (
        children(props)
      ) : (
        <input {...props} type={type} step={step} min={min} />
      )}
      {hint && !error && (
        <small id={`${id}-hint`} className="ws-dim">
          {hint}
        </small>
      )}
      {error && (
        <span className="field-error" id={`${id}-err`}>
          {error}
        </span>
      )}
    </div>
  );
}
