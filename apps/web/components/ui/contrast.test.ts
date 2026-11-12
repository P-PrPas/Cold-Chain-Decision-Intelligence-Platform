import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { contrastRatio, parseColor } from "./contrast";

const css = readFileSync(
  join(__dirname, "..", "..", "app", "globals.css"),
  "utf8",
);

function tokens(selector: string) {
  const start = css.indexOf(selector + ",\n");
  const body = css.slice(start, css.indexOf("\n}", start));
  const map: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    map[m[1]] = m[2];
  }
  return map;
}

const PAIRS: [string, string][] = [
  ["text", "bg"],
  ["text", "panel"],
  ["text", "panel-2"],
  ["muted", "bg"],
  ["muted", "panel"],
  ["muted", "panel-2"],
  ["accent", "bg"],
  ["accent", "panel"],
  ["accent-ink", "accent"],
  ["accent-ink", "accent-hover"],
  ["st-eligible-fg", "st-eligible-bg"],
  ["st-review-fg", "st-review-bg"],
  ["st-blocked-fg", "st-blocked-bg"],
  ["st-unknown-fg", "st-unknown-bg"],
  ["st-neval-fg", "bg"],
];

for (const [name, sel] of [
  ["light", ":root"],
  ["dark", ':root[data-theme="dark"]'],
] as const) {
  test(`${name} theme text pairs meet 4.5:1`, () => {
    const t = { ...tokens(":root"), ...tokens(sel) };
    for (const [fg, bg] of PAIRS) {
      const a = parseColor(t[fg]);
      const b = parseColor(t[bg]);
      expect(a && b, `${fg}/${bg} parse`).toBeTruthy();
      expect(
        contrastRatio(a!, b!),
        `${name} ${fg} on ${bg}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
}
