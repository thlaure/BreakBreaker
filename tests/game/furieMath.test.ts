import { describe, expect, test } from 'vitest';
import { FURIE_FADE_SEC, LAUNCH_EDGE_PX, LAUNCH_MS, auraAlpha, landingDistance, launchPose } from '../../src/game/render/furieMath';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import type { Launch } from '../../src/sim/types';

const right: Launch = { dir: { x: 1, y: 0 }, power: 300, spin: 3 };
const world = { width: 1536, height: 1536 };

describe('launched KO bodies', () => {
  test('ease-out travel, arc and spin: starts at the hit point, lands after LAUNCH_MS at `dist`, upright', () => {
    const from = { x: 100, y: 200 };
    const p0 = launchPose(from, right, 300, 0);
    expect(p0).toMatchObject({ x: 100, y: 200, lift: 0, angle: 0, t: 0 });
    const mid = launchPose(from, right, 300, LAUNCH_MS / 2);
    expect(mid.x - 100).toBeGreaterThan(150); // ease-out: more than half the way at half the time
    expect(mid.lift).toBeGreaterThan(20);
    const end = launchPose(from, right, 300, LAUNCH_MS * 2);
    expect(end).toMatchObject({ x: 400, y: 200, t: 1, scaleX: 1, scaleY: 1 });
    expect(end.lift).toBeCloseTo(0, 6);
    expect(end.angle).toBeCloseTo(3 * 360, 6);
    expect(launchPose(from, { ...right, spin: -2 }, 300, LAUNCH_MS).angle).toBeCloseTo(-720, 6);
  });

  test('a body never lands off the map', () => {
    const d = landingDistance({ x: 1500, y: 300 }, right, world, () => false);
    expect(1500 + d).toBeLessThanOrEqual(world.width - LAUNCH_EDGE_PX);
    const corner = landingDistance({ x: 40, y: 40 }, { dir: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, power: 400, spin: 2 }, world, () => false);
    expect(40 - corner * Math.SQRT1_2).toBeGreaterThanOrEqual(LAUNCH_EDGE_PX);
  });

  test('a body flies over walls but lands on the farthest free spot of its path', () => {
    const wall = (p: { x: number }) => p.x > 150 && p.x < 200;
    expect(landingDistance({ x: 100, y: 100 }, right, world, wall)).toBe(296);
    const end = (p: { x: number }) => p.x > 300;
    expect(landingDistance({ x: 100, y: 100 }, right, world, end)).toBe(200);
  });

  test('on the real map every launch from Paul’s spawn lands on a walkable tile inside the world', () => {
    const grid = new Grid(DISTRICT);
    const blocked = (p: { x: number; y: number }) => grid.circleBlocked(p, 6) || grid.isGroup(p);
    const from = DISTRICT.playerSpawn;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const l: Launch = { dir: { x: Math.cos(a), y: Math.sin(a) }, power: 420, spin: 2 };
      const d = landingDistance(from, l, world, blocked);
      const end = launchPose(from, l, d, LAUNCH_MS);
      expect(d === 0 || !blocked(end)).toBe(true);
      expect(end.x).toBeGreaterThanOrEqual(0);
      expect(end.y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('aura', () => {
  test('full until the last 2 s, then fading and blinking', () => {
    expect(auraAlpha(12, 0)).toBe(1);
    expect(auraAlpha(FURIE_FADE_SEC, 123)).toBe(1);
    const late = [0, 50, 100, 150, 200, 250, 300].map((ms) => auraAlpha(0.3, ms));
    expect(Math.max(...late)).toBeLessThan(1);
    expect(new Set(late).size).toBeGreaterThan(1);
    expect(auraAlpha(0, 0)).toBeGreaterThan(0);
  });
});
