import { describe, expect, test } from 'vitest';
import { CHAR_SHEETS } from '../../src/game/assets';
import {
  ESCAPE_MS,
  HOP_START,
  INMATE_COLS,
  INMATE_SLOTS,
  PICKUP_HOP_MS,
  VAN_IN_MS,
  VAN_PICKUP_DELAY_MS,
  VAN_RUN_MS,
  VAN_STOP_MS,
  YARD,
  escapeProgress,
  extraText,
  inmateLayout,
  inmatePose,
  inmateTextureKey,
  ridingCount,
} from '../../src/game/render/prisonMath';
import { rioterSheet } from '../../src/game/render/roleLook';
import { CONFIG } from '../../src/sim/config';
import type { PrisonInmate } from '../../src/sim/prison';

const inmate = (id: number, variant: PrisonInmate['variant'] = 'classic', lifeId = id + 100): PrisonInmate => ({
  id,
  variant,
  round: 4,
  lifeId,
});

describe('inmates: the skin hook', () => {
  test('inmateTextureKey is the Caïd’s look on the map (from his lifeId), one of the five caid_ sheets', () => {
    for (const v of ['classic', 'palestinian', 'antifa'] as const) {
      for (const id of [1, 2, 7]) {
        const key = inmateTextureKey(inmate(id, v, id * 3));
        expect(key).toBe(rioterSheet(v, 'boss', id * 3));
        expect(key).toMatch(/^caid_[0-4]$/);
        expect(CHAR_SHEETS as readonly string[]).not.toContain(key);
      }
    }
  });
});

describe('inmates: the yard layout', () => {
  test('up to INMATE_SLOTS (8) slots in rows of INMATE_COLS (4), the rest as « +N »', () => {
    expect(INMATE_SLOTS).toBe(8);
    expect(INMATE_COLS).toBe(4);
    expect(inmateLayout(0)).toEqual({ slots: [], extra: 0 });
    expect(inmateLayout(3).slots).toHaveLength(3);
    expect(inmateLayout(8)).toMatchObject({ extra: 0 });
    expect(inmateLayout(11).slots).toHaveLength(8);
    expect(inmateLayout(11).extra).toBe(3);
    expect(extraText(3)).toBe('+3');
  });

  test('slots are distinct, inside the yard, the back row first (drawn behind)', () => {
    const { slots } = inmateLayout(8);
    expect(new Set(slots.map((s) => `${s.x},${s.y}`)).size).toBe(8);
    for (const s of slots) {
      expect(s.x).toBeGreaterThan(YARD.x);
      expect(s.x).toBeLessThan(YARD.x + YARD.w);
      expect(s.y).toBeGreaterThan(YARD.y);
      expect(s.y).toBeLessThanOrEqual(YARD.y + YARD.h);
    }
    expect(slots[0]!.y).toBeLessThan(slots[INMATE_COLS]!.y);
    // a lone inmate stands in the middle of the back row
    const one = inmateLayout(1).slots[0]!;
    expect(Math.abs(one.x - (YARD.x + YARD.w / 2))).toBeLessThanOrEqual(12);
  });
});

describe('inmates: idle', () => {
  test('facing the camera, a 1-px bob, deterministic and out of step between inmates', () => {
    const poses = (id: number) => Array.from({ length: 200 }, (_, k) => inmatePose(k * 50, id, false));
    const a = poses(1);
    expect(a).toEqual(poses(1));
    expect(a.every((p) => p.bob === 0 || p.bob === -1)).toBe(true);
    expect(a.filter((p) => p.dir === 's').length).toBeGreaterThan(a.length * 0.7);
    expect(a.some((p) => p.dir !== 's')).toBe(true);
    expect(JSON.stringify(poses(2))).not.toBe(JSON.stringify(a));
  });

  test('still under prefers-reduced-motion', () => {
    for (let t = 0; t < 10000; t += 333) expect(inmatePose(t, 3, true)).toEqual({ dir: 's', bob: 0 });
  });

  test('the breakout run-out goes 0..1 over ESCAPE_MS', () => {
    expect(escapeProgress(-1)).toBe(0);
    expect(escapeProgress(0)).toBe(0);
    expect(escapeProgress(ESCAPE_MS / 2)).toBeCloseTo(0.5);
    expect(escapeProgress(ESCAPE_MS * 2)).toBe(1);
  });
});

describe('the van carries the body', () => {
  test('the render hides the body when the hop starts; the sim takes it off the map after that, before the van leaves', () => {
    expect(PICKUP_HOP_MS).toBe(VAN_PICKUP_DELAY_MS + VAN_IN_MS + HOP_START * VAN_STOP_MS);
    const simMs = CONFIG.prison.pickupSec * 1000;
    expect(simMs).toBeGreaterThanOrEqual(PICKUP_HOP_MS);
    expect(simMs).toBeLessThanOrEqual(VAN_PICKUP_DELAY_MS + VAN_RUN_MS);
  });
});

describe('the counter while a van rides', () => {
  test('one Caïd in a van (pickup + drop-off runs) hides one from the count, not two', () => {
    expect(
      ridingCount([
        { kind: 'pickup', inside: false },
        { kind: 'drop', inside: false },
      ]),
    ).toBe(1);
    expect(ridingCount([{ kind: 'drop', inside: false }])).toBe(1);
    expect(ridingCount([{ kind: 'drop', inside: true }])).toBe(0);
    expect(ridingCount([])).toBe(0);
  });
});
