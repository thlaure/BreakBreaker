import { describe, expect, test } from 'vitest';
import { CAID_SKINS } from '../../src/content/caids';

/** Real people and parties never named in a Caïd's slogan (substring of the lower-cased text). */
const FORBIDDEN_NAMES = [
  'macron',
  'sarkozy',
  'hollande',
  'chirac',
  'royal',
  'trump',
  'poutine',
  'putin',
  'khamenei',
  'lepen',
  'le pen',
  'mélenchon',
  'melenchon',
  'zemmour',
  'hassan',
  'bagayoko',
  'boyard',
];
/** Party initials: whole words only (« rn » is inside many French words). */
const FORBIDDEN_WORDS = ['lfi', 'rn'];
/** No religious word in a slogan. */
const RELIGIOUS = [
  'islam',
  'musulman',
  'allah',
  'dieu',
  'coran',
  'croix',
  'église',
  'eglise',
  'jésus',
  'imam',
  'curé',
  'rabbin',
  'mosquée',
];

const lower = (s: string): string => s.toLocaleLowerCase('fr');
const words = (s: string): string[] => lower(s).split(/[^a-zàâäçéèêëîïôöùûüœæ0-9]+/u);

describe('the Caïd looks (content)', () => {
  test('five looks, each with a name, a prop and 3–4 distinct slogans', () => {
    expect(CAID_SKINS).toHaveLength(5);
    expect(new Set(CAID_SKINS.map((s) => s.prop)).size).toBe(5);
    for (const s of CAID_SKINS) {
      expect(s.name.trim().length).toBeGreaterThan(0);
      expect(s.slogans.length).toBeGreaterThanOrEqual(3);
      expect(s.slogans.length).toBeLessThanOrEqual(4);
      expect(new Set(s.slogans).size).toBe(s.slogans.length);
    }
  });

  test('every slogan is short (≤ 40 characters) and non-empty', () => {
    for (const s of CAID_SKINS) {
      for (const line of s.slogans) {
        expect(line.trim().length).toBeGreaterThan(0);
        expect([...line].length).toBeLessThanOrEqual(40);
      }
    }
  });

  test('no real name, no party, no religious word in a name or a slogan', () => {
    for (const s of CAID_SKINS) {
      for (const line of [s.name, ...s.slogans]) {
        const t = lower(line);
        for (const f of FORBIDDEN_NAMES) expect(t, line).not.toContain(f);
        for (const w of [...FORBIDDEN_WORDS, ...RELIGIOUS]) expect(words(line), line).not.toContain(w);
        for (const r of RELIGIOUS) expect(t, line).not.toContain(r);
      }
    }
  });
});
