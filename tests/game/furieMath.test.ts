import { describe, expect, test } from 'vitest';
import { FURIE_FADE_SEC, LAUNCH_EDGE_PX, LAUNCH_MS, SATELLITE_END_SCALE, SATELLITE_MS, SATELLITE_MS_REDUCED, SATELLITE_RISE_PX, auraAlpha, landingDistance, launchPose, satellitePose } from '../../src/game/render/furieMath';
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

describe('satellites (onde d’énergie)', () => {
  const beam: Launch = { dir: { x: 1, y: 0 }, power: 1500, spin: 8, kind: 'satellite' };
  const from = { x: 100, y: 200 };

  test('starts at the hit point, full size, no spin', () => {
    expect(satellitePose(from, beam, 0)).toMatchObject({ x: 100, y: 200, lift: 0, angle: 0, scale: 1, t: 0 });
  });

  test('ease-in then fast: less than a quarter of the way at half time, all of it at the end, off the map allowed', () => {
    const mid = satellitePose(from, beam, SATELLITE_MS / 2);
    expect(mid.x - 100).toBeLessThan(1500 / 4);
    expect(mid.x).toBeGreaterThan(100);
    const end = satellitePose(from, beam, SATELLITE_MS);
    expect(end.t).toBe(1);
    expect(end.x).toBeCloseTo(1600, 6); // beyond a 1536 px world: never clamped
    expect(end.lift).toBeCloseTo(SATELLITE_RISE_PX, 6);
    expect(end.angle).toBeCloseTo(8 * 360, 6);
    expect(end.scale).toBeCloseTo(SATELLITE_END_SCALE, 6);
    expect(satellitePose(from, beam, SATELLITE_MS * 3).t).toBe(1);
  });

  test('shrinks and climbs monotonically', () => {
    let prev = satellitePose(from, beam, 0);
    for (let ms = 100; ms <= SATELLITE_MS; ms += 100) {
      const p = satellitePose(from, beam, ms);
      expect(p.scale).toBeLessThan(prev.scale);
      expect(p.lift).toBeGreaterThan(prev.lift);
      expect(p.x).toBeGreaterThan(prev.x);
      prev = p;
    }
  });

  test('reduced motion: 0.5 s flight, no spin', () => {
    expect(SATELLITE_MS_REDUCED).toBe(500);
    const end = satellitePose(from, beam, SATELLITE_MS_REDUCED, true);
    expect(end.t).toBe(1);
    expect(end.angle).toBe(0);
    expect(satellitePose(from, beam, 250, true).angle).toBe(0);
  });
});
