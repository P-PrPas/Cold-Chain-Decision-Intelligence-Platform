import { describe, expect, it } from "vitest";
import { dictionaries, LANGS } from "@/i18n";
import { FIGURES } from "./guide-figures";
import manifest from "./guide-images.json";

type Manifest = Record<
  string,
  Record<string, { w: number; h: number; anchors: Record<string, unknown> }>
>;
const images = manifest as Manifest;

describe("guide figures", () => {
  for (const lang of LANGS) {
    it(`${lang}: every alt and step text exists and is not empty`, () => {
      for (const def of Object.values(FIGURES)) {
        for (const key of [def.alt, ...def.steps])
          expect(dictionaries[lang][key], key).toBeTruthy();
      }
    });
    it(`${lang}: each image has one callout marker per numbered step`, () => {
      for (const [id, def] of Object.entries(FIGURES)) {
        const info = images[lang][id];
        expect(info, `${lang}/${id}`).toBeDefined();
        expect(info.w).toBeGreaterThan(0);
        expect(info.h).toBeGreaterThan(0);
        expect(Object.keys(info.anchors).sort(), id).toEqual(
          def.steps.map((_, i) => String(i + 1)).sort(),
        );
      }
    });
  }
  it("the guide never calls an option safe, certified or approved", () => {
    const banned = /\b(safe|certified|เป็นที่ปลอดภัย)\b/i;
    for (const lang of LANGS) {
      for (const [key, text] of Object.entries(dictionaries[lang])) {
        if (key.startsWith("gd")) expect(text, key).not.toMatch(banned);
      }
    }
  });
});
