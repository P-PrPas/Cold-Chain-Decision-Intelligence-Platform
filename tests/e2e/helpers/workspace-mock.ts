import { type Page } from "@playwright/test";
import { freshAssumptions } from "../../../apps/web/lib/simulation-assumptions";

type Cfg = {
  roles?: string[];
  datasets?: unknown[];
  policies?: unknown[];
  workflow?: unknown;
  analysis?: unknown;
  scenarios?: unknown[];
  decisions?: unknown[];
  shipments?: unknown[];
};

const shipment = {
  id: "ship",
  reference: "WS-TEST-001",
  product_id: "product",
  status: "IN_TRANSIT",
  revision: 1,
  currency: "THB",
  cargo_value: "1000",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: null,
  last_activity_at: "2026-01-02T03:04:00Z",
  evidence: {
    analysis_id: "a1",
    classification: "INDETERMINATE",
    unknown_seconds: 1800,
    excursion_count: 0,
    coverage_window_known: true,
    coverage_window: {
      start_at: "2026-01-01T00:00:00+00:00",
      end_at: "2026-01-01T06:00:00+00:00",
    },
  },
  origin: { name: "Chiang Mai DC" },
  destination: { name: "Bangkok receiver" },
};
const readyDataset = { id: "d1", version: 1, status: "READY" };
const approvedPolicy = {
  id: "p1",
  policy_key: "DEMO-POLICY",
  version: 1,
  status: "APPROVED",
  revision: 3,
  rules: { required_sensor_ids: ["A"] },
};
const analysis = (extra: object = {}) => ({
  id: "a1",
  status: "COMPLETED",
  classification: "NORMAL",
  dataset_id: "d1",
  policy_version_id: "p1",
  summary: { unknown_seconds: 0 },
  rule_results: [],
  unknown_intervals: [],
  excursions: [],
  ...extra,
});
const workflow = (run = true, decision: unknown = null) => ({
  analysis: { id: "a1", created_at: "2026-01-01T00:00:00Z" },
  simulation: run
    ? { id: "r1", analysis_id: "a1", created_at: "2026-01-01T01:00:00Z" }
    : null,
  decision,
  approved_decision: null,
});

async function mock(page: Page, cfg: Cfg = {}) {
  await page.route("http://localhost:8000/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const json = (body: unknown) => route.fulfill({ json: body });
    if (path === "/auth/me")
      return json({
        user: { id: "u" },
        memberships: [
          { organization_id: "org", roles: cfg.roles ?? ["LOGISTICS"] },
        ],
      });
    if (path === "/organizations/current")
      return json({ organization: { name: "Synthetic Foods" } });
    if (path === "/products")
      return json({
        items: [{ id: "product", name: "Fresh strawberries (demo)" }],
      });
    if (path === "/products/product")
      return json({ product: { name: "Fresh strawberries (demo)" } });
    if (path === "/dashboard")
      return json({
        shipment_counts: { IN_TRANSIT: 1 },
        pending_qa: 0,
        recent_analyses: [],
      });
    if (path === "/shipments")
      return json({ items: cfg.shipments ?? [shipment], next_cursor: null });
    if (path === "/shipments/ship") return json({ shipment });
    if (path === "/shipments/ship/workflow")
      return json(
        cfg.workflow ?? {
          analysis: null,
          simulation: null,
          decision: null,
          approved_decision: null,
        },
      );
    if (path === "/shipments/ship/temperature-datasets")
      return json({ items: cfg.datasets ?? [] });
    if (path === "/quality-policies")
      return json({ items: cfg.policies ?? [] });
    if (path === "/shipments/ship/analyses") return json({ items: [] });
    if (path === "/analyses/a1")
      return json({ analysis: cfg.analysis ?? analysis() });
    if (path === "/temperature-datasets/d1/validation")
      return json({ status: "READY", invalid_rows: 0, errors: [] });
    if (path === "/temperature-datasets/d1/readings")
      return json({
        items: [3, 3.4, 8.9, 9.1].map((v, i) => ({
          id: `r${i}`,
          sensor_id: "A",
          timestamp_utc: `2026-01-01T0${i}:00:00Z`,
          temperature_c: String(v),
          source_row: i + 2,
        })),
        next_cursor: null,
      });
    if (path === "/simulations/r1")
      return json({
        simulation: {
          id: "r1",
          analysis_id: "a1",
          parameters: {
            ...freshAssumptions(),
            analysis_id: "a1",
            dataset_id: "d1",
            policy_version_id: "p1",
          },
        },
      });
    if (path === "/simulations/r1/scenarios")
      return json({ items: cfg.scenarios ?? [] });
    if (path === "/decisions")
      return json({ items: cfg.decisions ?? [], next_cursor: null });
    if (path.endsWith("/reports"))
      return route.fulfill({
        status: 202,
        json: { report: { id: "rep1", status: "QUEUED" }, job: { id: "j1" } },
      });
    if (path.startsWith("/decisions/"))
      return json({
        decision: (cfg.decisions ?? []).find(
          (d) => (d as { id: string }).id === path.split("/")[2],
        ),
      });
    return json({});
  });
}

export { mock, readyDataset, approvedPolicy, analysis, workflow, shipment };
export type { Cfg };
