import { test, expect, type Page } from "@playwright/test";
import {
  analysis,
  approvedPolicy,
  mock,
  readyDataset,
  workflow,
} from "./helpers/workspace-mock";
const web = process.env.CC_TEST_WEB || "http://localhost:3000";

async function returning(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("cc-studio-visited", "1");
    localStorage.setItem("cc-studio-coach", "1");
  });
}

const sim = (page: Page) =>
  page
    .getByRole("group", { name: "Select scenario" })
    .getByRole("button", { name: "Hold for inspection", exact: true });

for (const [width, height] of [
  [1440, 900],
  [1280, 800],
]) {
  test(`Studio core loop fits ${width}x${height} without page scroll`, async ({
    page,
  }) => {
    await returning(page);
    await page.setViewportSize({ width, height });
    await page.goto(`${web}/studio`);
    await expect(page.locator(".network-canvas")).toHaveAttribute(
      "data-init-ms",
      /\d+/,
    );
    const box = (sel: string) => page.locator(sel).first().boundingBox();
    const timeline = await box(".timeline");
    const stage = await box(".stage");
    const inspector = await box(".inspector");
    expect(timeline!.y + timeline!.height).toBeLessThanOrEqual(height);
    expect(stage!.y + stage!.height).toBeLessThanOrEqual(timeline!.y);
    expect(inspector!.y + inspector!.height).toBeLessThanOrEqual(
      timeline!.y + 1,
    );
    // The inspector may scroll internally; the page need not.
    await expect(
      page.getByRole("slider", { name: "Simulation time" }),
    ).toBeInViewport();
  });
}

test("Escape closes the mobile bottom sheet and returns focus to its handle", async ({
  page,
}) => {
  await returning(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${web}/studio`);
  const handle = page.locator(".sheet-handle");
  await handle.click();
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Cost", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  await expect(handle).toBeFocused();
});

test("Tab stays inside the open bottom sheet", async ({ page }) => {
  await returning(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${web}/studio`);
  await page.locator(".sheet-handle").click();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(
      () => !!document.activeElement?.closest(".inspector"),
    );
    expect(inside).toBe(true);
  }
});

test("Escape dismisses the coach mark", async ({ page }) => {
  await page.goto(`${web}/studio`);
  await expect(page.locator(".coach")).toBeVisible({ timeout: 20000 });
  await page.keyboard.press("Escape");
  await expect(page.locator(".coach")).toHaveCount(0);
});

test("Escape closes the change-status menu and focuses its summary", async ({
  page,
}) => {
  await mock(page, {
    datasets: [readyDataset],
    policies: [approvedPolicy],
    workflow: workflow(false),
    analysis: analysis(),
  });
  await page.goto(`${web}/workspace/shipments/ship?org=org`);
  const summary = page.getByText("Change operational status");
  await summary.click();
  const menu = page.locator("details.ws-menu");
  await expect(menu).toHaveAttribute("open", "");
  await page.getByRole("combobox", { name: "Next operational state" }).focus();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(summary).toBeFocused();
});

test("the live region announces the decision point and arrival, not the journey", async ({
  page,
}) => {
  await page.goto(`${web}/studio`);
  const live = page.locator("[data-live-phase]");
  await expect(live).toHaveAttribute("aria-live", "polite");
  await expect(live).toHaveAttribute("data-live-phase", "journey");
  await expect(live).toHaveText("");
  await expect(live).toHaveAttribute("data-live-phase", "decision", {
    timeout: 20000,
  });
  await expect(live).toContainText("Decision point");
  await sim(page).click();
  await expect(live).toHaveAttribute("data-live-phase", "arrived", {
    timeout: 20000,
  });
  await expect(live).toContainText("Arrived");
});

test("the landing hero loop is silent for screen readers", async ({ page }) => {
  await page.goto(`${web}/`);
  await expect(page.locator("[data-live-phase]")).toHaveCount(0);
});

test("landing hero shows the 2D poster first and swaps in 3D", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __three: string[] }).__three = seen;
    const note = () => {
      const s = document.querySelector<HTMLElement>(".lp-frame--hero .stage");
      if (!s) return;
      const v = `${s.dataset.three}:${s.querySelector("svg.schematic-svg") ? "svg" : "nosvg"}`;
      if (seen[seen.length - 1] !== v) seen.push(v);
    };
    new MutationObserver(note).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
    });
  });
  await page.goto(`${web}/`);
  const stage = page.locator(".lp-frame--hero .stage");
  await expect(stage).toHaveAttribute("data-three", "ready", {
    timeout: 30000,
  });
  const seen = await page.evaluate(
    () => (window as unknown as { __three: string[] }).__three,
  );
  expect(seen[0]).toBe("pending:svg");
  expect(seen[seen.length - 1]).toBe("ready:nosvg");
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("the hero stage keeps its size while 3D loads (no layout shift)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${web}/`);
  const stage = page.locator(".lp-frame--hero .stage");
  const before = await stage.boundingBox();
  await expect(stage).toHaveAttribute("data-three", "ready", {
    timeout: 30000,
  });
  expect(await stage.boundingBox()).toEqual(before);
});

test("render loop: DPR capped at 2, paused offscreen, canvas removed on leave", async ({
  browser,
}) => {
  const context = await browser.newContext({
    deviceScaleFactor: 3,
    // Short viewport so the page can scroll the stage fully out of view.
    viewport: { width: 1440, height: 500 },
  });
  const page = await context.newPage();
  await returning(page);
  await page.goto(`${web}/studio`);
  const host = page.locator(".network-canvas");
  await expect(host).toHaveAttribute("data-init-ms", /\d+/);
  expect(Number(await host.getAttribute("data-dpr"))).toBeLessThanOrEqual(2);
  await expect(host).toHaveAttribute("data-paused", "false");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(host).toHaveAttribute("data-paused", "true");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(host).toHaveAttribute("data-paused", "false");
  await page
    .getByRole("link", { name: "Workspace", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/workspace/);
  await expect(page.locator("canvas")).toHaveCount(0);
  await context.close();
});

test("receiver acceptance is stated in words in the 3D labels and the scene description", async ({
  page,
}) => {
  await returning(page);
  await page.goto(`${web}/studio`);
  await expect(page.locator(".network-canvas")).toHaveAttribute(
    "data-init-ms",
    /\d+/,
  );
  await expect(
    page.locator(".network-marker", { hasText: "Receiver" }).first(),
  ).toContainText(/unknown|accepted|rejected/);
  await expect(
    page.getByRole("img", { name: /Receiver acceptance is an assumption/ }),
  ).toBeAttached();
});

test("the HUD shows scenario time after the decision point, labelled schematic", async ({
  page,
}) => {
  await returning(page);
  await page.goto(`${web}/studio`);
  await sim(page).click();
  await expect(page.locator(".hud-time")).toContainText(/12:00 UTC \+ \d+ min/);
  await expect(page.locator(".hud-branch-note")).toContainText("schematic");
});

test("no horizontal overflow at 320px on the Studio, the list and a shipment", async ({
  page,
}) => {
  await returning(page);
  await mock(page, {
    datasets: [readyDataset],
    policies: [approvedPolicy],
    workflow: workflow(false),
    analysis: analysis(),
  });
  await page.setViewportSize({ width: 320, height: 700 });
  for (const url of [
    "/studio",
    "/workspace?org=org",
    "/workspace/shipments/ship?org=org",
  ]) {
    await page.goto(`${web}${url}`);
    await page.waitForTimeout(800);
    const over = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(over, url).toBeLessThanOrEqual(0);
  }
});
