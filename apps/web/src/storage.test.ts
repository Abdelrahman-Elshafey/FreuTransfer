import { afterEach, describe, expect, it, vi } from "vitest";
import { readSaved, save } from "./storage.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const storage = (getItem: () => string | null, setItem: () => void) => ({ getItem, setItem });
const blocked = () => {
  throw new DOMException("The operation is insecure.", "SecurityError");
};

describe("storage", () => {
  it("reads and writes the reader's choice", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    });
    expect(readSaved("k")).toBeNull();
    save("k", "wise");
    expect(readSaved("k")).toBe("wise");
  });

  it("remembers nothing when storage is blocked, instead of breaking the page", () => {
    vi.stubGlobal("localStorage", storage(blocked, blocked));
    expect(readSaved("k")).toBeNull();
    expect(() => save("k", "wise")).not.toThrow();
  });

  it("lets any other error through: it would be a bug", () => {
    const bug = () => {
      throw new TypeError("bug");
    };
    vi.stubGlobal("localStorage", storage(bug, bug));
    expect(() => readSaved("k")).toThrow(TypeError);
    expect(() => save("k", "wise")).toThrow(TypeError);
  });
});
