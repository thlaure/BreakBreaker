import { describe, expect, test } from 'vitest';
import {
  POPUP_GAIN,
  POPUP_LOSS,
  POPUP_MS,
  POPUP_MS_REDUCED,
  POPUP_POP_MS,
  POPUP_RISE_PX,
  POPUP_STAGGER_MS,
  popupLayout,
  popupPose,
  popupStyle,
} from '../../src/game/render/scorePopupMath';

describe('popupStyle', () => {
  test('gains are green « +N », losses red « -N » (ASCII minus: the pixel font has no U+2212)', () => {
    expect(popupStyle(1)).toEqual({ text: '+1', color: POPUP_GAIN, size: 8 });
    expect(popupStyle(-3)).toEqual({ text: '-3', color: POPUP_LOSS, size: 10 });
    expect(POPUP_GAIN).toBe('#7bd88f');
    expect(POPUP_LOSS).toBe('#ff7b72');
  });

  test('size grows with the magnitude: 1 → 8, 2–4 → 10, 5–7 → 12, ≥ 8 → 14', () => {
    const size = (p: number) => popupStyle(p).size;
    expect([1, 2, 4, 5, 7, 8, 10].map(size)).toEqual([8, 10, 10, 12, 12, 14, 14]);
    expect([-1, -2, -4, -5, -8].map(size)).toEqual([8, 10, 10, 12, 14]);
  });
});

describe('popupPose', () => {
  test('hidden before it starts', () => {
    expect(popupPose(-10, 1)).toMatchObject({ alpha: 0, done: false });
  });

  test('pops (scale-up) during the first 80 ms, then scale 1; bigger bump for big changes', () => {
    expect(popupPose(0, 1).scale).toBe(1);
    expect(popupPose(POPUP_POP_MS / 2, 1).scale).toBeGreaterThan(1);
    expect(popupPose(POPUP_POP_MS / 2, 8).scale).toBeGreaterThan(popupPose(POPUP_POP_MS / 2, 1).scale);
    expect(popupPose(POPUP_POP_MS, 1).scale).toBe(1);
    expect(popupPose(500, 8).scale).toBe(1);
    // quarter steps only (crisp pixels)
    for (let t = 0; t < POPUP_POP_MS; t += 5) expect((popupPose(t, 3).scale * 4) % 1).toBe(0);
  });

  test('rises ~28 px with an ease-out, whole pixels, monotonic', () => {
    expect(popupPose(0, 1).dy).toBe(0);
    const half = popupPose(POPUP_MS / 2, 1).dy;
    expect(-half).toBeGreaterThan(POPUP_RISE_PX / 2);
    let prev = 1;
    for (let t = 0; t < POPUP_MS; t += 16) {
      const { dy } = popupPose(t, 1);
      expect(Number.isInteger(dy)).toBe(true);
      expect(dy).toBeLessThanOrEqual(prev);
      prev = dy;
    }
    expect(popupPose(POPUP_MS - 1, 1).dy).toBe(-POPUP_RISE_PX);
  });

  test('opaque for the first 60 %, fades in the last 40 %, done at POPUP_MS', () => {
    expect(popupPose(0.6 * POPUP_MS - 1, 1).alpha).toBe(1);
    const a = popupPose(0.8 * POPUP_MS, 1).alpha;
    expect(a).toBeGreaterThan(0.4);
    expect(a).toBeLessThan(0.6);
    expect(popupPose(POPUP_MS, 1)).toMatchObject({ alpha: 0, done: true });
  });

  test('reduced motion: no rise, no pop, a 0.6 s fade', () => {
    for (let t = 0; t < POPUP_MS_REDUCED; t += 20) {
      const p = popupPose(t, 8, true);
      expect(p.dy).toBe(0);
      expect(p.scale).toBe(1);
      expect(p.done).toBe(false);
    }
    expect(popupPose(0, 1, true).alpha).toBe(1);
    expect(popupPose(POPUP_MS_REDUCED / 2, 1, true).alpha).toBeCloseTo(0.5, 6);
    expect(popupPose(POPUP_MS_REDUCED, 1, true)).toMatchObject({ alpha: 0, done: true });
  });
});

describe('popupLayout', () => {
  test('stagger of 40 ms per rank, capped at 8 ranks; distinct sideways nudges', () => {
    expect(popupLayout(0)).toEqual({ delayMs: 0, dx: 0 });
    expect(popupLayout(3).delayMs).toBe(3 * POPUP_STAGGER_MS);
    expect(popupLayout(7).delayMs).toBe(7 * POPUP_STAGGER_MS);
    expect(popupLayout(20)).toEqual(popupLayout(7));
    const dxs = Array.from({ length: 8 }, (_, i) => popupLayout(i).dx);
    expect(new Set(dxs).size).toBe(8);
    for (const dx of dxs) expect(Math.abs(dx)).toBeLessThanOrEqual(16);
  });
});
