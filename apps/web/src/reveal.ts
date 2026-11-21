/** How far above the window still counts as seen. */
export const REACH_UP = "100000px";

/**
 * Shows an element when it scrolls into view (docs/adr/0016): a ref callback for elements with
 * `data-reveal`. Until then styles.css keeps them faded out; `data-shown` plays their entry. Each
 * element is shown once, then no longer watched. A browser without IntersectionObserver shows it
 * at once, so nothing can stay hidden.
 */
export function reveal(element: HTMLElement | null): (() => void) | undefined {
  if (!element) return undefined;
  const show = () => {
    element.dataset.shown = "";
  };
  if (typeof IntersectionObserver === "undefined") {
    show();
    return undefined;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        show();
        observer.disconnect();
      }
    },
    // The watched area reaches far up: an element the reader jumped past (End key, a fast fling,
    // a link) is above the window, never "in view", and would otherwise stay hidden. At the
    // bottom it stops a little short, so the reader sees an element arrive, not pop in late.
    { rootMargin: `${REACH_UP} 0px -8% 0px` },
  );
  observer.observe(element);
  return () => observer.disconnect();
}
