import { test, expect } from "@playwright/test";
const web = process.env.CC_TEST_WEB || "http://localhost:3000";
const returning = (page: import("@playwright/test").Page) =>
  page.addInitScript(() => {
    localStorage.setItem("cc-studio-visited", "1");
    localStorage.setItem("cc-studio-coach", "1");
  });
for (const width of [375, 320]) {
  test(`mobile ${width}: pointer drag keeps scene and feedback visible; receiver needs no hover`, async ({
    page,
  }) => {
    await returning(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${web}/studio`);
    const scene = page.locator(".network-canvas");
    await expect(scene).toHaveAttribute("data-init-ms", /\d+/);
    // Factors live in a bottom sheet on small screens.
    await page.getByRole("button", { name: "Adjust assumptions" }).click();
    const slider = page.getByRole("slider", {
      name: "Additional delay slider",
    });
    await slider.scrollIntoViewIfNeeded();
    const before = await slider.inputValue();
    const box = (await slider.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, {
      steps: 12,
    });
    await page.mouse.up();
    expect(await slider.inputValue()).not.toBe(before);
    const value = await slider.inputValue();
    await expect(
      page.locator(".impact-band").first().getByRole("img"),
    ).toHaveAttribute("aria-label", new RegExp(`current ${value}`));
    for (const locator of [scene, slider, page.locator(".scene-impact")]) {
      const r = (await locator.boundingBox())!;
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.height).toBeLessThanOrEqual(900);
    }
    await page.getByRole("button", { name: "Cost", exact: true }).click();
    const cost = page.getByRole("textbox", { name: "Cost component amount" });
    await cost.fill("5600");
    await expect(page.locator(".impact-band").nth(1)).toContainText(
      "5,600.00 THB",
    );
    const currentWidth = await page
      .locator(".impact-band")
      .nth(1)
      .locator(".current-bar")
      .getAttribute("width");
    const baselineWidth = await page
      .locator(".impact-band")
      .nth(1)
      .locator(".baseline-bar")
      .getAttribute("width");
    expect(Number(currentWidth)).toBe(Number(baselineWidth) * 2);
    await page
      .getByRole("group", { name: "Select scenario" })
      .getByRole("button", { name: "Conditional reroute", exact: true })
      .click();
    await page.getByRole("button", { name: "Receiver", exact: true }).click();
    await page
      .getByLabel("Receiver acceptance assumption")
      .selectOption("REJECTED");
    await expect(page.locator(".acceptance-state")).toContainText(
      "× Receiver: rejected",
    );
    await expect(
      page.locator(".network-name").filter({ hasText: "Alternative" }),
    ).toContainText("×");
    // The ranking weight is not offered in the sandbox (ranking follows engine eligibility).
    await expect(
      page.getByRole("button", { name: "Advanced", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Cost", exact: true }).click();
    await cost.focus();
    await page.keyboard.press("ArrowRight");
    const focus = await cost.boundingBox();
    const sceneBounds = await page.locator(".studio-stage").boundingBox();
    expect(focus!.y).toBeGreaterThanOrEqual(
      sceneBounds!.y + sceneBounds!.height,
    );
  });
}
test("touch drag updates delay without scrolling away from the scene", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 900 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await returning(page);
  await page.goto(`${web}/studio`);
  await page.getByRole("button", { name: "Adjust assumptions" }).click();
  const slider = page.getByRole("slider", { name: "Additional delay slider" });
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const y = box.y + box.height / 2;
  const before = await slider.inputValue();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y }],
  });
  for (let i = 1; i <= 8; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: box.x + box.width * (0.5 + i * 0.04), y }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(await slider.inputValue()).not.toBe(before);
  const scene = (await page.locator(".network-canvas").boundingBox())!;
  expect(scene.y).toBeGreaterThanOrEqual(0);
  expect(scene.y + scene.height).toBeLessThan(900);
  await context.close();
});
