import { useEffect, useRef, useState } from "react";

// Shared by the SVG charts (docs/adr/0012).

/** The reader's width in pixels, so text stays 12px on a phone instead of being scaled down. */
export function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** "M x y L x y …" with a new segment after every gap, so a missing point is never bridged. */
export function linePath(points: readonly (readonly [number, number] | null)[]): string {
  let path = "";
  let drawing = false;
  for (const p of points) {
    if (p === null) {
      drawing = false;
      continue;
    }
    path += `${drawing ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)} `;
    drawing = true;
  }
  return path.trim();
}
