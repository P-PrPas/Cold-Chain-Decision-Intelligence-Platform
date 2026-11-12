import { test, expect, type Page } from "@playwright/test";
const web = process.env.CC_TEST_WEB || "http://localhost:3000";

/** Studio factors: delay drives time, cost breakdown, compare chart, edit readings. */
async function returning(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("cc-studio-visited", "1");
    localStorage.setItem("cc-studio-coach", "1");
  });
}
async function openStudio(page: Page, query = "") {
  await returning(page);
  await page.goto(`${web}/studio${query}`);
  await expect(page.locator(".network-canvas")).toHaveAttribute(
    "data-init-ms",
    /\d+/,
  );
}
const slider = (page: Page) =>
  page.getByRole("slider", { name: "Simulation time" });
const phase = (page: Page) => page.locator(".hud-tl");
const delayField = (page: Page) =>
  page.getByLabel("Additional delay (minutes)", { exact: true });
const axisMax = async (page: Page) =>
  Number(await slider(page).getAttribute("aria-valuemax"));
const expectAxis = (page: Page, minutes: number) =>
  expect(slider(page)).toHaveAttribute("aria-valuemax", String(minutes));
const point = (page: Page, type: string) =>
  page.getByTestId(`chart-point-${type}`);

test("delay drives the timeline: delay 0 and delay 240 end at different times", async ({
  page,
}) => {
  await openStudio(page);
  // 240 min journey + 60 min schematic leg + the delay, to scale up to 240 min.
  await delayField(page).fill("0");
  await expectAxis(page, 300);
  await delayField(page).fill("240");
  await expectAxis(page, 540);
  // The playhead sits on the final frame of the longer run; the clock shows the entered value.
  await slider(page).focus();
  await page.keyboard.press("End");
  await expect(phase(page)).toHaveAttribute("data-phase", "arrived");
  await expect(page.getByTestId("hud-delay")).toHaveText("240 min");
  await delayField(page).fill("0");
  await expect(page.getByTestId("hud-delay")).toHaveText("0 min");
});

test("the truck waits out the delay and the clock counts the wait", async ({
  page,
}) => {
  await openStudio(page);
  await delayField(page).fill("200");
  await expectAxis(page, 500);
  await slider(page).focus();
  await page.keyboard.press("Home");
  // 240 journey + 60 drive + 10 waiting.
  for (let i = 0; i < 10; i++) await page.keyboard.press("Shift+ArrowRight");
  for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowRight");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "310");
  await expect(phase(page)).toHaveAttribute("data-phase", "branch");
  await expect(page.getByTestId("hud-delay")).toHaveText("10 min");
});

