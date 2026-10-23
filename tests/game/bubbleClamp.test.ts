import { describe, expect, test } from 'vitest';
import { clampBubbleX } from '../../src/game/render/bubbleClamp';

describe('clampBubbleX', () => {
  test('leaves a bubble that fits untouched', () => {
    expect(clampBubbleX(500, 40, 0, 1000)).toBe(500);
  });
  test('pushes a bubble back inside the left edge, keeping a margin', () => {
    expect(clampBubbleX(10, 40, 0, 1000, 4)).toBe(44);
  });
  test('pushes a bubble back inside the right edge, keeping a margin', () => {
    expect(clampBubbleX(990, 40, 0, 1000, 4)).toBe(956);
  });
  test('works with a view that does not start at zero', () => {
    expect(clampBubbleX(1200, 40, 1000, 1400, 4)).toBe(1200);
    expect(clampBubbleX(900, 40, 1000, 1400, 4)).toBe(1044);
  });
  test('a bubble wider than the view is centred on it', () => {
    expect(clampBubbleX(0, 300, 0, 400)).toBe(200);
  });
});
