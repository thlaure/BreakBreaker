import { describe, expect, test } from 'vitest';
import type { Locale } from '../../src/content/i18n';
import { quotesFor } from '../../src/content/quotes';
import { contentViolation } from './forbidden';

describe('the President quote dictionary (French and English)', () => {
  for (const l of ['fr', 'en'] as Locale[]) {
    const quotes = quotesFor(l);

    test(`${l}: 20–30 entries, each ≤ 60 characters, distinct and non-empty`, () => {
      expect(quotes.length).toBeGreaterThanOrEqual(20);
      expect(quotes.length).toBeLessThanOrEqual(30);
      for (const q of quotes) {
        expect(q.trim().length).toBeGreaterThan(0);
        expect([...q].length).toBeLessThanOrEqual(60);
      }
      expect(new Set(quotes).size).toBe(quotes.length);
    });

    test(`${l}: none names a real person or party, none has a religious word`, () => {
      for (const q of quotes) expect(contentViolation(q), q).toBeNull();
    });
  }
});
