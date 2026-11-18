import { describe, expect, it } from "vitest";
import { HOSTING_REGION } from "./site.ts";

describe("site details", () => {
  it("name the hosting country by a code Intl knows (else the page would print the raw code)", () => {
    expect(new Intl.DisplayNames("en", { type: "region" }).of(HOSTING_REGION)).not.toBe(
      HOSTING_REGION,
    );
  });
});
