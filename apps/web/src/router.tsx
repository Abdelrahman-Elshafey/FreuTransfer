import { type MouseEvent, type ReactNode, useSyncExternalStore } from "react";

// A minimal router for a few pages (no dependency): the address is the state. `navigate` pushes a
// history entry and tells subscribers; back and forward arrive as "popstate".

const CHANGE = "freu-transfer:navigate";

function subscribe(onChange: () => void): () => void {
  addEventListener("popstate", onChange);
  addEventListener(CHANGE, onChange);
  return () => {
    removeEventListener("popstate", onChange);
    removeEventListener(CHANGE, onChange);
  };
}

/** The current path; the component re-renders when it changes. */
export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => location.pathname);
}

/** Goes to `path` in this page (no reload), with a history entry, and starts at the top. */
function navigate(path: string): void {
  if (path === location.pathname) return;
  history.pushState(null, "", path);
  dispatchEvent(new Event(CHANGE));
  scrollTo(0, 0);
}

/**
 * A link inside the site: a real <a href> (it opens in a new tab, and works without JavaScript
 * reaching it), followed in-page on a plain click.
 */
export function Link(props: {
  readonly to: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    // Ctrl/Cmd/Shift/middle click: let the browser open a new tab or window as usual.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    navigate(props.to);
  };
  return (
    <a href={props.to} onClick={follow} className={props.className}>
      {props.children}
    </a>
  );
}
