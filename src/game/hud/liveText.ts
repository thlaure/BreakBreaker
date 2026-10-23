import { t, type Key } from '../../content/i18n';

/**
 * A read-only record of texts read from the catalog at each access, so it follows the current locale (a spread or a
 * lookup takes the language of that moment).
 */
export function liveRecord<K extends string>(ids: readonly K[], key: (id: K) => Key): Readonly<Record<K, string>> {
  const out = {} as Record<K, string>;
  for (const id of ids) Object.defineProperty(out, id, { enumerable: true, get: () => t(key(id)) });
  return out;
}

/** Defines `fields` on `obj` as getters reading the catalog (same idea as liveRecord, for an object's text fields). */
export function liveFields<T extends object, F extends string>(
  obj: T,
  fields: Readonly<Record<F, () => string>>,
): T & Readonly<Record<F, string>> {
  for (const [name, read] of Object.entries(fields) as [F, () => string][])
    Object.defineProperty(obj, name, { enumerable: true, get: read });
  return obj as T & Readonly<Record<F, string>>;
}
