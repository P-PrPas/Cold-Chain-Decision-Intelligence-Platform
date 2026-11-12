/**
 * Captures the real-UI screenshots (and callout anchor positions) used by the
 * /guide page. Not part of the normal e2e run: it only runs with CC_GUIDE_CAPTURE=1.
 *
 *   CC_GUIDE_CAPTURE=1 npx playwright test tests/e2e/guide-capture.spec.ts
 *   python scripts/optimize_guide_images.py
 *
 * Needs the dev stack on http://localhost:3000 (Keycloak login only works from
 * that origin). Everything shown is synthetic demo data. Raw PNGs and anchor
 * JSON land in tests/e2e/.guide-raw/ (git-ignored); the python step writes the
 * WebP files and apps/web/app/guide/guide-images.json.
 */
import {
  test,
  expect,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dictionaries } from "../../apps/web/i18n";

const web = "http://localhost:3000";
const api = "http://localhost:8000/api/v1";
const RAW = join(__dirname, ".guide-raw");
const LANGS = ["en", "th"] as const;
type Lang = (typeof LANGS)[number];
const D = (lang: Lang) => dictionaries[lang];

test.skip(!process.env.CC_GUIDE_CAPTURE, "set CC_GUIDE_CAPTURE=1 to capture");
test.describe.configure({ mode: "serial" });
test.use({ deviceScaleFactor: 1, actionTimeout: 15000 });

/* ------------------------------------------------------------- helpers */

type At = "tl" | "tr" | "c" | "l" | "r" | "t" | "b";
type Anchors = Record<string, [Locator, At?]>;
type Box = { x: number; y: number; w: number; h: number; form: boolean };

/** Page-absolute rectangle of an element. */
async function rect(loc: Locator): Promise<Box> {
  return loc.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + window.scrollX,
      y: r.top + window.scrollY,
      w: r.width,
      h: r.height,
      form: /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName),
    };
  });
}

/**
 * Default marker position. Form controls get it on the right edge (the label
 * sits above them), big panels on the left edge, small things above-left.
 */
function defaultAt(r: Box): At {
  if (r.form && r.w > 120) return "r";
  if (r.w >= 200 && r.h >= 50) return "l";
  return "tl";
}

/**
 * Takes a screenshot and records where each numbered callout belongs, as
 * percentages of the image, measured from the live DOM so the markers line up.
 * `clip` crops to one element (fullPage capture, so it may be taller than the
 * viewport); without it the current viewport is captured.
 */
