const web = process.env.CC_TEST_WEB || "http://localhost:3000";
import { test, expect } from "@playwright/test";
for (const width of [1440, 768, 375, 320]) {
  test(`evidence precedes actions and chart labels remain readable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${web}/demo`);
    const viewport = page.locator(".network-canvas");
    await expect(viewport).toHaveAttribute("data-init-ms", /\d+/);
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
    const evidence = page.getByRole("heading", {
      name: "Temperature evidence",
      exact: true,
    });
    const scenario = page.getByRole("table").filter({
      has: page.getByRole("button", {
        name: "Continue delivery",
        exact: true,
      }),
    });
    expect((await evidence.boundingBox())!.y).toBeLessThan(
      (await scenario.boundingBox())!.y,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const comparison = page.getByRole("heading", {
      name: "Understand the trade-offs.",
    });
    const preview = page.getByRole("button", { name: "Preview demo proposal" });
    expect((await comparison.boundingBox())!.y).toBeLessThan(
      (await preview.boundingBox())!.y,
    );
    const label = page.locator(".demo-chart text").first();
    expect(
      await label.evaluate((el) => {
        const m = (el as SVGGraphicsElement).getScreenCTM()!;
        return parseFloat(getComputedStyle(el).fontSize) * m.a;
      }),
    ).toBeGreaterThanOrEqual(12);
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
            page
              .getByText("Alternative receiver (unconfirmed)", {
                exact: false,
              })
              .first(),
          ).toBeVisible();
      }
    }
    await expect(page.getByText("6 / 9 readings available")).toBeVisible();
    await page.getByRole("button", { name: "Preview demo proposal" }).click();
    await expect(
      page.getByText("No proposal was saved or submitted."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reset demo" }).click();
    await expect(page.getByLabel("Example shipment")).toHaveValue("0");
    await page.screenshot({
      path: `test-results/evidence-demo-${width}.png`,
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
  await expect(page.locator(".queue-summary")).toBeVisible();
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
  await expect(
    page.getByText("Complete an analysis to unlock scenario comparison."),
  ).toBeVisible();
  await page.getByRole("button", { name: /Pending qa/ }).click();
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
  expect(submitted).toMatchObject({
    acknowledged_required_actions: ["HOLD_IN_CONTROLLED_STORAGE"],
    evidence_references: ["reference:reference-demo"],
  });
});
