import { afterEach, describe, expect, it, vi } from "vitest";
import { REACH_UP, reveal } from "./reveal.ts";

// The tests run in Node: a fake IntersectionObserver stands in for the browser's, and an element
// is only what reveal touches (its dataset).

type Callback = (entries: { isIntersecting: boolean }[]) => void;
type Options = { rootMargin?: string };

function fakeObserver() {
  const made: {
    callback: Callback;
    options: Options;
    observed: unknown[];
    disconnected: boolean;
  }[] = [];
  class FakeObserver {
    readonly record: (typeof made)[number];
    constructor(callback: Callback, options: Options) {
      this.record = { callback, options, observed: [], disconnected: false };
      made.push(this.record);
    }
    observe(target: unknown) {
      this.record.observed.push(target);
    }
    disconnect() {
      this.record.disconnected = true;
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return made;
}

const element = () => ({ dataset: {} as Record<string, string> }) as unknown as HTMLElement;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reveal", () => {
  it("shows the element once it is in view, then stops watching it", () => {
    const made = fakeObserver();
    const el = element();
    reveal(el);
    expect(made[0]?.observed).toEqual([el]);
    expect("shown" in el.dataset).toBe(false);

    made[0]?.callback([{ isIntersecting: true }]);
    expect(el.dataset.shown).toBe("");
    expect(made[0]?.disconnected).toBe(true);
  });

  it("keeps it hidden while it is out of view", () => {
    const made = fakeObserver();
    const el = element();
    reveal(el);
    made[0]?.callback([{ isIntersecting: false }]);
    expect("shown" in el.dataset).toBe(false);
    expect(made[0]?.disconnected).toBe(false);
  });

  // An element jumped past (End key, a fast fling) goes from below the window to above it without
  // ever being "in view": the watched area reaches up, so above counts as in view.
  it("counts everything above the window as seen", () => {
    const made = fakeObserver();
    reveal(element());
    expect(made[0]?.options.rootMargin?.split(" ")[0]).toBe(REACH_UP);
  });

  it("stops watching when React removes the element", () => {
    const made = fakeObserver();
    const cleanup = reveal(element());
    cleanup?.();
    expect(made[0]?.disconnected).toBe(true);
  });

  it("shows it at once where the browser can't watch (no IntersectionObserver)", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const el = element();
    expect(reveal(el)).toBeUndefined();
    expect(el.dataset.shown).toBe("");
  });

  it("does nothing for a removed element (React calls the ref with null)", () => {
    const made = fakeObserver();
    expect(reveal(null)).toBeUndefined();
    expect(made).toEqual([]);
  });
});
