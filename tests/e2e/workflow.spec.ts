import {
  test,
  expect,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import { readFileSync } from "node:fs";
const api = "http://localhost:8000/api/v1";
async function signIn(browser: Browser, user: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("http://localhost:3000/workspace");
  await page
    .getByRole("button", { name: "Sign in with identity provider" })
    .click();
  await page.locator("#username").fill(user);
  await page.locator("#password").fill("synthetic-demo-only");
  await page.locator("#kc-login").click();
  await page.waitForURL("http://localhost:3000/workspace");
  const me = await context.request.get(api + "/auth/me");
  expect(me.ok(), await me.text()).toBeTruthy();
  return { context, page, me: await me.json() };
}
async function call(
  context: BrowserContext,
  org: string,
  path: string,
  method = "GET",
  data?: unknown,
  revision?: string,
) {
  const csrf =
    (await context.cookies()).find((c) => c.name === "cc_csrf")?.value || "";
  const response = await context.request.fetch(api + path, {
    method,
    data,
    headers: {
      "X-Organization-Id": org,
      "X-CSRF-Token": csrf,
      "Idempotency-Key": crypto.randomUUID(),
      ...(revision ? { "If-Match": revision } : {}),
    },
  });
  expect(
    response.ok(),
    `${method} ${path}: ${await response.text()}`,
  ).toBeTruthy();
  return response.json();
}
async function job(context: BrowserContext, org: string, id: string) {
  await expect
    .poll(
      async () => {
        const result = await call(context, org, `/jobs/${id}`);
        if (result.job.status === "FAILED")
          throw new Error(JSON.stringify(result));
        return result.job.status;
      },
      { timeout: 90000, intervals: [1000, 2000, 3000] },
    )
    .toBe("COMPLETED");
}

test("OIDC -> shipment -> CSV -> policy -> analysis -> simulation -> independent QA -> private PDF", async ({
  browser,
}) => {
  const operator = await signIn(browser, "operator");
  const reviewer = await signIn(browser, "reviewer");
  const org = operator.me.memberships[0].organization_id;
  const createdProduct = await call(
    operator.context,
    org,
    "/products",
    "POST",
    {
      name: "E2E product " + Date.now(),
      category: "TEST",
      packaging_type: "DEMO",
    },
  );
  await operator.page.reload();
  await operator.page
    .getByLabel("Organization", { exact: true })
    .selectOption(org);
  await operator.page
    .getByRole("button", { name: "Create shipment", exact: true })
    .click();
  await operator.page
    .getByLabel("Reference", { exact: true })
    .fill("E2E-" + Date.now());
  const products = { items: [createdProduct.product] };
  await operator.page
    .getByLabel("Product", { exact: true })
    .selectOption(products.items[0].id);
  await operator.page
    .getByLabel("Origin", { exact: true })
    .fill("Synthetic origin");
  await operator.page
    .getByLabel("Destination", { exact: true })
    .fill("Synthetic receiver");
  await operator.page
    .getByLabel("Departure (local time)", { exact: true })
    .fill("2026-01-01T00:00");
  await operator.page
    .getByLabel("Arrival (local time)", { exact: true })
    .fill("2026-01-01T02:00");
  await operator.page
    .getByLabel("Cargo value (THB)", { exact: true })
    .fill("1000.00");
  const [createdShipment] = await Promise.all([
    operator.page.waitForResponse(
      (response) =>
        response.url() === api + "/shipments" &&
        response.request().method() === "POST",
    ),
    operator.page
      .getByRole("button", { name: "Create shipment", exact: true })
      .click(),
  ]);
  expect(createdShipment.ok(), await createdShipment.text()).toBeTruthy();
  const shipment = (await createdShipment.json()).shipment;
  expect(shipment.product_id).toBe(createdProduct.product.id);
  await expect(
    operator.page.getByRole("link", { name: shipment.reference, exact: true }),
  ).toBeVisible();
  const csrf = (await operator.context.cookies()).find(
    (c) => c.name === "cc_csrf",
  )!.value;
  const upload = await operator.context.request.post(
    api + `/shipments/${shipment.id}/temperature-datasets`,
    {
      headers: {
        "X-Organization-Id": org,
        "X-CSRF-Token": csrf,
        "Idempotency-Key": crypto.randomUUID(),
      },
      multipart: {
        mapping: JSON.stringify({
          timestamp: "timestamp",
          temperature: "temperature_c",
          sensor_id: "sensor_id",
        }),
        file: {
          name: "normal.csv",
          mimeType: "text/csv",
          buffer: readFileSync("tests/fixtures/normal.csv"),
        },
      },
    },
  );
  expect(upload.ok(), await upload.text()).toBeTruthy();
  const imported = await upload.json();
  await job(operator.context, org, imported.job.id);
  const reference = await operator.context.request.post(
    api + "/reference-documents",
    {
      headers: { "X-Organization-Id": org, "X-CSRF-Token": csrf },
      multipart: {
        file: {
          name: "synthetic-reference.txt",
          mimeType: "text/plain",
          buffer: Buffer.from(
            "Synthetic fixture oracle. Not real safety approval.",
          ),
        },
      },
    },
  );
  expect(reference.ok()).toBeTruthy();
  const ref = (await reference.json()).reference_document;
  const policy = (
    await call(operator.context, org, "/quality-policies", "POST", {
      product_id: shipment.product_id,
      policy_key: "E2E-" + Date.now(),
      version: 1,
      reference_document_id: ref.id,
      effective_from: "2025-01-01T00:00:00Z",
      rules: {
        schema_version: "1.0",
        required_sensor_ids: ["A"],
        max_valid_sampling_gap_seconds: 600,
        temperature_bounds: { min_c: "2", max_c: "8" },
        continuous_excursion_limit_seconds: 300,
        cumulative_excursion_limit_seconds: 600,
        unknown_gap_effect: "REVIEW_REQUIRED",
        action_constraints: [],
      },
    })
  ).quality_policy;
  await call(
    operator.context,
    org,
    `/quality-policies/${policy.id}/submit-review`,
    "POST",
    { note: "Synthetic review" },
    '"policy-r1"',
  );
  await call(
    reviewer.context,
    org,
    `/quality-policies/${policy.id}/approve`,
    "POST",
    { approval_note: "Synthetic test only" },
    '"policy-r2"',
  );
  const analysis = await call(
    operator.context,
    org,
    `/shipments/${shipment.id}/analyses`,
    "POST",
    {
      dataset_id: imported.dataset.id,
      policy_version_id: policy.id,
      selected_sensor_ids: ["A"],
    },
  );
  await job(operator.context, org, analysis.job.id);
  const simulation = await call(
    operator.context,
    org,
    `/shipments/${shipment.id}/simulations`,
    "POST",
    {
      analysis_id: analysis.analysis.id,
      dataset_id: imported.dataset.id,
      policy_version_id: policy.id,
      currency: "THB",
      scenario_types: ["HOLD_INSPECTION"],
      scenarios: [
        {
          type: "HOLD_INSPECTION",
          estimated_delay_minutes: 30,
          receiver_acceptance: "UNKNOWN",
          costs: Object.fromEntries(
            [
              "additional_transport",
              "inspection",
              "holding",
              "handling",
              "disposal",
              "other",
            ].map((name) => [
              name,
              { amount: "1.00", source: "USER_ESTIMATE" },
            ]),
          ),
        },
      ],
      ranking_weights: { cost: "0.60", delay: "0.40" },
    },
  );
  await job(operator.context, org, simulation.job.id);
  const scenarios = await call(
    operator.context,
    org,
    `/simulations/${simulation.simulation.id}/scenarios`,
  );
  expect(scenarios.items[0].direct_incremental_cost).toBe("6.00");
  const decision = (
    await call(operator.context, org, "/decisions", "POST", {
      simulation_run_id: simulation.simulation.id,
      selected_scenario_id: scenarios.items[0].id,
      justification: "Hold for inspection",
    })
  ).decision;
  const submitted = await call(
    operator.context,
    org,
    `/decisions/${decision.id}/submit`,
    "POST",
    { justification: "Hold for independent review" },
    '"decision-r1"',
  );
  const approved = await call(
    reviewer.context,
    org,
    `/decisions/${decision.id}/approve`,
    "POST",
    {
      acting_role: "QA",
      review_notes: "Synthetic evidence reviewed",
      evidence_references: ["reference:" + ref.id],
      acknowledged_required_actions: ["HOLD_IN_CONTROLLED_STORAGE"],
    },
    '"decision-r2"',
  );
  expect(approved.decision.snapshot_sha256).toBe(
    submitted.decision.snapshot_sha256,
  );
  const report = await call(
    operator.context,
    org,
    `/decisions/${decision.id}/reports`,
    "POST",
    { format: "PDF", language: "en" },
  );
  await job(operator.context, org, report.job.id);
  const pdf = await operator.context.request.get(
    api + `/reports/${report.report.id}/download`,
    { headers: { "X-Organization-Id": org } },
  );
  expect(pdf.ok()).toBeTruthy();
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await operator.page.goto(
    `http://localhost:3000/workspace/shipments/${shipment.id}?org=${org}`,
  );
  const journey = operator.page.getByRole("navigation", {
    name: "Shipment journey",
  });
  await expect(journey).toBeVisible();
  const open = async (step: string) =>
    operator.page.locator(`li[data-step="${step}"] button`).click();
  await open("evidence");
  await expect(
    operator.page.getByRole("heading", { name: "Temperature evidence" }),
  ).toBeVisible();
  await open("propose");
  await expect(
    operator.page.getByRole("heading", { name: "Proposal", exact: true }),
  ).toBeVisible();
  await open("qa");
  await expect(
    operator.page.getByRole("heading", { name: "QA review", exact: true }),
  ).toBeVisible();
  await open("report");
  await expect(
    operator.page.getByRole("heading", { name: "Report", exact: true }),
  ).toBeVisible();
  await operator.context.close();
  await reviewer.context.close();
});
