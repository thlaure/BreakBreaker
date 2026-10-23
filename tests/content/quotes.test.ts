import { describe, expect, test } from 'vitest';
import { QUOTES } from '../../src/content/quotes';

/** Real people (politicians, heads of state) and parties never named in the President's lines. */
const FORBIDDEN = [
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
];

describe('the President quote dictionary', () => {
  test('quotes are 20–30 entries, each ≤ 60 characters, distinct and non-empty', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(20);
    expect(QUOTES.length).toBeLessThanOrEqual(30);
    for (const q of QUOTES) {
      expect(q.trim().length).toBeGreaterThan(0);
      expect([...q].length).toBeLessThanOrEqual(60);
    }
    expect(new Set(QUOTES).size).toBe(QUOTES.length);
  });

  test('none contains a name from the forbidden list', () => {
    for (const q of QUOTES) {
      const low = q.toLowerCase();
      for (const name of FORBIDDEN) expect(low, `${q} names ${name}`).not.toContain(name);
    }
  });
});