async function shoot(
  page: Page,
  lang: Lang,
  name: string,
  anchors: Anchors,
  opts: { clip?: Locator; maxH?: number } = {},
) {
  const dir = join(RAW, lang);
  mkdirSync(dir, { recursive: true });
  // The skip link appears when focused, which would show in the shot.
  await page.addStyleTag({ content: ".skip-link{display:none!important}" });
  const view = page.viewportSize()!;
  let origin: Box = { x: 0, y: 0, w: view.width, h: view.height };
  if (opts.clip) {
    const r = await rect(opts.clip);
    origin = {
      x: r.x,
      y: r.y,
      w: r.w,
      h: Math.min(r.h, opts.maxH ?? r.h),
      form: false,
    };
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  const boxes: Record<string, Box> = {};
  for (const [key, [loc]] of Object.entries(anchors))
    boxes[key] = await rect(loc);
  const png = await page.screenshot({
    path: join(dir, name + ".png"),
    ...(opts.clip
      ? {
          fullPage: true,
          clip: { x: origin.x, y: origin.y, width: origin.w, height: origin.h },
        }
      : {}),
  });
  const measured: Record<string, { x: number; y: number }> = {};
  for (const [key, [, explicit]] of Object.entries(anchors)) {
    const r = boxes[key];
    const at = explicit ?? defaultAt(r);
    // The corner markers sit just outside the element's top-left corner so they
    // do not cover its first characters; the others sit on the edge named by `at`.
    const px =
      at === "tl"
        ? r.x - 4
        : at === "l"
          ? r.x
          : at === "tr"
            ? r.x + r.w + 4
            : at === "r"
              ? r.x + r.w
              : r.x + r.w / 2;
    const py =
      at === "tl" || at === "tr"
        ? r.y - 10
        : at === "t"
          ? r.y
          : at === "b"
            ? r.y + r.h
            : r.y + r.h / 2;
    const x = ((px - origin.x) / origin.w) * 100;
    const y = ((py - origin.y) / origin.h) * 100;
    if (x < -5 || x > 105 || y < -5 || y > 105)
      throw new Error(`${name}/${key} anchor outside the image: ${x}, ${y}`);
    const clamp = (v: number) => Math.min(99, Math.max(1, v));
    measured[key] = {
      x: Math.round(clamp(x) * 100) / 100,
      y: Math.round(clamp(y) * 100) / 100,
    };
  }
  writeFileSync(
    join(dir, name + ".json"),
    JSON.stringify({ anchors: measured }),
  );
}

async function prefs(page: Page, lang: Lang, fresh = false) {
  await page.addInitScript(
    ([l, isFresh]) => {
      localStorage.setItem("cc-lang", l as string);
      localStorage.setItem("cc-theme", "light");
      if (!isFresh) {
        localStorage.setItem("cc-studio-visited", "1");
        localStorage.setItem("cc-studio-coach", "1");
      }
    },
    [lang, fresh],
  );
}

async function openStudio(page: Page, query = "") {
  await page.goto(`${web}/studio${query}`);
  await expect(page.locator(".network-canvas")).toHaveAttribute(
    "data-init-ms",
    /\d+/,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
}

const slider = (page: Page) =>
  page.getByRole("slider", { name: /Simulation time|เวลาในการจำลอง/ });

/* -------------------------------------------------------------- studio */

for (const lang of LANGS) {
  test.describe(`studio ${lang}`, () => {
    test("first visit with coach mark", async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      await prefs(page, lang, true);
      await openStudio(page);
      await expect(page.locator(".coach")).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(600);
      await shoot(page, lang, "studio-first", {
        "1": [page.locator(".coach")],
        "2": [page.locator(".rail")],
        "3": [page.locator(".network-canvas")],
        "4": [page.locator(".result-card")],
        "5": [page.locator(".timeline")],
      });
      await context.close();
    });

    test("overview, timeline, scenario, factors, compare, 2D", async ({
      browser,
    }) => {
      const t = D(lang);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      await prefs(page, lang);
      await openStudio(page);
      await shoot(page, lang, "studio-overview", {
        "1": [page.locator(".studio-head"), "tl"],
        "2": [page.locator(".rail")],
        "3": [page.locator(".network-canvas")],
        "4": [page.locator(".result-card")],
        "5": [page.locator(".factor-controls")],
        "6": [page.locator(".timeline")],
      });

      await shoot(
        page,
        lang,
        "studio-timeline",
        {
          "1": [page.locator(".tl-play"), "l"],
          "2": [page.locator(".timeline .seg"), "r"],
          "3": [page.locator(".tl-legend li").first()],
          "4": [page.locator(".tl-track")],
          "5": [page.locator(".tl-decision"), "t"],
        },
        { clip: page.locator(".timeline") },
      );

      // Scenario 2 plays to the end: the ticker lands on the exact total.
      await page.keyboard.press("2");
      await expect(page.locator(".hud-tl")).toHaveAttribute(
        "data-phase",
        "arrived",
        { timeout: 20000 },
      );
      await page.waitForTimeout(500);
      await shoot(page, lang, "studio-scenario", {
        "1": [page.locator(".rail-item[aria-pressed='true']"), "r"],
        "2": [page.locator(".hud-br"), "tr"],
        "3": [page.locator(".result-card")],
        "4": [page.locator(".hud-tl"), "tr"],
      });

      // What-if: change the delay and capture the ghost of the previous value.
      // The ghost normally fades after 1.2 s, so hold its timer for the capture.
      await page.setViewportSize({ width: 1440, height: 1300 });
      await page.waitForTimeout(1000);
      await page.addStyleTag({
        content: ".ghost-chip{animation:none!important;opacity:1!important}",
      });
      await page.evaluate(() => {
        const st = window.setTimeout.bind(window);
        window.setTimeout = ((f: TimerHandler, d?: number, ...a: unknown[]) =>
          st(f, d === 1200 ? 60000 : d, ...a)) as typeof window.setTimeout;
      });
      await page.getByLabel(t.fcDelayLabel, { exact: true }).fill("240");
      await expect(page.locator(".ghost-chip")).toBeVisible();
      await shoot(page, lang, "studio-factors", {
        "1": [page.locator(".presets"), "r"],
        "2": [page.locator(".ghost-chip")],
        "3": [page.locator(".factor-tabs")],
        "4": [page.getByLabel(t.fcDelayLabel, { exact: true })],
        "5": [page.locator(".impact-band").first(), "tr"],
      });
      await page.getByRole("button", { name: t.fcReset }).first().click();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.waitForTimeout(1000);

      await page.keyboard.press("2");
      await page.waitForTimeout(500);
      await page.keyboard.press("c");
      await page.waitForTimeout(6000);
      await shoot(page, lang, "studio-compare", {
        "1": [page.locator(".compare-btn"), "tr"],
        "2": [page.locator(".network-canvas")],
        "3": [page.locator(".timeline")],
      });
      await page.keyboard.press("c");

      await page
        .getByRole("group", { name: t.cameraGroup })
        .getByRole("button", { name: t.cam2d })
        .click();
      await page.waitForTimeout(800);
      await shoot(
        page,
        lang,
        "studio-2d",
        {
          "1": [page.getByRole("group", { name: t.cameraGroup })],
          "2": [page.locator(".stage")],
        },
        { clip: page.locator(".studio-stage") },
      );
      await context.close();
    });

    test("cost breakdown and the delay and cost chart", async ({ browser }) => {
      const t = D(lang);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      await prefs(page, lang);
      await openStudio(page);
      await page.keyboard.press("2");
      await expect(page.locator(".hud-tl")).toHaveAttribute(
        "data-phase",
        "arrived",
        { timeout: 20000 },
      );
      // Spread the 2,800.00 THB total over four categories so the bar has segments.
      await page
        .getByRole("button", { name: t.fcTabCost, exact: true })
        .click();
      const component = page.locator(".factor-controls select").first();
      for (const [index, amount] of [
        [0, "900.00"],
        [1, "450.00"],
        [2, "350.00"],
        [5, "1100.00"],
      ] as const) {
        await component.selectOption({ index });
        await page.locator('.factor-controls input[type="text"]').fill(amount);
      }
      await page
        .getByRole("button", { name: t.fcTabDelay, exact: true })
        .click();
      await page.waitForTimeout(1800);
      await page.locator(".cost-breakdown-card").scrollIntoViewIfNeeded();
      await shoot(page, lang, "studio-chart", {
        "1": [page.locator(".compare-chart svg"), "tr"],
        "2": [page.locator(".cc-toggle"), "tr"],
        "3": [page.locator(".cb-bar[role='img']"), "tr"],
        "4": [page.locator(".cb-legend")],
      });
      await context.close();
    });

    test("edit readings", async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      await prefs(page, lang);
      await openStudio(page);
      await page.locator(".tl-edit-toggle").click();
      const point = (i: number) => page.getByTestId(`edit-point-${i}`);
      await point(5).focus();
      for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowDown");
      await point(7).focus();
      await page.keyboard.press("Delete");
      await point(4).focus();
      await page.waitForTimeout(1000);
      await shoot(
        page,
        lang,
        "studio-edit",
        {
          "1": [page.locator(".tl-edit-toggle"), "l"],
          "2": [point(4), "tr"],
          "3": [page.locator(".tl-edit-actions button").first(), "tl"],
          "4": [page.locator(".tl-edit-actions button").nth(1), "tl"],
          "5": [page.locator(".timeline .edited-pill"), "tr"],
        },
        { clip: page.locator(".timeline") },
      );
      await context.close();
    });

    test("data gap on DEMO-003", async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      await prefs(page, lang);
      await openStudio(page, "?shipment=DEMO-003");
      await slider(page).focus();
      for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowLeft");
      for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(1200);
      await shoot(page, lang, "studio-gap", {
        "1": [page.locator(".stage").getByText(/09:30/).first()],
        "2": [page.locator(".hud-tl"), "tr"],
        "3": [page.locator(".tl-gap")],
      });
      await context.close();
    });

    test("mobile", async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
      });
      const page = await context.newPage();
      await prefs(page, lang);
      await openStudio(page);
      await shoot(page, lang, "studio-mobile", {
        "1": [page.locator(".network-canvas")],
        "2": [page.locator(".timeline")],
        "3": [page.locator(".sheet-handle"), "tr"],
      });
      await page.locator(".sheet-handle").click();
      await page.waitForTimeout(600);
      await shoot(page, lang, "studio-mobile-sheet", {
        "1": [page.locator(".sheet-handle"), "tr"],
        "2": [page.locator(".result-card"), "tl"],
        "3": [page.locator(".factor-controls"), "tl"],
      });
      await context.close();
    });

    test("legend reference (brand sheet)", async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      await prefs(page, lang);
      await page.goto(`${web}/brand`);
      const sec = (id: string) =>
        page.locator(`section[aria-labelledby="${id}"]`);
      await expect(sec("b-thermal")).toBeVisible();
      await page.waitForTimeout(800);
      await shoot(
        page,
        lang,
        "ref-thermal",
        {
          "1": [sec("b-thermal").locator(".thermal-scale")],
          "2": [sec("b-thermal").locator(".hatch-sample")],
        },
        { clip: sec("b-thermal") },
      );
      await shoot(
        page,
        lang,
        "ref-status",
        {
          "1": [sec("b-status").locator(".chip-row").nth(0)],
          "2": [sec("b-status").locator(".chip-row").nth(1)],
        },
        { clip: sec("b-status") },
      );
      await context.close();
    });
  });
}

