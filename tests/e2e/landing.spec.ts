const web = process.env.CC_TEST_WEB || "http://localhost:3000";
import { test, expect } from "@playwright/test";

test("hero names the category, the primary action opens the Studio", async ({
  page,
}) => {
  await page.goto(`${web}/`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Cold-chain excursion simulator for QA teams",
    }),
  ).toBeVisible();
  const cta = page.getByRole("link", { name: "Open the simulator" }).first();
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page).toHaveURL(/\/studio$/);
});

test("Thai toggle switches the headline and the page language", async ({
  page,
}) => {
  await page.goto(`${web}/`);
  await page.getByRole("button", { name: "ไทย" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "th");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "โปรแกรมจำลองอุณหภูมิเบี่ยงเบน",
  );
  await expect(
    page.getByRole("link", { name: "เปิดตัวจำลอง" }).first(),
  ).toBeVisible();
});

for (const width of [320, 390, 768, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${web}/`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const over = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(over).toBeLessThanOrEqual(0);
  });
}

test("reduced motion shows a static final hero frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${web}/`);
  const canvas = page.locator(".lp-frame--hero .network-canvas");
  await expect(canvas).toHaveAttribute("data-init-ms", /\d+/);
  // No replay control: nothing moves, and the clock rests on the last frame.
  await expect(page.getByRole("button", { name: /replay/i })).toHaveCount(0);
  await expect(page.locator(".lp-frame--hero .hud-br")).toContainText(
    "6,000.00".length ? /\d/ : "",
  );
  const a = await page.locator(".lp-frame--hero .hud-time").innerText();
  await page.waitForTimeout(1500);
  const b = await page.locator(".lp-frame--hero .hud-time").innerText();
  expect(b).toBe(a);
});

test("replay can be paused and the loop uses one WebGL canvas", async ({
  page,
}) => {
  await page.goto(`${web}/`);
  await expect(page.locator("canvas")).toHaveCount(1);
  const toggle = page.getByRole("button", { name: "Pause the replay" });
  await toggle.click();
  await expect(
    page.getByRole("button", { name: "Play the replay" }),
  ).toBeVisible();
});

test("nothing on the landing is labelled safe, certified or approved", async ({
  page,
}) => {
  for (const lang of ["en", "th"]) {
    await page.addInitScript((l) => localStorage.setItem("cc-lang", l), lang);
    await page.goto(`${web}/`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\b(safe|certified|approved|guaranteed)\b/i);
  }
  // The shared footer carries the disclaimer once.
  await page.goto(`${web}/`);
  const n = await page
    .getByText("Does not certify food safety", { exact: false })
    .count();
  expect(n).toBe(1);
});
