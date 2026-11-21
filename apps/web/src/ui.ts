// Class names several components share (docs/adr/0011, docs/adr/0016), so the page keeps one
// type scale and one card shape.

/** A white card on the grey page, 24px corners. */
export const card = "rounded-3xl bg-card p-5 sm:p-6";

/** Small muted text: notes, sources, captions. */
export const note = "text-sm text-muted";

/**
 * A page's title: big but not bold, tight letter spacing (docs/design-inspiration.md §3). Each
 * page adds its size from 640px up: the home page's headline is the biggest.
 */
export const h1 =
  "mt-10 max-w-3xl text-4xl leading-[1.05] font-normal tracking-[-0.035em] text-balance sm:mt-20";

/** A section heading. */
export const h2 = "text-2xl font-medium tracking-[-0.02em] text-balance";

/** A section's spacing from the one above. */
export const section = "mt-16 animate-enter";