test("compare uses one shared axis: arrivals differ and the timeline shows each run", async ({
  page,
}) => {
  await openStudio(page);
  await delayField(page).fill("240");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("c");
  await expect(page.getByRole("button", { name: /^Compare/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("tl-lane-CONTINUE_DELIVERY")).toBeVisible();
  const width = async (type: string) =>
    (await page.getByTestId(`tl-lane-${type}`).boundingBox())!.width;
  const w = {
    continue: await width("CONTINUE_DELIVERY"),
    hold: await width("HOLD_INSPECTION"),
    reroute: await width("CONDITIONAL_REROUTE"),
    reject: await width("REJECT_QUARANTINE_DISPOSE"),
  };
  // Delays are 0, 240, 90 and 180 minutes: lengths follow the delays.
  expect(w.continue).toBeLessThan(w.reroute);
  expect(w.reroute).toBeLessThan(w.reject);
  expect(w.reject).toBeLessThan(w.hold);
  // The axis ends with the longest run: 240 + 60 + 240.
  await expectAxis(page, 540);
  // Stand 100 minutes into the runs: each tag shows its own clock and running total.
  await page.keyboard.press("Space");
  await slider(page).focus();
  await page.keyboard.press("Home");
  // 240 journey + 60 drive + 40 waiting = 340.
  for (let i = 0; i < 11; i++) await page.keyboard.press("Shift+ArrowRight");
  for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowRight");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "340");
  const tags = page.locator(".truck-tag");
  // Continue waits at the decision point for 0 min and has arrived (cost done).
  await expect(tags.nth(0)).toContainText("1,200.00 THB");
  await expect(tags.nth(0)).toContainText("0 min");
  // Hold has driven 60 min and waited 40.
  await expect(tags.nth(1)).toContainText("40 min");
  await expect(tags.nth(1)).not.toContainText("2,800.00");
  await slider(page).focus();
  await page.keyboard.press("End");
  await expect(tags.nth(1)).toContainText("2,800.00 THB");
  await expect(tags.nth(1)).toContainText("240 min");
  await expect(tags.nth(3)).toContainText("6,000.00 THB");
  await expect(tags.nth(3)).toContainText("180 min");
});

test("large delays compress the axis honestly and keep the entered number", async ({
  page,
}) => {
  await openStudio(page);
  await delayField(page).fill("525600");
  await expect.poll(() => axisMax(page)).toBeLessThan(1500);
  await expect.poll(() => axisMax(page)).toBeGreaterThan(900);
  await expect(page.getByTestId("tl-lane-HOLD_INSPECTION")).toHaveAttribute(
    "data-compressed",
    "true",
  );
  await expect(page.locator(".tl-compress").first()).toContainText(
    "compressed after 240 min",
  );
  await slider(page).focus();
  await page.keyboard.press("End");
  await expect(page.getByTestId("hud-delay")).toHaveText("525600 min");
  await expect(page.locator(".hud-br")).toContainText("axis compressed");
  // Longer still looks longer than a shorter delay.
  const long = (await page
    .getByTestId("tl-lane-HOLD_INSPECTION")
    .boundingBox())!.width;
  await delayField(page).fill("1000");
  const mid = (await page.getByTestId("tl-lane-HOLD_INSPECTION").boundingBox())!
    .width;
  expect(long).toBeGreaterThan(mid);
});

test("an empty or invalid delay is unknown, not zero", async ({ page }) => {
  await openStudio(page);
  await delayField(page).fill("");
  await slider(page).focus();
  await page.keyboard.press("End");
  await expect(page.getByTestId("hud-delay")).toHaveText("– min");
  await expect(phase(page)).not.toHaveAttribute("data-phase", "arrived");
  await expect(page.getByTestId("tl-lane-HOLD_INSPECTION")).toHaveAttribute(
    "data-unknown",
    "true",
  );
  // The chart does not plot it and says why.
  await expect(point(page, "HOLD_INSPECTION")).toHaveCount(0);
  await expect(page.locator(".compare-chart")).toContainText("Not plotted");
});

test("cost breakdown: six categories, exact amounts, segments follow the inputs", async ({
  page,
}) => {
  await openStudio(page);
  const card = page.locator(".cost-breakdown-card");
  await expect(card.locator("[data-category]").first()).toBeVisible();
  // Demo baseline: everything in "other".
  await expect(card.locator(".cb-bar .cb-seg")).toHaveCount(1);
  await page.getByRole("button", { name: "Cost", exact: true }).click();
  const component = page.locator(".factor-controls select").first();
  const amount = page.getByLabel("Cost component amount");
  await component.selectOption({ label: "Additional transport" });
  await amount.fill("900.10");
  await component.selectOption({ label: "Inspection cost" });
  await amount.fill("300.05");
  await component.selectOption({ label: "Other costs" });
  await amount.fill("1599.85");
  await expect(card.locator('.cb-bar[role="img"] .cb-seg')).toHaveCount(3);
  const row = (name: string) => card.locator("li", { hasText: name }).first();
  await expect(row("Additional transport")).toContainText("900.10 THB");
  await expect(row("Inspection cost")).toContainText("300.05 THB");
  await expect(row("Other costs")).toContainText("1,599.85 THB");
  await expect(row("Handling cost")).toContainText("0.00 THB");
  // Sum is exact: 900.10 + 300.05 + 1599.85.
  await expect(page.locator(".impact-band").nth(1)).toContainText(
    "2,800.00 THB",
  );
  await expect(card.locator("[role=img]").first()).toHaveAttribute(
    "aria-label",
    /total 2,800\.00 THB/,
  );
  // A provenance chip is shown, and a ghost of the previous bar follows a change.
  await expect(card.locator(".prov-chip").first()).toBeVisible();
  await amount.fill("1500.00");
  await expect(card.locator(".cb-ghost")).toHaveCount(1);
  // An invalid amount means no breakdown instead of a wrong one.
  await amount.fill("abc");
  await expect(card).toContainText("Breakdown unavailable");
});

test("compare chart: one labelled point per scenario that moves with the sliders", async ({
  page,
}) => {
  await openStudio(page);
  const types = [
    "CONTINUE_DELIVERY",
    "HOLD_INSPECTION",
    "CONDITIONAL_REROUTE",
    "REJECT_QUARANTINE_DISPOSE",
  ];
  for (const t of types) await expect(point(page, t)).toHaveCount(1);
  // The point's numbers match the scenario list; its marker carries the scenario number.
  await expect(point(page, "HOLD_INSPECTION")).toHaveAttribute(
    "data-delay",
    "120",
  );
  await expect(point(page, "HOLD_INSPECTION")).toHaveAttribute(
    "data-cost",
    "2800.00",
  );
  await expect(point(page, "HOLD_INSPECTION")).toContainText("2");
  const before = await point(page, "HOLD_INSPECTION").getAttribute("transform");
  await page.keyboard.press("2");
  const slide = page.getByLabel("Additional delay slider");
  await slide.fill("200");
  await expect(point(page, "HOLD_INSPECTION")).toHaveAttribute(
    "data-delay",
    "200",
  );
  const after = await point(page, "HOLD_INSPECTION").getAttribute("transform");
  expect(after).not.toBe(before);
  // A faded ghost marks the previous position for about a second.
  await expect(page.locator(".compare-chart .cc-ghost")).toHaveCount(1);
  // Equivalent data table, and no ranking or "best" wording on the chart.
  await page.getByRole("button", { name: "Chart data as a table" }).click();
  const table = page.locator(".cc-table");
  await expect(table.locator("tbody tr")).toHaveCount(4);
  await expect(table).toContainText("200");
  await page.getByRole("button", { name: "Chart data as a table" }).click();
  await expect(page.getByTestId("compare-chart")).not.toContainText(
    /\b(best|rank\w*|recommend\w*)\b/i,
  );
});

test("the ranking weight is not offered in the Studio", async ({ page }) => {
  await openStudio(page);
  await expect(
    page.getByRole("group", { name: "Factor groups" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Advanced", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Cost weight slider")).toHaveCount(0);
  for (const name of ["Delay", "Cost", "Receiver"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
});

test("edit readings: keyboard, drag, no reading and reset update the evidence live", async ({
  page,
}) => {
  await openStudio(page);
  await expect(page.getByTestId("edited-note")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit readings" }).click();
  const p5 = page.getByTestId("edit-point-5"); // 8.1 at 10:30
  await expect(p5).toHaveAttribute("aria-valuetext", "8.1 °C");
  await p5.focus();
  await page.keyboard.press("ArrowUp");
  await expect(p5).toHaveAttribute("aria-valuetext", "8.2 °C");
  await page.keyboard.press("Shift+ArrowUp");
  await expect(p5).toHaveAttribute("aria-valuetext", "9.2 °C");
  await page.keyboard.press("ArrowDown");
  await expect(p5).toHaveAttribute("aria-valuetext", "9.1 °C");
  // Persistent label, header and timeline.
  await expect(page.getByTestId("edited-note")).toContainText(
    "Edited data — synthetic, not saved",
  );
  await expect(page.locator(".studio-route .edited-pill")).toBeVisible();
  // The HUD temperature follows the edit: scrub to 10:30.
  await slider(page).focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+ArrowRight");
  await expect(page.locator(".hud-deg")).toContainText("9.1");
  // Evidence strip range and table follow.
  await expect(page.locator(".evidence-facts")).toContainText("9.1");
  // Clamp: the range ends at 40 °C.
  await p5.focus();
  for (let i = 0; i < 35; i++) await page.keyboard.press("Shift+ArrowUp");
  await expect(p5).toHaveAttribute("aria-valuetext", "40.0 °C");
  // Drag a point vertically.
  const p4 = page.getByTestId("edit-point-4"); // 6.5 at 10:00
  const box = (await p4.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 30, {
    steps: 6,
  });
  await page.mouse.up();
  const dragged = await p4.getAttribute("aria-valuetext");
  expect(parseFloat(dragged!)).toBeGreaterThan(6.5);
  // A point can be switched to no reading: unknown, never interpolated.
  const p6 = page.getByTestId("edit-point-6"); // 7.2 at 11:00
  await p6.focus();
  await page.getByRole("button", { name: "Mark as no reading" }).click();
  await expect(p6).toHaveAttribute("aria-valuetext", "No reading");
  await slider(page).focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowRight");
  await expect(page.locator(".hud-temp")).toHaveAttribute(
    "data-state",
    "unknown",
  );
  await expect(page.locator(".hud-temp")).toContainText("No readings 11:00");
  await expect(page.locator(".tl-gap")).toHaveCount(1);
  // The sandbox never decides eligibility and uses no verdict wording.
  await expect(page.locator(".result-rows")).toContainText("Not evaluated");
  await expect(page.locator("main.studio")).not.toContainText(
    /\b(SAFE|CERTIFIED)\b/,
  );
  // Reset restores the demo data.
  await page.getByRole("button", { name: "Reset to demo data" }).click();
  await expect(p5).toHaveAttribute("aria-valuetext", "8.1 °C");
  await expect(p6).toHaveAttribute("aria-valuetext", "7.2 °C");
  await expect(page.getByTestId("edited-note")).toHaveCount(0);
  await expect(page.locator(".tl-gap")).toHaveCount(0);
});

test("2D schematic carries the same delay and cost information in compare", async ({
  page,
}) => {
  await openStudio(page);
  await page
    .getByRole("group", { name: "Camera view" })
    .getByRole("button", { name: "2D" })
    .click();
  await page.keyboard.press("c");
  await slider(page).focus();
  await page.keyboard.press("End");
  const svg = page.locator(".schematic-svg");
  await expect(svg).toContainText("1 · 1,200.00 THB · 0 min");
  await expect(svg).toContainText("2 · 2,800.00 THB · 120 min");
  await expect(svg).toContainText("4 · 6,000.00 THB · 180 min");
});

test("reduced motion starts on the final frame of the longest run", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openStudio(page);
  await expect(phase(page)).toHaveAttribute("data-phase", "arrived");
  await delayField(page).fill("200");
  await expectAxis(page, 500);
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "500");
  await expect(page.getByTestId("hud-delay")).toHaveText("200 min");
});

test("no horizontal overflow at 320px with the sheet and edit mode open", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openStudio(page);
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Edit readings" }).click();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Done editing" }).click();
  await page.locator(".sheet-handle").click();
  await expect(page.locator(".compare-chart")).toBeVisible();
  await expect(page.locator(".cost-breakdown-card")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  // A compressed axis note and compare lanes also fit.
  await delayField(page).fill("100000");
  await page.locator(".sheet-handle").click();
  await expect(page.locator(".tl-compress")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});
