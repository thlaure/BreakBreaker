/**
 * The current language of the game. French by default, never guessed from the browser; `?lang=fr|en` overrides and is
 * saved; the choice is kept in localStorage (guarded: a private window or blocked storage still plays in French).
 * Never read by src/sim (the simulation carries ids, not text).
 */
export type Locale = 'fr' | 'en';

export const LOCALES: readonly Locale[] = ['fr', 'en'];
export const DEFAULT_LOCALE: Locale = 'fr';
const STORAGE_KEY = 'bb:locale';

type Listener = (l: Locale) => void;

let current: Locale | null = null;
const listeners = new Set<Listener>();

function isLocale(v: unknown): v is Locale {
  return v === 'fr' || v === 'en';
}

function load(): Locale | null {
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

function save(l: Locale): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, l);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

/** `<html lang>` follows the locale, when there is a document (the sim tests run without one). */
function applyDocumentLang(l: Locale): void {
  if (typeof document !== 'undefined' && document?.documentElement) document.documentElement.lang = l;
}

/**
 * Resolves the locale from a query string (`?lang=en`, saved when valid), else the saved one, else French. Called
 * lazily by getLocale with the page's own query; tests call it to start over.
 */
export function initLocale(search: string = globalThis.location?.search ?? ''): Locale {
  const asked = new URLSearchParams(search).get('lang');
  let l: Locale;
  if (isLocale(asked)) {
    l = asked;
    save(l);
  } else l = load() ?? DEFAULT_LOCALE;
  current = l;
  applyDocumentLang(l);
  return l;
}

export function getLocale(): Locale {
  return current ?? initLocale();
}

/** Switches the language: saved, `<html lang>` updated, listeners told (also when it is the same one). */
export function setLocale(l: Locale): void {
  current = l;
  save(l);
  applyDocumentLang(l);
  for (const cb of [...listeners]) cb(l);
}

/** Calls `cb` on every setLocale; returns the unsubscribe function. */
export function onLocaleChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
