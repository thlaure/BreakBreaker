import { onLocaleChange } from '../../content/i18n';

/** What localeBound needs of a text object (a Phaser Text fits). */
export interface LocaleTextTarget {
  setText(text: string): unknown;
  once(event: 'destroy', fn: () => void): unknown;
}

/**
 * A text drawn in the world that follows the language: `read()` (which calls t()) is shown now and again on every
 * setLocale, until the object is destroyed. Returns `obj` for chaining.
 */
export function localeBound<T extends LocaleTextTarget>(obj: T, read: () => string): T {
  obj.setText(read());
  const off = onLocaleChange(() => obj.setText(read()));
  obj.once('destroy', off);
  return obj;
}
