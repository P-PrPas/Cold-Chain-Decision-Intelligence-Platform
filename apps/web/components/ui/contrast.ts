export type Rgb = [number, number, number];

export function parseColor(input: string): Rgb | null {
  const s = input
    .trim()
    .replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i, "#$1$1$2$2$3$3");
  const hex = /^#([0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(s);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

function lin(c: number) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]: Rgb) {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio. */
export function contrastRatio(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
