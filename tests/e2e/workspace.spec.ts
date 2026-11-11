import { test, expect, type Page } from "@playwright/test";
import { freshAssumptions } from "../../apps/web/app/simulation-assumptions";
const web = process.env.CC_TEST_WEB || "http://localhost:3000";

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
        recent_analyses: [
          { id: "a1", classification: "INDETERMINATE", shipment_id: "ship" },
        ],
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
    if (path.startsWith("/decisions/"))
      return json({
        decision: (cfg.decisions ?? []).find(
          (d) => (d as { id: string }).id === path.split("/")[2],
        ),
      });
    return json({});
  });
}

const step = (page: Page, id: string) => page.locator(`li[data-step="${id}"]`);

test("stepper: no dataset blocks later steps and says why in words", async ({
  page,
}) => {
  await mock(page);
  await page.goto(`${web}/workspace/shipments/ship?org=org`);
  await expect(step(page, "evidence")).toHaveAttribute("data-state", "current");
  for (const id of ["simulate", "propose", "qa", "report"])
    await expect(step(page, id)).toHaveAttribute("data-state", "blocked");
  await expect(step(page, "simulate")).toContainText(
    "Upload a CSV and wait for a ready dataset first.",
  );
  await expect(step(page, "qa")).toContainText(
    "A proposal must be submitted to QA first.",
  );
  await expect(step(page, "report")).toContainText("frozen snapshot");
  // A blocked step does not open.
  await step(page, "simulate").getByRole("button").click({ force: true });
  await expect(
    page.getByRole("heading", { name: "Temperature evidence" }),
  ).toBeVisible();
});

test("stepper: ready dataset without an approved policy keeps simulate blocked", async ({
  page,
}) => {
  await mock(page, { datasets: [readyDataset], policies: [] });
  await page.goto(`${web}/workspace/shipments/ship?org=org`);
  await expect(step(page, "policy")).toHaveAttribute("data-state", "current");
  await expect(step(page, "simulate")).toHaveAttribute("data-state", "blocked");
  await expect(step(page, "simulate")).toContainText(
    "An approved policy is required first.",
  );
});

test("stepper: gaps in the readings are stated and never shown as compliant", async ({
  page,
}) => {
  await mock(page, {
    datasets: [readyDataset],
    policies: [approvedPolicy],
    workflow: workflow(false),
    analysis: analysis({
      classification: "INDETERMINATE",
      summary: { unknown_seconds: 1800 },
      unknown_intervals: [
        {
          sensor_id: "A",
          start_at: "2026-01-01T01:00:00Z",
          end_at: "2026-01-01T01:30:00Z",
          duration_seconds: 1800,
          classification: "UNKNOWN",
        },
      ],
    }),
  });
  await page.goto(`${web}/workspace/shipments/ship?org=org`);
  await expect(step(page, "evidence")).toContainText(
    "Readings have gaps. Analysis reports UNKNOWN intervals",
  );
  await step(page, "evidence").getByRole("button").click();
  await expect(page.locator(".ws-hatch").first()).toBeVisible();
  await expect(page.locator(".ws-legend").first()).toContainText(
    "Unknown interval",
  );
});

test("a BLOCKED option with a HARD_BLOCK cannot be proposed and says it cannot be overridden", async ({
  page,
}) => {
  await mock(page, {
    datasets: [readyDataset],
    policies: [approvedPolicy],
    workflow: workflow(true),
    scenarios: [
      {
        id: "s1",
        type: "CONTINUE_DELIVERY",
        eligibility: "BLOCKED",
        direct_incremental_cost: "0.00",
        additional_delay_minutes: 0,
        ranking_score: null,
        rule_results: [
          { rule_id: "R-HARD-1", effect: "HARD_BLOCK", matched: true },
        ],
        missing_information: [],
      },
    ],
  });
  await page.goto(`${web}/workspace/shipments/ship?org=org`);
  const region = page.getByRole("region", { name: "Simulation explorer" });
  await expect(region.locator(".result-card")).toContainText("Blocked");
  await expect(region.locator(".ws-rules")).toContainText("HARD_BLOCK");
  await expect(region.locator(".ws-rules")).toContainText(
    "Cannot be overridden by cost, delay, ranking weights, AI or QA review.",
  );
  await expect(
    page.getByRole("button", { name: "Prepare proposal" }),
  ).toHaveCount(0);
  await expect(step(page, "propose")).toHaveAttribute("data-state", "blocked");
  await expect(step(page, "propose")).toContainText("HARD_BLOCK");
});

test("an Admin without the QA role sees why there is no approve control", async ({
  page,
}) => {
  const decision = {
    id: "dec1",
    simulation_run_id: "r1",
    status: "PENDING_QA",
    revision: 2,
    created_at: "2026-01-01T02:00:00Z",
    justification: "Hold for inspection",
    submitted_by: "someone-else",
    snapshot_sha256: "a".repeat(64),
    snapshot: {
      dataset: { version: 2, sha256: "b".repeat(64) },
      policy: { policy_key: "DEMO-POLICY", version: 1 },
      analysis: { engine_version: "1.3.0", input_sha256: "c".repeat(64) },
      simulation: { engine_version: "1.0.0", template_version: "1.0.0" },
      scenario: { type: "HOLD_INSPECTION", eligibility: "REVIEW_REQUIRED" },
    },
  };
  await mock(page, {
    roles: ["ADMIN"],
    datasets: [readyDataset],
    policies: [approvedPolicy],
    workflow: workflow(true, decision),
    decisions: [decision],
    scenarios: [],
  });
  await page.goto(`${web}/workspace/shipments/ship?org=org`);
  await step(page, "qa").getByRole("button").click();
  await page.getByRole("button", { name: /Pending QA/ }).click();
  await expect(page.getByText("QA role required")).toBeVisible();
  await expect(page.getByLabel("Review outcome")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Confirm review outcome" }),
  ).toHaveCount(0);
  // The frozen snapshot is shown read-only with its hashes and versions.
  const snap = page.getByRole("region", { name: "Frozen snapshot" });
  await expect(snap).toContainText("Read-only");
  await expect(snap).toContainText("b".repeat(64));
  await expect(snap).toContainText("1.3.0");
});

