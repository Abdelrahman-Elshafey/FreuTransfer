import { describe, expect, it } from "vitest";
import { parseSeedArgs, SeedArgsError } from "./seed-args.ts";

describe("parseSeedArgs", () => {
  it("loads verified data only by default", () => {
    expect(parseSeedArgs([], {})).toEqual({ includeDrafts: false });
    expect(parseSeedArgs([], { NODE_ENV: "production" })).toEqual({ includeDrafts: false });
  });

  it("includes drafts when asked, outside production (also when the flag is repeated)", () => {
    expect(parseSeedArgs(["--include-drafts"], {})).toEqual({ includeDrafts: true });
    expect(parseSeedArgs(["--", "--include-drafts", "--include-drafts"], {})).toEqual({
      includeDrafts: true,
    });
  });

  it("refuses drafts in production", () => {
    expect(() => parseSeedArgs(["--include-drafts"], { NODE_ENV: "production" })).toThrow(
      SeedArgsError,
    );
  });

  it("refuses an unknown argument instead of ignoring a typo", () => {
    expect(() => parseSeedArgs(["--include-draft"], {})).toThrow(
      /Unknown argument: --include-draft/,
    );
  });
});
