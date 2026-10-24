import { describe, expect, test } from 'vitest';
import { bubbleScale } from '../../src/game/render/bubbleScale';

describe('bubbleScale', () => {
  test('desktop: x2 at zoom 1, x1 at zoom 2', () => {
    expect(bubbleScale(1, 1280, 720)).toBe(2);
    expect(bubbleScale(2, 1280, 720)).toBe(1);
  });
  test('phone portrait and landscape: x1 at zoom 1', () => {
    expect(bubbleScale(1, 390, 760)).toBe(1);
    expect(bubbleScale(1, 844, 390)).toBe(1);
  });
  test('never below x1, even with a missing zoom', () => {
    expect(bubbleScale(0, 390, 760)).toBe(1);
    expect(bubbleScale(4, 1280, 720)).toBe(1);
  });
});
