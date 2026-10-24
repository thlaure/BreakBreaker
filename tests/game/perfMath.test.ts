import { describe, expect, test } from 'vitest';
import { cadence, summarize, trimWindow } from '../../src/game/perfMath';

describe('summarize', () => {
  test('average, 95th percentile and maximum of a list', () => {
    const s = summarize(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(s.avg).toBeCloseTo(50.5);
    expect(s.p95).toBe(96);
    expect(s.max).toBe(100);
  });

  test('an empty list is all zeros, one value is itself', () => {
    expect(summarize([])).toEqual({ avg: 0, p95: 0, max: 0 });
    expect(summarize([7])).toEqual({ avg: 7, p95: 7, max: 7 });
  });

  test("does not reorder the caller's list", () => {
    const v = [3, 1, 2];
    summarize(v);
    expect(v).toEqual([3, 1, 2]);
  });
});

describe('trimWindow', () => {
  test('keeps only the last `n` values', () => {
    const v = [1, 2, 3, 4, 5];
    trimWindow(v, 3);
    expect(v).toEqual([3, 4, 5]);
    trimWindow(v, 10);
    expect(v).toEqual([3, 4, 5]);
  });
});

describe('cadence', () => {
  test('share of frames with no sim step and with two or more, in percent', () => {
    expect(cadence([1, 1, 0, 2, 1, 1, 3, 0, 1, 1])).toEqual({ none: 20, multi: 20 });
    expect(cadence([])).toEqual({ none: 0, multi: 0 });
  });
});
