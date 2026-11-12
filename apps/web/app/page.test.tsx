import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";
import { I18nProvider } from "@/i18n/provider";
import { SiteFooter } from "@/components/site-chrome";

const render = () =>
  renderToStaticMarkup(
    <I18nProvider>
      <Home />
      <SiteFooter />
    </I18nProvider>,
  );

test("landing names the category, the buyer and the one action", () => {
  const html = render();
  expect(html).toContain("Cold-chain excursion simulator for QA teams");
  expect(html).toContain("Open the simulator");
  expect(html).toContain('href="/studio"');
  expect(html).toContain("Gaps stay unknown. No interpolation.");
});

test("landing cannot imply operational approval", () => {
  const html = render();
  // The disclaimer sits in the shared footer, exactly once.
  expect(html.match(/Does not certify food safety/g)).toHaveLength(1);
  expect(html).toContain("Decision support only");
  const text = html.replace(/<[^>]*>/g, " ");
  expect(text).not.toMatch(/\b(safe|certified|approved|guaranteed)\b/i);
});