test("Thai toggle translates the shipment list and the journey", async ({
  page,
}) => {
  await mock(page);
  await page.goto(`${web}/workspace`);
  await page.getByLabel("Organization", { exact: true }).selectOption("org");
  await expect(page.getByRole("link", { name: "WS-TEST-001" })).toBeVisible();
  await page.getByRole("button", { name: "ไทย" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "คิวการจัดส่ง",
  );
  await expect(
    page.getByRole("columnheader", { name: "เส้นทาง" }),
  ).toBeVisible();
  await expect(page.getByText("อยู่ระหว่างขนส่ง").first()).toBeVisible();
  await page.goto(`${web}/workspace/shipments/ship?org=org`);
  await expect(page.locator("html")).toHaveAttribute("lang", "th");
  await expect(
    page.getByRole("navigation", { name: "ขั้นตอนของการจัดส่ง" }),
  ).toBeVisible();
  await expect(step(page, "simulate")).toContainText("ยังเปิดไม่ได้");
  await expect(step(page, "simulate")).toContainText(
    "อัปโหลดไฟล์ CSV และรอให้ชุดข้อมูลพร้อมใช้งานก่อน",
  );
});

test("401 on the list asks to sign in, 403 explains the role", async ({
  page,
}) => {
  await page.route("http://localhost:8000/api/v1/**", (route) =>
    route.fulfill({
      status: 401,
      json: { detail: "Sign in required", code: "AUTH_REQUIRED" },
    }),
  );
  await page.goto(`${web}/workspace`);
  await expect(
    page.getByRole("button", { name: "Sign in with identity provider" }),
  ).toBeVisible();
  await page.unroute("http://localhost:8000/api/v1/**");
  await page.route("http://localhost:8000/api/v1/**", (route) =>
    route.fulfill({
      status: 403,
      json: { detail: "Role not allowed", code: "PERMISSION_DENIED" },
    }),
  );
  await page.reload();
  await expect(page.getByText("Your role cannot open this")).toBeVisible();
});

test("empty organization invites the first shipment", async ({ page }) => {
  await mock(page, { shipments: [] });
  await page.goto(`${web}/workspace`);
  await page.getByLabel("Organization", { exact: true }).selectOption("org");
  await expect(page.getByText("No shipments yet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create the first shipment" }),
  ).toBeVisible();
});

test("create form shows inline errors under the fields", async ({ page }) => {
  await mock(page);
  await page.goto(`${web}/workspace`);
  await page.getByLabel("Organization", { exact: true }).selectOption("org");
  await page
    .getByRole("button", { name: "Create shipment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create shipment", exact: true })
    .click();
  const reference = page.getByLabel("Reference", { exact: true });
  await expect(reference).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#f-reference-err")).toHaveText(
    "This field is required.",
  );
  await page.getByLabel("Departure (local time)").fill("2026-01-02T10:00");
  await page.getByLabel("Arrival (local time)").fill("2026-01-02T09:00");
  await page
    .getByRole("button", { name: "Create shipment", exact: true })
    .click();
  await expect(page.locator("#f-arrival-err")).toHaveText(
    "Arrival must be after departure.",
  );
});

for (const width of [320, 390]) {
  test(`no horizontal overflow on the list and every shipment step at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const decision = {
      id: "dec1",
      simulation_run_id: "r1",
      status: "PENDING_QA",
      revision: 2,
      created_at: "2026-01-01T02:00:00Z",
      justification: "Hold for inspection",
      submitted_by: "someone-else",
      snapshot_sha256: "a".repeat(64),
      snapshot: {
        dataset: { version: 2, sha256: "b".repeat(64) },
        policy: { policy_key: "DEMO-POLICY", version: 1 },
        analysis: { engine_version: "1.3.0", input_sha256: "c".repeat(64) },
        simulation: { engine_version: "1.0.0", template_version: "1.0.0" },
        scenario: { type: "HOLD_INSPECTION", eligibility: "REVIEW_REQUIRED" },
      },
    };
    await mock(page, {
      roles: ["QA"],
      datasets: [readyDataset],
      policies: [approvedPolicy],
      workflow: workflow(true, decision),
      decisions: [decision],
      scenarios: [
        {
          id: "s1",
          type: "CONTINUE_DELIVERY",
          eligibility: "REVIEW_REQUIRED",
          direct_incremental_cost: "0.00",
          additional_delay_minutes: 0,
          ranking_score: "1",
          rule_results: [],
          missing_information: [],
        },
      ],
    });
    const over = () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
    await page.goto(`${web}/workspace`);
    await page.getByLabel("Organization", { exact: true }).selectOption("org");
    await expect(page.getByRole("link", { name: "WS-TEST-001" })).toBeVisible();
    expect(await over()).toBeLessThanOrEqual(0);
    await page.goto(`${web}/workspace/shipments/ship?org=org`);
    await expect(
      page.getByRole("navigation", { name: "Shipment journey" }),
    ).toBeVisible();
    for (const id of [
      "evidence",
      "policy",
      "simulate",
      "propose",
      "qa",
      "report",
    ]) {
      await step(page, id).getByRole("button").click();
      await page.waitForTimeout(150);
      expect(await over(), `step ${id}`).toBeLessThanOrEqual(0);
    }
  });
}
