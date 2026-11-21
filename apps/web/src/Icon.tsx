/** Icons are decoration: the text next to them says what they mean. 24px grid, drawn with lines. */
export function Icon({ d, className }: { d: string; className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={d} />
    </svg>
  );
}

export const ARROW = "M5 12h14m-6-6 6 6-6 6";
export const GLOBE =
  "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z";
export const CHEVRON = "m6 9 6 6 6-6";
export const CHECK = "M20 6 9 17l-5-5";