/* ----------------------------------------------------------- workspace */

/**
 * The API limits each client to 120 requests per UTC minute. Count what this
 * script sends and wait for the next minute before a burst that would exceed it.
 */
const sent: number[] = [];
async function throttle(need: number) {
  for (;;) {
    const minute = Math.floor(Date.now() / 60000);
    const used = sent.filter((t) => Math.floor(t / 60000) === minute).length;
    if (used + need <= 80) return;
    await new Promise((r) => setTimeout(r, 61000 - (Date.now() % 60000)));
  }
}

async function signIn(browser: Browser, user: string) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Bangkok",
    locale: "en-US",
  });
  context.on("request", (r) => {
    if (r.url().startsWith("http://localhost:8000/")) sent.push(Date.now());
  });
  const page = await context.newPage();
  await page.goto(`${web}/workspace`);
  await page
    .getByRole("button", { name: "Sign in with identity provider" })
    .click();
  await page.locator("#username").fill(user);
  await page.locator("#password").fill("synthetic-demo-only");
  await page.locator("#kc-login").click();
  await page.waitForURL(`${web}/workspace`);
  const me = await context.request.get(api + "/auth/me");
  expect(me.ok(), await me.text()).toBeTruthy();
  const body = await me.json();
  return {
    context,
    page,
    org: body.memberships[0].organization_id as string,
  };
}
type Session = Awaited<ReturnType<typeof signIn>>;

