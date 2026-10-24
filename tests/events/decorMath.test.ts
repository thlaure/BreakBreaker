import { describe, expect, test } from 'vitest';
import { DISTRICT } from '../../src/sim/map/district';
import { CONFIG } from '../../src/sim/config';
import { BAT_COUNT, GHOST_SPOTS, batPos, ghostBob, pumpkinSpots } from '../../src/events/halloween/decorMath';

const WORLD = DISTRICT.tiles * CONFIG.tile;

describe('halloween decor math', () => {
  test('two pumpkins in front of every building, on the map and not on top of each other', () => {
    const spots = pumpkinSpots(DISTRICT.buildings);
    expect(spots).toHaveLength(DISTRICT.buildings.length * 2);
    for (const s of spots) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(WORLD);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(WORLD);
    }
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++)
        expect(Math.hypot(spots[i]!.x - spots[j]!.x, spots[i]!.y - spots[j]!.y)).toBeGreaterThan(10);
  });

  test('ghost spots are on the map', () => {
    for (const g of GHOST_SPOTS) {
      expect(g.x).toBeGreaterThan(0);
      expect(g.x).toBeLessThan(WORLD);
      expect(g.y).toBeGreaterThan(0);
      expect(g.y).toBeLessThan(WORLD);
    }
  });

  test('bats fly in circles around their own centre, and hang still under reduced motion', () => {
    for (let k = 0; k < BAT_COUNT; k++) {
      const a = batPos(0, k, false);
      let far = 0;
      for (let t = 0; t <= 3000; t += 250) far = Math.max(far, Math.hypot(batPos(t, k, false).x - a.x, batPos(t, k, false).y - a.y));
      expect(far).toBeGreaterThan(20);
      expect(batPos(0, k, true)).toEqual(batPos(9000, k, true));
      for (const t of [0, 1500, 7000]) {
        const p = batPos(t, k, false);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(WORLD);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(WORLD);
      }
    }
  });

  test('ghosts bob by at most 3 px, out of step, and stay still under reduced motion', () => {
    for (let t = 0; t < 10_000; t += 250) {
      expect(Math.abs(ghostBob(t, 0, false))).toBeLessThanOrEqual(3);
      expect(ghostBob(t, 1, true)).toBe(0);
    }
    expect(ghostBob(1000, 0, false)).not.toBe(ghostBob(1000, 1, false));
  });
});
