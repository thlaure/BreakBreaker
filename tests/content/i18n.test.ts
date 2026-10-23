import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DOMAINS, t, translate } from '../../src/content/i18n';
import { getLocale, initLocale, onLocaleChange, setLocale } from '../../src/content/i18n/locale';

/** An in-memory Storage stand-in (vi.stubGlobal('localStorage', …)). */
function memoryStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(seed));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

const throwing = (): never => {
  throw new Error('storage blocked');
};
const brokenStorage = { getItem: throwing, setItem: throwing, removeItem: throwing } as unknown as Storage;

describe('locale', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => {
    vi.unstubAllGlobals();
    initLocale('');
  });

  test('defaults to fr (never guessed from the browser)', () => {
    initLocale('');
    expect(getLocale()).toBe('fr');
  });

  test('a saved locale is read back', () => {
    vi.stubGlobal('localStorage', memoryStorage({ 'bb:locale': 'en' }));
    initLocale('');
    expect(getLocale()).toBe('en');
  });

  test('an unknown saved value falls back to fr', () => {
    vi.stubGlobal('localStorage', memoryStorage({ 'bb:locale': 'de' }));
    initLocale('');
    expect(getLocale()).toBe('fr');
  });

  test('?lang=en wins over the saved locale and is saved', () => {
    const store = memoryStorage({ 'bb:locale': 'fr' });
    vi.stubGlobal('localStorage', store);
    initLocale('?go&lang=en');
    expect(getLocale()).toBe('en');
    expect(store.getItem('bb:locale')).toBe('en');
  });

  test('an unknown ?lang= is ignored', () => {
    vi.stubGlobal('localStorage', memoryStorage({ 'bb:locale': 'en' }));
    initLocale('?lang=xx');
    expect(getLocale()).toBe('en');
  });

  test('storage that throws (private window) still gives fr, and setLocale does not throw', () => {
    vi.stubGlobal('localStorage', brokenStorage);
    initLocale('');
    expect(getLocale()).toBe('fr');
    expect(() => setLocale('en')).not.toThrow();
    expect(getLocale()).toBe('en');
  });

  test('missing storage (no localStorage at all) gives fr', () => {
    vi.stubGlobal('localStorage', undefined);
    initLocale('');
    expect(getLocale()).toBe('fr');
  });

  test('setLocale saves, notifies listeners, and unsubscribe stops them', () => {
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    initLocale('');
    const seen: string[] = [];
    const off = onLocaleChange((l) => seen.push(l));
    setLocale('en');
    expect(store.getItem('bb:locale')).toBe('en');
    off();
    setLocale('fr');
    expect(seen).toEqual(['en']);
  });

  test('setLocale works without a document (sim tests run without DOM)', () => {
    expect(typeof document).toBe('undefined');
    expect(() => setLocale('en')).not.toThrow();
  });

  test('setLocale sets <html lang> when a document exists', () => {
    const root = { lang: 'fr' };
    vi.stubGlobal('document', { documentElement: root });
    setLocale('en');
    expect(root.lang).toBe('en');
  });
});

describe('t()', () => {
  afterEach(() => setLocale('fr'));

  test('reads the current locale', () => {
    setLocale('fr');
    expect(t('toolbox.toolboxRequired')).toBe('Caisse à outils requise');
    setLocale('en');
    expect(t('toolbox.toolboxRequired')).toBe('Toolbox required');
  });

  test('interpolates {name} parameters; an unknown placeholder is left as is', () => {
    const cat = { 'a.b': 'Manche {n} : {kos}/{total}' };
    expect(translate(cat, 'fr', 'a.b', { n: 3, kos: 4, total: 18 })).toBe('Manche 3 : 4/18');
    expect(translate(cat, 'fr', 'a.b', { n: 3 })).toBe('Manche 3 : {kos}/{total}');
  });

  test('plural one/other with n: French 0 and 1 are singular, English only 1', () => {
    const fr = { 'x.one': '{n} casseur', 'x.other': '{n} casseurs' };
    const en = { 'x.one': '{n} rioter', 'x.other': '{n} rioters' };
    expect([0, 1, 2, 15].map((n) => translate(fr, 'fr', 'x', { n }))).toEqual(['0 casseur', '1 casseur', '2 casseurs', '15 casseurs']);
    expect([0, 1, 2, 15].map((n) => translate(en, 'en', 'x', { n }))).toEqual(['0 rioters', '1 rioter', '2 rioters', '15 rioters']);
    // the forms can still be read directly
    expect(translate(fr, 'fr', 'x.one')).toBe('{n} casseur');
  });

  test('a missing key reads as the key itself (never throws)', () => {
    expect(translate({}, 'en', 'nope.key')).toBe('nope.key');
  });

  test('the sim ids read back in both languages', () => {
    setLocale('fr');
    expect([t('station.fullHealth'), t('station.spent'), t('held.gant'), t('objective.won')]).toEqual([
      'Santé au maximum',
      'Épuisé',
      'Gant de boxe',
      'réussi',
    ]);
    setLocale('en');
    expect(t('held.gant')).toBe('Boxing glove');
  });
});

describe('catalogs', () => {
  /** English may equal French only for names and signs kept as is. */
  const SAME_ALLOWED = new Set(['Paul', 'BreakBreaker', 'CAF', 'POULET CROUSTI', 'SAUNA', 'Flashball']);

  test('at least the core domain is registered', () => {
    expect(Object.keys(DOMAINS)).toContain('core');
  });

  for (const [name, d] of Object.entries(DOMAINS)) {
    test(`${name}: fr and en have the same keys`, () => {
      expect(Object.keys(d.en).sort()).toEqual(Object.keys(d.fr).sort());
    });

    test(`${name}: no empty string, English differs from French but for the allow-list`, () => {
      const fr = d.fr as Record<string, string>;
      for (const [k, en] of Object.entries(d.en as Record<string, string>)) {
        expect(en.trim(), k).not.toBe('');
        expect((fr[k] ?? '').trim(), k).not.toBe('');
        if (en === fr[k]) expect(SAME_ALLOWED.has(en), `${k}: "${en}" identical in both languages`).toBe(true);
      }
    });

    test(`${name}: a plural has both .one and .other`, () => {
      const keys = new Set(Object.keys(d.fr));
      for (const k of keys) {
        if (k.endsWith('.one')) expect(keys.has(`${k.slice(0, -4)}.other`), k).toBe(true);
        if (k.endsWith('.other')) expect(keys.has(`${k.slice(0, -6)}.one`), k).toBe(true);
      }
    });
  }
});