async function call(
  s: Session,
  path: string,
  method = "GET",
  data?: unknown,
  revision?: string,
) {
  await throttle(3);
  const csrf =
    (await s.context.cookies()).find((c) => c.name === "cc_csrf")?.value || "";
  sent.push(Date.now());
  const response = await s.context.request.fetch(api + path, {
    method,
    data,
    headers: {
      "X-Organization-Id": s.org,
      "X-CSRF-Token": csrf,
      "Idempotency-Key": crypto.randomUUID(),
      ...(revision ? { "If-Match": revision } : {}),
    },
  });
  expect(
    response.ok(),
    `${method} ${path}: ${await response.text()}`,
  ).toBeTruthy();
  return response.json();
}
async function job(s: Session, id: string) {
  await expect
    .poll(
      async () => {
        const result = await call(s, `/jobs/${id}`);
        if (result.job.status === "FAILED")
          throw new Error(JSON.stringify(result));
        return result.job.status;
      },
      { timeout: 90000, intervals: [1000, 2000, 3000] },
    )
    .toBe("COMPLETED");
}

/** Synthetic trip: readings every 5 minutes, 07:00 to 09:00 Bangkok time, with a 40 minute sensor gap. */
function demoCsv() {
  const rows = ["timestamp,temperature_c,sensor_id"];
  const base = [3.8, 3.9, 4.1, 4.0, 4.3, 4.6, 4.8, 5.1];
  for (let m = 0; m <= 120; m += 5) {
    if (m > 45 && m < 85) continue; // the gap: no readings, never filled in
    const h = 7 + Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, "0");
    const t =
      base[Math.min(Math.floor(m / 16), base.length - 1)] + (m % 10) / 20;
    rows.push(
      `2026-03-10 ${String(h).padStart(2, "0")}:${mm}:00,${t.toFixed(1)},A`,
    );
  }
  return Buffer.from(rows.join("\n") + "\n");
}
const csvFile = () => ({
  name: "strawberry-trip-0310.csv",
  mimeType: "text/csv",
  buffer: demoCsv(),
});

