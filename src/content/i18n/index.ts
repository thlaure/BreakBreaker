import { enContent } from './en/content';
import { enCore } from './en/core';
import { enHud } from './en/hud';
import { enLanding } from './en/landing';
import { enWorld } from './en/world';
import { frContent } from './fr/content';
import { frCore } from './fr/core';
import { frHud } from './fr/hud';
import { frLanding } from './fr/landing';
import { frWorld } from './fr/world';
import { getLocale, type Locale } from './locale';

export { getLocale, onLocaleChange, setLocale, type Locale } from './locale';

/**
 * Catalogs by domain, one file per language and domain (fr/<domain>.ts, en/<domain>.ts, same keys). A new domain is
 * one line here; the French object defines the keys, the English one is typed against it.
 */
export const DOMAINS = {
  core: { fr: frCore, en: enCore },
  hud: { fr: frHud, en: enHud },
  world: { fr: frWorld, en: enWorld },
  content: { fr: frContent, en: enContent },
  landing: { fr: frLanding, en: enLanding },
} as const;

const FR = { ...frCore, ...frHud, ...frWorld, ...frContent, ...frLanding };
const EN: Record<keyof typeof FR, string> = { ...enCore, ...enHud, ...enWorld, ...enContent, ...enLanding };

type CatalogKey = keyof typeof FR;
/** `x` when the catalog has `x.one` (and `x.other`): t('x', { n }) picks the form. */
type PluralBase<K> = K extends `${infer B}.one` ? B : never;
export type Key = CatalogKey | PluralBase<CatalogKey>;

type Params = Readonly<Record<string, string | number>>;
type Catalog = Readonly<Record<string, string>>;

const CATALOGS: Readonly<Record<Locale, Catalog>> = { fr: FR, en: EN };

export function catalog(l: Locale): Catalog {
  return CATALOGS[l];
}

const pluralRules = new Map<Locale, Intl.PluralRules>();
function pluralForm(l: Locale, n: number): 'one' | 'other' {
  let r = pluralRules.get(l);
  if (!r) pluralRules.set(l, (r = new Intl.PluralRules(l)));
  return r.select(n) === 'one' ? 'one' : 'other';
}

/**
 * Pure lookup: the entry `key` of `cat` with `{name}` placeholders filled from `params` (unknown placeholders stay).
 * When `params.n` is a number and `key.one` / `key.other` both exist, the plural form of `l` is used (French: 0 and 1
 * are singular). A missing key reads as the key itself.
 */
export function translate(cat: Catalog, l: Locale, key: string, params?: Params): string {
  let text = cat[key];
  const n = params?.n;
  if (typeof n === 'number') {
    const one = cat[`${key}.one`];
    const other = cat[`${key}.other`];
    if (one !== undefined && other !== undefined) text = pluralForm(l, n) === 'one' ? one : other;
  }
  if (text === undefined) return key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = params[name];
    return v === undefined ? m : String(v);
  });
}

/** The text of `key` in the current locale. */
export function t(key: Key, params?: Params): string {
  const l = getLocale();
  return translate(CATALOGS[l], l, key, params);
}
