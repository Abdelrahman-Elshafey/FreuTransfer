/**
 * The reader's choices (language, their provider) are conveniences kept in the browser. Storage can
 * be blocked (private mode, site data settings): then nothing is remembered and the page works as
 * on a first visit. Only that DOMException is caught.
 */
export function readSaved(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    return null;
  }
}

export function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
  }
}
