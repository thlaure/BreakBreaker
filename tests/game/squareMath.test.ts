import { describe, expect, test } from 'vitest';
import { BALCONY_HALF_W, SAUNA_SIGN, chateauBalcony, lanternGlow, silhouetteDrift, steamSpec } from '../../src/game/render/squareMath';
import { FACADE_H } from '../../src/game/render/geometry';
import { DISTRICT } from '../../src/sim/map/district';

const T = 32;

describe('main square fronts helpers', () => {
  test('the château balcony sits over its door, on top of the front wall, inside the footprint', () => {
    const d = DISTRICT.decor.find((x) => x.id === 'chateau')!;
    const b = d.footprint;
    const doorX = Math.floor(d.door.x / T) * T;
    const p = chateauBalcony(b, doorX, T);
    expect(p).toEqual({ x: doorX + T / 2, y: b.y + b.h - FACADE_H });
    expect(p.x - BALCONY_HALF_W).toBeGreaterThanOrEqual(b.x);
    expect(p.x + BALCONY_HALF_W).toBeLessThanOrEqual(b.x + b.w);
  });

  test('the balcony is clamped inside the front when the door is at a corner', () => {
    const b = { x: 100, y: 200, w: 96, h: 128 };
    expect(chateauBalcony(b, 100, T).x).toBe(100 + BALCONY_HALF_W);
    expect(chateauBalcony(b, 164, T).x).toBe(196 - BALCONY_HALF_W);
  });

  test('steam rises and fades, none under reduced motion', () => {
    expect(steamSpec(true)).toBeNull();
    const s = steamSpec(false)!;
    expect(s.speedY.max).toBeLessThan(0);
    expect(s.alpha.end).toBe(0);
    expect(s.lifespan.min).toBeLessThanOrEqual(s.lifespan.max);
  });

  test('lantern flickers in a narrow band, steady under reduced motion', () => {
    for (let t = 0; t < 10_000; t += 37) {
      const a = lanternGlow(t, false);
      expect(a).toBeGreaterThanOrEqual(0.16);
      expect(a).toBeLessThanOrEqual(0.22);
      expect(lanternGlow(t, true)).toBe(0.2);
    }
  });

  test('silhouettes drift at most 1 px, out of phase, and stay still under reduced motion', () => {
    const seen = new Set<number>();
    for (let t = 0; t < 20_000; t += 100) {
      for (let k = 0; k < 3; k++) {
        seen.add(silhouetteDrift(t, k, false));
        expect(silhouetteDrift(t, k, true)).toBe(0);
      }
    }
    expect([...seen].sort()).toEqual([-1, 0, 1]);
    let apart = 0;
    for (let t = 0; t < 20_000; t += 100) if (silhouetteDrift(t, 0, false) !== silhouetteDrift(t, 1, false)) apart++;
    expect(apart).toBeGreaterThan(0);
  });

  test('the sauna sign is in French and fits on the board', () => {
    expect(SAUNA_SIGN).toBe('Sauna – Ne pas déranger');
    expect(SAUNA_SIGN.length * 5).toBeLessThanOrEqual(124);
  });
});