// CC_GUIDE_RUN reuses the shipments of an earlier run (to re-take only the list shot).
const RUN =
  process.env.CC_GUIDE_RUN ?? String(Math.floor(Math.random() * 9000) + 1000);
const REF = `SB-${RUN}-01`;
const REF2 = `SB-${RUN}-02`;
const REF3 = `SB-${RUN}-03`;

async function setLang(page: Page, lang: Lang) {
  await page.evaluate((l) => localStorage.setItem("cc-lang", l), lang);
}
async function gotoShipment(s: Session, lang: Lang, id: string, step?: string) {
  await throttle(25);
  await setLang(s.page, lang);
  await s.page.goto(`${web}/workspace/shipments/${id}?org=${s.org}`);
  await expect(s.page.locator(".ws-stepper")).toBeVisible({ timeout: 30000 });
  await expect(s.page.locator("[aria-busy='true']")).toHaveCount(0, {
    timeout: 30000,
  });
  if (step) await s.page.locator(`li[data-step="${step}"] button`).click();
  await s.page.waitForTimeout(800);
}
async function gotoList(s: Session, lang: Lang) {
  const t = D(lang);
  await throttle(25);
  await setLang(s.page, lang);
  await s.page.goto(`${web}/workspace`);
  const orgSelect = s.page.getByLabel(t.wsOrganization, { exact: true });
  await expect(orgSelect).toBeVisible();
  await orgSelect.selectOption(s.org);
}

