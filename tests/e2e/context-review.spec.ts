import { freshAssumptions } from "../../apps/web/app/simulation-assumptions";
import { test, expect } from "@playwright/test";
const web = process.env.CC_TEST_WEB || "http://localhost:3000";
test("organization responses cannot overwrite the current scope; server search and pagination", async ({
  page,
}) => {
  await page.route("http://localhost:8000/api/v1/**", async (route) => {
    const u = new URL(route.request().url());
    const org = route.request().headers()["x-organization-id"];
    let json: unknown = {};
    if (u.pathname.endsWith("/auth/me"))
      json = {
        memberships: [
          { organization_id: "a", roles: ["ADMIN"] },
          { organization_id: "b", roles: ["ADMIN"] },
        ],
        user: { id: "u" },
      };
    else if (u.pathname.endsWith("/organizations/current"))
      json = { organization: { name: org === "a" ? "Alpha" : "Beta" } };
    else if (u.pathname.endsWith("/products")) json = { items: [] };
    else if (u.pathname.endsWith("/dashboard"))
      json = { shipment_counts: { DRAFT: 30 }, pending_qa: 0 };
    else if (u.pathname.endsWith("/shipments")) {
      await new Promise((r) => setTimeout(r, org === "a" ? 250 : 70));
      if (org === "b") {
        await route.fulfill({
          status: 503,
          json: { detail: "Beta unavailable" },
        });
        return;
      }
      const suffix =
        u.searchParams.get("q") ||
        (u.searchParams.get("cursor") ? "last" : "first");
      json = {
        items: [
          {
            id: suffix,
            reference: "Alpha " + suffix,
            status: "DRAFT",
            origin: { name: "Origin" },
            destination: { name: "Destination" },
            cargo_value: "1000.00",
            currency: "THB",
          },
        ],
        next_cursor: suffix === "first" ? "page2" : null,
      };
    }
    await route.fulfill({ json });
  });
  await page.goto(web + "/workspace");
  await page.getByLabel("Organization", { exact: true }).selectOption("a");
  await page.getByLabel("Organization", { exact: true }).selectOption("b");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Beta unavailable",
  );
  await expect(
    page.getByText("Alpha first", { exact: true }),
  ).not.toBeVisible();
  await page.getByLabel("Organization", { exact: true }).selectOption("a");
  await expect(page.getByText("Alpha first", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load more shipments" }).click();
  await expect(page.getByText("Alpha last", { exact: true })).toBeVisible();
  await page.getByLabel("Search all shipments").fill("far-away");
  await expect(page.getByText("Alpha far-away", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Search all shipments")).not.toBeVisible();
  await page.getByLabel("Organization", { exact: true }).selectOption("a");
  await expect(page.getByLabel("Search all shipments")).toHaveValue("far-away");
});
test("changing analysis clears old results and proposal; failed recalculation stays unavailable", async ({
  page,
}) => {
  const shipment = {
    id: "ship",
    reference: "TEST-SOURCE",
    product_id: "product",
    status: "ARRIVED",
    revision: 1,
    currency: "THB",
    cargo_value: "1000",
    origin: { name: "A" },
    destination: { name: "B" },
  };
  await page.route("http://localhost:8000/api/v1/**", async (route) => {
    const u = new URL(route.request().url());
    const path = u.pathname;
    let json: unknown = {};
    if (path.endsWith("/auth/me"))
      json = {
        user: { id: "u" },
        memberships: [{ organization_id: "org", roles: ["LOGISTICS"] }],
      };
    else if (path.endsWith("/workflow"))
      json = {
        analysis: { id: "a1", created_at: "2026-01-01T00:00:00Z" },
        simulation: {
          id: "r1",
          analysis_id: "a1",
          created_at: "2026-01-01T01:00:00Z",
        },
        decision: { status: "APPROVED" },
        approved_decision: { status: "APPROVED" },
      };
    else if (path.endsWith("/shipments/ship")) json = { shipment };
    else if (path.endsWith("/temperature-datasets"))
      json = { items: [{ id: "data", version: 1, status: "READY" }] };
    else if (path.endsWith("/quality-policies")) json = { items: [] };
    else if (path.endsWith("/shipments/ship/analyses"))
      json = {
        items: [
          { id: "a1", shipment_id: "ship", classification: "NORMAL" },
          { id: "a2", shipment_id: "ship", classification: "WARNING" },
        ],
      };
    else if (path.includes("/analyses/"))
      json = {
        analysis: {
          id: path.endsWith("a2") ? "a2" : "a1",
          status: "COMPLETED",
          dataset_id: "data",
          policy_version_id: "policy",
          summary: {},
        },
      };
    else if (path.endsWith("/simulations/r1"))
      json = {
        simulation: {
          id: "r1",
          analysis_id: "a1",
          parameters: {
            ...freshAssumptions(),
            analysis_id: "a1",
            dataset_id: "data",
            policy_version_id: "policy",
          },
        },
      };
    else if (path.endsWith("/scenarios"))
      json = {
        items: [
          {
            id: "s1",
            type: "CONTINUE_DELIVERY",
            eligibility: "ELIGIBLE",
            direct_incremental_cost: "111.00",
            currency: "THB",
            additional_delay_minutes: 0,
            ranking_score: "0",
            rule_results: [],
            missing_information: [],
          },
        ],
      };
    else if (path.endsWith("/decisions"))
      json = { items: [], next_cursor: null };
    else if (path.endsWith("/simulations") || path.endsWith("/recalculate"))
      json = { simulation: { id: "r2" }, job: { id: "j2" } };
    else if (path.endsWith("/jobs/j2")) json = { job: { status: "FAILED" } };
    await route.fulfill({ json });
  });
  await page.goto(web + "/workspace/shipments/ship?org=org");
  await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Prepare proposal" }).click();
  await expect(
    page.getByText("Selected proposal: Continue delivery"),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Select scenario" })
    .getByRole("button", { name: "Hold for inspection" })
    .click();
  await expect(
    page.getByText("Selected proposal: Continue delivery"),
  ).not.toBeVisible();
  await expect(
    page.getByRole("region", { name: "Simulation explorer" }),
  ).toContainText("Draft preview (not saved)");
  await page
    .getByRole("group", { name: "Select scenario" })
    .getByRole("button", { name: "Continue delivery", exact: true })
    .click();
  await page.getByRole("button", { name: "Prepare proposal" }).click();
  await page.locator("#analysis > details > summary").click();
  await page.getByLabel("Resume a recent analysis").selectOption("a2");
  await expect(
    page.getByText("Selected proposal: Continue delivery"),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare proposal" }),
  ).not.toBeVisible();
  await expect(page.getByText(/New scenario baseline:/)).toBeVisible();
  await page
    .getByRole("button", { name: "Run simulation", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Simulation failed",
  );
  await expect(
    page.getByRole("button", { name: "Prepare proposal" }),
  ).not.toBeVisible();
});
test("deep links, keyboard selection, 3D failure fallback, and 200 percent text zoom", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type.includes("webgl")) return null;
      return original.apply(this, [type, ...args] as Parameters<
        typeof original
      >);
    } as typeof original;
  });
  // /demo redirects to /studio and keeps the ?shipment= query.
  await page.goto(web + "/demo?shipment=DEMO-003");
  await expect(page).toHaveURL(/\/studio\?shipment=DEMO-003/);
  await expect(page.getByLabel("Example shipment")).toHaveValue("2");
  await expect(
    page.getByText("3D is unavailable.", { exact: false }),
  ).toBeVisible();
  const reroute = page.getByRole("button", {
    name: "Conditional reroute",
    exact: true,
  });
  await reroute.focus();
  await page.keyboard.press("Enter");
  await expect(reroute).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".route-steps")).toContainText(
    "Alternative receiver",
  );
  await page.getByLabel("Example shipment").selectOption("1");
  await expect(page).toHaveURL(/DEMO-002/);
  await page.reload();
  await expect(page.getByLabel("Example shipment")).toHaveValue("1");
  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => (document.documentElement.style.zoom = "2"));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
