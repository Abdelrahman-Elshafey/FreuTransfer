import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// index.html names the icon; Vite copies apps/web/public/ to the site root, so the file must be
// there under the same name, or browsers ask for it and get a 404.
const web = new URL("../", import.meta.url);

describe("favicon", () => {
  it("is linked from index.html and exists in public/", () => {
    const href = readFileSync(new URL("index.html", web), "utf8").match(
      /<link rel="icon" href="\/([^"]+)" type="image\/svg\+xml" \/>/,
    )?.[1];
    expect(href).toBeDefined();
    expect(existsSync(new URL(`public/${href}`, web))).toBe(true);
  });

  it("is a plain SVG: no script, no font, no outside reference", () => {
    const svg = readFileSync(new URL("public/favicon.svg", web), "utf8");
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    for (const banned of ["<script", "<text", "href=", "@import", "url("]) {
      expect(svg).not.toContain(banned);
    }
  });
});
