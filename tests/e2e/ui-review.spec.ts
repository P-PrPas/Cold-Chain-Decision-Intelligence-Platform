const web = process.env.CC_TEST_WEB || "http://localhost:3000";
import { test, expect } from "@playwright/test";
// Returning visitor: skip the first-visit autoplay so the sandbox starts at the decision point.
async function returning(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("cc-studio-visited", "1");
    localStorage.setItem("cc-studio-coach", "1");
  });
}
for (const width of [1440, 768, 375, 320]) {
  test(`3D first, persistent canvas, evidence gate and readable timeline labels at ${width}px`, async ({
    page,
  }) => {
    await returning(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${web}/studio`);
    const viewport = page.locator(".network-canvas");
    await expect(viewport).toHaveAttribute("data-init-ms", /\d+/);
    await expect(viewport).toHaveAttribute("data-draw-calls", /\d+/);
    const sceneBudget = await viewport.evaluate((el) => ({
      draws: Number((el as HTMLElement).dataset.drawCalls),
      triangles: Number((el as HTMLElement).dataset.triangles),
      markersVisible: [...el.querySelectorAll(".network-marker")].every(
        (marker) => {
          const rect = marker.getBoundingClientRect(),
            bounds = el.getBoundingClientRect();
          return (
            rect.left >= bounds.left &&
            rect.right <= bounds.right &&
            rect.top >= bounds.top &&
            rect.bottom <= bounds.bottom
          );
        },
      ),
    }));
    expect(sceneBudget.draws).toBeLessThan(100);
    expect(sceneBudget.triangles).toBeLessThan(20000);
    expect(sceneBudget.markersVisible).toBe(true);
    const scenario = page.getByRole("group", { name: "Select scenario" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const box = (await viewport.boundingBox())!;
    expect(box.y).toBeLessThan(width >= 1000 ? 400 : 420);
    expect(box.y + box.height).toBeLessThan(900);
    expect(box.height).toBeGreaterThanOrEqual(190);
    // The h1 is visible, not screen-reader only.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Synthetic demo only")).toBeVisible();
    if (width <= 760)
      await page.getByRole("button", { name: "Adjust assumptions" }).click();
    const delay = page.getByRole("slider", { name: "Additional delay slider" });
    // The sheet scrolls on small screens; bring the control into view first.
    await delay.scrollIntoViewIfNeeded();
    const controlBox = (await delay.boundingBox())!;
    expect(controlBox.y + controlBox.height).toBeLessThan(900);
    const canvas = await viewport.locator("canvas").elementHandle();
    await delay.fill("135");
    if (width <= 760)
      await page.getByRole("button", { name: "Hide assumptions" }).click();
    await page
      .getByRole("button", { name: "Follow truck", exact: true })
      .click();
    expect(await canvas!.evaluate((el) => el.isConnected)).toBe(true);
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    expect(await canvas!.evaluate((el) => el.isConnected)).toBe(true);
    // Timeline axis labels stay readable.
    const label = page.locator(".tl-axis span").first();
    expect(
      await label.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(12);
    await expect(
      page.getByRole("button", { name: "Preview demo proposal" }),
    ).toBeDisabled();
    for (const shipment of ["0", "1", "2"]) {
      await page.getByLabel("Example shipment").selectOption(shipment);
      for (const action of [
        "Continue delivery",
        "Hold for inspection",
        "Conditional reroute",
        "Reject / quarantine / dispose",
      ]) {
        await scenario
          .getByRole("button", { name: action, exact: true })
          .click();
        await expect(
          scenario.getByRole("button", { name: action, exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        if (action === "Conditional reroute")
          await expect(
            page.locator(".network-name").filter({ hasText: "Alternative" }),
          ).toBeVisible();
      }
    }
    await expect(page.locator(".evidence-facts")).toContainText(
      "6 / 9 readings available",
    );
    await page
      .getByLabel(
        "I reviewed the synthetic evidence and its limitations for this selection.",
      )
      .check();
    await page.getByRole("button", { name: "Preview demo proposal" }).click();
    await expect(
      page.getByText("No proposal was saved or submitted."),
    ).toBeVisible();
    // Reset returns the current example to its prepared estimates and clears the preview.
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByLabel("Example shipment")).toHaveValue("2");
    await expect(
      page.getByText("No proposal was saved or submitted."),
    ).not.toBeVisible();
    await page.screenshot({
      path: `test-results/studio-${width}.png`,
      fullPage: true,
    });
  });
}
test("work queue shows organization name and keeps create form closed", async ({
  page,
}) => {
  await page.goto(`${web}/workspace`);
  await page
    .getByRole("button", { name: "Sign in with identity provider" })
    .click();
  await page.locator("#username").fill("operator");
  await page.locator("#password").fill("synthetic-demo-only");
  await page.locator("#kc-login").click();
  await expect(
    page.getByRole("heading", { name: "Shipment queue" }),
  ).toBeVisible();
  await expect(page.getByLabel("Organization")).toContainText(
    "Synthetic Foods",
  );
  await expect(
    page.getByRole("heading", { name: "Create shipment", exact: true }),
  ).not.toBeVisible();
  await expect(page.locator(".ws-stats")).toBeVisible();
  await expect(page.getByRole("status")).not.toBeVisible();
  await page.screenshot({
    path: "test-results/work-queue.png",
    fullPage: true,
  });
});
test("QA requires explicit acknowledgement and sends only the checked action", async ({
  page,
}) => {
  const decision = {
    id: "decision-demo",
    simulation_run_id: "run-demo",
    status: "PENDING_QA",
    revision: 2,
    created_at: "2026-11-11T08:00:00Z",
    justification: "Inspect temperature evidence",
    submitted_by: "operator",
    snapshot_sha256: "demo-hash",
    snapshot: {
      shipment: { reference: "UI-TEST" },
      dataset: { version: 1 },
      policy: { policy_key: "Synthetic policy", version: 1 },
      analysis: { classification: "REVIEW_REQUIRED" },
      scenario: { type: "HOLD_INSPECTION" },
    },
  };
  let submitted: Record<string, unknown> | null = null;
  await page.route("http://localhost:8000/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path.endsWith("/auth/me"))
      body = {
        user: { id: "reviewer" },
        memberships: [{ organization_id: "org-demo", roles: ["QA"] }],
      };
    else if (path.endsWith("/shipments/shipment-demo"))
      body = {
        shipment: {
          id: "shipment-demo",
          reference: "UI-TEST",
          status: "DRAFT",
          revision: 1,
          product_id: "product-demo",
          cargo_value: "100",
          currency: "THB",
        },
      };
    else if (path.endsWith("/workflow"))
      body = { decision: submitted ? { status: "APPROVED" } : null };
    else if (path.endsWith("/temperature-datasets")) body = { items: [] };
    else if (path.endsWith("/simulations/run-demo"))
      body = { simulation: { id: "run-demo", shipment_id: "shipment-demo" } };
    else if (path.endsWith("/decisions"))
      body = { items: [decision], next_cursor: null };
    else if (path.endsWith("/decisions/decision-demo")) body = { decision };
    else if (path.endsWith("/reference-documents"))
      body = { reference_document: { id: "reference-demo" } };
    else if (path.endsWith("/approve")) {
      submitted = route.request().postDataJSON();
      body = { decision: { ...decision, status: "APPROVED", revision: 3 } };
    }
    await route.fulfill({ json: body });
  });
  await page.goto(`${web}/workspace/shipments/shipment-demo?org=org-demo`);
  // Without a ready dataset the simulate step is blocked and says why.
  await expect(page.locator('li[data-step="simulate"]')).toHaveAttribute(
    "data-state",
    "blocked",
  );
  await expect(
    page
      .locator('li[data-step="simulate"]')
      .getByText("Upload a CSV and wait for a ready dataset first."),
  ).toBeVisible();
  await page.getByRole("button", { name: /Pending QA/ }).click();
  await page.getByLabel("Review outcome").selectOption("approve");
  await page
    .getByLabel("Review notes", { exact: true })
    .fill("Reviewed the pinned synthetic evidence.");
  await page.getByLabel("Supporting reference document").setInputFiles({
    name: "qa-reference.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Synthetic review evidence"),
  });
  await page.getByRole("button", { name: "Confirm review outcome" }).click();
  expect(submitted).toBeNull();
  await page
    .getByLabel("I confirm the required hold in controlled storage.")
    .check();
  await page
    .getByLabel("I have reviewed the evidence and understand this action.")
    .check();
  await page.getByRole("button", { name: "Confirm review outcome" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Decision updated: Approved" }),
  ).toBeVisible();
  await expect(page.locator(".saved-workflow")).toContainText("APPROVED");
  expect(submitted).toMatchObject({
    acknowledged_required_actions: ["HOLD_IN_CONTROLLED_STORAGE"],
    evidence_references: ["reference:reference-demo"],
  });
});
