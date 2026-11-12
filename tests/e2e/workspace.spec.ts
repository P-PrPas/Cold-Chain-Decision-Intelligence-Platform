import { test, expect, type Page } from "@playwright/test";
import {
  analysis,
  approvedPolicy,
  mock,
  readyDataset,
  shipment,
  workflow,
} from "./helpers/workspace-mock";
const web = process.env.CC_TEST_WEB || "http://localhost:3000";

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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("คิวการจัดส่ง");
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

test("list shows last activity and stored evidence, unknown time is never compliant", async ({
  page,
}) => {
  await mock(page);
  await page.goto(`${web}/workspace`);
  await page.getByLabel("Organization", { exact: true }).selectOption("org");
  const row = page.getByRole("row", { name: /WS-TEST-001/ });
  await expect(row).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Last activity" }),
  ).toBeVisible();
  await expect(row).toContainText("2 Jan 2026");
  await expect(row).toContainText("Unknown time: 30 min");
  await expect(row.locator('[data-analysis="INDETERMINATE"]')).toBeVisible();
  await expect(row).not.toContainText(/compliant|safe|certified/i);
  await page.getByRole("button", { name: "ไทย" }).click();
  await expect(
    page.getByRole("columnheader", { name: "กิจกรรมล่าสุด" }),
  ).toBeVisible();
  await expect(row).toContainText("เวลาที่ไม่ทราบ: 30 นาที");
});

test("a shipment without analysis shows no evidence instead of a guess", async ({
  page,
}) => {
  await mock(page, {
    shipments: [
      { ...shipment, evidence: null, last_activity_at: shipment.created_at },
    ],
  });
  await page.goto(`${web}/workspace`);
  await page.getByLabel("Organization", { exact: true }).selectOption("org");
  const row = page.getByRole("row", { name: /WS-TEST-001/ });
  await expect(row).toBeVisible();
  await expect(row).not.toContainText("Unknown time");
  await expect(row.locator("[data-analysis]")).toHaveCount(0);
});

for (const lang of ["en", "th"]) {
  test(`report request sends the interface language (${lang})`, async ({
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
    await page.addInitScript((l) => localStorage.setItem("cc-lang", l), lang);
    await mock(page, {
      roles: ["ADMIN"],
      datasets: [readyDataset],
      policies: [approvedPolicy],
      workflow: workflow(true, decision),
      decisions: [decision],
      scenarios: [],
    });
    await page.goto(`${web}/workspace/shipments/ship?org=org`);
    await step(page, "report").getByRole("button").click();
    await page
      .getByRole("button", { name: /Pending QA|รอ QA/ })
      .first()
      .click();
    const sent = page.waitForRequest(
      (r) =>
        r.url().endsWith("/decisions/dec1/reports") && r.method() === "POST",
    );
    await page
      .getByRole("button", {
        name: lang === "th" ? "สร้างรายงาน PDF" : "Generate PDF report",
      })
      .click();
    expect((await sent).postDataJSON()).toEqual({
      format: "PDF",
      language: lang,
    });
    await expect(
      page.getByText(/generated in English|สร้างเป็นภาษาอังกฤษ/),
    ).toHaveCount(0);
  });
}
