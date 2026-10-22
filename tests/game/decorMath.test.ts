import { describe, expect, test } from 'vitest';
import { QUEUE_GAP, queueBob, queueSlots, signGlow, smokeSpec } from '../../src/game/render/decorMath';

describe('decor fronts helpers', () => {
  test('queue slots start past the door and step outward, all on the wall', () => {
    expect(queueSlots(960, 1054, 5)).toEqual([973, 986, 999, 1012, 1025]);
    // as many as fit before the limit
    const xs = queueSlots(960, 1000, 9);
    expect(xs).toEqual([973, 986]);
    for (const x of xs) expect(x + 5).toBeLessThanOrEqual(1000);
    // westward
    expect(queueSlots(900, 850, 4, -1)).toEqual([887, 874, 861]);
    expect(xs[1]! - xs[0]!).toBe(QUEUE_GAP);
  });

  test('idle bob is 0 or 1 px up, out of phase, and still under reduced motion', () => {
    const seen = new Set<number>();
    for (let t = 0; t < 10_000; t += 50) for (let k = 0; k < 5; k++) seen.add(queueBob(t, k, false));
    expect([...seen].sort()).toEqual([-1, 0]);
    for (let t = 0; t < 10_000; t += 50) expect(queueBob(t, 2, true)).toBe(0);
    // not all in step
    const at = (t: number) => [0, 1, 2, 3, 4].map((k) => queueBob(t, k, false));
    expect(Array.from({ length: 200 }, (_, i) => at(i * 50)).some((v) => new Set(v).size > 1)).toBe(true);
  });

  test('fryer smoke rises slowly, off under reduced motion', () => {
    const s = smokeSpec(false)!;
    expect(s.speedY.max).toBeLessThan(0);
    expect(s.alpha.end).toBe(0);
    expect(s.frequency).toBeGreaterThanOrEqual(150);
    expect(smokeSpec(true)).toBeNull();
  });

  test('sign glow pulses softly, steady under reduced motion', () => {
    const vals = Array.from({ length: 100 }, (_, i) => signGlow(i * 100, false));
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(0.18);
    expect(Math.max(...vals)).toBeLessThanOrEqual(0.26);
    expect(new Set([0, 500, 1200].map((t) => signGlow(t, true))).size).toBe(1);
  });
});
