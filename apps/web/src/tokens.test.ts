import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every text colour the page puts on a background must pass WCAG 2.2 AA (4.5:1 for normal text,
// SC 1.4.3), in the light and in the dark theme. The values come from styles.css itself, so a
// changed token is checked, not a copy of it.
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function tokens(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(
      (m) => m.slice(1, 3) as [string, string],
    ),
  );
}
const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
const light = tokens(css.slice(0, darkStart));
const dark = tokens(css.slice(darkStart, css.indexOf("@theme")));

/** WCAG 2.2 relative luminance of an sRGB hex colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// [text, background]: each pair the page uses.
const PAIRS = [
  ["ink", "page"],
  ["ink", "card"],
  ["muted", "page"],
  ["muted", "card"],
  ["accent-ink", "accent"],
  ["danger", "page"],
  ["danger", "card"],
  ["warn-ink", "warn-bg"],
] as const;

describe("colour tokens", () => {
  it("defines the same tokens in both themes", () => {
    expect(light.size).toBeGreaterThan(0);
    expect([...dark.keys()]).toEqual([...light.keys()]);
  });

  for (const [name, theme] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    it.each(PAIRS)(`${name}: %s on %s has at least 4.5:1 contrast`, (text, background) => {
      const fg = theme.get(text);
      const bg = theme.get(background);
      if (!fg || !bg) throw new Error(`missing token ${text} or ${background}`);
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("the contrast formula matches WCAG's known values", () => {
    // Black on white is exactly 21:1; #767676 on white is the classic AA threshold, 4.54:1.
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
});
