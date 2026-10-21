import { describe, expect, test } from 'vitest';
import {
  BUBBLE_FLICKER_SEC,
  BUBBLE_R,
  HIGHLIGHT_REST,
  POP_GROW_PX,
  POP_MS,
  RIPPLE_MAX_PX,
  RIPPLE_MS,
  bubbleAlpha,
  bubbleRadius,
  highlightAngle,
  popRing,
  rimPoint,
  rippleRing,
} from '../../src/game/render/bubbleMath';

describe('bouclier bubble curves', () => {
  test('radius ≈ 24 px, whole pixels, gentle ±1 px pulse; fixed with reduced motion', () => {
    expect(BUBBLE_R).toBe(24);
    const seen = new Set<number>();
    for (let t = 0; t < 2000; t += 7) {
      const r = bubbleRadius(t);
      expect(Number.isInteger(r)).toBe(true);
      expect(Math.abs(r - BUBBLE_R)).toBeLessThanOrEqual(1);
      seen.add(r);
      expect(bubbleRadius(t, true)).toBe(BUBBLE_R);
    }
    expect([...seen].sort()).toEqual([23, 24, 25]);
  });

  test('alpha: full until the last 3 s, then fading and flickering faster as time runs out', () => {
    expect(BUBBLE_FLICKER_SEC).toBe(3);
    for (const t of [0, 100, 555]) expect(bubbleAlpha(20, t)).toBe(1);
    expect(bubbleAlpha(3, 0)).toBe(1);
    // flicker: some frames off, never above the fade, never zero
    const flips = (left: number): number => {
      let n = 0;
      let prev = bubbleAlpha(left, 0);
      for (let t = 1; t <= 1000; t++) {
        const a = bubbleAlpha(left, t);
        expect(a).toBeGreaterThan(0);
        expect(a).toBeLessThanOrEqual(0.55 + 0.45 * (left / 3) + 1e-9);
        if (a !== prev) n++;
        prev = a;
      }
      return n;
    };
    expect(flips(2.5)).toBeGreaterThan(0);
    expect(flips(0.3)).toBeGreaterThan(flips(2.5));
  });

  test('reduced motion: no flicker, only the fade', () => {
    for (let t = 0; t < 1000; t += 13) expect(bubbleAlpha(1.5, t, true)).toBeCloseTo(0.55 + 0.45 * 0.5, 9);
    expect(bubbleAlpha(10, 3, true)).toBe(1);
  });

  test('highlight arc circles once per turn; fixed upper left with reduced motion', () => {
    expect(highlightAngle(0)).toBeCloseTo(HIGHLIGHT_REST, 9);
    expect(highlightAngle(1000)).not.toBeCloseTo(HIGHLIGHT_REST, 3);
    expect(highlightAngle(4000)).toBeCloseTo(HIGHLIGHT_REST, 9);
    expect(highlightAngle(1234, true)).toBe(HIGHLIGHT_REST);
  });

  test('pop ring grows from the bubble by 10 px and fades out over POP_MS', () => {
    expect(popRing(-1)).toBeNull();
    expect(popRing(0)).toEqual({ r: BUBBLE_R, alpha: 1 });
    const mid = popRing(POP_MS / 2)!;
    expect(mid.r).toBe(BUBBLE_R + POP_GROW_PX / 2);
    expect(mid.alpha).toBeCloseTo(0.5, 9);
    expect(popRing(POP_MS)).toBeNull();
  });

  test('ripple ring grows 2 → 10 px and fades over RIPPLE_MS', () => {
    expect(rippleRing(0)).toEqual({ r: 2, alpha: 1 });
    const end = rippleRing(RIPPLE_MS - 1)!;
    expect(end.r).toBe(RIPPLE_MAX_PX);
    expect(end.alpha).toBeLessThan(0.01);
    expect(rippleRing(RIPPLE_MS)).toBeNull();
  });

  test('a hit shows on the rim toward where it was stopped (whole px); straight up when on Paul', () => {
    const center = { x: 100, y: 87 };
    const feet = { x: 100, y: 100 };
    expect(rimPoint(center, feet, { x: 107, y: 100 })).toEqual({ x: 124, y: 87 });
    expect(rimPoint(center, feet, { x: 100, y: 93 })).toEqual({ x: 100, y: 63 });
    expect(rimPoint(center, feet, { ...feet })).toEqual({ x: 100, y: 63 });
    const d = rimPoint(center, feet, { x: 95, y: 105 });
    expect(Number.isInteger(d.x) && Number.isInteger(d.y)).toBe(true);
    expect(Math.hypot(d.x - center.x, d.y - center.y)).toBeCloseTo(BUBBLE_R, 0);
  });
});
