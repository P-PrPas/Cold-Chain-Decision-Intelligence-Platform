import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TemperatureEvidence } from "./analysis-panel";
import { I18nProvider } from "@/i18n/provider";

const render = (observations: Record<string, unknown>[]) =>
  renderToStaticMarkup(
    <I18nProvider>
      <TemperatureEvidence observations={observations} />
    </I18nProvider>,
  );

test("QA sees observed heat and its window reason without opening raw JSON", () => {
  for (const reason of [
    "OUT_OF_RANGE_OUTSIDE_SHIPMENT_WINDOW",
    "OUT_OF_RANGE_INTERVAL_CROSSES_SHIPMENT_END",
  ]) {
    const html = render([
      {
        sensor_id: "A",
        temperature_c: "40",
        at: "2026-01-01T00:15:00Z",
        reason,
      },
    ]);
    expect(html).toContain('role="alert"');
    expect(html).toContain(reason);
    expect(html).toContain("40");
    expect(html).toContain("2026-01-01T00:15:00Z");
    expect(html).toContain("reanalysis before release");
  }
  expect(render([])).toBe("");
});
