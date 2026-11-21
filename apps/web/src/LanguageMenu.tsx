import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { CHECK, CHEVRON, GLOBE, Icon } from "./Icon.tsx";
import { useI18n } from "./i18n/context.tsx";
import { LOCALE_CODES, localeInfo } from "./i18n/locales.ts";

/**
 * The language picker in the header (docs/adr/0016): a pill button that opens a small frosted
 * panel with the four languages, each in its own name. A disclosure (button + list of buttons):
 * Tab, Enter and Space work as usual; the arrow keys move between the languages; Escape, a click
 * outside or Tab closes it.
 */
/** The four language buttons in the panel. */
const items = (root: HTMLElement | null) => [
  ...(root?.querySelectorAll<HTMLButtonElement>("[data-item]") ?? []),
];

export function LanguageMenu() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Opened: the current language gets the focus; a click anywhere else closes the panel.
  useEffect(() => {
    if (!open) return;
    items(box.current)
      .find((item) => item.lang === locale)
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, locale]);

  const keys = (event: KeyboardEvent) => {
    if (!open) return;
    // Tab moves on as usual and closes the panel behind the reader. (Not on blur: Safari doesn't
    // focus a clicked button, so a blur would close the panel before the click lands.)
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
      return;
    }
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const all = items(box.current);
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    all[(at + step + all.length) % all.length]?.focus();
  };

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={keys}
        className="flex h-10 items-center gap-2 rounded-full border border-line bg-card/70 pr-3 pl-3.5 text-sm text-ink transition-colors duration-200 hover:border-muted/60 aria-expanded:border-muted/60"
      >
        <Icon d={GLOBE} className="size-4 text-muted" />
        <span className="sr-only">{t.language}: </span>
        {localeInfo(locale).name}
        <Icon
          d={CHEVRON}
          className={`size-4 text-muted transition-transform duration-300 ease-out-expo ${open ? "rotate-180" : ""}`}
        />
      </button>
      {/* Always there, so it can fade and scale out; hidden (and out of the Tab order) when closed. */}
      <div
        id={panelId}
        className={`absolute top-full right-0 z-40 mt-2 w-48 origin-top-right rounded-2xl border border-line/70 bg-card/80 p-1.5 shadow-xl shadow-black/10 backdrop-blur-xl duration-200 ease-out-expo ${
          // Opening, it is visible at once (so the current language can take the focus) and then
          // fades in; closing, it fades out first and turns invisible at the end.
          open
            ? "visible translate-y-0 scale-100 opacity-100 transition-[opacity,scale,translate]"
            : "invisible -translate-y-1 scale-95 opacity-0 transition-[opacity,scale,translate,visibility]"
        }`}
      >
        <ul>
          {LOCALE_CODES.map((code) => (
            <li key={code}>
              <button
                type="button"
                data-item
                lang={code}
                onKeyDown={keys}
                aria-current={code === locale ? "true" : undefined}
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                  button.current?.focus();
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-ink transition-colors duration-150 hover:bg-hover focus-visible:bg-hover aria-[current=true]:font-medium"
              >
                {/* The language's own name, so readers find theirs whatever is selected now. */}
                {localeInfo(code).name}
                {code === locale && <Icon d={CHECK} className="size-4" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
