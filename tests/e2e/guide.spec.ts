import { test, expect, type Page } from "@playwright/test";
const web = process.env.CC_TEST_WEB || "http://localhost:3000";

async function loadAllImages(page: Page) {
  const imgs = page.locator(".gd-shot img");
  const n = await imgs.count();
  for (let i = 0; i < n; i++) {
    const img = imgs.nth(i);
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth))
      .toBeGreaterThan(0);
  }
  return n;
}

test("guide loads with a skip-link target, title and navigation entry", async ({
  page,
}) => {
  await page.goto(`${web}/guide`);
  await expect(page.locator("main#content")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "How to use",
  );
  await expect(
    page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Guide" }),
  ).toBeVisible();
  // The Studio and the landing page link here.
  await page.goto(`${web}/studio`);
  await page.getByRole("link", { name: "How to use" }).click();
  await expect(page).toHaveURL(/\/guide$/);
});

test("table of contents links jump to their sections", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${web}/guide`);
  const toc = page.getByRole("navigation", { name: "On this page" });
  for (const [name, id] of [
    ["Keyboard shortcuts", "shortcuts"],
    ["Questions and fixes", "faq"],
    ["Shipments", "ws-shipments"],
  ] as const) {
    await toc.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator(`#${id}`)).toBeInViewport();
  }
});

test("every screenshot loads, has alt text and a size, and each marker has a step", async ({
  page,
}) => {
  await page.goto(`${web}/guide`);
  const count = await loadAllImages(page);
  expect(count).toBeGreaterThanOrEqual(20);
  const imgs = page.locator(".gd-shot img");
  for (let i = 0; i < count; i++) {
    const img = imgs.nth(i);
    expect(((await img.getAttribute("alt")) ?? "").length).toBeGreaterThan(20);
    expect(Number(await img.getAttribute("width"))).toBeGreaterThan(0);
    expect(Number(await img.getAttribute("height"))).toBeGreaterThan(0);
  }
  const figures = page.locator("figure.gd-fig");
  for (let i = 0; i < (await figures.count()); i++) {
    const f = figures.nth(i);
    await expect(f.locator(".gd-pin")).toHaveCount(
      await f.locator(".gd-steps li").count(),
    );
  }
});

test("language toggle switches the text and the screenshots", async ({
  page,
}) => {
  await page.goto(`${web}/guide`);
  const first = page.locator(".gd-shot img").first();
  await expect(first).toHaveAttribute("src", /\/guide\/en\//);
  await page.getByRole("button", { name: "ไทย" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "th");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("วิธีใช้");
  await expect(first).toHaveAttribute("src", /\/guide\/th\//);
  await loadAllImages(page);
  await page.getByRole("button", { name: "EN" }).click();
  await expect(first).toHaveAttribute("src", /\/guide\/en\//);
});

test("a screenshot opens enlarged and Escape closes it", async ({ page }) => {
  await page.goto(`${web}/guide`);
  await page
    .getByRole("button", { name: "Enlarge screenshot" })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

for (const lang of ["en", "th"] as const) {
  test(`no horizontal overflow at 320 px (${lang})`, async ({ page }) => {
    await page.addInitScript((l) => localStorage.setItem("cc-lang", l), lang);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`${web}/guide`);
    await loadAllImages(page);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // The contents list collapses behind a button and opens on demand.
    const toggle = page.getByRole("button", { name: /Contents|สารบัญ/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
}
