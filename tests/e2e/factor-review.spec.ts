import { test, expect } from "@playwright/test";
import { freshAssumptions } from "../../apps/web/app/simulation-assumptions";
const web = process.env.CC_TEST_WEB || "http://localhost:3000";
test("saved single-scenario assumptions round-trip; latest preview wins; saved summary refreshes", async ({
  page,
}) => {
  const baseline = freshAssumptions();
  Object.assign(baseline, {
    analysis_id: "a1",
    dataset_id: "data",
    policy_version_id: "policy",
  });
  baseline.scenarios = [baseline.scenarios[1]];
  baseline.scenario_types = ["HOLD_INSPECTION"];
  baseline.scenarios[0].estimated_delay_minutes = 30;
  baseline.scenarios[0].receiver_acceptance = "ACCEPTED";
  baseline.scenarios[0].costs.inspection = {
    amount: "4.00",
    source: "CONFIRMED",
  };
  baseline.scenarios[0].costs.other = {
    amount: "2.00",
    source: "USER_ESTIMATE",
  };
  baseline.ranking_weights = { cost: "0.25", delay: "0.75" };
  let submitted: unknown,
    saved = false,
    workflowReads = 0,
    previewCalls = 0;
  const scenario = {
    id: "hold",
    type: "HOLD_INSPECTION",
    eligibility: "REVIEW_REQUIRED",
    direct_incremental_cost: "6.00",
    additional_delay_minutes: 30,
    currency: "THB",
    receiver_acceptance: "ACCEPTED",
    missing_information: [],
    rule_results: [],
  };
  await page.route("http://localhost:8000/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = { items: [] };
    if (path.endsWith("/auth/me"))
      json = {
        user: { id: "operator" },
        memberships: [{ organization_id: "org", roles: ["LOGISTICS"] }],
      };
    else if (path.endsWith("/workflow")) {
      workflowReads++;
      json = {
        analysis: { id: "a1" },
        simulation: {
          id: saved ? "r2" : "r1",
          analysis_id: "a1",
          created_at: saved ? "2026-02-02T12:00:00Z" : "2026-01-01T00:00:00Z",
        },
        decision: null,
      };
    } else if (path.endsWith("/shipments/ship"))
      json = {
        shipment: {
          id: "ship",
          reference: "RESTORE-TEST",
          product_id: "product",
          status: "ARRIVED",
          revision: 1,
          currency: "THB",
          cargo_value: "1000",
          origin: { name: "Origin" },
          destination: { name: "Receiver" },
        },
      };
    else if (path.endsWith("/temperature-datasets"))
      json = { items: [{ id: "data", version: 1, status: "READY" }] };
    else if (path.endsWith("/simulations/r1"))
      json = {
        simulation: { id: "r1", analysis_id: "a1", parameters: baseline },
      };
    else if (path.endsWith("/scenarios")) json = { items: [scenario] };
    else if (path.endsWith("/recalculate")) {
      submitted = route.request().postDataJSON();
      json = { simulation: { id: "r2" }, job: { id: "job" } };
    } else if (path.endsWith("/jobs/job")) {
      saved = true;
      json = { job: { status: "COMPLETED" } };
    } else if (path.endsWith("/simulation-preview")) {
      previewCalls++;
      const delay = route.request().postDataJSON()
        .scenarios[0].estimated_delay_minutes;
      if (delay === 99) {
        await route.abort();
        return;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, delay === 31 ? 1200 : 40),
      );
      json = {
        items: [
          {
            ...scenario,
            eligibility: delay === 40 ? "BLOCKED" : "REVIEW_REQUIRED",
          },
        ],
        persisted: false,
      };
    }
    await route.fulfill({ json });
  });
  await page.goto(`${web}/workspace/shipments/ship?org=org`);
  const scene = page.getByRole("region", { name: "Simulation explorer" });
  await expect(
    scene.getByRole("heading", { name: "Hold for inspection" }),
  ).toBeVisible();
  await expect(scene).toContainText("6.00 THB");
  await expect(
    page.getByRole("spinbutton", {
      name: "Additional delay (minutes)",
      exact: true,
    }),
  ).toHaveValue("30");
  await expect(
    page.getByRole("spinbutton", { name: "Cost component amount" }),
  ).toHaveValue("2.00");
  await expect(page.getByLabel("Receiver acceptance assumption")).toHaveValue(
    "ACCEPTED",
  );
  await expect(
    page.getByRole("spinbutton", { name: "Cost weight (0–1)" }),
  ).toHaveValue("0.25");
  await page.getByRole("button", { name: "Recalculate as a new run" }).click();
  await expect(
    page.getByRole("button", { name: "Prepare proposal" }),
  ).toBeVisible();
  expect(submitted).toEqual(baseline);
  await expect(page.locator(".saved-workflow")).toContainText("02/02/2026");
  expect(workflowReads).toBeGreaterThan(1);
  const delayControl = page.getByRole("spinbutton", {
    name: "Additional delay (minutes)",
    exact: true,
  });
  await delayControl.fill("31");
  await expect.poll(() => previewCalls).toBe(1);
  await delayControl.fill("40");
  await expect(scene).toContainText("BLOCKED");
  await expect(
    page.getByRole("button", { name: "Prepare proposal" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Reset to baseline" }).click();
  await expect(delayControl).toHaveValue("30");
  await expect(
    page.getByRole("spinbutton", { name: "Cost component amount" }),
  ).toHaveValue("2.00");
  await delayControl.fill("99");
  await expect(page.getByText(/Preview unavailable/)).toBeVisible();
  await expect(scene).toContainText("Awaiting calculation");
  await expect(
    page.getByRole("button", { name: "Prepare proposal" }),
  ).not.toBeVisible();
  expect(submitted).toEqual(baseline);
});
