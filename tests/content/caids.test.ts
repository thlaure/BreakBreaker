import { describe, expect, test } from 'vitest';
import { CAID_SKINS, caidLinesFor } from '../../src/content/caids';
import type { Locale } from '../../src/content/i18n';
import { contentViolation } from './forbidden';

describe('the Caïd looks (content)', () => {
  test('five looks, each with its own prop', () => {
    expect(CAID_SKINS).toHaveLength(5);
    expect(new Set(CAID_SKINS.map((s) => s.prop)).size).toBe(5);
  });

  for (const l of ['fr', 'en'] as Locale[]) {
    const looks = caidLinesFor(l);

    test(`${l}: five looks, each with a name and 3–4 distinct slogans`, () => {
      expect(looks).toHaveLength(5);
      for (const s of looks) {
        expect(s.name.trim().length).toBeGreaterThan(0);
        expect(s.slogans.length).toBeGreaterThanOrEqual(3);
        expect(s.slogans.length).toBeLessThanOrEqual(4);
        expect(new Set(s.slogans).size).toBe(s.slogans.length);
      }
    });

    test(`${l}: every slogan is short (≤ 40 characters) and non-empty`, () => {
      for (const s of looks) {
        for (const line of s.slogans) {
          expect(line.trim().length).toBeGreaterThan(0);
          expect([...line].length).toBeLessThanOrEqual(40);
        }
      }
    });

    test(`${l}: no real name, no party, no religious word in a name or a slogan`, () => {
      for (const s of looks) for (const line of [s.name, ...s.slogans]) expect(contentViolation(line), line).toBeNull();
    });
  }
});