test.describe("workspace", () => {
  let op: Session;
  let qa: Session;
  let shipA = "";
  let product = "";
  let policyId = "";
  let decisionId = "";
  const state: {
    dataset?: string;
    ref?: string;
    run?: string;
    scenarios?: { id: string }[];
  } = {};

  test.beforeAll(async ({ browser }) => {
    op = await signIn(browser, "operator");
    qa = await signIn(browser, "reviewer");
    // A fresh product per run: an approved policy cannot overlap an earlier one.
    const name = `Fresh strawberries, lot L${RUN}`;
    const csrf =
      (await op.context.cookies()).find((c) => c.name === "cc_csrf")?.value ||
      "";
    const made = await op.context.request.post(api + "/products", {
      data: { name, category: "FRESH_FRUIT", packaging_type: "VENTED_CRATE" },
      headers: {
        "X-Organization-Id": op.org,
        "X-CSRF-Token": csrf,
        "Idempotency-Key": crypto.randomUUID(),
      },
    });
    if (made.ok()) product = (await made.json()).product.id;
    else
      product = (await call(op, "/products?limit=100")).items.find(
        (p: { name: string }) => p.name === name,
      ).id;
  });
  test.afterAll(async () => {
    await op?.context.close();
    await qa?.context.close();
  });

  for (const lang of LANGS) {
    test(`create shipment form ${lang}`, async () => {
      const t = D(lang);
      await gotoList(op, lang);
      await op.page
        .getByRole("button", { name: t.wsCreateShipment, exact: true })
        .click();
      const f = (label: string) => op.page.getByLabel(label, { exact: true });
      await f(t.wsFieldReference).fill(REF);
      await f(t.wsFieldProduct).selectOption(product);
      await f(t.wsFieldOrigin).fill("Chiang Mai DC");
      await f(t.wsFieldDestination).fill("Bangkok receiver");
      await f(t.wsFieldDeparture).fill("2026-03-10T07:00");
      await f(t.wsFieldArrival).fill("2026-03-10T09:00");
      await f(t.wsFieldValue).fill("185000.00");
      await op.page.waitForTimeout(500);
      const form = op.page
        .locator("form")
        .filter({ has: f(t.wsFieldReference) });
      const submit = form.getByRole("button", {
        name: t.wsCreateShipment,
        exact: true,
      });
      await shoot(
        op.page,
        lang,
        "ws-create",
        {
          "1": [f(t.wsFieldReference)],
          "2": [f(t.wsFieldProduct)],
          "3": [f(t.wsFieldDeparture)],
          "4": [f(t.wsFieldValue)],
          "5": [submit, "b"],
        },
        { clip: form },
      );
      if (lang === "en") {
        await submit.click();
        await expect(
          op.page.getByRole("link", { name: REF, exact: true }),
        ).toBeVisible();
      }
    });
  }

  test("seed more shipments and find ids", async () => {
    const list = await call(op, "/shipments?limit=50");
    shipA = list.items.find(
      (x: { reference: string }) => x.reference === REF,
    ).id;
    const mk = async (
      reference: string,
      origin: string,
      destination: string,
      value: string,
    ) =>
      call(op, "/shipments", "POST", {
        reference,
        product_id: product,
        origin: { name: origin },
        destination: { name: destination },
        departure_at: "2026-03-11T00:00:00Z",
        estimated_arrival_at: "2026-03-11T03:00:00Z",
        cargo_value: value,
        currency: "THB",
      });
    await mk(REF2, "Nakhon Ratchasima DC", "Bangkok receiver", "92000.00");
    await mk(REF3, "Rayong packhouse", "Laem Chabang port", "240000.00");
  });

  test("evidence step: empty shipment, locked steps, upload form", async () => {
    for (const lang of LANGS) {
      await gotoShipment(op, lang, shipA, "evidence");
      await shoot(
        op.page,
        lang,
        "ws-evidence-empty",
        {
          "1": [op.page.locator(".ws-stepper"), "tl"],
          "2": [op.page.locator('li[data-step="simulate"] .ws-step-why')],
          "3": [op.page.locator("form.ws-upload")],
          "4": [op.page.locator("#evidence .ws-split > .ws-card").last()],
        },
        { clip: op.page.locator("main#content"), maxH: 1000 },
      );
      await op.page.locator('input[name="file"]').setInputFiles(csvFile());
      await op.page.locator('input[name="timezone"]').fill("Asia/Bangkok");
      await op.page.waitForTimeout(400);
      const form = op.page.locator("form.ws-upload");
      await shoot(
        op.page,
        lang,
        "ws-upload",
        {
          "1": [form.locator('input[name="file"]')],
          "2": [form.locator('input[name="timestamp"]')],
          "3": [form.locator('input[name="timezone"]')],
          "4": [form.locator('select[name="unit"]')],
          "5": [form.locator("button")],
        },
        { clip: form },
      );
    }
  });

  test("upload through the UI, then draft a policy", async () => {
    await gotoShipment(op, "en", shipA, "evidence");
    await op.page.locator('input[name="file"]').setInputFiles(csvFile());
    await op.page.locator('input[name="timezone"]').fill("Asia/Bangkok");
    await op.page.locator("form.ws-upload button").click();
    await expect(op.page.locator(".ws-busy")).toHaveCount(0, {
      timeout: 60000,
    });
    const datasets = await call(op, `/shipments/${shipA}/temperature-datasets`);
    const dataset = datasets.items.find(
      (d: { status: string }) => d.status === "READY",
    );
    expect(dataset).toBeTruthy();
    const csrf = (await op.context.cookies()).find(
      (c) => c.name === "cc_csrf",
    )!.value;
    const reference = await op.context.request.post(
      api + "/reference-documents",
      {
        headers: { "X-Organization-Id": op.org, "X-CSRF-Token": csrf },
        multipart: {
          file: {
            name: "synthetic-reference.txt",
            mimeType: "text/plain",
            buffer: Buffer.from(
              "Synthetic demo reference. Not a real safety approval.",
            ),
          },
        },
      },
    );
    const ref = (await reference.json()).reference_document;
    const policy = (
      await call(op, "/quality-policies", "POST", {
        product_id: product,
        policy_key: "DEMO-STRAWBERRY-" + RUN,
        version: 1,
        reference_document_id: ref.id,
        effective_from: "2025-01-01T00:00:00Z",
        rules: {
          schema_version: "1.0",
          required_sensor_ids: ["A"],
          max_valid_sampling_gap_seconds: 600,
          temperature_bounds: { min_c: "2", max_c: "8" },
          continuous_excursion_limit_seconds: 300,
          cumulative_excursion_limit_seconds: 600,
          unknown_gap_effect: "REVIEW_REQUIRED",
          action_constraints: [],
        },
      })
    ).quality_policy;
    policyId = policy.id;
    await call(
      op,
      `/quality-policies/${policy.id}/submit-review`,
      "POST",
      { note: "Synthetic review" },
      '"policy-r1"',
    );
    state.dataset = dataset.id;
    state.ref = ref.id;
  });

  test("policy awaiting QA approval", async () => {
    for (const lang of LANGS) {
      const t = D(lang);
      await gotoShipment(op, lang, shipA, "policy");
      await shoot(
        op.page,
        lang,
        "ws-policy",
        {
          "1": [op.page.locator('li[data-step="simulate"] .ws-step-why')],
          "2": [op.page.getByText(t.wsNoApprovedTitle).first()],
          "3": [op.page.getByText(t.wsNeedsQaToApprove).first()],
        },
        { clip: op.page.locator("main#content"), maxH: 1000 },
      );
    }
  });

  test("QA approves the policy; analysis and simulation", async () => {
    await call(
      qa,
      `/quality-policies/${policyId}/approve`,
      "POST",
      { approval_note: "Synthetic demo only" },
      '"policy-r2"',
    );
    const analysis = await call(op, `/shipments/${shipA}/analyses`, "POST", {
      dataset_id: state.dataset,
      policy_version_id: policyId,
      selected_sensor_ids: ["A"],
    });
    await job(op, analysis.job.id);
    for (const lang of LANGS) {
      const t = D(lang);
      await gotoShipment(op, lang, shipA, "policy");
      const card = op.page
        .locator(".ws-card")
        .filter({ hasText: t.wsIndeterminateNote })
        .last();
      await shoot(
        op.page,
        lang,
        "ws-analysis",
        {
          "1": [card.getByText(t.wsAnIndeterminate).first()],
          "2": [card.getByText(t.wsIndeterminateNote)],
          "3": [card.getByText(t.wsUnknownTime).first()],
          "4": [card.getByText(t.wsRulesMatched).first()],
        },
        { clip: card },
      );
      await op.page.locator('li[data-step="evidence"] button').click();
      await op.page.waitForTimeout(800);
      const chart = op.page.locator("figure.ws-timeline");
      await shoot(
        op.page,
        lang,
        "ws-evidence-chart",
        {
          "1": [chart.locator(".chart-scroll"), "r"],
          "2": [chart.locator("svg rect[stroke-dasharray]"), "t"],
          "3": [chart.locator(".ws-legend"), "r"],
        },
        { clip: chart },
      );
    }
    const cost = (amount: string) =>
      Object.fromEntries(
        [
          "additional_transport",
          "inspection",
          "holding",
          "handling",
          "disposal",
          "other",
        ].map((n) => [n, { amount, source: "USER_ESTIMATE" }]),
      );
    const types = [
      ["CONTINUE_DELIVERY", 0, "200.00"],
      ["HOLD_INSPECTION", 120, "480.00"],
      ["CONDITIONAL_REROUTE", 90, "750.00"],
      ["REJECT_QUARANTINE_DISPOSE", 180, "1000.00"],
    ] as const;
    const simulation = await call(
      op,
      `/shipments/${shipA}/simulations`,
      "POST",
      {
        analysis_id: analysis.analysis.id,
        dataset_id: state.dataset,
        policy_version_id: policyId,
        currency: "THB",
        scenario_types: types.map((x) => x[0]),
        scenarios: types.map(([type, delay, amount]) => ({
          type,
          estimated_delay_minutes: delay,
          receiver_acceptance: "UNKNOWN",
          costs: cost(amount),
        })),
        ranking_weights: { cost: "0.60", delay: "0.40" },
      },
    );
    await job(op, simulation.job.id);
    const scenarios = await call(
      op,
      `/simulations/${simulation.simulation.id}/scenarios`,
    );
    state.run = simulation.simulation.id;
    state.scenarios = scenarios.items;
    for (const lang of LANGS) {
      const t = D(lang);
      await gotoShipment(op, lang, shipA, "simulate");
      await op.page
        .getByRole("button", { name: t.scnHold, exact: true })
        .first()
        .click();
      await op.page.waitForTimeout(1500);
      // Show the whole inspector (it normally scrolls inside its own box).
      await op.page.addStyleTag({
        content:
          "#simulation .inspector{max-height:none!important;overflow:visible!important}",
      });
      await op.page.waitForTimeout(300);
      await shoot(
        op.page,
        lang,
        "ws-simulate",
        {
          "1": [op.page.locator("#simulation .rail")],
          "2": [op.page.locator("#simulation .network-canvas")],
          "3": [op.page.locator("#simulation .result-card")],
          "4": [op.page.locator("#simulation .ws-table")],
          "5": [
            op.page.getByRole("button", { name: t.wsPrepareProposal }).first(),
          ],
        },
        { clip: op.page.locator("#simulation"), maxH: 1900 },
      );
    }
  });

  test("propose, QA review and report", async () => {
    for (const lang of LANGS) {
      // The proposal form opens from the Simulate step. Shown only; the draft is saved by API.
      const t = D(lang);
      await gotoShipment(op, lang, shipA, "simulate");
      await op.page
        .getByRole("button", { name: t.scnHold, exact: true })
        .first()
        .click();
      await op.page
        .getByRole("button", { name: t.wsPrepareProposal })
        .first()
        .click();
      const why = op.page.getByLabel(t.wsWhyAppropriate);
      await why.fill(
        lang === "en"
          ? "Hold the load for inspection at the cold store before release to the receiver."
          : "กักสินค้าไว้ตรวจสอบที่ห้องเย็นก่อนส่งมอบให้ผู้รับ",
      );
      await op.page.waitForTimeout(800);
      const review = op.page.locator("#review");
      await shoot(
        op.page,
        lang,
        "ws-propose",
        {
          "1": [review.getByText(t.wsSelectedProposal).first()],
          "2": [review.getByText(t.wsReasons, { exact: true }).first()],
          "3": [why],
          "4": [review.getByRole("button", { name: t.wsSaveDraftForReview })],
        },
        { clip: review },
      );
    }
    const hold = state.scenarios!.find((x) =>
      JSON.stringify(x).includes("HOLD_INSPECTION"),
    )!;
    decisionId = (
      await call(op, "/decisions", "POST", {
        simulation_run_id: state.run,
        selected_scenario_id: hold.id,
        justification:
          "Hold the load for inspection at the cold store before release to the receiver.",
      })
    ).decision.id;
    await call(
      op,
      `/decisions/${decisionId}/submit`,
      "POST",
      { justification: "Hold for independent QA review" },
      '"decision-r1"',
    );
    for (const lang of LANGS) {
      const t = D(lang);
      await gotoShipment(qa, lang, shipA, "qa");
      await qa.page.locator(".decision-list li button").first().click();
      await qa.page.waitForTimeout(1000);
      const review = qa.page.locator("#review");
      await shoot(
        qa.page,
        lang,
        "ws-qa",
        {
          "1": [review.locator(".ws-snapshot")],
          "2": [review.getByLabel(t.wsReviewOutcome)],
          "3": [review.getByLabel(t.wsReviewNotes)],
          "4": [review.getByRole("button", { name: t.wsConfirmReview })],
        },
        { clip: review },
      );
    }
    await call(
      qa,
      `/decisions/${decisionId}/approve`,
      "POST",
      {
        acting_role: "QA",
        review_notes: "Synthetic evidence reviewed for the guide demo.",
        evidence_references: ["reference:" + state.ref],
        acknowledged_required_actions: ["HOLD_IN_CONTROLLED_STORAGE"],
      },
      '"decision-r2"',
    );
    for (const lang of LANGS) {
      // The PDF is generated from the UI so its labels follow the interface language.
      const t = D(lang);
      await gotoShipment(op, lang, shipA, "report");
      await op.page.locator(".decision-list li button").first().click();
      await op.page.getByRole("button", { name: t.wsGeneratePdf }).click();
      await expect
        .poll(
          async () => {
            await throttle(5);
            await op.page
              .getByRole("button", { name: t.wsRefreshReport })
              .click();
            await op.page.waitForTimeout(1500);
            return op.page.getByText(t.wsDownloadPdf).count();
          },
          { timeout: 90000, intervals: [2000, 4000, 6000] },
        )
        .toBeGreaterThan(0);
      const review = op.page.locator("#review");
      await shoot(
        op.page,
        lang,
        "ws-report",
        {
          "1": [review.locator(".ws-snapshot")],
          "2": [review.getByRole("button", { name: t.wsRefreshReport }), "tl"],
          "3": [op.page.getByText(t.wsDownloadPdf).first(), "tr"],
        },
        { clip: review },
      );
    }
  });

  test("shipment list", async () => {
    for (const lang of LANGS) {
      const t = D(lang);
      await gotoList(op, lang);
      await op.page.getByLabel(t.wsSearch, { exact: true }).fill(`SB-${RUN}`);
      await op.page.waitForTimeout(2000);
      await shoot(
        op.page,
        lang,
        "ws-list",
        {
          "1": [
            op.page.getByRole("button", {
              name: t.wsCreateShipment,
              exact: true,
            }),
            "tl",
          ],
          "2": [op.page.getByLabel(t.wsSearch, { exact: true })],
          "3": [op.page.locator("select").nth(1)],
          "4": [op.page.locator("table a").first()],
        },
        { clip: op.page.locator("main").first(), maxH: 1000 },
      );
    }
  });
});
