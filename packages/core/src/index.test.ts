import { describe, expect, it } from "vitest";
import { CORE_VERSION } from "./index.ts";

describe("core package", () => {
  it("exposes a version string", () => {
    expect(CORE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
