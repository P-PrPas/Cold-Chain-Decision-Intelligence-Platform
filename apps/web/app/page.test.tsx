import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";
test("foundation cannot imply operational approval", () => {
  const html = renderToStaticMarkup(Home());
  expect(html).toContain("Domain QA policy approval remains open");
  expect(html).toContain("No operational decisions are available");
});
