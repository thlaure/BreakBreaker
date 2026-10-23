import { expect, test } from 'vitest';
import { inArc, segmentCircleHit, len, norm, dist } from '../../src/sim/math';
import { rng } from '../../src/sim/rng';

test('inArc: 90° arc, range 56', () => {
  expect(inArc({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 50, y: 10 }, 56, 90)).toBe(true);
  expect(inArc({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 50 }, 56, 90)).toBe(false);
  expect(inArc({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 60, y: 0 }, 56, 90)).toBe(false);
});
test('segmentCircleHit catches a fast segment passing through', () => {
  expect(segmentCircleHit({ x: -100, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, 7)).toBeCloseTo(93 / 200, 2);
  expect(segmentCircleHit({ x: -100, y: 20 }, { x: 100, y: 20 }, { x: 0, y: 0 }, 7)).toBeNull();
});
test('vector helpers', () => {
  expect(len({ x: 3, y: 4 })).toBe(5);
  expect(norm({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
});
test('rng is deterministic and in [0,1)', () => {
  const a = rng(42),
    b = rng(42);
  for (let i = 0; i < 20; i++) {
    const v = a();
    expect(v).toBe(b());
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});
