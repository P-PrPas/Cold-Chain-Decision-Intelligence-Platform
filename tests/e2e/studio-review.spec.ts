import { test, expect, type Page } from "@playwright/test";
const web = process.env.CC_TEST_WEB || "http://localhost:3000";

const SCENARIOS = [
  "Continue delivery",
  "Hold for inspection",
  "Conditional reroute",
  "Reject / quarantine / dispose",
];

async function returning(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("cc-studio-visited", "1");
    localStorage.setItem("cc-studio-coach", "1");
  });
}
const rail = (page: Page) =>
  page.getByRole("group", { name: "Select scenario" });
const slider = (page: Page) =>
  page.getByRole("slider", { name: "Simulation time" });
const phase = (page: Page) => page.locator(".hud-tl");

test("scenario switching via the rail and the 1-4 keys", async ({ page }) => {
  await returning(page);
  await page.goto(`${web}/studio`);
  await expect(page.locator(".network-canvas")).toHaveAttribute(
    "data-init-ms",
    /\d+/,
  );
  // The rail is the only scenario selector.
  await expect(rail(page)).toHaveCount(1);
  for (const [i, name] of SCENARIOS.entries()) {
    await rail(page).getByRole("button", { name, exact: true }).click();
    await expect(
      rail(page).getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".result-card h2")).toContainText(name);
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    const other = SCENARIOS[(i + 1) % 4];
    await page.keyboard.press(String(((i + 1) % 4) + 1));
    await expect(
      rail(page).getByRole("button", { name: other, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  // Choosing a branch replays it to the arrived frame; the HUD ticker lands on the exact total.
  await rail(page)
    .getByRole("button", { name: "Hold for inspection", exact: true })
    .click();
  await expect(phase(page)).toHaveAttribute("data-phase", "arrived", {
    timeout: 15000,
  });
  await expect(page.locator(".hud-br")).toContainText("2,800.00 THB");
  await expect(page.locator(".hud-br")).toContainText("120 min");
  await expect(page.locator(".impact-band").nth(1)).toContainText(
    "2,800.00 THB",
  );
});

test("keys: Space, arrows, C, R work and are ignored inside form fields", async ({
  page,
}) => {
  await returning(page);
  await page.goto(`${web}/studio`);
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "240");
  await page.keyboard.press("ArrowLeft");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "235");
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "205");
  await page.keyboard.press("ArrowRight");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "210");
  // Space plays, Space pauses.
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  // Compare toggles.
  const compare = page.getByRole("button", { name: /^Compare/ });
  await expect(compare).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("c");
  await expect(compare).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("c");
  await expect(compare).toHaveAttribute("aria-pressed", "false");
  // Keys are ignored while a select has focus.
  const picker = page.getByLabel("Example shipment");
  await picker.focus();
  await page.keyboard.press("3");
  await expect(
    rail(page).getByRole("button", {
      name: "Hold for inspection",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  // Reset restores the starting frame and the illustrative selection.
  await page.keyboard.press("2");
  await page.keyboard.press("3");
  await page.keyboard.press("r");
  await expect(
    rail(page).getByRole("button", {
      name: "Hold for inspection",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("first visit autoplays to the decision point and shows one dismissible coach mark", async ({
  page,
}) => {
  await page.goto(`${web}/studio`);
  await expect(phase(page)).toHaveAttribute("data-phase", "journey");
  await expect(phase(page)).toHaveAttribute("data-phase", "decision", {
    timeout: 20000,
  });
  const coach = page.getByText("Choose a scenario", { exact: true }).last();
  await expect(page.locator(".coach")).toBeVisible();
  await expect(page.locator(".coach")).toContainText("Choose a scenario");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "240");
  void coach;
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.locator(".coach")).toHaveCount(0);
  // Remembered: a reload starts at the decision point without autoplay or coach mark.
  await page.reload();
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "240");
  await page.waitForTimeout(800);
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "240");
  await expect(page.locator(".coach")).toHaveCount(0);
});

test("preset what-if chips set factors through the assumption model and replay", async ({
  page,
}) => {
  await returning(page);
  await page.goto(`${web}/studio`);
  await page.getByRole("button", { name: "Inspection takes 4 h?" }).click();
  await expect(
    rail(page).getByRole("button", {
      name: "Hold for inspection",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".impact-band").first()).toContainText("240 min");
  await expect(phase(page)).toHaveAttribute("data-phase", "arrived", {
    timeout: 15000,
  });
  await expect(page.locator(".hud-br")).toContainText("240 min");
  await page.getByRole("button", { name: "New receiver rejects?" }).click();
  await expect(page.locator(".acceptance-state")).toContainText(
    "× Receiver: rejected",
  );
  await expect(
    page.locator(".network-name").filter({ hasText: "Alternative" }),
  ).toContainText("×");
});

test("reduced motion shows the final frame without playback", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${web}/studio`);
  await expect(phase(page)).toHaveAttribute("data-phase", "arrived");
  await expect(slider(page)).toHaveAttribute(
    "aria-valuenow",
    (await slider(page).getAttribute("aria-valuemax"))!,
  );
  await expect(
    page.getByRole("button", { name: /Replay|Play/ }),
  ).toBeDisabled();
  // Final frame equals the exact totals.
  await expect(page.locator(".hud-br")).toContainText("2,800.00 THB");
  await expect(page.locator(".hud-br")).toContainText("120 min");
  // Switching scenario jumps straight to that scenario's final frame.
  await page.keyboard.press("4");
  await expect(phase(page)).toHaveAttribute("data-phase", "arrived");
  await expect(page.locator(".hud-br")).toContainText("6,000.00 THB");
  await expect(page.locator(".ghost-chip")).toHaveCount(0);
});

test("gaps are unknown: no interpolation in the HUD, slider text or ribbon", async ({
  page,
}) => {
  await returning(page);
  await page.goto(`${web}/studio?shipment=DEMO-003`);
  await slider(page).focus();
  // 09:30 slot is missing: scrub to t = 100 minutes (10:20 UTC).
  for (let i = 0; i < 28; i++) await page.keyboard.press("ArrowLeft");
  const now = Number(await slider(page).getAttribute("aria-valuenow"));
  expect(now).toBeGreaterThanOrEqual(90);
  expect(now).toBeLessThan(180);
  await expect(page.locator(".hud-temp")).toHaveAttribute(
    "data-state",
    "unknown",
  );
  await expect(page.locator(".hud-temp")).toContainText("Unknown");
  await expect(page.locator(".hud-temp")).toContainText(
    "No readings 09:30–10:30",
  );
  await expect(slider(page)).toHaveAttribute("aria-valuetext", /no readings/);
  // Before the gap the cargo has a real reading again.
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowLeft");
  await expect(page.locator(".hud-temp")).toHaveAttribute(
    "data-state",
    "observed",
  );
  // The timeline draws the gap hatched with its label.
  await expect(page.locator(".tl-gap")).toContainText(
    "No readings 09:30–10:30",
  );
});

test("no SAFE / CERTIFIED / APPROVED label and eligibility is not evaluated", async ({
  page,
}) => {
  await returning(page);
  for (const id of ["DEMO-001", "DEMO-002", "DEMO-003"]) {
    await page.goto(`${web}/studio?shipment=${id}`);
    await expect(page.locator(".network-canvas")).toHaveAttribute(
      "data-init-ms",
      /\d+/,
    );
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\b(SAFE|CERTIFIED|APPROVED)\b/);
    expect(text).not.toMatch(/\bSafe\b|\bCertified\b/);
    await expect(page.locator(".status-badge")).toHaveCount(1);
    await expect(page.locator(".status-badge")).toHaveAttribute(
      "data-status",
      "NOT_EVALUATED",
    );
    // The highlighted option is labelled illustrative, not a determination.
    await expect(page.locator(".rail-tag").first()).toContainText(
      "Illustrative pick",
    );
    await expect(
      page.getByText("Not a policy determination.", { exact: false }).first(),
    ).toBeVisible();
  }
});

test("WebGL unavailable: the 2D view carries route, gap, temperature and chosen branch", async ({
  page,
}) => {
  await returning(page);
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
  await page.goto(`${web}/studio?shipment=DEMO-003`);
  await expect(
    page.getByText("3D is unavailable.", { exact: false }),
  ).toBeVisible();
  const svg = page.locator(".schematic-svg");
  await expect(svg).toBeVisible();
  await expect(svg).toContainText("No readings 09:30–10:30");
  await expect(svg).toContainText("Rayong");
  await expect(svg.locator(".svg-gap")).toHaveCount(1);
  await expect(svg.locator(".svg-band").first()).toBeVisible();
  await expect(svg.locator(".svg-road.is-chosen")).toHaveCount(1);
  await expect(page.locator(".hud-tl")).toContainText("UTC");
  // The chosen branch follows the scenario.
  await rail(page)
    .getByRole("button", { name: "Conditional reroute", exact: true })
    .click();
  await expect(page.locator(".route-steps")).toContainText(
    "Alternative receiver",
  );
  await expect(svg).toContainText("Alternative");
});

test("320px: no horizontal overflow, sticky canvas, 44px targets, sheet opens", async ({
  page,
}) => {
  await returning(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`${web}/studio`);
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
  expect(await overflow()).toBe(true);
  // The brand mark is still visible on the Studio.
  await expect(page.locator(".brand-mark").first()).toBeVisible();
  const handle = page.locator(".sheet-handle");
  const hb = (await handle.boundingBox())!;
  expect(hb.height).toBeGreaterThanOrEqual(44);
  await handle.click();
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  expect(await overflow()).toBe(true);
  await page.getByRole("button", { name: "Hide assumptions" }).click();
  // Scenario selector is a compact segmented control with 44px targets.
  for (const name of SCENARIOS) {
    const b = (await rail(page)
      .getByRole("button", { name, exact: true })
      .boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }
  // The canvas stays pinned under the scenario control while the page scrolls.
  const before = (await page.locator(".stage").boundingBox())!;
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  const after = (await page.locator(".stage").boundingBox())!;
  expect(before.y).toBeGreaterThan(after.y);
  expect(after.y).toBeGreaterThanOrEqual(0);
  expect(after.y).toBeLessThan(120);
  expect(await overflow()).toBe(true);
});

test("/demo redirects to /studio and keeps the shipment query", async ({
  page,
}) => {
  await returning(page);
  await page.goto(`${web}/demo?shipment=DEMO-002`);
  await expect(page).toHaveURL(/\/studio\?shipment=DEMO-002/);
  await expect(page.getByLabel("Example shipment")).toHaveValue("1");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "DEMO-002",
  );
});

test("Thai: Studio strings are translated and codes stay English", async ({
  page,
}) => {
  await returning(page);
  await page.addInitScript(() => localStorage.setItem("cc-lang", "th"));
  await page.goto(`${web}/studio?shipment=DEMO-001`);
  await expect(page.locator("html")).toHaveAttribute("lang", "th");
  await expect(page.getByText("ข้อมูลจำลองเพื่อสาธิตเท่านั้น")).toBeVisible();
  await expect(page.getByText("ภาพแผนผัง ไม่ใช่ GPS")).toBeVisible();
  await expect(page.locator(".status-badge")).toContainText("ยังไม่ได้ประเมิน");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "DEMO-001",
  );
});
