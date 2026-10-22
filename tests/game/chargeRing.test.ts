import { describe, expect, test } from 'vitest';
import { CHARGE_RING_R, chargeRing } from '../../src/game/render/chargeMath';

describe('onde d’énergie charge ring around Paul', () => {
  test('starts at 12 o’clock and closes clockwise with the progress', () => {
    const top = -Math.PI / 2;
    expect(chargeRing(0)).toEqual({ start: top, end: top, radius: CHARGE_RING_R });
    expect(chargeRing(0.25).end).toBeCloseTo(0, 6);
    expect(chargeRing(0.5).end).toBeCloseTo(Math.PI / 2, 6);
    expect(chargeRing(1).end).toBeCloseTo(top + 2 * Math.PI, 6);
  });

  test('progress is clamped to [0, 1]; the radius clears Paul (whole pixels)', () => {
    expect(chargeRing(-1).end).toBe(chargeRing(0).end);
    expect(chargeRing(3).end).toBe(chargeRing(1).end);
    expect(Number.isInteger(CHARGE_RING_R)).toBe(true);
    expect(CHARGE_RING_R).toBeGreaterThanOrEqual(14);
  });
});
